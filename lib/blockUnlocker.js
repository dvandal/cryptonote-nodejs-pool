/* Stellite Nodejs Pool
 * Copyright StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
 * Copyright Dvandal    	<https://github.com/dvandal/cryptonote-nodejs-pool>
 * Copyright Fancoder   	<https://github.com/fancoder/cryptonote-universal-pool>
 * Copyright zone117x		<https://github.com/zone117x/node-cryptonote-pool>
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
 
var async = require('async');

var apiInterfaces = require('./apiInterfaces.js');

var utils = require('./utils.js');

var slushMiningEnabled = config.poolServer.slushMining && config.poolServer.slushMining.enabled;

// Initialize log system
var logSystem = 'unlocker';

require('./exceptionWriter.js')(logSystem);

/**
 * Run block unlocker
 **/
 
log('info', logSystem, 'Started');

function runInterval(){
    async.waterfall([

        // Get all block candidates in redis
        function(callback){
            redisClient.zrange(config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES', function(error, results){
                if (error){
                    log('error', logSystem, 'Error trying to get pending blocks from redis %j', [error]);
                    callback(true);
                    return;
                }
                if (results.length === 0){
                    log('info', logSystem, 'No blocks candidates in redis');
                    callback(true);
                    return;
                }

                var blocks = [];

                for (var i = 0; i < results.length; i += 2){
                    var parts = results[i].split(':');
                    blocks.push({
                        serialized: results[i],
                        height: parseInt(results[i + 1]),
                        hash: parts[0],
                        time: parts[1],
                        difficulty: parts[2],
                        shares: parts[3],
                        score: parts.length >= 5 ? parts[4] : parts[3]
                    });
                }

                callback(null, blocks);
            });
        },

        // Check if blocks are orphaned
        function(blocks, callback){
            async.filter(blocks, function(block, mapCback){
                var daemonType = "default";
                var blockHeight = block.height;
                apiInterfaces.rpcDaemon('getblockheaderbyheight', {height: blockHeight}, function(error, result){
                    if (error){
                        log('error', logSystem, 'Error with getblockheaderbyheight RPC request for block %s - %j', [block.serialized, error]);
                        block.unlocked = false;
                        mapCback();
                        return;
                    }
                    if (!result.block_header){
                        log('error', logSystem, 'Error with getblockheaderbyheight, no details returned for %s - %j', [block.serialized, result]);
                        block.unlocked = false;
                        mapCback();
                        return;
                    }
                    var blockHeader = result.block_header;
                    block.orphaned = blockHeader.hash === block.hash ? 0 : 1;
                    block.unlocked = blockHeader.depth >= config.blockUnlocker.depth;
                    block.reward = blockHeader.reward;
                    if (config.blockUnlocker.networkFee) {
                        var networkFeePercent = config.blockUnlocker.networkFee / 100;
                        block.reward = block.reward - (block.reward * networkFeePercent);
                    }
                    mapCback(block.unlocked);
                });
            }, function(unlockedBlocks){

                if (unlockedBlocks.length === 0){
                    log('info', logSystem, 'No pending blocks are unlocked yet (%d pending)', [blocks.length]);
                    callback(true);
                    return;
                }

                callback(null, unlockedBlocks)
            })
        },

        // Get worker shares for each unlocked block
        function(blocks, callback){

            var redisCommands = blocks.map(function(block){
                return ['hgetall', config.coin + ':scores:round' + block.height];
            });


            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting round shares from redis %j', [error]);
                    callback(true);
                    return;
                }
                for (var i = 0; i < replies.length; i++){
                    var workerScores = replies[i];
                    blocks[i].workerScores = workerScores;
                }
                callback(null, blocks);
            });
        },

        // Handle orphaned blocks
        function(blocks, callback){
            var orphanCommands = [];

            blocks.forEach(function(block){
                if (!block.orphaned) {
                	return;
                }

                orphanCommands.push(['del', config.coin + ':scores:round' + block.height]);
                orphanCommands.push(['del', config.coin + ':shares_actual:round' + block.height]);
                orphanCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized]);
                orphanCommands.push(['zadd', config.coin + ':blocks:matured', block.height, [
                    block.hash,
                    block.time,
                    block.difficulty,
                    block.shares,
                    block.orphaned
                ].join(':')]);

                if (block.workerScores && !slushMiningEnabled) {
                    var workerScores = block.workerScores;
                    Object.keys(workerScores).forEach(function (worker) {
                        orphanCommands.push(['hincrby', config.coin + ':scores:roundCurrent', worker, workerScores[worker]]);
                    });
                }

           
            });

            if (orphanCommands.length > 0){
                redisClient.multi(orphanCommands).exec(function(error, replies){
                    if (error){
                        log('error', logSystem, 'Error with cleaning up data in redis for orphan block(s) %j', [error]);
                        callback(true);
                        return;
                    }
                    callback(null, blocks);
                });
            }
            else{
                callback(null, blocks);
            }
        },

        // Handle unlocked blocks
        function(blocks, callback){
            var unlockedBlocksCommands = [];
            var payments = {};
            var totalBlocksUnlocked = 0;
            
            var feePercent = 0.00;

            if (Object.keys(global.config.contributions).length) {
                for(var wallet in global.config.contributions) {
                    feePercent += global.config.contributions[wallet].percent / 100;
                }
            }
            
            blocks.forEach(function(block){
                if (block.orphaned) return;
                totalBlocksUnlocked++;

                unlockedBlocksCommands.push(['del', config.coin + ':scores:round' + block.height]);
                unlockedBlocksCommands.push(['del', config.coin + ':shares_actual:round' + block.height]);
                unlockedBlocksCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized]);
                unlockedBlocksCommands.push(['zadd', config.coin + ':blocks:matured', block.height, [
                    block.hash,
                    block.time,
                    block.difficulty,
                    block.shares,
                    block.orphaned,
                    block.reward
                ].join(':')]);

                if (Object.keys(global.config.contributions).length) {
                    for(var wallet in global.config.contributions) {
                        var percent = global.config.contributions[wallet].percent / 100;
                        payments[wallet] = Math.round(block.reward * percent);
                        log('info', logSystem, 'Block %d %s to %s as %d percent of reward: %d', [
                        	block.height,
                        	global.config.contributions[wallet].desc || 'contributions', 
                        	wallet, percent, 
                        	payments[wallet]
                        ]);
                    }
                }
                
				
				var contReward =  Math.round(block.reward * feePercent);
                var reward = Math.round(block.reward - contReward);

                log('info', logSystem, 'Unlocked %d block with reward %d and contributions %d %f. Miners reward: %d', [block.height, block.reward, feePercent,contReward, reward]);

                if (block.workerScores) {
                    var totalScore = parseFloat(block.score);
                    Object.keys(block.workerScores).forEach(function (worker) {
                        var percent = block.workerScores[worker] / totalScore;
                        var workerReward = Math.round(reward * percent);
                        payments[worker] = (payments[worker] || 0) + workerReward;
                        log('info', logSystem, 'Block %d payment to %s for %d%% of total block score: %d', [block.height, worker, percent*100, payments[worker]]);
                    });
                }
            });


			var getDonationCommands = [];
            var donationWorkers = [];

            if (config.poolServer.donations && config.poolServer.donations.enabled) {
                if (!config.poolServer.donations.address) {
                    log('error', logSystem, 'Cannot unlock block: no donation address specified in configuration file');
                    callback(true);
                    return;
                }
                var donationAddress = config.poolServer.donations.address;
                for (var worker in payments) {
                    var amount = parseInt(payments[worker]);
                    if (amount <= 0){
                        delete payments[worker];
                        continue;
                    }

                    getDonationCommands.push(['hget', config.coin + ':workers:' + worker, 'donation_level']);
                    donationWorkers.push(worker);
                }

                redisClient.multi(getDonationCommands).exec(function(error, replies) {
                    if (error) {
                        log('error', logSystem, 'Error retrieving worker donation levels: %j', [error]);
                        callback(true);
                        return;
                    }
                    var fallback = 0;
                    var donate = {};
                    for (var i in replies) {
                        var worker = donationWorkers[i];
                        var level = parseFloat(replies[i]);
                        if (isNaN(level) || level < 0 || level > 100) {
                            level = fallback;
                        }
                       
                        // The donation level is expressed as a pre-pool-fee percentage, but we've
                        // already removed the pool fee, so adjust (e.g. if the pool fee is 0.5% and
                        // donation level is 9.5% we want the overall reward reduced by exactly 10%
                        // not .095*.995+.005 = slightly less than 10%.
                    	if (feePercent > 0)
                            level /= (1 - feePercent);
                        if (level > 100) {
                        	level = 100;
                        } else if (level < 0) {
                        	level = 0;
                        }

                        var donation = Math.floor(payments[worker] * (level / 100.));
                        payments[worker] -= donation;
                        if (donationAddress in payments){
                            payments[donationAddress] += donation;
                        } else{
                            payments[donationAddress] = donation;
                        }
                        if(donation > 0) {
                        	log('info', logSystem, '%s is donating %d to %s', [worker, donation, donationAddress]);
                        }
                        donate[worker] = donation;
                    }
                    
                    for (var worker in payments) {
	                    var amount = parseInt(payments[worker]);
	                    unlockedBlocksCommands.push(['hincrby', config.coin + ':workers:' + worker, 'balance', amount]);
                        if (worker in donate && donate[worker] > 0){
                            unlockedBlocksCommands.push(['hincrby', config.coin + ':workers:' + worker, 'donations', donate[worker]]);
                        }
                    }

                    if (unlockedBlocksCommands.length === 0){
                        log('info', logSystem, 'No unlocked blocks yet (%d pending)', [blocks.length]);
                        callback(true);
                        return;
                    }

                    redisClient.multi(unlockedBlocksCommands).exec(function(error, replies){
                        if (error){
                            log('error', logSystem, 'Error with unlocking blocks %j', [error]);
                            callback(true);
                            return;
                        }
                        log('info', logSystem, 'Unlocked %d blocks and update balances for %d workers', [totalBlocksUnlocked, Object.keys(payments).length]);
                        callback(null);
                    });
                });
            } else {
                for (var worker in payments) {
                    var amount = parseInt(payments[worker]);
                    unlockedBlocksCommands.push(['hincrby', config.coin + ':workers:' + worker, 'balance', amount]);
                }

                if (unlockedBlocksCommands.length === 0){
                    log('info', logSystem, 'No unlocked blocks yet (%d pending)', [blocks.length]);
                    callback(true);
                    return;
                }

                redisClient.multi(unlockedBlocksCommands).exec(function(error, replies){
                    if (error){
                        log('error', logSystem, 'Error with unlocking blocks %j', [error]);
                        callback(true);
                        return;
                    }
                    log('info', logSystem, 'Unlocked %d blocks and update balances for %d workers', [totalBlocksUnlocked, Object.keys(payments).length]);
                    callback(null);
                });
            }
        }
    ], function(error, result){
        setTimeout(runInterval, config.blockUnlocker.interval * 1000);
    })
}

runInterval();

