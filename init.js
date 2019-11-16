 /**
 * Cryptonite Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Pool initialization script
 **/

// Load needed modules
var fs = require('fs');
var cluster = require('cluster');
var os = require('os');

// Load configuration
require('./lib/configReader.js');

// Load log system
require('./lib/logger.js');

// Initialize redis database client
var redis = require('redis');

var redisDB = (config.redis.db && config.redis.db > 0) ? config.redis.db : 0;
global.redisClient = redis.createClient(config.redis.port, config.redis.host, { db: redisDB, auth_pass: config.redis.auth });

if (typeof config.childPools !== 'undefined')
    config.childPools = config.childPools.filter(pool => pool.enabled)

// Load pool modules
if (cluster.isWorker){
    switch(process.env.workerType){
        case 'pool':
            require('./lib/pool.js');
            break;
        case 'daemon':
            require('./lib/daemon.js')
            break
	case 'childDaemon':
	    require('./lib/childDaemon.js')
	    break
        case 'blockUnlocker':
            require('./lib/blockUnlocker.js');
            break;
        case 'paymentProcessor':
            require('./lib/paymentProcessor.js');
            break;
        case 'api':
            require('./lib/api.js');
            break;
        case 'chartsDataCollector':
            require('./lib/chartsDataCollector.js');
            break;
        case 'telegramBot':
            require('./lib/telegramBot.js');
            break;
    }
    return;
}

// Initialize log system
var logSystem = 'master';
require('./lib/exceptionWriter.js')(logSystem);

// Pool informations
log('info', logSystem, 'Starting Cryptonote Node.JS pool version %s', [version]);
 
// Run a single module ?
var singleModule = (function(){
    var validModules = ['pool', 'api', 'unlocker', 'payments', 'chartsDataCollector', 'telegramBot'];

    for (var i = 0; i < process.argv.length; i++){
        if (process.argv[i].indexOf('-module=') === 0){
            var moduleName = process.argv[i].split('=')[1];
            if (validModules.indexOf(moduleName) > -1)
                return moduleName;

            log('error', logSystem, 'Invalid module "%s", valid modules: %s', [moduleName, validModules.join(', ')]);
            process.exit();
        }
    }
})();

/**
 * Start modules
 **/
(function init(){
    checkRedisVersion(function(){
        if (singleModule){
            log('info', logSystem, 'Running in single module mode: %s', [singleModule]);

            switch(singleModule){
                case 'daemon':
                    spawnDaemon()
                    break
                case 'pool':
                    spawnPoolWorkers();
                    break;
                case 'unlocker':
                    spawnBlockUnlocker();
                    break;
                case 'payments':
                    spawnPaymentProcessor();
                    break;
                case 'api':
                    spawnApi();
                    break;
                case 'chartsDataCollector':
                    spawnChartsDataCollector();
                    break;
                case 'telegramBot':
                    spawnTelegramBot();
                    break;
            }
        }
        else{
            spawnPoolWorkers();
            spawnDaemon();
	    if (config.poolServer.mergedMining)
   	        spawnChildDaemons();
            spawnBlockUnlocker();
            spawnPaymentProcessor();
            spawnApi();
            spawnChartsDataCollector();
            spawnTelegramBot();
        }
    });
})();

/**
 * Check redis database version
 **/
function checkRedisVersion(callback){
    redisClient.info(function(error, response){
        if (error){
            log('error', logSystem, 'Redis version check failed');
            return;
        }
        var parts = response.split('\r\n');
        var version;
        var versionString;
        for (var i = 0; i < parts.length; i++){
            if (parts[i].indexOf(':') !== -1){
                var valParts = parts[i].split(':');
                if (valParts[0] === 'redis_version'){
                    versionString = valParts[1];
                    version = parseFloat(versionString);
                    break;
                }
            }
        }
        if (!version){
            log('error', logSystem, 'Could not detect redis version - must be super old or broken');
            return;
        }
        else if (version < 2.6){
            log('error', logSystem, "You're using redis version %s the minimum required version is 2.6. Follow the damn usage instructions...", [versionString]);
            return;
        }
        callback();
    });
}

/**
 * Spawn pool workers module
 **/
function spawnPoolWorkers(){
    if (!config.poolServer || !config.poolServer.enabled || !config.poolServer.ports || config.poolServer.ports.length === 0) return;

    if (config.poolServer.ports.length === 0){
        log('error', logSystem, 'Pool server enabled but no ports specified');
        return;
    }
    var numForks = (function(){
        if (!config.poolServer.clusterForks)
            return 1;
        if (config.poolServer.clusterForks === 'auto')
            return os.cpus().length;
        if (isNaN(config.poolServer.clusterForks))
            return 1;
        return config.poolServer.clusterForks;
    })();

    var poolWorkers = {};

    var createPoolWorker = function(forkId){
        var worker = cluster.fork({
            workerType: 'pool',
            forkId: forkId
        });
        worker.forkId = forkId;
        worker.type = 'pool';
        poolWorkers[forkId] = worker;
        worker.on('exit', function(code, signal){
            log('error', logSystem, 'Pool fork %s died, spawning replacement worker...', [forkId]);
            setTimeout(function(){
                createPoolWorker(forkId);
            }, 2000);
        }).on('message', function(msg){
            switch(msg.type){
                case 'banIP':
                    Object.keys(cluster.workers).forEach(function(id) {
                        if (cluster.workers[id].type === 'pool'){
                            cluster.workers[id].send({type: 'banIP', ip: msg.ip});
                        }
                    });
                    break;
            }
        });
    };

    var i = 1;
    var spawnInterval = setInterval(function(){
        createPoolWorker(i.toString());
        i++;
        if (i - 1 === numForks){
            clearInterval(spawnInterval);
            log('info', logSystem, 'Pool spawned on %d thread(s)', [numForks]);
        }
    }, 10);
}

