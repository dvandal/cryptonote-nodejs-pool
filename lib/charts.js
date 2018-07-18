/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Charts data functions
 **/

// Load required modules
var fs = require('fs');
var async = require('async');
var http = require('http');

var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
var market = require('./market.js');

// Set charts cleanup interval
var cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;

// Initialize log system
var logSystem = 'charts';
require('./exceptionWriter.js')(logSystem);

/**
 * Charts data collectors (used by chartsDataCollector.js)
 **/
 
// Start data collectors
function startDataCollectors() {
    async.each(Object.keys(config.charts.pool), function(chartName) {
        var settings = config.charts.pool[chartName];
        if(settings.enabled) {
            setInterval(function() {
                collectPoolStatWithInterval(chartName, settings);
            }, settings.updateInterval * 1000);
        }
    });

    var settings = config.charts.user.hashrate;
    if(settings.enabled) {
        setInterval(function() {
            collectUsersHashrate('hashrate', settings);
        }, settings.updateInterval * 1000)
    }

    settings = config.charts.user.worker_hashrate;
    if (settings && settings.enabled) {
        setInterval(function() {
            collectWorkersHashrate('worker_hashrate', settings);
        }, settings.updateInterval * 1000);
    }
}

// Chart data functions
var chartStatFuncs = {
    hashrate: getPoolHashrate,
    miners: getPoolMiners,
    workers: getPoolWorkers,
    difficulty: getNetworkDifficulty,
    price: getCoinPrice,
    profit: getCoinProfit
};

// Statistic value handler
var statValueHandler = {
    avg: function(set, value) {
        set[1] = (set[1] * set[2] + value) / (set[2] + 1);
    },
    avgRound: function(set, value) {
        statValueHandler.avg(set, value);
        set[1] = Math.round(set[1]);
    },
    max: function(set, value) {
        if(value > set[1]) {
            set[1] = value;
        }
    }
};

// Presave functions
var preSaveFunctions = {
    hashrate: statValueHandler.avgRound,
    workers: statValueHandler.max,
    difficulty: statValueHandler.avgRound,
    price: statValueHandler.avg,
    profit: statValueHandler.avg
};

// Store collected values in redis database
function storeCollectedValues(chartName, values, settings) {
    for(var i in values) {
        storeCollectedValue(chartName + ':' + i, values[i], settings);
    }
}

// Store collected value in redis database
function storeCollectedValue(chartName, value, settings) {
    var now = new Date() / 1000 | 0;
    getChartDataFromRedis(chartName, function(sets) {
        var lastSet = sets[sets.length - 1]; // [time, avgValue, updatesCount]
        if(!lastSet || now - lastSet[0] > settings.stepInterval) {
            lastSet = [now, value, 1];
            sets.push(lastSet);
            while(now - sets[0][0] > settings.maximumPeriod) { // clear old sets
                sets.shift();
            }
        }
        else {
            preSaveFunctions[chartName]
                ? preSaveFunctions[chartName](lastSet, value)
                : statValueHandler.avgRound(lastSet, value);
            lastSet[2]++;
        }
        
        if(getStatsRedisKey(chartName).search(config.coin + ":charts:hashrate") >=0){
             redisClient.set(getStatsRedisKey(chartName), JSON.stringify(sets), 'EX', (86400 * cleanupInterval));
        }
        else{
            redisClient.set(getStatsRedisKey(chartName), JSON.stringify(sets));
        }       
        
        log('info', logSystem, chartName + ' chart collected value ' + value + '. Total sets count ' + sets.length);
    });
}

// Collect pool statistics with an interval
function collectPoolStatWithInterval(chartName, settings) {
    async.waterfall([
        chartStatFuncs[chartName],
        function(value, callback) {
            storeCollectedValue(chartName, value, settings, callback);
        }
    ]);
}

/**
 * Get chart data from redis database
 **/
function getChartDataFromRedis(chartName, callback) {
    redisClient.get(getStatsRedisKey(chartName), function(error, data) {
        callback(data ? JSON.parse(data) : []);
    });
}

/**
 * Return redis key for chart data
 **/
function getStatsRedisKey(chartName) {
    return config.coin + ':charts:' + chartName;
}

/**
 * Get pool statistics from API
 **/
function getPoolStats(callback) {
    apiInterfaces.pool('/stats', function(error, data) {
        if (error) {
            log('error', logSystem, 'Unable to get API data for stats: ' + error);
        }
        callback(error, data);
    });
}

/**
 * Get pool hashrate from API
 **/
function getPoolHashrate(callback) {
    getPoolStats(function(error, stats) {
        callback(error, stats.pool ? Math.round(stats.pool.hashrate) : null);
    });
}

/**
 * Get pool miners from API
 **/
function getPoolMiners(callback) {
    getPoolStats(function(error, stats) {
        callback(error, stats.pool ? stats.pool.miners : null);
    });
}

/**
 * Get pool workers from API
 **/
function getPoolWorkers(callback) {
    getPoolStats(function(error, stats) {
        callback(error, stats.pool ? stats.pool.workers : null);
    });
}

/**
 * Get network difficulty from API
 **/
