/* Stellite Nodejs Pool
 * Contributors:
 * StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
 * Dvandal    	<https://github.com/dvandal/cryptonote-nodejs-pool>
 * Fancoder   	<https://github.com/fancoder/cryptonote-universal-pool>
 * zone117x		<https://github.com/zone117x/node-cryptonote-pool>
 * jagerman		<https://github.com/jagerman/node-cryptonote-pool>
 
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

var fs = require('fs');
var http = require('http');
var https = require('https');
var url = require("url");
var async = require('async');

var apiInterfaces = require('./apiInterfaces.js');
var authSid = Math.round(Math.random() * 10000000000) + '' + Math.round(Math.random() * 10000000000);

var charts = require('./charts.js');

var market = require('./market.js');
const utils = require('./utils.js');
const os = require('os');

// Initialize log system
const logSystem = 'api';
require('./exceptionWriter.js')(logSystem);

// Data storage variables used for live statistics
var currentStats = {};
var minerStats = {};
var minersHashrate = {};
var pendingBlockRewards = {};
var liveConnections = {};
var addressConnections = {};


var getContributionOrDonationForConfig = function(fromConfig){
	var output = {};
	for(var wallet in fromConfig){
		var data = fromConfig[wallet];
		output[data.desc] = {
			percent:data.percent
		};
		if(!data.hidden){
			output[data.desc].wallet = wallet;
		}
	}
	return output;
};
const getPoolConfigs = {

    ports: getPublicPorts(config.poolServer.ports),
    hashrateWindow: config.api.hashrateWindow,
    donations:getContributionOrDonationForConfig(global.config.donations),
	contributions:getContributionOrDonationForConfig(global.config.contributions),
    networkFee: config.blockUnlocker.networkFee || 0,
    coin: config.coin,
    coinUnits: config.coinUnits,
    coinDecimalPlaces: config.coinDecimalPlaces || 4, // config.coinUnits.toString().length - 1,
    coinDifficultyTarget: config.coinDifficultyTarget,
    symbol: config.symbol,
    depth: config.blockUnlocker.depth,
    version: version,
    paymentsInterval: config.payments.interval,
    minPaymentThreshold: config.payments.minPayment,
    minPaymentIntegratedAddressThreshold: config.payments.minPaymentIntegratedAddress || config.payments.minPayment,
    maxPaymentThreshold: config.payments.maxPayment || null,
    transferFee: config.payments.transferFee,
    denominationUnit: config.payments.denomination,
    slushMiningEnabled: config.poolServer.slushMining.enabled,
    weight: config.poolServer.slushMining.weight,
    priceSource: config.prices ? config.prices.source : 'tradeorge',
    priceCurrency: config.prices ? config.prices.currency : 'USD',
    paymentIdSeparator: config.poolServer.paymentId,
    fixedDiffEnabled: config.poolServer.fixedDiff.enabled,
    fixedDiffSeparator: config.poolServer.fixedDiff.addressSeparator,

    blocksChartEnabled: (config.charts.blocks && config.charts.blocks.enabled),
    blocksChartDays: config.charts.blocks && config.charts.blocks.days ? config.charts.blocks.days : null,
};


/**
 * Handle server requests
 **/
function handleServerRequest(request, response) {
    var urlParts = url.parse(request.url, true);

    switch(urlParts.pathname){
        // Pool statistics
        case '/stats':
            handleStats(urlParts, request, response);
            break;
        case '/live_stats':
            response.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'Connection': 'keep-alive'
            });

            var address = urlParts.query.address ? urlParts.query.address : 'undefined';
            var uid = Math.random().toString();
            var key = address + ':' + uid;

            response.on("finish", function() {
                delete liveConnections[key];
            });
            response.on("close", function() {
                delete liveConnections[key];
            });

            liveConnections[key] = response;
            break;

        // Worker statistics
        case '/stats_address':
            handleMinerStats(urlParts, response);
            break;

        // Payments
        case '/get_payments':
            handleGetPayments(urlParts, response);
            break;

        // Blocks
        case '/get_blocks':
            handleGetBlocks(urlParts, response);
            break;

        // Get market prices
        case '/get_market':
	    handleGetMarket(urlParts, response);
	    break;

        // Top 10 miners
        case '/get_top10':
        	handleTops(response);
        	break;
        case '/get_top10miners':
            handleTopMiners(response);
            break;
        case '/get_top10donators':
            handleTopDonators(response);
            break;

        // Miner settings
        case '/get_miner_payout_level':
            handleGetMinerPayoutLevel(urlParts, response);
            break;
        case '/set_miner_payout_level':
            handleSetMinerPayoutLevel(urlParts, response);
            break;
        
        // Miners/workers hashrate (used for charts)
        case '/miners_hashrate':
            if (!authorize(request, response)) {
                return;
            }
            handleGetMinersHashrate(response);
            break;
        case '/workers_hashrate':
            if (!authorize(request, response)) {
                return;
            }
            handleGetWorkersHashrate(response);
            break;

        // Pool Administration
        case '/admin_stats':
            if (!authorize(request, response))
                return;
            handleAdminStats(response);
            break;
        case '/admin_monitoring':
            if (!authorize(request, response)) {
                return;
            }
            handleAdminMonitoring(response);
            break;
        case '/admin_log':
            if (!authorize(request, response)) {
                return;
            }
            handleAdminLog(urlParts, response);
            break;
        case '/admin_users':
            if (!authorize(request, response)) {
                return;
            }
            handleAdminUsers(response);
            break;
        case '/admin_ports':
            if (!authorize(request, response)) {
                return;
            }
            handleAdminPorts(response);
            break;

        // Default response
        default:
            response.writeHead(404, {
                'Access-Control-Allow-Origin': '*'
            });
            response.end('Invalid API call');
            break;
    }
}


function sendData(response,data){
	
	var reply = JSON.stringify(data);

    response.writeHead("200", {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reply, 'utf8')
    });
    return response.end(reply);	
	
};

/**
 * Collect statistics data
 **/
