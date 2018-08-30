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

var fs = require('fs');
var cluster = require('cluster');
var os = require('os');

const args = require("args-parser")(process.argv);

// Initialize log system
var logSystem = 'init';
/**
 * Load pool configuration
 **/
global.config = require('./lib/bootstrap')(args.config || 'config.json');

require('./lib/logger.js');


global.redisClient = require('redis').createClient((function(){
	var options = { 
		host:global.config.redis.host || "127.0.0.1",
		socket_keepalive:true,
		port:global.config.redis.port || 6379, 
		retry_strategy: function (options) {
	        if (options.error && options.error.code === 'ECONNREFUSED') {
	            // End reconnecting on a specific error and flush all commands with
	            // a individual error
	        	log('error', logSystem,'The server refused the connection');
				return;
	        }
	        if (options.total_retry_time > 1000 * 60 * 60) {
	            // End reconnecting after a specific timeout and flush all commands
	            // with a individual error
	            return new Error('Retry time exhausted');
	        }
	        if (options.attempt > 10) {
	            // End reconnecting with built in error
	            return undefined;
	        }
	        // reconnect after
	        return Math.min(options.attempt * 100, 3000);
	    },
		db: config.redis.db || 0,
	};
	
	if(config.redis.auth){
		options.auth_pass= config.redis.auth;
	}
	return options;
})());

global.redisClient.on('error', function (err) {
    log('error', logSystem, "Error on redis with code : %s",[err.code]);
});

// Load pool modules
if (cluster.isWorker){
    switch(process.env.workerType){
        case 'pool':
            require('./lib/pool.js');
            break;
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
    }
    return;
}

require('./lib/exceptionWriter.js')(logSystem);

// Pool informations
log('info', logSystem, 'Starting Stellite Node.JS pool version %s', [global.version]);

/**
 * Start modules
 **/
(function(){
	/**
	 * Spawn pool workers module
	 **/
	function spawnPoolWorkers(){
	    if (!config.poolServer || !config.poolServer.enabled) {
	    	return;
	    }
	    
	    if (!config.poolServer.ports || config.poolServer.ports.length === 0){
	        log('error', logSystem, 'Pool server enabled but no ports specified');
	        return;
	    }
	
	    var numForks = (function(){
	        if (!config.poolServer.clusterForks){
	            return 1;
	        }
	        if (config.poolServer.clusterForks === 'auto'){
	            return os.cpus().length;
	        }
	        if (isNaN(config.poolServer.clusterForks)){
	            return 1;
	        }
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
	            }, global.config.poolServer.timeout || 2000);
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
	
	    var i = 0;
	    var spawnInterval = setInterval(function(){
	        createPoolWorker(i.toString());
			i++;
	        if (i -1 === numForks){
	        	log('info', logSystem, 'Pool spawned on %d thread(s)', [numForks]);
	            clearInterval(spawnInterval);
				return;
	        }
	        
	    }, 10);
	}
	
	/**
	 * Spawn block unlocker module
	 **/
	function spawnBlockUnlocker(){
	    if (!config.blockUnlocker || !config.blockUnlocker.enabled) {
	    	return;
	    }
	
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
	    if (!config.payments || !config.payments.enabled) {
	    	return;
	    }
	
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
	    if (!config.api || !config.api.enabled) {
	    	return;
	    }
	
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
	
	
	var init = function(){
    	 
		// Run a single module ?
		var singleModule = (function(){
		    var validModules = ['pool', 'api', 'unlocker', 'payments', 'chartsDataCollector'];
		
		    for (var i = 0; i < process.argv.length; i++){
		        if (process.argv[i].indexOf('-module=') === 0){
		            var moduleName = process.argv[i].split('=')[1];
		            if (validModules.indexOf(moduleName) > -1){
		                return moduleName.toLoweCase();
		            }
		            log('error', logSystem, 'Invalid module "%s", valid modules: %s', [moduleName, validModules.join(', ')]);
		            process.exit();
		        }
		    }
		})();

        if (!singleModule){
        	spawnPoolWorkers();
	        spawnBlockUnlocker();
	        spawnPaymentProcessor();
	        spawnApi();
	        spawnChartsDataCollector();
	        return;
        }
        log('info', logSystem, 'Running in single module mode: %s', [singleModule]);

        switch(singleModule){
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
            default:
            	break;
        }
    };
    
    /**
	 * Check redis database version
	 **/
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
        } else if (version < 2.6){
            log('error', logSystem, "You're using redis version %s the minimum required version is 2.6. Follow the damn usage instructions...", [versionString]);
        } else {
        	init();
        }
    });
})();