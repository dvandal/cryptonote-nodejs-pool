/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Pool API
 **/

// Load required modules
let fs = require('fs');
let http = require('http');
let https = require('https');
let url = require("url");
let async = require('async');

let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet);
let authSid = Math.round(Math.random() * 10000000000) + '' + Math.round(Math.random() * 10000000000);

let charts = require('./charts.js');
let notifications = require('./notifications.js');
let market = require('./market.js');
let utils = require('./utils.js');

// Initialize log system
let logSystem = 'api';
require('./exceptionWriter.js')(logSystem);

// Data storage variables used for live statistics
let currentStats = {};
let minerStats = {};
let minersHashrate = {};

let liveConnections = {};
let addressConnections = {};

/**
 * Handle server requests
 **/
function handleServerRequest(request, response) {
    let urlParts = url.parse(request.url, true);

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

            let address = urlParts.query.address ? urlParts.query.address : 'undefined';
            let uid = Math.random().toString();
            let key = address + ':' + uid;

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
        case '/get_top10miners':
            handleTopMiners(response);
            break;

        // Miner settings
        case '/get_miner_payout_level':
            handleGetMinerPayoutLevel(urlParts, response);
            break;
        case '/set_miner_payout_level':
            handleSetMinerPayoutLevel(urlParts, response);
            break;
        case '/get_email_notifications':
            handleGetMinerNotifications(urlParts, response);
            break;
        case '/set_email_notifications':
            handleSetMinerNotifications(urlParts, response);
            break;
        case '/get_telegram_notifications':
            handleGetTelegramNotifications(urlParts, response);
            break;
        case '/set_telegram_notifications':
            handleSetTelegramNotifications(urlParts, response);
            break;
        case '/block_explorers':
            handleBlockExplorers(response)
            break
        case '/get_apis':
            handleGetApis(response)
            break
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
            handleAdminUsers(request, response);
            break;
        case '/admin_ports':
            if (!authorize(request, response)) {
                return;
            }
            handleAdminPorts(request, response);
            break;

        // Test notifications
	case '/test_email_notification':
            if (!authorize(request, response)) {
                return;
            }
	    handleTestEmailNotification(urlParts, response);
            break;
        case '/test_telegram_notification':
            if (!authorize(request, response)) {
                return;
            }
	    handleTestTelegramNotification(urlParts, response);
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

/**
 * Collect statistics data
 **/
function collectStats(){
    let startTime = Date.now();
    let redisFinished;
    let daemonFinished;

    let redisCommands = [
        ['zremrangebyscore', `${config.coin}:hashrate`, '-inf', ''],
        ['zrange', `${config.coin}:hashrate`, 0, -1],
        ['hgetall', `${config.coin}:stats`],
        ['zrange', `${config.coin}:blocks:candidates`, 0, -1, 'WITHSCORES'],
        ['zrevrange', `${config.coin}:blocks:matured`, 0, config.api.blocks - 1, 'WITHSCORES'],
        ['hgetall', `${config.coin}:scores:prop:roundCurrent`],
        ['hgetall', `${config.coin}:stats`],
        // ['zcard', `${config.coin}:blocks:matured`],
        ['zrevrange', `${config.coin}:payments:all`, 0, config.api.payments - 1, 'WITHSCORES'],
        ['zcard', `${config.coin}:payments:all`],
        ['keys', `${config.coin}:payments:*`],
        ['hgetall', `${config.coin}:shares_actual:prop:roundCurrent`],
        ['zrange', `${config.coin}:blocks:matured`, 0, -1, 'WITHSCORES']
    ];

    let windowTime = (((Date.now() / 1000) - config.api.hashrateWindow) | 0).toString();
    redisCommands[0][3] = '(' + windowTime;

    async.parallel({
        health: function(callback) {
            let keys = []
            let data = {}
            keys.push(config.coin)
            let healthCommands = []
            healthCommands.push(['hget', `${config.coin}:status:daemon`, 'lastStatus'])
            healthCommands.push(['hget', `${config.coin}:status:wallet`, 'lastStatus'])
            healthCommands.push(['hget', `${config.coin}:status:price`, 'lastReponse'])
/*
            config.childPools.forEach(pool => {
                healthCommands.push(['hmget', `${pool.coin}:status:daemon`, 'lastStatus'])
                healthCommands.push(['hmget', `${pool.coin}:status:wallet`, 'lastStatus']) 
                keys.push(pool.coin)

            })
*/
            redisClient.multi(healthCommands).exec(function(error, replies){

                if (error){
                    data = {daemon: 'fail', wallet: 'fail', price: 'fail'}
                    callback(null, data)
                }
                for (var i = 0, index = 0; i < keys.length; index+=2, i++) {
                    data[keys[i]] = {daemon: replies[index], wallet: replies[index+1], price: replies[index+2]}

                }
                callback(null, data)
            })
        },
        pool: function(callback){
            redisClient.multi(redisCommands).exec(function(error, replies){
                redisFinished = Date.now();
                let dateNowSeconds = Date.now() / 1000 | 0;

                if (error){
                    log('error', logSystem, 'Error getting redis data %j', [error]);
                    callback(true);
                    return;
                }

                let data = {
                    stats: replies[2],
                    blocks: truncateMinerAddress(replies[3].concat(replies[4])),
                    totalBlocks: 0, 
		            totalBlocksSolo: 0,
                    totalDiff: 0,
		            totalDiffSolo: 0,
                    totalShares: 0,
		            totalSharesSolo: 0,
                    payments: replies[7],
                    totalPayments: parseInt(replies[8]),
                    totalMinersPaid: replies[9] && replies[9].length > 0 ? replies[9].length - 1 : 0,
                    miners: 0,
		            minersSolo: 0,
                    workers: 0,
		            workersSolo: 0,
                    hashrate: 0,
		            hashrateSolo: 0,
                    roundScore: 0,
                    roundHashes: 0
                };

                calculateBlockData(data, replies[3].concat(replies[11]))

                minerStats = {};

                minersHashrate = {};
                minersHashrateSolo = {};

                minersHashrate = {};
	            minersRewardType = {}

                let hashrates = replies[1];
                for (let i = 0; i < hashrates.length; i++){
                    let hashParts = hashrates[i].split(':');
                    minersHashrate[hashParts[1]] = (minersHashrate[hashParts[1]] || 0) + parseInt(hashParts[0]);
		            minersRewardType[hashParts[1]] = hashParts[3]
                }

                let totalShares = 0
		        let totalSharesSolo = 0

                for (let miner in minersHashrate){
	            if (minersRewardType[miner] === 'prop') {
                        if (miner.indexOf('~') !== -1) {
                            data.workers ++;
                           totalShares += minersHashrate[miner];
                        } else {
                           data.miners ++;
                        }
	            } else if (minersRewardType[miner] === 'solo') {
                        if (miner.indexOf('~') !== -1) {
                            data.workersSolo ++;
                           totalSharesSolo += minersHashrate[miner];
                        } else {
                           data.minersSolo ++;
                        }
	 	     }
                     minersHashrate[miner] = Math.round(minersHashrate[miner] / config.api.hashrateWindow);
                     if (!minerStats[miner]) { minerStats[miner] = {}; }
                         minerStats[miner]['hashrate'] = minersHashrate[miner];
                }


                data.hashrate = Math.round(totalShares / config.api.hashrateWindow);
                data.hashrateSolo = Math.round(totalSharesSolo / config.api.hashrateWindow);

                data.roundScore = 0;

                if (replies[5]){
                    for (let miner in replies[5]){
                        let roundScore = parseFloat(replies[5][miner]);

                        data.roundScore += roundScore;

                        if (!minerStats[miner]) { minerStats[miner] = {}; }
                        minerStats[miner]['roundScore'] = roundScore;
                    }
                }

                data.roundHashes = 0;

                if (replies[10]){
                    for (let miner in replies[10]){
                        let roundHashes = parseInt(replies[10][miner])
                        data.roundHashes += roundHashes;

                        if (!minerStats[miner]) { minerStats[miner] = {}; }
                        minerStats[miner]['roundHashes'] = roundHashes;
                    }
                }

                if (replies[6]) {
                    if (!replies[6].lastBlockFound || parseInt(replies[6].lastBlockFound) < parseInt(replies[6].lastBlockFoundprop))
                        data.lastBlockFound = replies[6].lastBlockFoundprop;
                    else
                        data.lastBlockFound = replies[6].lastBlockFound

                    if (replies[6].lastBlockFoundsolo)
	                    data.lastBlockFoundSolo = replies[6].lastBlockFoundsolo;
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
        config: function(callback){
            callback(null, {
                poolHost: config.poolHost || '',
                ports: getPublicPorts(config.poolServer.ports),
                cnAlgorithm: config.cnAlgorithm || 'cryptonight',
                cnVariant: config.cnVariant || 0,
                cnBlobType: config.cnBlobType || 0,
                hashrateWindow: config.api.hashrateWindow,
                fee: config.blockUnlocker.poolFee,
                networkFee: config.blockUnlocker.networkFee || 0,
                coin: config.coin,
                coinUnits: config.coinUnits,
                coinDecimalPlaces: config.coinDecimalPlaces || 4, // config.coinUnits.toString().length - 1,
                coinDifficultyTarget: config.coinDifficultyTarget,
                symbol: config.symbol,
                depth: config.blockUnlocker.depth,
                donation: donations,
                version: version,
                paymentsInterval: config.payments.interval,
                minPaymentThreshold: config.payments.minPayment,
                maxPaymentThreshold: config.payments.maxPayment || null,
                transferFee: config.payments.transferFee,
                denominationUnit: config.payments.denomination,
                slushMiningEnabled: config.poolServer.slushMining.enabled,
                weight: config.poolServer.slushMining.weight,
                priceSource: config.prices ? config.prices.source : 'cryptonator',
                priceCurrency: config.prices ? config.prices.currency : 'USD',
                paymentIdSeparator: config.poolServer.paymentId && config.poolServer.paymentId.addressSeparator ? config.poolServer.paymentId.addressSeparator : ".",
                fixedDiffEnabled: config.poolServer.fixedDiff.enabled,
                fixedDiffSeparator: config.poolServer.fixedDiff.addressSeparator,
                sendEmails: config.email ? config.email.enabled : false,
                blocksChartEnabled: (config.charts.blocks && config.charts.blocks.enabled),
                blocksChartDays: config.charts.blocks && config.charts.blocks.days ? config.charts.blocks.days : null,
                telegramBotName: config.telegram && config.telegram.botName ? config.telegram.botName : null,
                telegramBotStats: config.telegram && config.telegram.botCommands ? config.telegram.botCommands.stats : "/stats",
                telegramBotReport: config.telegram && config.telegram.botCommands ? config.telegram.botCommands.report : "/report",
                telegramBotNotify: config.telegram && config.telegram.botCommands ? config.telegram.botCommands.notify : "/notify",
                telegramBotBlocks: config.telegram && config.telegram.botCommands ? config.telegram.botCommands.blocks : "/blocks"
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

                let chartDays = config.charts.blocks.days;

                let beginAtTimestamp = (Date.now() / 1000) - (chartDays * 86400);
                let beginAtDate = new Date(beginAtTimestamp * 1000);
                if (chartDays > 1) {
                    beginAtDate = new Date(beginAtDate.getFullYear(), beginAtDate.getMonth(), beginAtDate.getDate(), 0, 0, 0, 0);
                    beginAtTimestamp = beginAtDate / 1000 | 0;
                }

                let blocksCount = {};
                let blocksCountSolo = {};
                if (chartDays === 1) {
                    for (let h = 0; h <= 24; h++) {
                        let date = utils.dateFormat(new Date((beginAtTimestamp + (h * 60 * 60)) * 1000), 'yyyy-mm-dd HH:00');
                        blocksCount[date] = 0;
                        blocksCountSolo[date] = 0
                    }
                } else {
                    for (let d = 0; d <= chartDays; d++) {
                        let date = utils.dateFormat(new Date((beginAtTimestamp + (d * 86400)) * 1000), 'yyyy-mm-dd');
                        blocksCount[date] = 0;
                        blocksCountSolo[date] = 0
                    }
                }

                redisClient.zrevrange(config.coin + ':blocks:matured', 0, -1, 'WITHSCORES', function(err, result) {
                    for (let i = 0; i < result.length; i++){
                        let block = result[i].split(':');
                        if (block[0] === 'prop' || block[0] === 'solo') {
                            let blockTimestamp = block[3];
                            if (blockTimestamp < beginAtTimestamp) {
                                continue;
                            }
                            let date = utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd');
                            if (chartDays === 1) utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd HH:00');
                            if (block[0] === 'prop'){
                                if (!blocksCount[date]) blocksCount[date] = 0;
                                blocksCount[date] ++;
                                continue
                            }
                            if (block[0] === 'solo') {
                                if (!blocksCountSolo[date]) blocksCountSolo[date] = 0;
                                    blocksCountSolo[date] ++;
                            }
                        }
                        else
                        {
                            if (block[5]) {
                                let blockTimestamp = block[1];
                            if (blockTimestamp < beginAtTimestamp) {
                                continue;
                            }
                            let date = utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd');
                            if (chartDays === 1) utils.dateFormat(new Date(blockTimestamp * 1000), 'yyyy-mm-dd HH:00');
                            if (!blocksCount[date]) blocksCount[date] = 0;
                            blocksCount[date] ++;
                            }
                        }
                    }
                    data.blocks = blocksCount;
                    data.blocksSolo = blocksCountSolo;
                    callback(error, data);
                });
            });
        }
    }, function(error, results){
        log('info', logSystem, 'Stat collection finished: %d ms redis, %d ms daemon', [redisFinished - startTime, daemonFinished - startTime]);

        if (error){
            log('error', logSystem, 'Error collecting all stats');
        }
        else{
            currentStats = results;
            broadcastLiveStats();
            broadcastFinished = Date.now();
            log('info', logSystem, 'Stat collection broadcastLiveStats: %d ms', [broadcastFinished - startTime]);
        }

        setTimeout(collectStats, config.api.updateInterval * 1000);
    });

}

function truncateMinerAddress(blocks) {
    for (let i = 0; i < blocks.length; i++){
        let block = blocks[i].split(':');
        if (block[0] === 'solo' || block[0] === 'prop') {
            block[1] = `${block[1].substring(0,7)}...${block[1].substring(block[1].length-7)}`
            blocks[i] = block.join(':')
        }
    }
    return blocks
}

/**
*  Calculate the Diff, shares and totalblocks
**/
function calculateBlockData(data, blocks) {
    for (let i = 0; i < blocks.length; i++){
        let block = blocks[i].split(':');
        if ( block[0] === 'solo') {
            data.totalDiffSolo += parseInt(block[4])
            data.totalSharesSolo += parseInt(block[5])
            data.totalBlocksSolo += 1
        } 
        else if (block[0] === 'prop')
        {
            data.totalDiff += parseInt(block[4])
            data.totalShares += parseInt(block[5])
            data.totalBlocks += 1
        }
        else {
            if (block[5]) {
                data.totalDiff += parseInt(block[2])
                data.totalShares += parseInt(block[3])
                data.totalBlocks += 1
            }
        }
    }
}

/**
 * Get Network data
 **/
let networkDataRpcMode = 'get_info';
function getNetworkData(callback, rpcMode) {
    if (!rpcMode) rpcMode = networkDataRpcMode;

    // Try get_info RPC method first if available (not all coins support it)
    if (rpcMode === 'get_info') {
        apiInterfaces.rpcDaemon('get_info', {}, function(error, reply){
            if (error) {
                getNetworkData(callback, 'getlastblockheader');
                return;
            } else {
                networkDataRpcMode = 'get_info';

                callback(null, {
                    difficulty: reply.difficulty,
                    height: reply.height
                });
            }
        });
    }

    // Else fallback to getlastblockheader
    else {
        apiInterfaces.rpcDaemon('getlastblockheader', {}, function(error, reply){
            if (error){
                log('error', logSystem, 'Error getting network data %j', [error]);
                callback(true);
                return;
            } else {
                networkDataRpcMode = 'getlastblockheader';

                let blockHeader = reply.block_header;
                callback(null, {
                    difficulty: blockHeader.difficulty,
                    height: blockHeader.height + 1
                });
            }
        });
    }
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
       let blockHeader = reply.block_header;
       if (config.blockUnlocker.useFirstVout) {
            apiInterfaces.rpcDaemon('getblock', { height: blockHeader.height }, function(error, result) {
                if (error) {
                    log('error', logSystem, 'Error getting last block details: %j', [error]);
                    callback(true);
                    return;
                }
                let vout = JSON.parse(result.json).miner_tx.vout;
                if (!vout.length) {
                    log('error', logSystem, 'Error: tx at height %s has no vouts!', [blockHeader.height]);
                    callback(true);
                    return;
                }
                callback(null, {
                    difficulty: blockHeader.difficulty,
                    height: blockHeader.height,
                    timestamp: blockHeader.timestamp,
                    reward: vout[0].amount,
                    hash:  blockHeader.hash
                });
            });
            return;
        }
       callback(null, {
            difficulty: blockHeader.difficulty,
            height: blockHeader.height,
            timestamp: blockHeader.timestamp,
            reward: blockHeader.reward,
            hash:  blockHeader.hash
        });
    });
}

function handleGetApis(callback) {
    let apis = {}
     config.childPools.forEach(pool => {
	 if (pool.enabled)
             apis[pool.coin] = {api: pool.api}
     })
    callback(apis)
}

/**
 * Broadcast live statistics
 **/
function broadcastLiveStats(){
    log('info', logSystem, 'Broadcasting to %d visitors and %d address lookups', [Object.keys(liveConnections).length, Object.keys(addressConnections).length]);

    // Live statistics
    let processAddresses = {};
    for (let key in liveConnections){
        let addrOffset = key.indexOf(':');
        let address = key.substr(0, addrOffset);
        if (!processAddresses[address]) processAddresses[address] = [];
        processAddresses[address].push(liveConnections[key]);
    }
    
    for (let address in processAddresses) {
        let data = currentStats;

        data.miner = {};
        if (address && minerStats[address]){
            data.miner = minerStats[address];
        }

        let destinations = processAddresses[address];
        sendLiveStats(data, destinations);
    }

    // Workers Statistics
    processAddresses = {};
    for (let key in addressConnections){
        let addrOffset = key.indexOf(':');
        let address = key.substr(0, addrOffset);
        if (!processAddresses[address]) processAddresses[address] = [];
        processAddresses[address].push(addressConnections[key]);
    }
    
    for (let address in processAddresses) {
        broadcastWorkerStats(address, processAddresses[address]);
    }
}

/**
 * Takes a chart data JSON string and uses it to compute the average over the past hour, 6 hours,
 * and 24 hours.  Returns [AVG1, AVG6, AVG24].
 **/
function extractAverageHashrates(chartdata) {
    let now = new Date() / 1000 | 0;

    let sums = [0, 0, 0]; // 1h, 6h, 24h
    let counts = [0, 0, 0];

    let sets = chartdata ? JSON.parse(chartdata) : []; // [time, avgValue, updateCount]
    for (let j in sets) {
        let hr = sets[j][1];
        if (now - sets[j][0] <=  1*60*60) { sums[0] += hr; counts[0]++; }
        if (now - sets[j][0] <=  6*60*60) { sums[1] += hr; counts[1]++; }
        if (now - sets[j][0] <= 24*60*60) { sums[2] += hr; counts[2]++; }
    }

    return [sums[0] * 1.0 / (counts[0] || 1), sums[1] * 1.0 / (counts[1] || 1), sums[2] * 1.0 / (counts[2] || 1)];
}

/**
 * Broadcast worker statistics
 **/
function broadcastWorkerStats(address, destinations) {
    let redisCommands = [
        ['hgetall', `${config.coin}:workers:${address}`],
        ['zrevrange', `${config.coin}:payments:${address}`, 0, config.api.payments - 1, 'WITHSCORES'],
        ['keys', `${config.coin}:unique_workers:${address}~*`],
        ['get', `${config.coin}:charts:hashrate:${address}`]
    ];
    redisClient.multi(redisCommands).exec(function(error, replies){
        if (error || !replies || !replies[0]){
            sendLiveStats({error: 'Not found'}, destinations);
            return;
        }

        let stats = replies[0];
        stats.hashrate = minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address]['hashrate'] : 0;
        stats.roundScore = minerStats[address] && minerStats[address]['roundScore'] ? minerStats[address]['roundScore'] : 0;
        stats.roundHashes = minerStats[address] && minerStats[address]['roundHashes'] ? minerStats[address]['roundHashes'] : 0;
        if (replies[3]) {
            let hr_avg = extractAverageHashrates(replies[3]);
            stats.hashrate_1h  = hr_avg[0];
            stats.hashrate_6h  = hr_avg[1];
            stats.hashrate_24h = hr_avg[2];
        }

        let paymentsData = replies[1];    
      
        let workersData = [];
        for (let j=0; j<replies[2].length; j++) {
            let key = replies[2][j];
            let keyParts = key.split(':');
            let miner = keyParts[2];
            if (miner.indexOf('~') !== -1) {
                let workerName = miner.substr(miner.indexOf('~')+1, miner.length);
                let workerData = {
                    name: workerName,
                    hashrate: minerStats[miner] && minerStats[miner]['hashrate'] ? minerStats[miner]['hashrate'] : 0
                };
                workersData.push(workerData);
            }
        }

        charts.getUserChartsData(address, paymentsData, function(error, chartsData) {
            let redisCommands = [];
            for (let i in workersData){
                redisCommands.push(['hgetall', `${config.coin}:unique_workers:${address}~${workersData[i].name}`]);
                redisCommands.push(['get', `${config.coin}:charts:worker_hashrate:${address}~${ workersData[i].name}`]);
            }
            redisClient.multi(redisCommands).exec(function(error, replies){
                for (let i in workersData) {
                    let wi = 2*i;
                    let hi = wi + 1
                    if (replies[wi]) {
                        workersData[i].lastShare = replies[wi]['lastShare'] ? parseInt(replies[wi]['lastShare']) : 0;
                        workersData[i].hashes = replies[wi]['hashes'] ? parseInt(replies[wi]['hashes']) : 0;
                    }
                    if (replies[hi]) {
                        let avgs = extractAverageHashrates(replies[hi]);
                        workersData[i]['hashrate_1h']  = avgs[0];
                        workersData[i]['hashrate_6h']  = avgs[1];
                        workersData[i]['hashrate_24h']  = avgs[2];
                    }
                }

                let data = {
                    stats: stats,
                    payments: paymentsData,
                    charts: chartsData,
                    workers: workersData
                };

                sendLiveStats(data, destinations);
            });
        });
    });
}

/**
 * Send live statistics to specified destinations
 **/
function sendLiveStats(data, destinations){
    if (!destinations) return ;

    let dataJSON = JSON.stringify(data);
    for (let i in destinations) {
        destinations[i].end(dataJSON);
    }
}

/**
 * Return pool statistics
 **/
function handleStats(urlParts, request, response){
    let data = currentStats;

    data.miner = {};
    let address = urlParts.query.address;
    if (address && minerStats[address]) {
        data.miner = minerStats[address];
    }

    let dataJSON = JSON.stringify(data);

    response.writeHead("200", {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataJSON, 'utf8')
    });
    response.end(dataJSON);
}

/**
 * Return miner (worker) statistics
 **/
function handleMinerStats(urlParts, response){
    let address = urlParts.query.address;
    let longpoll = (urlParts.query.longpoll === 'true');
    
    if (longpoll){
        response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        });
        
        redisClient.exists(`${config.coin}:workers:${address}`, function(error, result){
            if (!result){
                response.end(JSON.stringify({error: 'Not found'}));
                return;
            }
        
            let address = urlParts.query.address;
            let uid = Math.random().toString();
            let key = address + ':' + uid;
        
            response.on("finish", function() {
                delete addressConnections[key];
            });
            response.on("close", function() {
                delete addressConnections[key];
            });

            addressConnections[key] = response;
        });
    }
    else{
        redisClient.multi([
            ['hgetall', `${config.coin}:workers:${address}`],
            ['zrevrange', `${config.coin}:payments:${address}`, 0, config.api.payments - 1, 'WITHSCORES'],
            ['keys', `${config.coin}:unique_workers:${address}~*`],
            ['get', `${config.coin}:charts:hashrate:${address}`]
        ]).exec(function(error, replies){
            if (error || !replies[0]){
                let dataJSON = JSON.stringify({error: 'Not found'});
                response.writeHead("200", {
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataJSON, 'utf8')
                });
                response.end(dataJSON);
                return;
            }
        
            let stats = replies[0];
            stats.hashrate = minerStats[address] && minerStats[address]['hashrate'] ? minerStats[address]['hashrate'] : 0;
            stats.roundScore = minerStats[address] && minerStats[address]['roundScore'] ? minerStats[address]['roundScore'] : 0;
            stats.roundHashes = minerStats[address] && minerStats[address]['roundHashes'] ? minerStats[address]['roundHashes'] : 0;
            if (replies[3]) {
                let hr_avg = extractAverageHashrates(replies[3]);
                stats.hashrate_1h  = hr_avg[0];
                stats.hashrate_6h  = hr_avg[1];
                stats.hashrate_24h = hr_avg[2];
            }

            let paymentsData = replies[1];

            let workersData = [];
            for (let i=0; i<replies[2].length; i++) {
                let key = replies[2][i];
                let keyParts = key.split(':');
                let miner = keyParts[2];
                if (miner.indexOf('~') !== -1) {
                    let workerName = miner.substr(miner.indexOf('~')+1, miner.length);
                    let workerData = {
                        name: workerName,
                        hashrate: minerStats[miner] && minerStats[miner]['hashrate'] ? minerStats[miner]['hashrate'] : 0
                    };
                    workersData.push(workerData);
                }
            }

            charts.getUserChartsData(address, paymentsData, function(error, chartsData) {
                let redisCommands = [];
                for (let i in workersData){
                    redisCommands.push(['hgetall', `${config.coin}:unique_workers:${address}~${workersData[i].name}`]);
                    redisCommands.push(['get', `${config.coin}:charts:worker_hashrate:${address}~${workersData[i].name}`]);
                }
                redisClient.multi(redisCommands).exec(function(error, replies){
                    for (let i in workersData){
                        let wi = 2*i;
                        let hi = wi + 1
                        if (replies[wi]) {
                            workersData[i].lastShare = replies[wi]['lastShare'] ? parseInt(replies[wi]['lastShare']) : 0;
                            workersData[i].hashes = replies[wi]['hashes'] ? parseInt(replies[wi]['hashes']) : 0;
                        }
                        if (replies[hi]) {
                            let avgs = extractAverageHashrates(replies[hi]);
                            workersData[i]['hashrate_1h']  = avgs[0];
                            workersData[i]['hashrate_6h']  = avgs[1];
                            workersData[i]['hashrate_24h']  = avgs[2];
                        }
                    }
            
                    let data = {
                        stats: stats,
                        payments: paymentsData,
                        charts: chartsData,
                        workers: workersData
                    }

                    let dataJSON = JSON.stringify(data);
            
                    response.writeHead("200", {
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(dataJSON, 'utf8')
                    });
                    response.end(dataJSON);
                });
            });
        });
    }
}