function collectStats(){
    var startTime = Date.now();
    var redisFinished;
    var daemonFinished;

    var redisCommands = [
        ['zremrangebyscore', config.coin + ':hashrate', '-inf', ''],
        ['zrange', config.coin + ':hashrate', 0, -1],
        ['hgetall', config.coin + ':stats'],
        ['zrange', config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES'],
        ['zrevrange', config.coin + ':blocks:matured', 0, config.api.blocks - 1, 'WITHSCORES'],
        ['hgetall', config.coin + ':scores:roundCurrent'],
        ['hgetall', config.coin + ':stats'],
        ['zcard', config.coin + ':blocks:matured'],
        ['zrevrange', config.coin + ':payments:all', 0, config.api.payments - 1, 'WITHSCORES'],
        ['zcard', config.coin + ':payments:all'],
        ['keys', config.coin + ':payments:*'],
        ['hgetall', config.coin + ':shares_actual:roundCurrent'],
    ];
    
    var haveDonations = false;
    if (getPoolConfigs.donations && getPoolConfigs.donations.enabled && getPoolConfigs.donations.address) {
        haveDonations = true;
        redisCommands.push(['hmget', config.coin + ':workers:' + getPoolConfigs.donations.address, 'balance', 'paid']);
    }

    var windowTime = (((Date.now() / 1000) - config.api.hashrateWindow) | 0).toString();
    redisCommands[0][3] = '(' + windowTime;

    async.parallel({
    	config: function(callback){
        	callback(null,getPoolConfigs);
        },
        system: function(callback){
          var os_load = os.loadavg();
          var num_cores = os.cpus().length;
          callback(null, {
            load: os_load,
            number_cores: num_cores
          });
        },
        pool: function(callback){
            redisClient.multi(redisCommands).exec(function(error, replies){
                redisFinished = Date.now();
                var dateNowSeconds = Date.now() / 1000 | 0;

                if (error){
                    log('error', logSystem, 'Error getting redis data %j', [error]);
                    callback(true);
                    return;
                }
				
                var data = {
                    stats: replies[2],
                    blocks: replies[3].concat(replies[4]),
                    totalBlocks: parseInt(replies[7]) + (replies[3].length / 2),
                    totalDiff: 0,
                    totalShares: 0,
                    payments: replies[8],
                    totalPayments: parseInt(replies[9]),
                    totalDonations: haveDonations ? parseInt(replies[12][0]) + parseInt(replies[12][1]) : 0,
                    totalMinersPaid: replies[10] && replies[10].length > 0 ? replies[10].length - 1 : 0,
                    miners: 0,
                    workers: 0,
                    hashrate: 0,
                    roundScore: 0,
                    roundHashes: 0
                };

                for (var i = 0; i < data.blocks.length; i++){
                    var block = data.blocks[i].split(':');
                    if (block[5]) {
                        var blockShares = parseInt(block[3]);
                        var blockDiff = parseInt(block[2]);
                        data.totalDiff += blockDiff;
                        data.totalShares += blockShares;
                    }
                }

                minerStats = {};
                minersHashrate = {};
                var hashrates = replies[1];
                for (var i = 0; i < hashrates.length; i++){
                    var hashParts = hashrates[i].split(':');
                    minersHashrate[hashParts[1]] = (minersHashrate[hashParts[1]] || 0) + parseInt(hashParts[0]);
                }
        
                var totalShares = 0;

                for (var miner in minersHashrate){
                    if (miner.indexOf('~') !== -1) {
                        data.workers ++;
                    } else {
                        totalShares += minersHashrate[miner];
                        data.miners ++;
                    }
            
                    minersHashrate[miner] = Math.round(minersHashrate[miner] / config.api.hashrateWindow);

                    if (!minerStats[miner]) { minerStats[miner] = {}; }
                    minerStats[miner]['hashrate'] = minersHashrate[miner];
                    
                }

                data.hashrate = Math.round(totalShares / config.api.hashrateWindow);

                data.roundScore = 0;

                if (replies[5]){
                    for (var miner in replies[5]){
                        var roundScore = parseFloat(replies[5][miner]);
            
                        data.roundScore += roundScore;

                        if (!minerStats[miner]) { minerStats[miner] = {}; }
                        minerStats[miner]['roundScore'] = roundScore;
                    }
                }

                data.roundHashes = 0;

                if (replies[11]){
                    for (var miner in replies[11]){
                        var roundHashes = parseInt(replies[11][miner])
                        data.roundHashes += roundHashes;

                        if (!minerStats[miner]) { minerStats[miner] = {}; }
                        minerStats[miner]['roundHashes'] = roundHashes;
                        
                    }
                }
				var currentRoundMiners = [];

				for(var miner in minerStats){
					if (miner.indexOf('~') > -1) {
                        continue;
                    }
					var minerStat = minerStats[miner];
					currentRoundMiners.push({
						miner:miner.substring(0,7)+'...'+miner.substring(miner.length-7),
						roundHashes:minerStat.roundHashes || 0,
						roundScore:minerStat.roundScore || 0,
						hashrate:minerStat.hashrate || 0
					});
				}
				
				data.currentRoundMiners = currentRoundMiners.sort(function(a,b){
					var v1 = a.roundHashes ? parseInt(a.roundHashes) : 0;
					var v2 = b.roundHashes ? parseInt(b.roundHashes) : 0;
					if (v1 > v2) return -1;
					if (v1 < v2) return 1;
					return 0;	
				});
                if (replies[6]) {
                    data.lastBlockFound = replies[6].lastBlockFound;
                }

                callback(null, data);
            });
        },
        lastblock: function(callback){
            getLastBlockData(function(error, data) {
                daemonFinished = Date.now();
                callback(error, data);
            });
        },
        network: function(callback){
            getNetworkData(function(error, data) {
                daemonFinished = Date.now();
                callback(error, data);
            });
        },
        charts: function (callback) {
            // Get enabled charts data
            charts.getPoolChartsData(function(error, data) {
                if (error) {
                    callback(error, data);
                    return;
                }

                // Blocks chart
                if (!config.charts.blocks || !config.charts.blocks.enabled || !config.charts.blocks.days) {
                    callback(error, data);
                    return;
                }

                var chartDays = config.charts.blocks.days;

                var beginAtTimestamp = (Date.now() / 1000) - (chartDays * 86400);
                var beginAtDate = new Date(beginAtTimestamp * 1000);
                if (chartDays > 1) {
                    beginAtDate = new Date(beginAtDate.getFullYear(), beginAtDate.getMonth(), beginAtDate.getDate(), 0, 0, 0, 0);
                    beginAtTimestamp = beginAtDate / 1000 | 0;
                }

                var blocksCount = {};
                if (chartDays === 1) {
                    for (var h = 0; h <= 24; h++) {
                        var date = utils.dateFormat(new Date((beginAtTimestamp + (h * 60 * 60)) * 1000), 'yyyy-mm-dd HH:00');
                        blocksCount[date] = 0;
                    }
                } else {
                    for (var d = 0; d <= chartDays; d++) {
                        var date = utils.dateFormat(new Date((beginAtTimestamp + (d * 86400)) * 1000), 'yyyy-mm-dd');
                        blocksCount[date] = 0;
                    }
                }

                redisClient.zrevrange(config.coin + ':blocks:matured', 0, -1, 'WITHSCORES', function(err, result) {
                    for (var i = 0; i < result.length; i++){
                        var block = result[i].split(':');
                        if (block[5]) {
                            var blockTimestamp = block[1];
                            if (blockTimestamp < beginAtTimestamp) {
                                continue;
                            }
                            var date = utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd');
                            if (chartDays === 1) utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd HH:00');
                            if (!blocksCount[date]) blocksCount[date] = 0;
                            blocksCount[date] ++;
                        }
                    }
                    data.blocks = blocksCount;
                    callback(error, data);
                });
            });
        }
    }, function(error, results){
        // log('info', logSystem, 'Stat collection finished: %d ms redis, %d ms daemon', [redisFinished - startTime, daemonFinished - startTime]);

        if (error){
            log('error', logSystem, 'Error collecting all stats');
        }
        else{
            currentStats = results;
            broadcastLiveStats();
        }

        setTimeout(collectStats, config.api.updateInterval * 1000);
    });

}

/**
 * Get Network data
 **/
function getNetworkData(callback) {
    
    // Try get_info RPC method first if available (not all coins support it)
    
    apiInterfaces.rpcDaemon('get_info', {}, function(error, reply){
        if (error) {
            log('error', logSystem, 'Error getting network data %j', [error]);
            return;
        } 
        
        
        callback(null, {
            difficulty: reply.difficulty,
            height: reply.height
        });
        
    });
    
}

/**
 * Get Last Block data
 **/
function getLastBlockData(callback) {
    apiInterfaces.rpcDaemon('getlastblockheader', {}, function(error, reply){
       if (error){
           log('error', logSystem, 'Error getting last block data %j', [error]);
           callback(true);
           return;
       }
       
       var blockHeader = reply.block_header;
       callback(null, {
            difficulty: blockHeader.difficulty,
            height: blockHeader.height,
            timestamp: blockHeader.timestamp,
            reward: blockHeader.reward,
            hash:  blockHeader.hash
        });
    });
}

/**
 * Broadcast live statistics
 **/
function broadcastLiveStats(){
    // log('info', logSystem, 'Broadcasting to %d visitors and %d address lookups', [Object.keys(liveConnections).length, Object.keys(addressConnections).length]);

    // Live statistics
    var processAddresses = {};
    for (var key in liveConnections){
        var addrOffset = key.indexOf(':');
        var address = key.substr(0, addrOffset);
        if (!processAddresses[address]) processAddresses[address] = [];
        processAddresses[address].push(liveConnections[key]);
    }
    
    for (var address in processAddresses) {
        var data = currentStats;

        data.miner = {};
        if (address && minerStats[address]){
            data.miner = minerStats[address];
        }

        var destinations = processAddresses[address];
        sendLiveStats(data, destinations);
    }

    // Workers Statistics
    var processAddresses = {};
    for (var key in addressConnections){
        var addrOffset = key.indexOf(':');
        var address = key.substr(0, addrOffset);
        if (!processAddresses[address]) processAddresses[address] = [];
        processAddresses[address].push(addressConnections[key]);
    }
    
    for (var address in processAddresses) {
        broadcastWorkerStats(address, processAddresses[address]);
    }
}

/**
 * Takes a chart data JSON string and uses it to compute the average over the past hour, 6 hours,
 * and 24 hours.  Returns [AVG1, AVG6, AVG24].
 **/
function extractAverageHashrates(chartdata) {
    var now = new Date() / 1000 | 0;

    var sums = [0, 0, 0]; // 1h, 6h, 24h
    var counts = [0, 0, 0];

    var sets = JSON.parse(chartdata); // [time, avgValue, updateCount]
    for (var j in sets) {
        var hr = sets[j][1];
        if (now - sets[j][0] <=  1*60*60) { sums[0] += hr; counts[0]++; }
        if (now - sets[j][0] <=  6*60*60) { sums[1] += hr; counts[1]++; }
        if (now - sets[j][0] <= 24*60*60) { sums[2] += hr; counts[2]++; }
    }

    return [sums[0] * 1.0 / (counts[0] || 1), sums[1] * 1.0 / (counts[1] || 1), sums[2] * 1.0 / (counts[2] || 1)];
}

/**
 * Obtains worker stats and invokes the given callback with them.
 */
function collectWorkerStats(address, statsCallback) {
    async.waterfall([

        // Get all pending blocks (to find unconfirmed rewards)
        function(callback){
            redisClient.zrevrange(config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES', function(error, results){
                if (error) {
                    statsCallback({error: 'Not found'});
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

        function(blocks, callback) {
            async.filter(blocks, function(block, mapCback){
                var blockHeight = block.height;
                if (blockHeight in pendingBlockRewards) {
                    block.reward = pendingBlockRewards[blockHeight];
                    mapCback(true);
                }else {
                    apiInterfaces.rpcDaemon('getblockheaderbyheight', {height: blockHeight}, function(error, result){
                        if (error){
                            log('error', logSystem, 'Error with getblockheaderbyheight RPC request for block %s - %j', [block.serialized, error]);
                            mapCback();
                        } else if (!result.block_header){
                            log('error', logSystem, 'Error with getblockheaderbyheight, no details returned for %s - %j', [block.serialized, result]);
                            mapCback();
                        } else {
                            block.reward = result.block_header.reward;
                            if (config.blockUnlocker.networkFee) {
                                var networkFeePercent = config.blockUnlocker.networkFee / 100;
                                block.reward = block.reward - (block.reward * networkFeePercent);
                            }
                            pendingBlockRewards[blockHeight] = block.reward;
                            mapCback(true);
                        }
                    });
                }
            }, function(pending) {
                if (pending.length === 0) {
                    callback(null, null);
                } else {
                    var redisCommands = [];
                    for (var i in pending) {
                        redisCommands.push(['hget', config.coin + ':shares_actual:round' + pending[i].height, address]);
                        redisCommands.push(['hget', config.coin + ':scores:round' + pending[i].height, address]);
                    }
                    redisClient.multi(redisCommands).exec(function(error, replies) {
                        if (error) {
                            log('error', logSystem, 'Error retrieving worker shares/score: %j', [error]);
                            callback(null, null); // Ignore the error and carry on
                            return;
                        }
                        var feePercent = 0.0;
                        if (Object.keys(global.config.contributions).length) {
                            for (var wallet in contributions){
                            	feePercent += contributions[wallet].percent / 100;
                            } 
                        }
                        var removeFees = 1 - feePercent;

                        var pending_scores = [];
                        for (var i = 0; i < replies.length; i += 2) {
                            var block = pending[i >> 1];
                            var myScore = parseFloat(replies[i+1]);
                            if (!myScore) {
                            	continue;
                            }
                            var totalScore = parseFloat(block.score);

                            var reward = Math.floor(block.reward * removeFees * myScore / totalScore);
                            pending_scores.push({
                                height: block.height,
                                hash: block.hash,
                                time: block.time,
                                difficulty: block.difficulty,
                                totalShares: parseFloat(block.shares),
                                shares: parseFloat(replies[i]),
                                totalScore: totalScore,
                                score: myScore,
                                reward: reward,
                                blockReward: block.reward
                            });
                        }

                        callback(null, pending_scores);
                    });
                }
            });
        },

        function(pending, callback) {
            var redisCommands = [
                ['hgetall', config.coin + ':workers:' + address],
                ['zrevrange', config.coin + ':payments:' + address, 0, config.api.payments - 1, 'WITHSCORES'],
                ['keys', config.coin + ':unique_workers:' + address + '~*'],
                ['get', config.coin + ':charts:hashrate:' + address],
                ['zrevrange', config.coin + ':worker_unlocked:' + address, 0, -1, 'WITHSCORES']
            ];
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error || !replies || !replies[0]){
                    statsCallback({
                    	error: 'Not found'
                    });
                    return;
                }

                var stats = replies[0];
                stats.hashrate = minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address]['hashrate'] : 0;
                stats.roundScore = minerStats[address] && minerStats[address]['roundScore'] ? minerStats[address]['roundScore'] : 0;
                stats.roundHashes = minerStats[address] && minerStats[address]['roundHashes'] ? minerStats[address]['roundHashes'] : 0;
                stats.poolRoundScore = currentStats.pool.roundScore;
                stats.poolRoundHashes = currentStats.pool.roundHashes;
                stats.networkHeight = currentStats.network.height;
                if (replies[3]) {
                    var hr_avg = extractAverageHashrates(replies[3]);
                    stats.hashrate_1h  = hr_avg[0];
                    stats.hashrate_6h  = hr_avg[1];
                    stats.hashrate_24h = hr_avg[2];
                }

                var paymentsData = replies[1];

                var payments_24h = 0, payments_7d = 0;
                var now = Math.floor(Date.now() / 1000);
                var then_24h = now - 86400, then_7d = now - 7*86400;
                var need_payments_to;
                for (var p=0; p<paymentsData.length; p += 2) {
                    if (paymentsData[p + 1] < then_7d) {
                        need_payments_to = null;
                        break;
                    }
                    var paid = parseInt(paymentsData[p].split(':')[1]);
                    if (paymentsData[p + 1] >= then_24h){
                        payments_24h += paid;
                    }
                    payments_7d += paid;
                }
                if (need_payments_to === undefined && paymentsData.length == 2*config.api.payments) {
                    // Ran off the end before getting to a week; we need to fetch more payment info
                    need_payments_to = paymentsData[paymentsData.length-1] - 1;
                }

                var unlockedData = replies[4];

                var workersData = [];
                for (var j=0; j<replies[2].length; j++) {
                    var key = replies[2][j];
                    var keyParts = key.split(':');
                    var miner = keyParts[2];
                    if (miner.indexOf('~') !== -1) {
                        var workerName = miner.substr(miner.indexOf('~')+1, miner.length);
                        var workerData = {
                            name: workerName,
                            hashrate: minerStats[miner] && minerStats[miner]['hashrate'] ? minerStats[miner]['hashrate'] : 0
                        };
                        workersData.push(workerData);
                    }
                }

                charts.getUserChartsData(address, paymentsData, function(error, chartsData) {
                    var redisCommands = [];
                    for (var i in workersData){
                        redisCommands.push(['hgetall', config.coin + ':unique_workers:' + address + '~' + workersData[i].name]);
                        redisCommands.push(['get', config.coin + ':charts:worker_hashrate:' + address + '~' + workersData[i].name]);
                    }
                    if (need_payments_to) {
                        redisCommands.push(['zrangebyscore', config.coin + ':payments:' + address, then_7d, need_payments_to, 'WITHSCORES']);
                    }

                    redisClient.multi(redisCommands).exec(function(error, replies){
                        for (var i in workersData) {
                            var wi = 2*i;
                            var hi = wi + 1
                            if (replies[wi]) {
                                workersData[i].lastShare = replies[wi]['lastShare'] ? parseInt(replies[wi]['lastShare']) : 0;
                                workersData[i].hashes = replies[wi]['hashes'] ? parseInt(replies[wi]['hashes']) : 0;
                            }
                            if (replies[hi]) {
                                var avgs = extractAverageHashrates(replies[hi]);
                                workersData[i]['hashrate_1h']  = avgs[0];
                                workersData[i]['hashrate_6h']  = avgs[1];
                                workersData[i]['hashrate_24h']  = avgs[2];
                            }
                        }

                        if (need_payments_to) {
                            var extra_payments = replies[replies.length-1];
                            for (var p=0; p<extra_payments.length; p += 2) {
                                var paid = parseInt(extra_payments[p].split(':')[1]);
                                if (extra_payments[p + 1] >= then_24h)
                                    payments_24h += paid;
                                payments_7d += paid;
                            }
                        }
                        stats['payments_24h'] = payments_24h;
                        stats['payments_7d'] = payments_7d;

                        statsCallback({
                            stats: stats,
                            payments: paymentsData,
                            charts: chartsData,
                            workers: workersData,
                            unlocked: unlockedData,
                            unconfirmed: pending
                        });
                    });
                });
            });
        }
    ]);
}