/**
 * Spawn pool workers module
 **/
function spawnChildDaemons(){
    if (!config.poolServer || !config.poolServer.enabled || !config.poolServer.ports || config.poolServer.ports.length === 0) return;

    if (config.poolServer.ports.length === 0){
        log('error', logSystem, 'Pool server enabled but no ports specified');
        return;
    }

    var numForks = (function(){
        if (!config.poolServer.mergedMining)
            return 0;
        if (typeof config.childPools !== 'undefined') {
	    return config.childPools.length
	}
        return 0;
    })();
    var daemonWorkers = {};

    var createDaemonWorker = function(poolId){
        var worker = cluster.fork({
            workerType: 'childDaemon',
            poolId: poolId
        });
        worker.poolId = poolId;
        worker.type = 'childDaemon';
        daemonWorkers[poolId] = worker;
        worker.on('exit', function(code, signal){
            log('error', logSystem, 'Child Daemon fork %s died, spawning replacement worker...', [poolId]);
            setTimeout(function(){
                createDaemonWorker(poolId);
            }, 2000);
        }).on('message', function(msg){
            switch(msg.type){
                case 'ChildBlockTemplate':
                    Object.keys(cluster.workers).forEach(function(id) {
                        if (cluster.workers[id].type === 'pool'){
                            cluster.workers[id].send({type: 'ChildBlockTemplate', block: msg.block, poolIndex: msg.poolIndex});
                        }
                    });
                    break;
                }
        });
    };

    var i = 0;
    var spawnInterval = setInterval(function(){
        createDaemonWorker(i.toString())
	i++
        if (i === numForks){
            clearInterval(spawnInterval);
            log('info', logSystem, 'Child Daemon spawned on %d thread(s)', [numForks]);
        }
    }, 10);
}


/**
 * Spawn daemon module
 **/
function spawnDaemon(){
    if (!config.poolServer || !config.poolServer.enabled || !config.poolServer.ports || config.poolServer.ports.length === 0) return;

    var worker = cluster.fork({
        workerType: 'daemon'
    });
    worker.on('exit', function(code, signal){
        log('error', logSystem, 'Daemon died, spawning replacement...');
        setTimeout(function(){
            spawnDaemon();
        }, 10);
    }).on('message', function(msg){
        switch(msg.type){
            case 'BlockTemplate':
                Object.keys(cluster.workers).forEach(function(id) {
                    if (cluster.workers[id].type === 'pool'){
                        cluster.workers[id].send({type: 'BlockTemplate', block: msg.block});
                    }
                });
                break;
        }
    });
}

/**
 * Spawn block unlocker module
 **/
function spawnBlockUnlocker(){
    if (!config.blockUnlocker || !config.blockUnlocker.enabled) return;

    var worker = cluster.fork({
        workerType: 'blockUnlocker'
    });
    worker.on('exit', function(code, signal){
        log('error', logSystem, 'Block unlocker died, spawning replacement...');
        setTimeout(function(){
            spawnBlockUnlocker();
        }, 2000);
    });
}

/**
 * Spawn payment processor module
 **/
function spawnPaymentProcessor(){
    if (!config.payments || !config.payments.enabled) return;

    var worker = cluster.fork({
        workerType: 'paymentProcessor'
    });
    worker.on('exit', function(code, signal){
        log('error', logSystem, 'Payment processor died, spawning replacement...');
        setTimeout(function(){
            spawnPaymentProcessor();
        }, 2000);
    });
}

/**
 * Spawn API module
 **/
function spawnApi(){
    if (!config.api || !config.api.enabled) return;

    var worker = cluster.fork({
        workerType: 'api'
    });
    worker.on('exit', function(code, signal){
        log('error', logSystem, 'API died, spawning replacement...');
        setTimeout(function(){
            spawnApi();
        }, 2000);
    });
}

/**
 * Spawn charts data collector module
 **/
function spawnChartsDataCollector(){
    if (!config.charts) return;

    var worker = cluster.fork({
        workerType: 'chartsDataCollector'
    });
    worker.on('exit', function(code, signal){
        log('error', logSystem, 'chartsDataCollector died, spawning replacement...');
        setTimeout(function(){
            spawnChartsDataCollector();
        }, 2000);
    });
}

/**
 * Spawn telegram bot module
 **/
function spawnTelegramBot(){
    if (!config.telegram || !config.telegram.enabled || !config.telegram.token) return;

    var worker = cluster.fork({
        workerType: 'telegramBot'
    });
    worker.on('exit', function(code, signal){
        log('error', logSystem, 'telegramBot died, spawning replacement...');
        setTimeout(function(){
            spawnTelegramBot();
        }, 2000);
    });
}