/**
 * Return payments history
 **/
function handleGetPayments(urlParts, response){
    let paymentKey = ':payments:all';

    if (urlParts.query.address)
        paymentKey = `:payments:${urlParts.query.address}`;

    redisClient.zrevrangebyscore(
            `${config.coin}${paymentKey}`,
            `(${urlParts.query.time}`,
            '-inf',
            'WITHSCORES',
            'LIMIT',
            0,
            config.api.payments,
        function(err, result){
            let data;
            if (err) {
                data = {error: 'Query failed'};
            } else {
                data = result ? result : '';
            }

            let reply = JSON.stringify(data);

            response.writeHead("200", {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(reply, 'utf8')
            });
            response.end(reply);
        }
    )
}

/**
 * Return blocks data
 **/
function handleGetBlocks(urlParts, response){
    redisClient.zrevrangebyscore(
            `${config.coin}:blocks:matured`,
            `(${urlParts.query.height}`,
            '-inf',
            'WITHSCORES',
            'LIMIT',
            0,
            config.api.blocks,
        function(err, result){
            let data;
            if (err) {
                data = {error: 'Query failed'};
            } else {

                for (let i in result) {
                    let block = result[i].split(':');
                    if ( block[0] === 'solo' || block[0] === 'prop')
                    {
                        block[1] = `${block[1].substring(0,7)}...${block[1].substring(block[1].length-7)}`
                        result[i] = block.join(':')
                    }
                }
                data = result ? result : '';
            }

            let reply = JSON.stringify(data);

        response.writeHead("200", {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(reply, 'utf8')
        });
        response.end(reply);

    });
}