/**
 * Broadcast worker statistics
 **/
function broadcastWorkerStats(address, destinations) {
    collectWorkerStats(address, function(data) { sendLiveStats(data, destinations); });
}
/**
 * Send live statistics to specified destinations
 **/
function sendLiveStats(data, destinations){
    if (!destinations) return ;

    var dataJSON = JSON.stringify(data);
    for (var i in destinations) {
        destinations[i].end(dataJSON);
    }
}

/**
 * Return pool statistics
 **/
function handleStats(urlParts, request, response){
    var data = currentStats;

    data.miner = {};
    var address = urlParts.query.address;
    if (address && minerStats[address]) {
        data.miner = minerStats[address];
    }

    sendData(response,data);
}

/**
 * Return miner (worker) statistics
 **/
function handleMinerStats(urlParts, response){
    var address = urlParts.query.address;
    var longpoll = (urlParts.query.longpoll === 'true');
    
    if (longpoll){
        response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        });
        
        redisClient.exists(config.coin + ':workers:' + address, function(error, result){
            if (!result){
                response.end(JSON.stringify({error: 'Not found'}));
                return;
            }
        
            var address = urlParts.query.address;
            var uid = Math.random().toString();
            var key = address + ':' + uid;
        
            response.on("finish", function() {
                delete addressConnections[key];
            });
            response.on("close", function() {
                delete addressConnections[key];
            });

            addressConnections[key] = response;
        });
    } else{
        redisClient.multi([
            ['hgetall', config.coin + ':workers:' + address],
            ['zrevrange', config.coin + ':payments:' + address, 0, config.api.payments - 1, 'WITHSCORES'],
            ['keys', config.coin + ':unique_workers:' + address + '~*'],
            ['get', config.coin + ':charts:hashrate:' + address]
        ]).exec(function(error, replies){
            if (error || !replies[0]){
               return  sendData(response,{error: 'Not found'});
            }
        
            var stats = replies[0];
            stats.hashrate = minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address]['hashrate'] : 0;
            stats.roundScore = minerStats[address] && minerStats[address]['roundScore'] ? minerStats[address]['roundScore'] : 0;
            stats.roundHashes = minerStats[address] && minerStats[address]['roundHashes'] ? minerStats[address]['roundHashes'] : 0;
            if (replies[3]) {
                var hr_avg = extractAverageHashrates(replies[3]);
                stats.hashrate_1h  = hr_avg[0];
                stats.hashrate_6h  = hr_avg[1];
                stats.hashrate_24h = hr_avg[2];
            }

            var paymentsData = replies[1];

            var workersData = [];
            for (var i=0; i<replies[2].length; i++) {
                var key = replies[2][i];
                var keyParts = key.split(':');
                var miner = keyParts[2];
                if (miner.indexOf('~') !== -1) {
                    var workerName = miner.substr(miner.indexOf('~')+1, miner.length);
                    var workerData = {
                        name: workerName,
                        hashrate: minerStats[miner] && minerStats[miner]['hashrate'] ? minerStats[miner]['hashrate'] : 0
                    };
                    workersData.push(workerData);
                }
            }

            charts.getUserChartsData(address, paymentsData, function(error, chartsData) {
                var redisCommands = [];
                for (var i in workersData){
                    redisCommands.push(['hgetall', config.coin + ':unique_workers:' + address + '~' + workersData[i].name]);
                    redisCommands.push(['get', config.coin + ':charts:worker_hashrate:' + address + '~' + workersData[i].name]);
                }
                redisClient.multi(redisCommands).exec(function(error, replies){
                    for (var i in workersData){
                        var wi = 2*i;
                        var hi = wi + 1
                        if (replies[wi]) {
                            workersData[i].lastShare = replies[wi]['lastShare'] ? parseInt(replies[wi]['lastShare']) : 0;
                            workersData[i].hashes = replies[wi]['hashes'] ? parseInt(replies[wi]['hashes']) : 0;
                        }
                        if (replies[hi]) {
                            var avgs = extractAverageHashrates(replies[hi]);
                            workersData[i]['hashrate_1h']  = avgs[0];
                            workersData[i]['hashrate_6h']  = avgs[1];
                            workersData[i]['hashrate_24h']  = avgs[2];
                        }
                    }
            
                    var data = {
                        stats: stats,
                        payments: paymentsData,
                        charts: chartsData,
                        workers: workersData
                    }

					sendData(response,data);
                    
                });
            });
        });
    }
}

