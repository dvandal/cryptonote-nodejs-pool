let utils = require('./utils.js');
let async = require('async');
let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
let lastHash;

let POOL_NONCE_SIZE = 16 + 1; // +1 for old XMR/new TRTL bugs
let EXTRA_NONCE_TEMPLATE = "02" + POOL_NONCE_SIZE.toString(16) + "00".repeat(POOL_NONCE_SIZE);
let POOL_NONCE_MM_SIZE = POOL_NONCE_SIZE + utils.cnUtil.get_merged_mining_nonce_size();
let EXTRA_NONCE_NO_CHILD_TEMPLATE = "02" + POOL_NONCE_MM_SIZE.toString(16) + "00".repeat(POOL_NONCE_MM_SIZE);


let logSystem = 'daemon'
let blockData = JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: 'getlastblockheader',
        params: {}
    })

let templateData = JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: 'getblocktemplate',
        params: {reserve_size: config.poolServer.mergedMining ? POOL_NONCE_MM_SIZE : POOL_NONCE_SIZE, wallet_address: config.poolServer.poolAddress}
    })


require('./exceptionWriter.js')(logSystem);


function runInterval(){
    async.waterfall([
	function(callback) {
	  apiInterfaces.jsonHttpRequest(config.daemon.host, config.daemon.port, blockData , function(err, res){
            if(err){
	            log('error', logSystem, '%s error from daemon', [pool.coin]);
                setTimeout(runInterval, 3000);
                return;
            }
            if (res && res.result && res.result.status === "OK" && res.result.hasOwnProperty('block_header')){
                let hash = res.result.block_header.hash.toString('hex');
                if (!lastHash || lastHash !== hash) {
		    lastHash = hash
	            log('info', logSystem, '%s found new hash %s', [config.coin, hash]);
                    callback(null, true);
                    return;
                }else{
                    callback(true);
                    return;
                }
            } else {
	            log('error', logSystem, 'bad reponse from daemon');
                setTimeout(runInterval, 3000);
                return;
            }
        });
	},
	function(getbc, callback) {
	    apiInterfaces.jsonHttpRequest(config.daemon.host, config.daemon.port, templateData, function(err, res) {
	        if (err) {
		    log('error', logSystem, 'Error polling getblocktemplate %j', [err])
		    callback(null)
		    return
		}
	        process.send({type: 'BlockTemplate', block: res.result})
	        callback(null)
	    })
	}
    ],
    function(error) {
	if (error){}
        setTimeout(function() {
            runInterval()
        }, config.poolServer.blockRefreshInterval)
    })
}

runInterval()