/**
 * Get market exchange prices
 **/
function handleGetMarket(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let tickers = urlParts.query["tickers[]"] || urlParts.query.tickers;
    if (!tickers || tickers === undefined) {
        response.end(JSON.stringify({error: 'No tickers specified.'}));
        return;
    }

    let exchange = urlParts.query.exchange || config.prices.source;
    if (!exchange || exchange === undefined) {
        response.end(JSON.stringify({error: 'No exchange specified.'}));
        return;
    }

    // Get market prices
    market.get(exchange, tickers, function(data) {
        response.end(JSON.stringify(data));
    });
}

function handleGetApis(response) {
    async.waterfall([
            function(callback) {
                let apis = {}
                 config.childPools.forEach(pool => {
		    if (pool.enabled)
                        apis[pool.coin] = {api: pool.api}
                 })
                callback(null, apis)
            }
        ], function(error, data) {
            if(error) {
                response.end(JSON.stringify({error: 'Error collecting Api Information'}));
                return;
            }
            let reply = JSON.stringify(data);

            response.writeHead("200", {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(reply, 'utf8')
            });
            response.end(reply);
        })
}

/**
 * Return top 10 miners
 **/
function handleBlockExplorers(response) {
    async.waterfall([
            function(callback) {
                let blockExplorers = {}
                blockExplorers[config.coin] = {"blockchainExplorer":  config.blockchainExplorer, "transactionExplorer": config.transactionExporer}
                 config.childPools.forEach(pool => {
		     if (pool.enabled)
                         blockExplorers[pool.coin] = {"blockchainExplorer": pool.blockchainExplorer, "transactionExplorer": pool.transactionExporer}
                 })
                callback(null, blockExplorers)
            }
        ], function(error, data) {
            if(error) {
                response.end(JSON.stringify({error: 'Error collecting Block Explorer Information'}));
                return;
            }
            let reply = JSON.stringify(data);

            response.writeHead("200", {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(reply, 'utf8')
            });
            response.end(reply);
        })
}