/**
 * Return payments history
 **/
function handleGetPayments(urlParts, response){
    var paymentKey = ':payments:all';

    if (urlParts.query.address)
        paymentKey = ':payments:' + urlParts.query.address;

    redisClient.zrevrangebyscore(
            config.coin + paymentKey,
            '(' + urlParts.query.time,
            '-inf',
            'WITHSCORES',
            'LIMIT',
            0,
            config.api.payments,
        function(err, result){
            
            sendData(response,(err) ? {error: 'Query failed'} : result);
        }
    )
}

/**
 * Return blocks data
 **/
function handleGetBlocks(urlParts, response){
    redisClient.zrevrangebyscore(
            config.coin + ':blocks:matured',
            '(' + urlParts.query.height,
            '-inf',
            'WITHSCORES',
            'LIMIT',
            0,
            config.api.blocks,
        function(err, result){

        sendData(response,(err) ? {error: 'Query failed'} : result);

    });
}

/**
 * Get market exchange prices
 **/
function handleGetMarket(urlParts, response){
    var tickers = urlParts.query["tickers[]"] || urlParts.query.tickers;
    if (!tickers || tickers === undefined) {
        sendData(response,{error: 'No tickers specified.'});
        return;
    }

    var exchange = urlParts.query.exchange || config.prices.source;
    if (!exchange || exchange === undefined) {
        sendData(response,{error: 'No exchange specified.'});
        return;
    }

    // Get market prices
    market.get(exchange, tickers, function(data) {
        sendData(response,data);
    });
}