function getNetworkDifficulty(callback) {
    getPoolStats(function(error, stats) {
        callback(error, stats.pool ? stats.network.difficulty : null);
    });
}

/**
 * Get users hashrate from API
 **/
function getUsersHashrates(callback) {
    apiInterfaces.pool('/miners_hashrate', function(error, data) {
        if (error) {
            log('error', logSystem, 'Unable to get API data for miners_hashrate: ' + error);
        }
        var resultData = data && data.minersHashrate ? data.minersHashrate : {};
        callback(resultData);
    });
}

/**
 * Get workers' hashrates from API
 **/
function getWorkersHashrates(callback) {
    apiInterfaces.pool('/workers_hashrate', function(error, data) {
        if (error) {
            log('error', logSystem, 'Unable to get API data for workers_hashrate: ' + error);
        }
        var resultData = data && data.workersHashrate ? data.workersHashrate : {};
        callback(resultData);
    });
}

/**
 * Collect users hashrate from API
 **/
function collectUsersHashrate(chartName, settings) {
    var redisBaseKey = getStatsRedisKey(chartName) + ':';
    redisClient.keys(redisBaseKey + '*', function(keys) {
        var hashrates = {};
        for(var i in keys) {
            hashrates[keys[i].substr(redisBaseKey.length)] = 0;
        }
        getUsersHashrates(function(newHashrates) {
            for(var address in newHashrates) {
                hashrates[address] = newHashrates[address];
            }
            storeCollectedValues(chartName, hashrates, settings);
        });
    });
}

/**
 * Get user hashrate chart data
 **/
function getUserHashrateChartData(address, callback) {
    getChartDataFromRedis('hashrate:' + address, callback);
}

/**
 * Collect worker hashrates from API
 **/
function collectWorkersHashrate(chartName, settings) {
    var redisBaseKey = getStatsRedisKey(chartName) + ':';
    redisClient.keys(redisBaseKey + '*', function(keys) {
        var hashrates = {};
        for(var i in keys) {
            hashrates[keys[i].substr(redisBaseKey.length)] = 0;
        }
        getWorkersHashrates(function(newHashrates) {
            for(var addr_worker in newHashrates) {
                hashrates[addr_worker] = newHashrates[addr_worker];
            }
            storeCollectedValues(chartName, hashrates, settings);
        });
    });
}

/**
 * Convert payments data to chart
 **/
function convertPaymentsDataToChart(paymentsData) {
    var data = [];
    if(paymentsData && paymentsData.length) {
        for(var i = 0; paymentsData[i]; i += 2) {
            data.unshift([+paymentsData[i + 1], paymentsData[i].split(':')[1]]);
        }
    }
    return data;
}

/**
 * Get current coin market price
 **/
function getCoinPrice(callback) {
    var source = config.prices.source;
    var currency = config.prices.currency;

    var tickers = [config.symbol.toUpperCase() + '-' + currency.toUpperCase()];
    market.get(source, tickers, function(data) {
        var error = (!data || !data[0] || !data[0].price) ? 'No exchange data for ' + config.symbol.toUpperCase() + ' to ' + currency.toUpperCase() + ' using ' + source : null;
        var price = (data && data[0] && data[0].price) ? data[0].price : null;
        callback(error, price);	
    });
}

/**
 * Get current coin profitability
 **/
function getCoinProfit(callback) {
    getCoinPrice(function(error, price) {
        if(error) {
            callback(error);
            return;
        }
        getPoolStats(function(error, stats) {
            if(error) {
                callback(error);
                return;
            }
            callback(null, stats.lastblock.reward * price / stats.network.difficulty / config.coinUnits);
        });
    });
}

/**
 * Return pool charts data
 **/
function getPoolChartsData(callback) {
    var chartsNames = [];
    var redisKeys = [];
    for(var chartName in config.charts.pool) {
        if(config.charts.pool[chartName].enabled) {
            chartsNames.push(chartName);
            redisKeys.push(getStatsRedisKey(chartName));
        }
    }
    if(redisKeys.length) {
        redisClient.mget(redisKeys, function(error, data) {
            var stats = {};
            if(data) {
                for(var i in data) {
                    if(data[i]) {
                        stats[chartsNames[i]] = JSON.parse(data[i]);
                    }
                }
            }
            callback(error, stats);
        });
    }
    else {
        callback(null, {});
    }
}

/**
 * Return user charts data
 **/
function getUserChartsData(address, paymentsData, callback) {
    var stats = {};
    var chartsFuncs = {
        hashrate: function(callback) {
            getUserHashrateChartData(address, function(data) {
                callback(null, data);
            });
        },

        payments: function(callback) {
            callback(null, convertPaymentsDataToChart(paymentsData));
        }
    };
    for(var chartName in chartsFuncs) {
        if(!config.charts.user[chartName].enabled) {
            delete chartsFuncs[chartName];
        }
    }
    async.parallel(chartsFuncs, callback);
}


/**
 * Exports charts functions
 **/
module.exports = {
    startDataCollectors: startDataCollectors,
    getUserChartsData: getUserChartsData,
    getPoolChartsData: getPoolChartsData
};