/**
 * Return top 10 miners
 **/
function handleTopMiners(response) {
    async.waterfall([
        function(callback) {
            redisClient.keys(`${config.coin}:workers:*`, callback);
        },
        function(workerKeys, callback) {
            let redisCommands = workerKeys.map(function(k) {
                return ['hmget', k, 'lastShare', 'hashes'];
            });
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                let minersData = [];
                let keyParts = [];
                let address = '';
                let data = '';
                for (let i in redisData) {
                    keyParts = workerKeys[i].split(':');
                    address = keyParts[keyParts.length-1];
                    data = redisData[i];
                    minersData.push({
                        miner: address.substring(0,7)+'...'+address.substring(address.length-7),
                        hashrate: minersHashrate[address] && minerStats[address]['hashrate'] ? minersHashrate[address] : 0,
                        lastShare: data[0],
                        hashes: data[1]
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

        data.sort(compareTopMiners);
        data = data.slice(0,10);

        let reply = JSON.stringify(data);

        response.writeHead("200", {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(reply, 'utf8')
        });
        response.end(reply);
    });
}

function compareTopMiners(a,b) {
    let v1 = a.hashrate ? parseInt(a.hashrate) : 0;
    let v2 = b.hashrate ? parseInt(b.hashrate) : 0;
    if (v1 > v2) return -1;
    if (v1 < v2) return 1;
    return 0;
}

/**
 * Miner settings: minimum payout level
 **/
 
// Get current minimum payout level
function handleGetMinerPayoutLevel(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let address = urlParts.query.address;

    // Check the minimal required parameters for this handle.
    if (address === undefined) {
        response.end(JSON.stringify({status: 'Parameters are incomplete'}));
        return;
    }

    // Return current miner payout level
    redisClient.hget(`${config.coin}:workers:${address}`, 'minPayoutLevel', function(error, value){
        if (error){
            response.end(JSON.stringify({status: 'Unable to get the current minimum payout level from database'}));
            return;
        }
    
        let minLevel = config.payments.minPayment / config.coinUnits;
        if (minLevel < 0) minLevel = 0;

        let maxLevel = config.payments.maxPayment ? config.payments.maxPayment / config.coinUnits : null;

        let currentLevel = value / config.coinUnits;
        if (currentLevel < minLevel) currentLevel = minLevel;
        if (maxLevel && currentLevel > maxLevel) currentLevel = maxLevel;

        response.end(JSON.stringify({status: 'done', level: currentLevel}));
    });
}

// Set minimum payout level
function handleSetMinerPayoutLevel(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let address = urlParts.query.address;
    let ip = urlParts.query.ip;
    let level = urlParts.query.level;

    // Check the minimal required parameters for this handle.
    if (ip === undefined || address === undefined || level === undefined) {
        response.end(JSON.stringify({status: 'Parameters are incomplete'}));
        return;
    }

    // Do not allow wildcards in the queries.
    if (ip.indexOf('*') !== -1 || address.indexOf('*') !== -1) {
        response.end(JSON.stringify({status: 'Remove the wildcard from your miner address'}));
        return;
    }

    level = parseFloat(level);
    if (isNaN(level)) {
        response.end(JSON.stringify({status: 'Your minimum payout level doesn\'t look like a number'}));
        return;
    }

    let minLevel = config.payments.minPayment / config.coinUnits;
    if (minLevel < 0) minLevel = 0;

    let maxLevel = config.payments.maxPayment ? config.payments.maxPayment / config.coinUnits : null;

    if (level < minLevel) {
        response.end(JSON.stringify({status: 'The minimum payout level is ' + minLevel}));
        return;
    }

    if (maxLevel && level > maxLevel) {
        response.end(JSON.stringify({status: 'The maximum payout level is ' + maxLevel}));
        return;
    }

    // Only do a modification if we have seen the IP address in combination with the wallet address.
    minerSeenWithIPForAddress(address, ip, function (error, found) {
        if (!found || error) {
          response.end(JSON.stringify({status: 'We haven\'t seen that IP for that wallet address in our record'}));
          return;
        }

        let payoutLevel = level * config.coinUnits;
        redisClient.hset(config.coin + ':workers:' + address, 'minPayoutLevel', payoutLevel, function(error, value){
            if (error){
                response.end(JSON.stringify({status: 'An error occurred when updating the value in our database'}));
                return;
            }

            log('info', logSystem, 'Updated minimum payout level for ' + address + ' to: ' + payoutLevel);
            response.end(JSON.stringify({status: 'done'}));
        });
    });
}

/**
 * Miner settings: email notifications
 **/

// Get destination for email notifications
function handleGetMinerNotifications(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let address = urlParts.query.address;

    // Check the minimal required parameters for this handle.
    if (address === undefined) {
        response.end(JSON.stringify({status: 'Parameters are incomplete'}));
        return;
    }

    // Return current email for notifications
    redisClient.hget(`${config.coin}:notifications`, address, function(error, value){
        if (error){
            response.end(JSON.stringify({'status': 'Unable to get current email from database'}));
            return;
        }
        response.end(JSON.stringify({'status': 'done', 'email': value}));
    });
}

// Set email notifications
function handleSetMinerNotifications(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let email = urlParts.query.email;
    let address = urlParts.query.address;
    let ip = urlParts.query.ip;
    let action = urlParts.query.action;

    // Check the minimal required parameters for this handle.
    if (ip === undefined || address === undefined || action === undefined) {
        response.end(JSON.stringify({status: 'Parameters are incomplete'}));
        return;
    }

    // Do not allow wildcards in the queries.
    if (ip.indexOf('*') !== -1 || address.indexOf('*') !== -1) {
        response.end(JSON.stringify({status: 'Remove the wildcard from your input'}));
        return;
    }

    // Check the action
    if (action === undefined || action === '' || (action != 'enable' && action != 'disable')) {
        response.end(JSON.stringify({status: 'Invalid action'}));
        return;
    }
    
    // Now only do a modification if we have seen the IP address in combination with the wallet address.
    minerSeenWithIPForAddress(address, ip, function (error, found) {
        if (!found || error) {
          response.end(JSON.stringify({status: 'We haven\'t seen that IP for your address'}));
          return;
        }

        if (action === "enable") {
            if (email === undefined) {
                response.end(JSON.stringify({status: 'No email address specified'}));
                return;
            }
            redisClient.hset(config.coin + ':notifications', address, email, function(error, value){
                if (error){
                    response.end(JSON.stringify({status: 'Unable to add email address in database'}));
                    return;
                }

                log('info', logSystem, 'Enable email notifications to ' + email + ' for address: ' + address);
                notifications.sendToMiner(address, 'emailAdded', {
                    'ADDRESS': address,
                    'EMAIL': email
                });
            });
            response.end(JSON.stringify({status: 'done'}));
        }
        else if (action === "disable") {
            redisClient.hdel(config.coin + ':notifications', address, function(error, value){
                if (error){
                    response.end(JSON.stringify({status: 'Unable to remove email address from database'}));
                    return;
                }
                log('info', logSystem, 'Disabled email notifications for address: ' + address);
            });
            response.end(JSON.stringify({status: 'done'}));
        }
    });
}

/**
 * Miner settings: telegram notifications
 **/

// Get destination for telegram notifications
function handleGetTelegramNotifications(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let chatId = urlParts.query.chatId;
    let address = urlParts.query.address;
    let type = urlParts.query.type || 'miner';

    if (chatId === undefined || chatId === '') {
        response.end(JSON.stringify({status: 'No chat id specified'}));
        return;
    }

    // Default miner address
    if (type == 'default') {
        redisClient.hget(config.coin + ':telegram:default', chatId, function(error, value){
            if (error){
                response.end(JSON.stringify({'status': 'Unable to get current telegram default miner address from database'}));
                return;
            }
            response.end(JSON.stringify({'status': 'done', 'address': value}));
        });
    }

    // Blocks notification
    if (type === 'blocks') {
        redisClient.hget(config.coin + ':telegram:blocks', chatId, function(error, value){
            if (error){
                response.end(JSON.stringify({'status': 'Unable to get current telegram chat id from database'}));
                return;
            }
            response.end(JSON.stringify({'status': 'done', 'enabled': +value}));
        });
    }

    // Miner notification
    if (type === 'miner') {
        if (address === undefined || address === '') {
            response.end(JSON.stringify({status: 'No miner address specified'}));
            return;
        }

        redisClient.hget(config.coin + ':telegram', address, function(error, value){
            if (error){
                response.end(JSON.stringify({'status': 'Unable to get current telegram chat id from database'}));
                return;
            }
            response.end(JSON.stringify({'status': 'done', 'chatId': value}));
        });
    }
}

// Enable/disable telegram notifications
function handleSetTelegramNotifications(urlParts, response){
    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    response.write('\n');

    let chatId = urlParts.query.chatId;
    let type = urlParts.query.type || 'miner';
    let action = urlParts.query.action;
    let address = urlParts.query.address;

    // Check chat id
    if (chatId === undefined || chatId === '') {
        response.end(JSON.stringify({status: 'No chat id specified'}));
        return;
    }
    
    // Check action
    if (type !== 'default' && (action === undefined || action === '' || (action != 'enable' && action != 'disable'))) {
        response.end(JSON.stringify({status: 'Invalid action'}));
        return;
    }

    // Default miner address
    if (type == 'default') {
        if (address === undefined || address === '') {
            response.end(JSON.stringify({status: 'No miner address specified'}));
            return;
        }

        redisClient.hset(config.coin + ':telegram:default', chatId, address, function(error, value){
            if (error){
                response.end(JSON.stringify({status: 'Unable to set default telegram miner address'}));
                return;
            }
        });
        response.end(JSON.stringify({status: 'done'}));
    }

    // Blocks notification
    if (type === 'blocks') {
        // Enable
        if (action === "enable") {
            redisClient.hset(config.coin + ':telegram:blocks', chatId, 1, function(error, value){
                if (error){
                    response.end(JSON.stringify({status: 'Unable to enable telegram notifications'}));
                    return;
                }

                log('info', logSystem, 'Enabled telegram notifications for blocks to ' + chatId);
            });
            response.end(JSON.stringify({status: 'done'}));
        }
    
        // Disable
        else if (action === "disable") {
            redisClient.hdel(config.coin + ':telegram:blocks', chatId, function(error, value){
                if (error){
                    response.end(JSON.stringify({status: 'Unable to disable telegram notifications'}));
                    return;
                }
                log('info', logSystem, 'Disabled telegram notifications for blocks to ' + chatId);
            });
            response.end(JSON.stringify({status: 'done'}));
        }
    }

    // Miner notification
    if (type === 'miner') {
        if (address === undefined || address === '') {
            response.end(JSON.stringify({status: 'No miner address specified'}));
            return;
        }

        redisClient.exists(config.coin + ':workers:' + address, function(error, result){
            if (!result){
                response.end(JSON.stringify({status: 'Miner not found in database'}));
                return;
            }

            // Enable
            if (action === "enable") {
                redisClient.hset(config.coin + ':telegram', address, chatId, function(error, value){
                    if (error){
                        response.end(JSON.stringify({status: 'Unable to enable telegram notifications'}));
                        return;
                    }
                    log('info', logSystem, 'Enabled telegram notifications to ' + chatId + ' for address: ' + address);
                });
                response.end(JSON.stringify({status: 'done'}));
            }

            // Disable
            else if (action === "disable") {
                redisClient.hdel(config.coin + ':telegram', address, function(error, value){
                    if (error){
                        response.end(JSON.stringify({status: 'Unable to disable telegram notifications'}));
                        return;
                    }
                    log('info', logSystem, 'Disabled telegram notifications for address: ' + address);
                });
                response.end(JSON.stringify({status: 'done'}));
            }
        });
    }
}

/**
 * Return miners hashrate
 **/
function handleGetMinersHashrate(response) {
    let data = {};
    for (let miner in minersHashrate){
        if (miner.indexOf('~') !== -1) continue;
        data[miner] = minersHashrate[miner];
    }

    data = {
        minersHashrate: data
    }

    let reply = JSON.stringify(data);

    response.writeHead("200", {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reply, 'utf8')
    });
    response.end(reply);
}

/**
 * Return workers hashrate
 **/
function handleGetWorkersHashrate(response) {
    let data = {};
    for (let miner in minersHashrate){
        if (miner.indexOf('~') === -1) continue;
        data[miner] = minersHashrate[miner];
    }
    let reply = JSON.stringify({
        workersHashrate: data
    });

    response.writeHead("200", {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Content-Length': reply.length
    });
    response.end(reply);
}


/**
 * Authorize access to a secured API call
 **/
function authorize(request, response){
    let sentPass = url.parse(request.url, true).query.password;

    let remoteAddress = request.connection.remoteAddress;
    if(config.api.trustProxyIP && request.headers['x-forwarded-for']){
      remoteAddress = request.headers['x-forwarded-for'];
    }
    
    let bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
    if (typeof sentPass == "undefined" && (remoteAddress === '127.0.0.1' || remoteAddress === '::ffff:127.0.0.1' || remoteAddress === '::1' || (bindIp != "0.0.0.0" && remoteAddress === bindIp))) {
        return true;
    }
    
    response.setHeader('Access-Control-Allow-Origin', '*');

    let cookies = parseCookies(request);
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

    let cookieExpire = new Date( new Date().getTime() + 60*60*24*1000);
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
                ['keys', `${config.coin}:workers:*`],
                ['zrange', `${config.coin}:blocks:matured`, 0, -1]
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
            let redisCommands = workerKeys.map(function(k){
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
            let stats = {
                totalOwed: 0,
                totalPaid: 0,
                totalRevenue: 0,
                totalRevenueSolo: 0,
                totalDiff: 0,
                totalDiffSolo: 0,
                totalShares: 0,
                totalSharesSolo: 0,
                blocksOrphaned: 0,
                blocksUnlocked: 0,
                blocksUnlockedSolo: 0,
                totalWorkers: 0
            };

            for (let i = 0; i < workerData.length; i++){
                stats.totalOwed += parseInt(workerData[i][0]) || 0;
                stats.totalPaid += parseInt(workerData[i][1]) || 0;
                stats.totalWorkers++;
            }

            for (let i = 0; i < blocks.length; i++){
                let block = blocks[i].split(':');
                if (block[0] === 'prop' || block[0] === 'solo') {
                    if(block[7]){
                        if (block[0] === 'solo') {
                            stats.blocksUnlockedSolo++
                            stats.totalDiffSolo += parseInt(block[4])
                            stats.totalSharesSolo += parseInt(block[5])
                            stats.totalRevenueSolo += parseInt(block[7])
                        }
                        else
                        {
                            stats.blocksUnlocked++
                            stats.totalDiff += parseInt(block[4])
                            stats.totalShares += parseInt(block[5])
                            stats.totalRevenue += parseInt(block[7])                            
                        }
                    }
                    else {
                        stats.blocksOrphaned++
                    }
                }
                else {
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
function handleAdminUsers(request, response){
    let otherCoin = url.parse(request.url, true).query.otherCoin;
    async.waterfall([
        // get workers Redis keys
        function(callback) {
            redisClient.keys(`${config.coin}:workers:*`, callback);
        },

        // get workers data
        function(workerKeys, callback) {
            let allCoins = config.childPools
                                 .filter(pool => pool.enabled)
                                 .map(pool => {
                                     return `${pool.coin}`
                                 })

            allCoins.push(otherCoin)
            
            let redisCommands = workerKeys.map(function(k) {
                return ['hmget', k, 'balance', 'paid', 'lastShare', 'hashes', ...allCoins];
            });
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                let workersData = {}
                let keyParts = []
                let address = ''
                let data = []
                let wallet = ''
                let coin = null
                for(let i in redisData) {
                    keyParts = workerKeys[i].split(':');
                    address = keyParts[keyParts.length-1];
                    data = redisData[i];

                    for (let a = 0, b = 4; b <= data.length; a++, b++) {
                        if (data[b]) {
                            coin = `${allCoins[a]}=${data[b]}`
                            break
                        }
                    }

                    workersData[address] = {
                        pending: data[0],
                        paid: data[1],
                        lastShare: data[2],
                        hashes: data[3],
                        childWallet: coin,
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
    response.writeHead("200", {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
    });
    async.parallel({
        monitoring: getMonitoringData,
        logs: getLogFiles
    }, function(error, result) {
        response.end(JSON.stringify(result));
    });
}

/**
 * Administration: log file data
 **/
function handleAdminLog(urlParts, response){
    let file = urlParts.query.file;
    let filePath = config.logging.files.directory + '/' + file;
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
function handleAdminPorts(request, response){
    async.waterfall([
        function(callback) {
            redisClient.keys(`${config.coin}:ports:*`, callback);
        },
        function(portsKeys, callback) {
            let redisCommands = portsKeys.map(function(k) {
                return ['hmget', k, 'port', 'users'];
            });
            redisClient.multi(redisCommands).exec(function(error, redisData) {
                let portsData = {}
                let port = ''
                let data = []
                for (let i in redisData) {
                    port = portsKeys[i];

                    data = redisData[i];
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
 * Administration: test email notification
 **/
function handleTestEmailNotification(urlParts, response) {
    let email = urlParts.query.email;
    if (!config.email) {
        response.end(JSON.stringify({status: 'Email system is not configured'}));
        return;
    }
    if (!config.email.enabled) {
        response.end(JSON.stringify({status: 'Email system is not enabled'}));
        return;
    }
    if (!email) {
        response.end(JSON.stringify({status: 'No email specified'}));
        return;
    }
    log('info', logSystem, 'Sending test e-mail notification to %s', [email]);
    notifications.sendToEmail(email, 'test', {});
    response.end(JSON.stringify({status: 'done'}));
}

/**
 * Administration: test telegram notification
 **/
function handleTestTelegramNotification(urlParts, response) {
    if (!config.telegram) {
        response.end(JSON.stringify({status: 'Telegram is not configured'}));
        return;
    }
    if (!config.telegram.enabled) {
        response.end(JSON.stringify({status: 'Telegram is not enabled'}));
        return;
    }
    if (!config.telegram.token) {
        response.end(JSON.stringify({status: 'No telegram bot token specified in configuration'}));
        return;
    }
    if (!config.telegram.channel) {
        response.end(JSON.stringify({status: 'No telegram channel specified in configuration'}));
        return;
    }
    log('info', logSystem, 'Sending test telegram channel notification');
    notifications.sendToTelegramChannel('test', {});
    response.end(JSON.stringify({status: 'done'}));
}

/**
 * RPC monitoring of daemon and wallet
 **/

// Start RPC monitoring
function startRpcMonitoring(rpc, module, method, interval) {
    setInterval(function() {
        rpc(method, {}, function(error, response) {
            let stat = {
                lastCheck: new Date() / 1000 | 0,
                lastStatus: error ? 'fail' : 'ok',
                lastResponse: JSON.stringify(error ? error : response)
            };
            if(error) {
                stat.lastFail = stat.lastCheck;
                stat.lastFailResponse = stat.lastResponse;
            }
            let key = getMonitoringDataKey(module);
            let redisCommands = [];
            for(let property in stat) {
                redisCommands.push(['hset', key, property, stat[property]]);
            }
            redisClient.multi(redisCommands).exec();
        });
    }, interval * 1000);
}

// function startPriceMonitoring(rpc, module, method, endPoint, interval, coin) {
//     setInterval(function() {
//         let tickers = ['ARQ-BTC', 'ARQ-LTC', 'ARQ-USD', 'ARQ-EUR', 'ARQ-CAD'] 
//         let exchange = config.prices.source;
//         market.get(exchange, tickers, function(data) {
//             redisClient.set(`${config.coin}:status:prices`, JSON.stringify(data))
//         });
//     }, interval * 1000);
// }

// Return monitoring data key
function getMonitoringDataKey(module) {
    return config.coin + ':status:' + module;
}

// Initialize monitoring
function initMonitoring() {
    let modulesRpc = {
        daemon: apiInterfaces.rpcDaemon,
        wallet: apiInterfaces.rpcWallet,
        price: apiInterfaces.jsonHttpRequest
    };
    let daemonType = config.daemonType ? config.daemonType.toLowerCase() : "default";
    let settings = '';
    for(let module in config.monitoring) {
        settings = config.monitoring[module];
        // if (module === "price") {
        //     startPriceMonitoring(modulesRpc[module], module, settings.rpcMethod, settings.checkInterval, settings.tickers )
        //     break
        // }
        if (daemonType === "bytecoin" && module === "wallet" && settings.rpcMethod === "getbalance") {
            settings.rpcMethod = "getBalance";
        }
        if(settings.checkInterval) {
            startRpcMonitoring(modulesRpc[module], module, settings.rpcMethod, settings.checkInterval);
        }
    }
}

// Get monitoring data
function getMonitoringData(callback) {
    let modules = Object.keys(config.monitoring);
    let redisCommands = [];
    for(let i in modules) {
        redisCommands.push(['hgetall', getMonitoringDataKey(modules[i])])
    }
    redisClient.multi(redisCommands).exec(function(error, results) {
        let stats = {};
        for(let i in modules) {
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
    let dir = config.logging.files.directory;
    fs.readdir(dir, function(error, files) {
        let logs = {};
        let file = ''
        let stats = '';
        for(let i in files) {
            file = files[i];
            stats = fs.statSync(dir + '/' + file);
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
    let ipv4_regex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    if (ipv4_regex.test(ip)) {
        ip = '::ffff:' + ip;
    }
    redisClient.sismember([`${config.coin}:workers_ip:${address}`, ip], function(error, result) {
        let found = result > 0 ? true : false;
        callback(error, found);
    });
}

/**
 * Parse cookies data
 **/
function parseCookies(request) {
    let list = {},
        rc = request.headers.cookie;
    rc && rc.split(';').forEach(function(cookie) {
        let parts = cookie.split('=');
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
let bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";

// Start API on HTTP port
let server = http.createServer(function(request, response){
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

// Start API on SSL port
if (config.api.ssl){
    if (!config.api.sslCert) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate not configured', [bindIp, config.api.sslPort]);
    } else if (!config.api.sslKey) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL key not configured', [bindIp, config.api.sslPort]);
    } else if (!config.api.sslCA) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate authority not configured', [bindIp, config.api.sslPort]);
    } else if (!fs.existsSync(config.api.sslCert)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate file not found (configuration error)', [bindIp, config.api.sslPort]);
    } else if (!fs.existsSync(config.api.sslKey)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL key file not found (configuration error)', [bindIp, config.api.sslPort]);
    } else if (!fs.existsSync(config.api.sslCA)) {
        log('error', logSystem, 'Could not start API listening on %s port %d (SSL): SSL certificate authority file not found (configuration error)', [bindIp, config.api.sslPort]);
    } else {
        let options = {
            key: fs.readFileSync(config.api.sslKey),
            cert: fs.readFileSync(config.api.sslCert),
            ca: fs.readFileSync(config.api.sslCA),
            honorCipherOrder: true
        };
    
        let ssl_server = https.createServer(options, function(request, response){
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

        ssl_server.listen(config.api.sslPort, bindIp, function(){
            log('info', logSystem, 'API started & listening on %s port %d (SSL)', [bindIp, config.api.sslPort]);
        });
    }
}