/**
 * Return top 10 miners
 **/
const topMinersCache = {
	donate:{},
	miner:{}
};
function _handleTops(comparator,fn) {
    if (!comparator) {
    	comparator = compareTopMiners;
    }
    
    var limit = 10;
	
    async.waterfall([
        function(callback) {
            redisClient.keys(config.coin + ':workers:*', callback);
        },
        function(workerKeys, callback) {
            var redisCommands = workerKeys.map(function(k) {
                return ['hmget', k, 'lastShare', 'hashes', 'donation_level', 'donations', 'blocksFound'];
            });
			
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                var minersData = [];
                for (var i in redisData) {
                    var keyParts = workerKeys[i].split(':');
                    var address = keyParts[keyParts.length-1];
                    var data = redisData[i];
                    minersData.push({
                        miner: address.substring(0,7)+'...'+address.substring(address.length-7),
                        hashrate: minersHashrate[address] && minerStats[address]['hashrate'] ? minersHashrate[address] : 0,
                        lastShare: data[0],
                        hashes: data[1],
                        donationLevel: data[2],
                        donations: data[3],
                        blocksFound: data[4]
                    });
                }
                callback(null, minersData);
            });
        }
    ], function(error, data) {
        if(error) {
            response.end(JSON.stringify({error: 'Error collecting top 10 miners stats'}));
            return;
        }

        data = comparator(data,limit);
		if(comparator === compareTopMiners){
			topMinersCache.miner = data;
    	}else{
			topMinersCache.donate = data;
    	}
    	
    	
    	setTimeout(function(){
    		_handleTops(comparator);
    	},500);
    });
}


