/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Block unlocker
 **/

// Load required modules
let async = require('async');

let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api)
let notifications = require('./notifications.js')
let utils = require('./utils.js')

let slushMiningEnabled = config.poolServer.slushMining && config.poolServer.slushMining.enabled

// Initialize log system
let logSystem = 'unlocker'
require('./exceptionWriter.js')(logSystem)

/**
 * Run block unlocker
 **/
 
log('info', logSystem, 'Started')

function runInterval(){
    async.waterfall([

        // Get all block candidates in redis
        function(callback){
            redisClient.zrange(config.coin + ':blocks:candidates', 0, -1, 'WITHSCORES', function(error, results){
                if (error){
                    log('error', logSystem, 'Error trying to get pending blocks from redis %j', [error])
                    callback(true)
                    return
                }
                if (results.length === 0){
                    log('info', logSystem, 'No blocks candidates in redis')
                    callback(true)
                    return
                }

                let blocks = []

                for (let i = 0; i < results.length; i += 2){
                    let parts = results[i].split(':')
                    blocks.push({
                        serialized: results[i],
                        height: parseInt(results[i + 1]),
			rewardType: parts[0],
			login: parts[1],
                        hash: parts[2],
                        time: parts[3],
                        difficulty: parts[4],
                        shares: parts[5],
                        score: parts.length >= 7 ? parts[6] : parts[5]
                    })
                }

                callback(null, blocks)
            })
        },

        // Check if blocks are orphaned
        function(blocks, callback){
            async.filter(blocks, function(block, mapCback){
                let daemonType = config.daemonType ? config.daemonType.toLowerCase() : "default"
                let blockHeight = ((daemonType === "forknote" || daemonType === "bytecoin") && config.blockUnlocker.fixBlockHeightRPC) ? block.height + 1 : block.height
		        let rpcMethod = config.blockUnlocker.useFirstVout ? 'getblock' : 'getblockheaderbyheight'
                apiInterfaces.rpcDaemon(rpcMethod, {height: blockHeight}, function(error, result){
                    if (error){
			            log('error', logSystem, 'Error with %s RPC request for block %s - %j', [rpcMethod, block.serialized, error])
                        block.unlocked = false
                        mapCback()
                        return
                    }
                    if (!result.block_header){
                        log('error', logSystem, 'Error with getblockheaderbyheight RPC request for block %s - %j', [block.serialized, error])
                        block.unlocked = false
                        mapCback()
                        return
                    }
                    let blockHeader = result.block_header
                    block.orphaned = blockHeader.hash === block.hash ? 0 : 1
                    block.unlocked = blockHeader.depth >= config.blockUnlocker.depth
                    block.reward = blockHeader.reward
		            if (config.blockUnlocker.useFirstVout) {
                        let vout = JSON.parse(result.json).miner_tx.vout
                        if (!vout.length) {
                            log('error', logSystem, 'Error: tx at height %s has no vouts!', [blockHeight])
                            block.unlocked = false
                            mapCback()
                            return
                        }
                        block.reward = vout[0].amount
                    } else {
                        block.reward = blockHeader.reward
                    }
                    if (config.blockUnlocker.networkFee) {
                        let networkFeePercent = config.blockUnlocker.networkFee / 100
                        block.reward = block.reward - (block.reward * networkFeePercent)
                    }
                    mapCback(block.unlocked)
                })
            }, function(unlockedBlocks){

                if (unlockedBlocks.length === 0){
                    log('info', logSystem, 'No pending blocks are unlocked yet (%d pending)', [blocks.length])
                    callback(true)
                    return
                }

                callback(null, unlockedBlocks)
            })
        },

        // Get worker shares for each unlocked block
        function(blocks, callback){

            let redisCommands = blocks.map(function(block){
		if (block.rewardType === 'prop')
                    return ['hgetall', config.coin + ':scores:prop:round' + block.height]
		else
                    return ['hgetall', config.coin + ':scores:solo:round' + block.height]
            })

            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting round shares from redis %j', [error])
                    callback(true)
                    return
                }
                for (let i = 0; i < replies.length; i++){
                    let workerScores = replies[i]
                    blocks[i].workerScores = workerScores
                }
                callback(null, blocks)
            })
        },

        // Handle orphaned blocks
        function(blocks, callback){
            let orphanCommands = []

            blocks.forEach(function(block){
                if (!block.orphaned) return

                orphanCommands.push(['del', config.coin + ':scores:solo:round' + block.height])
                orphanCommands.push(['del', config.coin + ':scores:prop:round' + block.height])
                orphanCommands.push(['del', config.coin + ':shares_actual:solo:round' + block.height])
                orphanCommands.push(['del', config.coin + ':shares_actual:prop:round' + block.height])
                orphanCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized])
                orphanCommands.push(['zadd', config.coin + ':blocks:matured', block.height, [
		    block.rewardType,
		    block.login,
                    block.hash,
                    block.time,
                    block.difficulty,
                    block.shares,
                    block.orphaned
                ].join(':')])

                if (block.workerScores && !slushMiningEnabled) {
                    let workerScores = block.workerScores
                    Object.keys(workerScores).forEach(function (worker) {
                        orphanCommands.push(['hincrby', config.coin + ':scores:roundCurrent', worker, workerScores[worker]])
                    })
                }

                notifications.sendToAll('blockOrphaned', {
                    'HEIGHT': block.height,
                    'BLOCKTIME': utils.dateFormat(new Date(parseInt(block.time) * 1000), 'yyyy-mm-dd HH:MM:ss Z'),
                    'HASH': block.hash,
                    'DIFFICULTY': block.difficulty,
                    'SHARES': block.shares,
                    'EFFORT': Math.round(block.shares / block.difficulty * 100) + '%'
                })
            })

            if (orphanCommands.length > 0){
                redisClient.multi(orphanCommands).exec(function(error, replies){
                    if (error){
                        log('error', logSystem, 'Error with cleaning up data in redis for orphan block(s) %j', [error])
                        callback(true)
                        return
                    }
                    callback(null, blocks)
                })
            }
            else{
                callback(null, blocks)
            }
        },

        // Handle unlocked blocks
        function(blocks, callback){
            let unlockedBlocksCommands = []
            let payments = {}
            let totalBlocksUnlocked = 0
            blocks.forEach(function(block){
                if (block.orphaned) return
                totalBlocksUnlocked++

                unlockedBlocksCommands.push(['del', config.coin + ':scores:solo:round' + block.height])
                unlockedBlocksCommands.push(['del', config.coin + ':scores:prop:round' + block.height])
                unlockedBlocksCommands.push(['del', config.coin + ':shares_actual:solo:round' + block.height])
                unlockedBlocksCommands.push(['del', config.coin + ':shares_actual:prop:round' + block.height])
                unlockedBlocksCommands.push(['zrem', config.coin + ':blocks:candidates', block.serialized])
                unlockedBlocksCommands.push(['zadd', config.coin + ':blocks:matured', block.height, [
		    block.rewardType,
		    block.login,
                    block.hash,
                    block.time,
                    block.difficulty,
                    block.shares,
                    block.orphaned,
                    block.reward
                ].join(':')])

                let feePercent = config.blockUnlocker.poolFee / 100

                if (Object.keys(donations).length) {
                    for(let wallet in donations) {
                        let percent = donations[wallet] / 100
                        feePercent += percent
                        payments[wallet] = Math.round(block.reward * percent)
                        log('info', logSystem, 'Block %d donation to %s as %d percent of reward: %d', [block.height, wallet, percent, payments[wallet]])
                    }
                }

                let reward = Math.round(block.reward - (block.reward * feePercent))

                log('info', logSystem, 'Unlocked %d block with reward %d and donation fee %d. Miners reward: %d', [block.height, block.reward, feePercent, reward])

                if (block.workerScores) {
                    let totalScore = parseFloat(block.score)
                    //deal with solo block
                    if (block.rewardType === 'solo') {
                        let worker = block.login
                        payments[worker] = (payments[worker] || 0) + reward
                        log('info', logSystem, 'SOLO Block %d payment to %s for %d%% of total block score: %d', [block.height, worker, 100, payments[worker]])
                    } else {
                        Object.keys(block.workerScores).forEach(function (worker) {
                            let percent = block.workerScores[worker] / totalScore
                            let workerReward = Math.round(reward * percent)
                            payments[worker] = (payments[worker] || 0) + workerReward
                            log('info', logSystem, 'PROP Block %d payment to %s for %d%% of total block score: %d', [block.height, worker, percent*100, payments[worker]])
                        })
		    }
                }

                notifications.sendToAll('blockUnlocked', {
                    'HEIGHT': block.height,
                    'BLOCKTIME': utils.dateFormat(new Date(parseInt(block.time) * 1000), 'yyyy-mm-dd HH:MM:ss Z'),
                    'HASH': block.hash,
                    'REWARD': utils.getReadableCoins(block.reward),
                    'DIFFICULTY': block.difficulty,
                    'SHARES': block.shares,
                    'EFFORT': Math.round(block.shares / block.difficulty * 100) + '%'
                })
            })

            for (let worker in payments) {
                let amount = parseInt(payments[worker])
                if (amount <= 0){
                    delete payments[worker]
                    continue
                }
                unlockedBlocksCommands.push(['hincrby', `${config.coin}:workers:${worker}`, 'balance', amount])
            }

            if (unlockedBlocksCommands.length === 0){
                log('info', logSystem, 'No unlocked blocks yet (%d pending)', [blocks.length])
                callback(true)
                return
            }

            redisClient.multi(unlockedBlocksCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with unlocking blocks %j', [error])
                    callback(true)
                    return
                }
                log('info', logSystem, 'Unlocked %d blocks and update balances for %d workers', [totalBlocksUnlocked, Object.keys(payments).length])
                callback(null)
            })
        }
    ], function(error, result){
        setTimeout(runInterval, config.blockUnlocker.interval * 1000)
    })
}

runInterval()