function compareTopMiners(data, limit) {
	limit = limit || 10;
	
	data.sort(function(a,b){
		var v1 = a.hashrate ? parseInt(a.hashrate) : 0;
	    var v2 = b.hashrate ? parseInt(b.hashrate) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});
	// data = ;
        
	// data.sort(function(a,b){
	// 	var v1 = a.hashes ? parseInt(a.hashes) : 0;
	//     var v2 = b.hashes ? parseInt(b.hashes) : 0;
	//     if (v1 > v2) return -1;
	//     if (v1 < v2) return 1;
	//     return 0;	
	// });
	
    return data.slice(0,limit);
}

function compareTopDonators(data,limit) {
	limit = limit || 10;
	
	data.sort(function(a,b){
		var v1 = a.donations ? parseInt(a.donations) : 0;
	    var v2 = b.donations ? parseInt(b.donations) : 0;
	    if (v1 > v2) return -1;
	    if (v1 < v2) return 1;
	    return 0;	
	});
	
	return data.slice(0,limit);
    
}

function handleTops(response){
	var doForDm = function(dm){
		_handleTops(compareTopMiners,function(dM){
			topMinersCache.miner = dM;
			sendData(s,topMinersCache);
		});
	};
	const dd = {};
	// We won't have donors yet for v1.4.0
// 	const dd = topMinersCache.donate;
	const dm = topMinersCache.miner;
	
	if(Object.keys(dd).length === 0){
		_handleTops(compareTopDonators,function(dD){
			topMinersCache.donate = dD;
			if(Object.keys(dm).length > 0){
				return;
			}
			doForDm(dm);	
		});
	}
	
	if(Object.keys(dm).length === 0){
		return doForDm(dm);
	}
	
	sendData(response,topMinersCache);
	
}
/**
 * Return top 10 miners by hashrate
 **/
function handleTopMiners(response) {

	const dd = topMinersCache.miner;
	
	if(Object.keys(dd).length > 0){
		return sendData(response,dd);
	}
	
	_handleTops(compareTopMiners,function(data){
		sendData(response,data);
	});

}
/*
/**
 * Return top 10 miners by donations
 **/
function handleTopDonators(response) {

	const dd = topMinersCache.donate;
	
	if(Object.keys(dd).length > 0){
		return sendData(response,dd);
	}
	
	_handleTops(compareTopDonators,function(data){
		sendData(response,data);
	});
}
/**
 * Miner settings: minimum payout level
 **/
 
// Get current minimum payout level
function handleGetMinerPayoutLevel(urlParts, response){

    var address = urlParts.query.address;

    // Check the minimal required parameters for this handle.
    if (address === undefined) {
        sendData(response,{status: 'Parameters are incomplete'});
        return;
    }

    // Return current miner payout level
    redisClient.hget(config.coin + ':workers:' + address, 'minPayoutLevel', function(error, value){
        if (error){
            response.end(JSON.stringify({status: 'Unable to get the current minimum payout level from database'}));
            return;
        }
        var minLevel;
		if(utils.isIntegratedAddress(address)){
			minLevel = (config.payments.minPaymentIntegratedAddress / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
		}else{
			minLevel = (config.payments.minPayment / config.coinUnits) || 0;
		}

        var maxLevel = config.payments.maxPayment ? config.payments.maxPayment / config.coinUnits : null;

        var currentLevel = value / config.coinUnits;
        if (currentLevel < minLevel) {
        	currentLevel = minLevel;
        }
        if (maxLevel && currentLevel > maxLevel){
        	 currentLevel = maxLevel;	
        }

        sendData(response,{status: 'done', level: currentLevel});
    });
}

// Set minimum payout level
function handleSetMinerPayoutLevel(urlParts, response){
    
    var address = urlParts.query.address;
    var ip = urlParts.query.ip;
    var level = urlParts.query.level;

    // Check the minimal required parameters for this handle.
    if (ip === undefined || address === undefined || level === undefined) {
		sendData(response,{status: 'Parameters are incomplete'});
        return;
    }

    // Do not allow wildcards in the queries.
    if (ip.indexOf('*') !== -1 || address.indexOf('*') !== -1) {
        sendData(response,{status: 'Remove the wildcard from your miner address'});
        return;
    }

    level = parseFloat(level);
    if (isNaN(level)) {
        sendData(response,{status: 'Your minimum payout level doesn\'t look like a number'});
        return;
    }

    var minLevel;
    
    if(utils.isIntegratedAddress(address)){
    	minLevel = (config.payments.minPaymentIntegratedAddress / config.coinUnits) || (config.payments.minPayment / config.coinUnits) || 0;
    }else{
    	minLevel = (config.payments.minPayment / config.coinUnits) || 0;
    }

    var maxLevel = config.payments.maxPayment ? config.payments.maxPayment / config.coinUnits : null;

    if (level < minLevel) {
        sendData(response,{status: 'The minimum payout level is ' + minLevel});
        return;
    }

    if (maxLevel && level > maxLevel) {
        sendData(response,{status: 'The maximum payout level is ' + maxLevel});
        return;
    }

    // Only do a modification if we have seen the IP address in combination with the wallet address.
    minerSeenWithIPForAddress(address, ip, function (error, found) {
        if (!found || error) {
          sendData(response,{status: 'We haven\'t seen that IP for your address'});
          return;
        }

        var payoutLevel = level * config.coinUnits;
        redisClient.hset(config.coin + ':workers:' + address, 'minPayoutLevel', payoutLevel, function(error, value){
            if (error){
                sendData(response,{status: 'An error occurred when updating the value in our database'});
                return;
            }

            log('info', logSystem, 'Updated minimum payout level for ' + address + ' to: ' + payoutLevel);
            sendData(response,{status: 'done'});
        });
    });
}


/**
 * Return miners hashrate
 **/
function handleGetMinersHashrate(response) {
    var data = {};
    for (var miner in minersHashrate){
        if (miner.indexOf('~') !== -1) continue;
        data[miner] = minersHashrate[miner];
    }

    sendData(response, {
        minersHashrate: data
    });
}

/**
 * Return workers hashrate
 **/
function handleGetWorkersHashrate(response) {
    var data = {};
    for (var miner in minersHashrate){
        if (miner.indexOf('~') === -1) continue;
        data[miner] = minersHashrate[miner];
    }

    sendData(response,{
        workersHashrate: data
    });
}


/**
 * Authorize access to a secured API call
 **/
function authorize(request, response){
    var sentPass = url.parse(request.url, true).query.password;

    var remoteAddress = request.connection.remoteAddress;
    if(config.api.trustProxyIP && request.headers['x-forwarded-for']){
      remoteAddress = request.headers['x-forwarded-for'];
    }
    
    var bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
    if (typeof sentPass == "undefined" && (remoteAddress === '127.0.0.1' || remoteAddress === '::ffff:127.0.0.1' || remoteAddress === '::1' || (bindIp != "0.0.0.0" && remoteAddress === bindIp))) {
        return true;
    }
    
    response.setHeader('Access-Control-Allow-Origin', '*');

    var cookies = parseCookies(request);
    if (typeof sentPass == "undefined" && cookies.sid && cookies.sid === authSid) {
        return true;
    }

    if (sentPass !== config.api.password){
        response.statusCode = 401;
        response.end('Invalid password');
        return;
    }

    log('warn', logSystem, 'Admin authorized from %s', [remoteAddress]);
    response.statusCode = 200;

    var cookieExpire = new Date( new Date().getTime() + 60*60*24*1000);
    response.setHeader('Set-Cookie', 'sid=' + authSid + '; path=/; expires=' + cookieExpire.toUTCString());
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Content-Type', 'application/json');

    return true;
}

/**
 * Administration: return pool statistics
 **/
function handleAdminStats(response){
    async.waterfall([

        //Get worker keys & unlocked blocks
        function(callback){
            redisClient.multi([
                ['keys', config.coin + ':workers:*'],
                ['zrange', config.coin + ':blocks:matured', 0, -1]
            ]).exec(function(error, replies) {
                if (error) {
                    log('error', logSystem, 'Error trying to get admin data from redis %j', [error]);
                    callback(true);
                    return;
                }
                callback(null, replies[0], replies[1]);
            });
        },

        //Get worker balances
        function(workerKeys, blocks, callback){
            var redisCommands = workerKeys.map(function(k){
                return ['hmget', k, 'balance', 'paid'];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting balances from redis %j', [error]);
                    callback(true);
                    return;
                }

                callback(null, replies, blocks);
            });
        },
        function(workerData, blocks, callback){
            var stats = {
                totalOwed: 0,
                totalPaid: 0,
                totalRevenue: 0,
                totalDiff: 0,
                totalShares: 0,
                blocksOrphaned: 0,
                blocksUnlocked: 0,
                totalWorkers: 0
            };

            for (var i = 0; i < workerData.length; i++){
                stats.totalOwed += parseInt(workerData[i][0]) || 0;
                stats.totalPaid += parseInt(workerData[i][1]) || 0;
                stats.totalWorkers++;
            }

            for (var i = 0; i < blocks.length; i++){
                var block = blocks[i].split(':');
                if (block[5]) {
                    stats.blocksUnlocked++;
                    stats.totalDiff += parseInt(block[2]);
                    stats.totalShares += parseInt(block[3]);
                    stats.totalRevenue += parseInt(block[5]);
                }
                else{
                    stats.blocksOrphaned++;
                }
            }
            callback(null, stats);
        }
    ], function(error, stats){
            if (error){
                response.end(JSON.stringify({error: 'Error collecting stats'}));
                return;
            }
            response.end(JSON.stringify(stats));
        }
    );

}

/**
 * Administration: users list
 **/
function handleAdminUsers(response){
    async.waterfall([
        // get workers Redis keys
        function(callback) {
            redisClient.keys(config.coin + ':workers:*', callback);
        },
        // get workers data
        function(workerKeys, callback) {
            var redisCommands = workerKeys.map(function(k) {
                return ['hmget', k, 'balance', 'paid', 'lastShare', 'hashes'];
            });
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                var workersData = {};
                for(var i in redisData) {
                    var keyParts = workerKeys[i].split(':');
                    var address = keyParts[keyParts.length-1];
                    var data = redisData[i];
                    workersData[address] = {
                        pending: data[0],
                        paid: data[1],
                        lastShare: data[2],
                        hashes: data[3],
                        hashrate: minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address]['hashrate'] : 0,
                        roundScore: minerStats[address] && minerStats[address]['roundScore'] ? minerStats[address]['roundScore'] : 0,
                        roundHashes: minerStats[address] && minerStats[address]['roundHashes'] ? minerStats[address]['roundHashes'] : 0
                    };
                }
                callback(null, workersData);
            });
        }
        ], function(error, workersData) {
            if(error) {
                response.end(JSON.stringify({error: 'Error collecting users stats'}));
                return;
            }
            response.end(JSON.stringify(workersData));
        }
    );
}

/**
 * Administration: pool monitoring
 **/
function handleAdminMonitoring(response) {

    async.parallel({
        monitoring: getMonitoringData,
        logs: getLogFiles
    }, function(error, result) {
    	sendData(response,result);
    });
}

/**
 * Administration: log file data
 **/
function handleAdminLog(urlParts, response){
    var file = urlParts.query.file;
    var filePath = config.logging.files.directory + '/' + file;
    if(!file.match(/^\w+\.log$/)) {
        response.end('wrong log file');
    }
    response.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Content-Length': fs.statSync(filePath).size
    });
    fs.createReadStream(filePath).pipe(response);
}

/**
 * Administration: pool ports usage
 **/
function handleAdminPorts(response){
    async.waterfall([
        function(callback) {
            redisClient.keys(config.coin + ':ports:*', callback);
        },
        function(portsKeys, callback) {
            var redisCommands = portsKeys.map(function(k) {
                return ['hmget', k, 'port', 'users'];
            });
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                var portsData = {};
                for (var i in redisData) {
                    var port = portsKeys[i];

                    var data = redisData[i];
                    portsData[port] = {
                        port: data[0],
                        users: data[1]
                    };
                }
                callback(null, portsData);
            });
        }
    ], function(error, portsData) {
        if(error) {
            response.end(JSON.stringify({error: 'Error collecting Ports stats'}));
            return;
        }
        response.end(JSON.stringify(portsData));
    });
}

/**
 * RPC monitoring of daemon and wallet
 **/

// Start RPC monitoring
function startRpcMonitoring(rpc, module, method, interval) {
    setInterval(function() {
        rpc(method, {}, function(error, response) {
            var stat = {
                lastCheck: new Date() / 1000 | 0,
                lastStatus: error ? 'fail' : 'ok',
                lastResponse: JSON.stringify(error ? error : response)
            };
            if(error) {
                stat.lastFail = stat.lastCheck;
                stat.lastFailResponse = stat.lastResponse;
            }
            var key = getMonitoringDataKey(module);
            var redisCommands = [];
            for(var property in stat) {
                redisCommands.push(['hset', key, property, stat[property]]);
            }
            redisClient.multi(redisCommands).exec();
        });

    }, interval * 1000);
}

// Return monitoring data key
function getMonitoringDataKey(module) {
    return config.coin + ':status:' + module;
}

// Initialize monitoring
function initMonitoring() {
    var modulesRpc = {
        daemon: apiInterfaces.rpcDaemon,
        wallet: apiInterfaces.rpcWallet
    };
    for(var module in config.monitoring) {
        var settings = config.monitoring[module];
        
        if(settings.checkInterval) {
            startRpcMonitoring(modulesRpc[module], module, settings.rpcMethod, settings.checkInterval);
        }
    }
}

// Get monitoring data
function getMonitoringData(callback) {
    var modules = Object.keys(config.monitoring);
    var redisCommands = [];
    for(var i in modules) {
        redisCommands.push(['hgetall', getMonitoringDataKey(modules[i])])
    }
    redisClient.multi(redisCommands).exec(function(error, results) {
        var stats = {};
        for(var i in modules) {
            if(results[i]) {
                stats[modules[i]] = results[i];
            }
        }
        callback(error, stats);
    });
}

/**
 * Return pool public ports
 **/
function getPublicPorts(ports){
    return ports.filter(function(port) {
        return !port.hidden;
    });
}

/**
 * Return list of pool logs file
 **/
function getLogFiles(callback) {
    var dir = config.logging.files.directory;
    fs.readdir(dir, function(error, files) {
        var logs = {};
        for(var i in files) {
            var file = files[i];
            var stats = fs.statSync(dir + '/' + file);
            logs[file] = {
                size: stats.size,
                changed: Date.parse(stats.mtime) / 1000 | 0
            }
        }
        callback(error, logs);
    });
}

/**
 * Check if a miner has been seen with specified IP address
 **/
function minerSeenWithIPForAddress(address, ip, callback) {
    var ipv4_regex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    if (ipv4_regex.test(ip)) {
        ip = '::ffff:' + ip;
    }
    redisClient.sismember([config.coin + ':workers_ip:' + address, ip], function(error, result) {
        var found = result > 0 ? true : false;
        callback(error, found);
    });
}

/**
 * Parse cookies data
 **/
function parseCookies(request) {
    var list = {},
        rc = request.headers.cookie;
    rc && rc.split(';').forEach(function(cookie) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });
    return list;
}
/**
 * Start pool API
 **/

// Collect statistics for the first time
collectStats();

// Initialize RPC monitoring
initMonitoring();

// Enable to be bind to a certain ip or all by default
var bindIp = config.api.bindIp || "0.0.0.0";

// Start API on HTTP port
var server = http.createServer(function(request, response){
    if (request.method.toUpperCase() === "OPTIONS"){
        response.writeHead("204", "No Content", {
            "access-control-allow-origin": '*',
            "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
            "access-control-allow-headers": "content-type, accept",
            "access-control-max-age": 10, // Seconds.
            "content-length": 0
        });
        return(response.end());
    }

    handleServerRequest(request, response);
});

server.listen(config.api.port, bindIp, function(){
    log('info', logSystem, 'API started & listening on %s port %d', [bindIp, config.api.port]);
});

if(config.api.ssl && config.api.ssl.enabled){
    var bindIpSsl = config.api.ssl.bindIp || "0.0.0.0";
	var sslPort = config.api.ssl.port;
    if (!config.api.ssl.cert) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate not configured', [bindIpSsl, sslPort]);
    } else if (!config.api.ssl.key) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL key not configured', [bindIpSsl, sslPort]);
       
    } else if (!config.api.ssl.ca) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate authority not configured', [bindIpSsl, sslPort]);
        
    } else if (!fs.existsSync(config.api.ssl.cert)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate file not found (configuration error)', [bindIpSsl, sslPort]);
        
    } else if (!fs.existsSync(config.api.ssl.key)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL key file not found (configuration error)', [bindIpSsl, sslPort]);
        
    } else if (!fs.existsSync(config.api.ssl.ca)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate authority file not found (configuration error)', [bindIpSsl, sslPort]);
    }else{
    	
    	var sslOptions = {
	        key: fs.readFileSync(config.api.ssl.key),
	        cert: fs.readFileSync(config.api.ssl.cert),
	        ca: fs.readFileSync(config.api.ssl.ca),
	        honorCipherOrder: true
	    };
	    
    	var ssl_server = https.createServer(sslOptions, function(request, response){
	        if (request.method.toUpperCase() === "OPTIONS"){
	            response.writeHead("204", "No Content", {
	                "access-control-allow-origin": '*',
	                "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
	                "access-control-allow-headers": "content-type, accept",
	                "access-control-max-age": 10, // Seconds.
	                "content-length": 0,
	                "strict-transport-security": "max-age=604800"
	            });
	            return(response.end());
	        }
	
	        handleServerRequest(request, response);
	    });
	    
	    ssl_server.listen(sslPort, bindIpSsl, function(){
	    	log('info', logSystem, 'API started & listening on %s port %d (SSL)', [bindIpSsl, sslPort]);
	    });
    }
}
