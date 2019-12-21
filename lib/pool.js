/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Pool TCP daemon
 **/

// Load required modules
let fs = require('fs');
let net = require('net');
let tls = require('tls');
let async = require('async');
let bignum = require('bignum');

let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
let notifications = require('./notifications.js');
let utils = require('./utils.js');

config.hashingUtil = config.hashingUtil || false;
let cnHashing = require('cryptonight-hashing');
if (config.hashingUtil)
    cnHashing = require('turtlecoin-multi-hashing');

// Set nonce pattern - must exactly be 8 hex chars
let noncePattern = new RegExp("^[0-9A-Fa-f]{8}$");

// Set redis database cleanup interval
let cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;
let fallBackCoin = typeof config.poolServer.fallBackCoin !== 'undefined' && config.poolServer.fallBackCoin ? config.poolServer.fallBackCoin : 0

// Initialize log system
let logSystem = 'pool';
require('./exceptionWriter.js')(logSystem);

let threadId = '(Thread ' + process.env.forkId + ') ';
let log = function(severity, system, text, data){
    global.log(severity, system, threadId + text, data);
};

// Set cryptonight algorithm
let cnAlgorithm = config.cnAlgorithm || "cryptonight";
let cnVariant = config.cnVariant || 0;
let cnBlobType = config.cnBlobType || 0;

let cryptoNight;
if (!cnHashing || !cnHashing[cnAlgorithm]) {
    log('error', logSystem, 'Invalid cryptonight algorithm: %s', [cnAlgorithm]);
} else {
    cryptoNight = cnHashing[cnAlgorithm];
}

// Set instance id
let instanceId = utils.instanceId();

// Pool variables
let poolStarted = false;
let connectedMiners = {};
// Get merged mining tag reseved space size
let POOL_NONCE_SIZE = 16 + 1; // +1 for old XMR/new TRTL bugs
let EXTRA_NONCE_TEMPLATE = "02" + POOL_NONCE_SIZE.toString(16) + "00".repeat(POOL_NONCE_SIZE);
let POOL_NONCE_MM_SIZE = POOL_NONCE_SIZE + utils.cnUtil.get_merged_mining_nonce_size();
let EXTRA_NONCE_NO_CHILD_TEMPLATE = "02" + POOL_NONCE_MM_SIZE.toString(16) + "00".repeat(POOL_NONCE_MM_SIZE);
let mergedMining = config.poolServer.mergedMining && (Array.isArray(config.childPools) && config.childPools.length > 0)

function randomIntFromInterval(min,max){
    return Math.floor(Math.random()*(max-min+1)+min);
}


// Pool settings
let shareTrustEnabled = config.poolServer.shareTrust && config.poolServer.shareTrust.enabled;
let shareTrustStepFloat = shareTrustEnabled ? config.poolServer.shareTrust.stepDown / 100 : 0;
let shareTrustMinFloat = shareTrustEnabled ? config.poolServer.shareTrust.min / 100 : 0;

let banningEnabled = config.poolServer.banning && config.poolServer.banning.enabled;
let bannedIPs = {};
let perIPStats = {};


let slushMiningEnabled = config.poolServer.slushMining && config.poolServer.slushMining.enabled;

if (!config.poolServer.paymentId) config.poolServer.paymentId = {};
if (!config.poolServer.paymentId.addressSeparator) config.poolServer.paymentId.addressSeparator = "+";

config.isRandomX = config.isRandomX || false

let previousOffset = config.previousOffset || 7
let offset = config.offset || 2
config.daemonType = config.daemonType || 'default'
if (config.daemonType === 'bytecoin')
{
    previousOffset = config.previousOffset || 3
    offset = config.offset || 3
}

function Create2DArray(rows) {
  let arr = [];

  for (let i=0;i<rows;i++) {
     arr[i] = [];
  }

  return arr;
}

if (mergedMining)
    config.childPools = config.childPools.filter(pool => pool.enabled)


// Block templates
let validBlockTemplates = mergedMining ? Create2DArray(config.childPools.length) : Create2DArray(1);
let currentBlockTemplate = [];


// Child Block templates
let currentChildBlockTemplate = new Array(mergedMining ? config.childPools.length : 1);


// Difficulty buffer
let diff1 = bignum('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 16);

/**
 * Convert buffer to byte array
 **/
Buffer.prototype.toByteArray = function () {
    return Array.prototype.slice.call(this, 0);
};

/**
 * Periodical updaters
 **/

// Variable difficulty retarget
setInterval(function(){
    let now = Date.now() / 1000 | 0;
    for (let minerId in connectedMiners){
        let miner = connectedMiners[minerId];
        if(!miner.noRetarget) {
            miner.retarget(now);
        }
    }
}, config.poolServer.varDiff.retargetTime * 1000);

// Every 30 seconds clear out timed-out miners and old bans
setInterval(function(){
    let now = Date.now();
    let timeout = config.poolServer.minerTimeout * 1000;
    for (let minerId in connectedMiners){
        let miner = connectedMiners[minerId];
        if (now - miner.lastBeat > timeout){
            log('warn', logSystem, 'Miner timed out and disconnected %s@%s', [miner.login, miner.ip]);
            delete connectedMiners[minerId];
            removeConnectedWorker(miner, 'timeout');
        }
    }

    if (banningEnabled){
        for (ip in bannedIPs){
            let banTime = bannedIPs[ip];
            if (now - banTime > config.poolServer.banning.time * 1000) {
                delete bannedIPs[ip];
                delete perIPStats[ip];
                log('info', logSystem, 'Ban dropped for %s', [ip]);
            }
        }
    }

}, 30000);

/**
 * Handle multi-thread messages
 **/
process.on('message', function(message) {
    switch (message.type) {
        case 'banIP':
            bannedIPs[message.ip] = Date.now();
            break;
        case 'BlockTemplate':
            let buffer = Buffer.from(message.block.blocktemplate_blob, 'hex');
            let new_hash = Buffer.alloc(32);
            buffer.copy(new_hash, 0, previousOffset, 39);
            try {
                if (!currentBlockTemplate[0] || new_hash.toString('hex') !== currentBlockTemplate[0].prev_hash.toString('hex') || (currentBlockTemplate[0].num_transactions == 0 && message.block.num_transactions > 0)) {
                    log('info', logSystem, 'New %s block to mine at height %d w/ difficulty of %d (%d transactions)', [config.coin, message.block.height, message.block.difficulty, (message.block.num_transactions || 0)]);
                    if (mergedMining) {
                         for (var childPoolIndex = 0; childPoolIndex < config.childPools.length; childPoolIndex++) {
                             processBlockTemplate(message.block, childPoolIndex);
                         }
                    } else {
                        processBlockTemplate(message.block, 0);
                    }
                    return;
                }else{
                    return;
                }
            }catch(e){log('error', logSystem, `BlockTemplate ${e}`)}
            break;
        case 'ChildBlockTemplate':
	    let poolIndex = parseInt(message.poolIndex)
            try {
                if (!currentChildBlockTemplate[poolIndex] || message.block.height > currentChildBlockTemplate[poolIndex].height || (currentChildBlockTemplate[poolIndex].num_transactions == 0 && message.block.num_transactions > 0)) {
                    log('info', logSystem, 'New %s child block to mine at height %d w/ difficulty of %d (%d transactions)', [config.childPools[poolIndex].coin, message.block.height, message.block.difficulty, (message.block.num_transactions || 0)]);
                    processChildBlockTemplate(poolIndex, message.block);
                    return;
                }else{
                    return;
                }
            }catch(e){log('error', logSystem, `ChildBlockTemplate ${e}`)}

            break;
    }
});

/**
 * Block template
 **/
function BlockTemplate(template, parent, indexOfChildPool){
    this.difficulty = template.difficulty;
    this.height;
    try {
    this.height = template.height;
    }catch(e){console.log(`BlockTemplate ${e}`)}
    this.num_transactions = template.num_transactions || 0;
    this.blocktemplate_blob = template.blocktemplate_blob;
    let blob = this.blocktemplate_blob;
    this.buffer = Buffer.from(blob, 'hex');
    let template_hex = EXTRA_NONCE_TEMPLATE;
    if (parent && mergedMining) {
        if (currentChildBlockTemplate[indexOfChildPool]) {
            this.childBlockTemplate = currentChildBlockTemplate[indexOfChildPool];
            this.buffer = utils.cnUtil.construct_mm_parent_block_blob(this.buffer, cnBlobType, this.childBlockTemplate.buffer);
            blob = this.buffer.toString('hex');
        } else {
            template_hex = EXTRA_NONCE_NO_CHILD_TEMPLATE;
        }
    }
    this.isRandomX = config.isRandomX
    if (!mergedMining && this.isRandomX)
    {
        this.seed_hash = template.seed_hash;
        this.next_seed_hash = template.next_seed_hash;   
    }
    var found_template_at = blob.indexOf(template_hex);
    if (found_template_at !== -1) {
        this.reserveOffset = offset + (found_template_at >> 1);
        if (this.reserveOffset != template.reserved_offset && !mergedMining) {
            log('error', logSystem, "INTERNAL ERROR: found reserve offset in unexpected place (found at %d, expected at %d)",
                [this.reserveOffset, template.reserved_offset]);
        }
    } else {
        log('error', logSystem, "INTERNAL ERROR: Couldn't find extra nonce data in blob!");
        this.reserveOffset = template.reserveOffset || template.reserved_offset;
    }
    // Copy the Instance ID to the reserve offset + 4 bytes deeper.  Copy in 4 bytes.
    instanceId.copy(this.buffer, this.reserveOffset + 4, 0, 4);

    // Reset nonce - this is the per-miner/pool nonce
    this.extraNonce = 0;
     // The clientNonceLocation is the location at which the client pools should set the nonces for each of their clients.
    this.clientNonceLocation = this.reserveOffset + 12;

    this.prev_hash = Buffer.alloc(32);
    this.buffer.copy(this.prev_hash, 0, previousOffset, 39);
}
BlockTemplate.prototype = {
    nextBlob: function(index){
        this.buffer.writeUInt32BE(++this.extraNonce, this.reserveOffset);
        if (mergedMining && this.childBlockTemplate) {
	    return utils.cnUtil.convert_blob(this.buffer, cnBlobType, this.childBlockTemplate.buffer).toString('hex')
        }
        return utils.cnUtil.convert_blob(this.buffer, cnBlobType).toString('hex');
    },
    nextBlobWithChildNonce: function(){
        // Write a 32 bit integer, big-endian style to the 0 byte of the reserve offset.
        this.buffer.writeUInt32BE(++this.extraNonce, this.reserveOffset);
        // Don't convert the blob to something hashable.  You bad.
        return this.buffer.toString('hex');
    }
};


/**
 * Get block template
 **/
/*function getBlockTemplate(callback){
    let rsize = config.poolServer.mergedMining ? POOL_NONCE_MM_SIZE : POOL_NONCE_SIZE;
    apiInterfaces.rpcDaemon('getblocktemplate',
                            {reserve_size: rsize, wallet_address: config.poolServer.poolAddress},
                            callback)
}*/

/**
 * Get child block template
 **/
/*function getChildBlockTemplate(poolIndex, callback){
    apiInterfaces.rpcDaemon('getblocktemplate',
                            {reserve_size: POOL_NONCE_SIZE, wallet_address: config.childPools[poolIndex].poolAddress},
                            callback, config.childPools[poolIndex].childDaemon)
}*/

/**
 * Process block template
 **/
function processBlockTemplate(template, indexOfChildPool){
    let block_template = new BlockTemplate(template, true, indexOfChildPool)

    if (currentBlockTemplate[indexOfChildPool])
        validBlockTemplates[indexOfChildPool].push(currentBlockTemplate[indexOfChildPool]);

    while (validBlockTemplates[indexOfChildPool].length > (mergedMining ? 6 : 3))
         validBlockTemplates[indexOfChildPool].shift();

    currentBlockTemplate[indexOfChildPool] = block_template;
    notifyConnectedMiners(indexOfChildPool)
}



/**
 * Process child block template
 **/
function processChildBlockTemplate(indexOfChildPool, template){
    let block_template = new BlockTemplate(template, false);

    currentChildBlockTemplate[indexOfChildPool] = block_template;

    // Update the parent block template to include this new child
    if (currentBlockTemplate[indexOfChildPool]){
        processBlockTemplate(currentBlockTemplate[indexOfChildPool], indexOfChildPool);
    }
}

function notifyConnectedMiners(indexOfChildPool){
    let now = Date.now() / 1000 | 0;
    for (let minerId in connectedMiners){
        let miner = connectedMiners[minerId];
        if (indexOfChildPool === miner.activeChildPool)
            miner.pushMessage('job', miner.getJob());
    }
}

/**
 * Variable difficulty
 **/
let VarDiff = (function(){
    let variance = config.poolServer.varDiff.variancePercent / 100 * config.poolServer.varDiff.targetTime;
    return {
        variance: variance,
        bufferSize: config.poolServer.varDiff.retargetTime / config.poolServer.varDiff.targetTime * 4,
        tMin: config.poolServer.varDiff.targetTime - variance,
        tMax: config.poolServer.varDiff.targetTime + variance,
        maxJump: config.poolServer.varDiff.maxJump
    };
})();

function GetRewardTypeAsKey(rewardType){
    switch (rewardType) {
    case 'solo':
        return ':solo'
    case 'prop':
        return ''
    default:
        return ''
    }
}

/**
 * Miner
 **/
function Miner(rewardType, childRewardType, id, childPoolIndex, login, pass, ip, port, agent, childLogin, startingDiff, noRetarget, pushMessage){
    this.rewardType = rewardType
    this.childRewardType = childRewardType
    this.rewardTypeAsKey  = GetRewardTypeAsKey(rewardType)
    this.childRewardTypeAsKey = GetRewardTypeAsKey(childRewardType)

    this.lastChildBlockHeight = 0
    this.id = id;
    this.activeChildPool = childPoolIndex || 0;
    this.login = login;
    this.pass = pass;
    this.ip = ip;
    this.port = port;
    this.proxy = false;
    if (agent && agent.includes('xmr-node-proxy')) {
        this.proxy = true;
    }
    this.workerName = 'undefined';
    this.childLogin = childLogin;
    if (pass.lastIndexOf('@') >= 0 && pass.lastIndexOf('@') < pass.length) {
        passDelimiterPos = pass.lastIndexOf('@') + 1;
        this.workerName = pass.substr(passDelimiterPos, pass.length).trim();
    }
    this.pushMessage = pushMessage;
    this.heartbeat();
    this.noRetarget = noRetarget;
    this.difficulty = startingDiff;
    this.validJobs = [];
    this.workerName2 = pass;

    // Vardiff related variables
    this.shareTimeRing = utils.ringBuffer(16);
    this.lastShareTime = Date.now() / 1000 | 0;

    if (shareTrustEnabled) {
        this.trust = {
            threshold: config.poolServer.shareTrust.threshold,
            probability: 1,
            penalty: 0
        };
    }
}
Miner.prototype = {
    retarget: function(now){

        let options = config.poolServer.varDiff;

        let sinceLast = now - this.lastShareTime;
        let decreaser = sinceLast > VarDiff.tMax;

        let avg = this.shareTimeRing.avg(decreaser ? sinceLast : null);
        let newDiff;

        let direction;

        if (avg > VarDiff.tMax && this.difficulty > options.minDiff){
            newDiff = options.targetTime / avg * this.difficulty;
            newDiff = newDiff > options.minDiff ? newDiff : options.minDiff;
            direction = -1;
        }
        else if (avg < VarDiff.tMin && this.difficulty < options.maxDiff){
            newDiff = options.targetTime / avg * this.difficulty;
            newDiff = newDiff < options.maxDiff ? newDiff : options.maxDiff;
            direction = 1;
        }
        else{
            return;
        }

        if (Math.abs(newDiff - this.difficulty) / this.difficulty * 100 > options.maxJump){
            let change = options.maxJump / 100 * this.difficulty * direction;
            newDiff = this.difficulty + change;
        }

        this.setNewDiff(newDiff);
        this.shareTimeRing.clear();
        if (decreaser) this.lastShareTime = now;
    },
    setNewDiff: function(newDiff){
        newDiff = Math.round(newDiff);
        if (this.difficulty === newDiff) return;
        log('info', logSystem, 'Retargetting difficulty %d to %d for %s', [this.difficulty, newDiff, this.login]);
        this.pendingDifficulty = newDiff;
        this.pushMessage('job', this.getJob());
    },
    heartbeat: function(){
        this.lastBeat = Date.now();
    },
    getTargetHex: function(){
        if (this.pendingDifficulty){
            this.lastDifficulty = this.difficulty;
            this.difficulty = this.pendingDifficulty;
            this.pendingDifficulty = null;
        }

        let padded = Buffer.alloc(32);
        padded.fill(0);

        let diffBuff = diff1.div(this.difficulty).toBuffer();
        diffBuff.copy(padded, 32 - diffBuff.length);

        let buff = padded.slice(0, 4);
        let buffArray = buff.toByteArray().reverse();
        let buffReversed = Buffer.from(buffArray);
        this.target = buffReversed.readUInt32BE(0);
        let hex = buffReversed.toString('hex');
        return hex;
    },
    getJob: function(){
        let blockTemplate = currentBlockTemplate[this.activeChildPool]
        let newJob = {
            id: utils.uid(),
            height: blockTemplate.height,
            submissions: []
        };
        if (mergedMining) {
            if (this.lastBlockHeight === blockTemplate.height
            && (!currentChildBlockTemplate[this.activeChildPool] || this.lastChildBlockHeight === currentChildBlockTemplate[this.activeChildPool].height)
            && !this.pendingDifficulty
            && this.cachedJob !== null
            && !config.daemon.alwaysPoll) {
                return this.cachedJob;
            }
            this.lastChildBlockHeight = currentChildBlockTemplate ? currentChildBlockTemplate[this.activeChildPool].height : -1;
	    newJob.activeChildPool = this.activeChildPool
            newJob.childHeight = this.lastChildBlockHeight
        } else {
            if (this.lastBlockHeight === blockTemplate.height && !this.pendingDifficulty && this.cachedJob !== null && !config.daemon.alwaysPoll) {
                return this.cachedJob;
            }
        }
        let blob = this.proxy ? blockTemplate.nextBlobWithChildNonce() : blockTemplate.nextBlob();
        this.lastBlockHeight = blockTemplate.height;
        let target = this.getTargetHex();

        newJob.difficulty = this.difficulty
        newJob.diffHex = this.diffHex
	newJob.extraNonce = blockTemplate.extraNonce

        if (blockTemplate.isRandomX){
            newJob.seed_hash = blockTemplate.seed_hash
            newJob.next_seed_hash = blockTemplate.next_seed_hash
        }

        this.validJobs.push(newJob);

        while (this.validJobs.length > 4)
            this.validJobs.shift();

        this.cachedJob = {
            job_id: newJob.id,
            id: this.id
        };

        if (this.proxy) {
            newJob.clientPoolLocation = blockTemplate.clientPoolLocation
            newJob.clientNonceLocation = blockTemplate.clientNonceLocation

            this.cachedJob.blocktemplate_blob = blob
            this.cachedJob.difficulty = blockTemplate.difficulty
            this.cachedJob.height = blockTemplate.height
            this.cachedJob.childHeight = this.lastChildBlockHeight
            this.cachedJob.reserved_offset = blockTemplate.reserveOffset
            this.cachedJob.client_nonce_offset = blockTemplate.clientNonceLocation
            this.cachedJob.client_pool_offset = blockTemplate.clientPoolLocation
            this.cachedJob.target_diff = this.difficulty
            this.cachedJob.target_diff_hex = this.diffHex

        } else {
            this.cachedJob.blob = blob
            this.cachedJob.target = target
        }

        if (typeof config.includeAlgo !== "undefined" && config.includeAlgo)
            this.cachedJob.algo = config.includeAlgo
        if (typeof config.includeHeight !== "undefined" && config.includeHeight)
            this.cachedJob.height = blockTemplate.height

        if (newJob.seed_hash) {
            this.cachedJob.seed_hash = newJob.seed_hash;
            this.cachedJob.next_seed_hash = newJob.next_seed_hash;
        }
        return this.cachedJob;
    },
    checkBan: function(validShare){
        if (!banningEnabled) return;

        // Init global per-ip shares stats
        if (!perIPStats[this.ip]){
            perIPStats[this.ip] = { validShares: 0, invalidShares: 0 };
        }

        let stats = perIPStats[this.ip];
        validShare ? stats.validShares++ : stats.invalidShares++;

        if (stats.validShares + stats.invalidShares >= config.poolServer.banning.checkThreshold){
            if (stats.invalidShares / stats.validShares >= config.poolServer.banning.invalidPercent / 100){
                validShare ? this.validShares++ : this.invalidShares++;
                log('warn', logSystem, 'Banned %s@%s', [this.login, this.ip]);
                bannedIPs[this.ip] = Date.now();
                delete connectedMiners[this.id];
                process.send({type: 'banIP', ip: this.ip});
                removeConnectedWorker(this, 'banned');
            }
            else{
                stats.invalidShares = 0;
                stats.validShares = 0;
            }
        }
    }
};

validateMinerPaymentId_difficulty = (address, ip, poolServerConfig, coin, sendReply) => {
    if (utils.characterCount(address, '\\+') > 1) {
        let message = `Invalid paymentId specified for ${coin}login, ${ip}`;
        if (poolServerConfig.paymentId.validation) {
            process.send({type: 'banIP', ip: ip});
            message +=  ` banned for ${poolServerConfig.banning.time / 60} minutes`
        }
        sendReply(message)
        log('warn', logSystem, message);
        return false
    }

    if (utils.characterCount(address, '\\.') > 1) {
        log('warn', logSystem, `Invalid difficulty specified for ${coin}login`);
        sendReply(`Invalid difficulty specified for ${coin}login, ${ip}`)
        return false
    }
    return true
}

/**
 * Handle miner method
 **/
function handleMinerMethod(method, params, ip, portData, sendReply, pushMessage){
    let miner = connectedMiners[params.id];

    // Check for ban here, so preconnected attackers can't continue to screw you
    if (IsBannedIp(ip)){
        sendReply('Your IP is banned');
        return;
    }

    switch(method){
        case 'login':
            let login = params.login;
            if (!login){
                sendReply('Missing login');
                return;
            }

            if (!validateMinerPaymentId_difficulty(login, ip, config.poolServer, 'parent ', sendReply))
                return

            let calculated = utils.determineRewardData(login)
            login = calculated.address
            let rewardType = calculated.rewardType

	        let address = ''
	        let paymentid = null
            let port = portData.port;
            let pass = params.pass;
            let childLogin = pass.trim();
            let childPoolIndex = 0;
            let childRewardType = rewardType
	        if (mergedMining) {
                childPoolIndex = -1
                if (!validateMinerPaymentId_difficulty(pass, ip, config.poolServer, 'child ', sendReply))
                    return

                calculated = utils.determineRewardData(pass)
                pass = calculated.address
                childRewardType = calculated.rewardType

                if (pass.indexOf('@') >= 0 && pass.indexOf('@') >= 0) {
                   passDelimiterPos = pass.lastIndexOf('@');
                   childLogin = pass.substr(0, passDelimiterPos).trim();
                }
                childLogin = childLogin.replace(/\s/g, '');
                childLogin = utils.cleanupSpecialChars(childLogin);


                let addr = childLogin.split(config.poolServer.paymentId.addressSeparator);
                address = addr[0] || null;
		        paymentId = addr[1] || null

                if (!address) {
                    log('warn', logSystem, 'No address specified for login');
                    sendReply('Invalid address used for login');
                }


                if (paymentId && paymentId.match('^([a-zA-Z0-9]){0,15}$')) {
                    if (config.poolServer.paymentId.validation) {
                        process.send({type: 'banIP', ip: ip});
                        log('warn', logSystem, 'Invalid paymentId specified for child login');
                    } else {
                        log('warn', logSystem, 'Invalid paymentId specified for child login');
                    }
                    sendReply(`Invalid paymentId specified for child login, ${portData.ip} banned for ${config.poolServer.banning.time / 60} minutes`)
                    return;
               }

        		for (i = 0; i < config.childPools.length; i++) {
        		    if(config.childPools[i].pattern) {
            			if (new RegExp(config.childPools[i].pattern, 'i').test(address))
            			{
            			   childPoolIndex = i
            			   break
            			}
        		    }
        		}
                if (childPoolIndex < 0)
                {
                    childPoolIndex = fallBackCoin
                    address = config.childPools[childPoolIndex].poolAddress
                    childLogin = config.childPools[childPoolIndex].poolAddress
                }
                if (!utils.validateChildMinerAddress(address, childPoolIndex)) {
                    let addressPrefix = utils.getAddressPrefix(address);
                    if (!addressPrefix) addressPrefix = 'N/A';

                    log('warn', logSystem, 'Invalid address used for childLogin (prefix: %s): %s', [addressPrefix, address]);
                    sendReply('Invalid address used for childLogin');
                    return;
                }
	        }


            let difficulty = portData.difficulty;
            let noRetarget = false;
            if(config.poolServer.fixedDiff.enabled) {
                let fixedDiffCharPos = login.lastIndexOf(config.poolServer.fixedDiff.addressSeparator);
                if (fixedDiffCharPos !== -1 && (login.length - fixedDiffCharPos < 32)){
                    diffValue = login.substr(fixedDiffCharPos + 1);
                    difficulty = parseInt(diffValue);
                    login = login.substr(0, fixedDiffCharPos);
                    if (!difficulty || difficulty != diffValue) {
                        log('warn', logSystem, 'Invalid difficulty value "%s" for login: %s', [diffValue, login]);
                        difficulty = portData.difficulty;
                    } else {
                        noRetarget = true;
                        if (difficulty < config.poolServer.varDiff.minDiff) {
                            difficulty = config.poolServer.varDiff.minDiff;
                        }
                    }
                }
            }

            addr = login.split(config.poolServer.paymentId.addressSeparator);
            address = addr[0] || null;
	        paymentId = addr[1] || null;
            if (!address) {
                log('warn', logSystem, 'No address specified for login');
                sendReply('Invalid address used for login');
                return
            }

            if (paymentId && paymentId.match('^([a-zA-Z0-9]){0,15}$')) {
                if (config.poolServer.paymentId.validation) {
                    process.send({type: 'banIP', ip: ip});
                    log('warn', logSystem, 'Invalid paymentId specified for login');
                } else {
                    log('warn', logSystem, 'Invalid paymentId specified for login');
                }
                sendReply(`Invalid paymentId specified for login, ${portData.ip} banned for ${config.poolServer.banning.time / 60} minutes`)
                return;
            }

            if (!utils.validateMinerAddress(address)) {
                let addressPrefix = utils.getAddressPrefix(address);
                if (!addressPrefix) addressPrefix = 'N/A';

                log('warn', logSystem, 'Invalid address used for login (prefix: %s): %s', [addressPrefix, address]);
                sendReply('Invalid address used for login');
                return;
            }

            let minerId = utils.uid();
            miner = new Miner(rewardType, childRewardType, minerId, childPoolIndex, login, pass, ip, port, params.agent, childLogin, difficulty, noRetarget, pushMessage);
            connectedMiners[minerId] = miner;

            sendReply(null, {
                id: minerId,
                job: miner.getJob(),
                status: 'OK'
            });

            newConnectedWorker(miner);
            break;
        case 'getjob':
            if (!miner){
                sendReply('Unauthenticated');
                return;
            }
            miner.heartbeat();
            sendReply(null, miner.getJob());
            break;
        case 'submit':
            if (!miner){
                sendReply('Unauthenticated');
                return;
            }
            miner.heartbeat();

            let job = miner.validJobs.filter(function(job){
                return job.id === params.job_id;
            })[0];

            if (!job){
                sendReply('Invalid job id');
                return;
            }

            if (!params.nonce || !params.result) {
                sendReply('Attack detected');
                let minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Malformed miner share: ' + JSON.stringify(params) + ' from ' + minerText);
                return;
            }

            if (!noncePattern.test(params.nonce)) {
                let minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Malformed nonce: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share1');
                return;
            }

            // Force lowercase for further comparison
            params.nonce = params.nonce.toLowerCase();

            if (!miner.proxy) {
                if (job.submissions.indexOf(params.nonce) !== -1){
                    let minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                    log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                    perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                    miner.checkBan(false);
                    sendReply('Duplicate share2');
                    return;
                }

                job.submissions.push(params.nonce);
            } else {
                if (!Number.isInteger(params.poolNonce) || !Number.isInteger(params.workerNonce)) {
                    let minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                    log('warn', logSystem, 'Malformed nonce: ' + JSON.stringify(params) + ' from ' + minerText);
                    perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                    miner.checkBan(false);
                    sendReply('Duplicate share3');
                    return;
                }
                let nonce_test = `${params.nonce}_${params.poolNonce}_${params.workerNonce}`;
                if (job.submissions.indexOf(nonce_test) !== -1) {
                    let minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                    log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                    perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                    miner.checkBan(false);
                    sendReply('Duplicate share4');
                    return;
                }
                job.submissions.push(nonce_test);

            }

            let isJobBlock = function(b) {
                return b.height === job.height && job.childHeight === (
                    b.childBlockTemplate ? b.childBlockTemplate.height : undefined);
            };

            let blockTemplate = currentBlockTemplate[miner.activeChildPool]
            if (job.childHeight)
                blockTemplate = isJobBlock(currentBlockTemplate[miner.activeChildPool]) ? currentBlockTemplate[miner.activeChildPool] : validBlockTemplates[miner.activeChildPool].filter(isJobBlock)[0];

            if (!blockTemplate){
                sendReply('Block expired');
                return;
            }

    	    let shareAccepted = processShare(miner, job, blockTemplate, params);
            miner.checkBan(shareAccepted);

            if (shareTrustEnabled){
                if (shareAccepted){
                    miner.trust.probability -= shareTrustStepFloat;
                    if (miner.trust.probability < shareTrustMinFloat)
                        miner.trust.probability = shareTrustMinFloat;
                    miner.trust.penalty--;
                    miner.trust.threshold--;
                }
                else{
                    log('warn', logSystem, 'Share trust broken by %s@%s', [miner.login, miner.ip]);
                    miner.trust.probability = 1;
                    miner.trust.penalty = config.poolServer.shareTrust.penalty;
                }
            }

            if (!shareAccepted){
                sendReply('Rejected share: invalid result');
                return;
            }

            let now = Date.now() / 1000 | 0;
            miner.shareTimeRing.append(now - miner.lastShareTime);
            miner.lastShareTime = now;

            sendReply(null, {status: 'OK'});
            break;
        case 'keepalived' :
            if (!miner){
                sendReply('Unauthenticated');
                return;
            }
            miner.heartbeat();
            sendReply(null, { status:'KEEPALIVED' });
            break;
        default:
            sendReply('Invalid method');
            let minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
            log('warn', logSystem, 'Invalid method: %s (%j) from %s', [method, params, minerText]);
            break;
    }
}

/**
 * New connected worker
 **/
function newConnectedWorker(miner){
    log('info', logSystem, 'Miner connected %s@%s on port', [miner.login, miner.ip, miner.port]);
    if (miner.workerName !== 'undefined') log('info', logSystem, 'Worker Name: %s', [miner.workerName]);
    if (miner.difficulty) log('info', logSystem, 'Miner difficulty fixed to %s', [miner.difficulty]);

    redisClient.sadd(`${config.coin}:workers_ip:${miner.login}`, miner.ip);
    redisClient.hincrby(`${config.coin}:ports:${miner.port}`, 'users', 1);

    redisClient.hincrby(`${config.coin}:active_connections${miner.rewardTypeAsKey}`, `${miner.login}~${miner.workerName}`, 1, function(error, connectedWorkers) {
        if (connectedWorkers === 1) {
            notifications.sendToMiner(miner.login, 'workerConnected', {
                'LOGIN' : miner.login,
                'MINER': `${miner.login.substring(0,7)}...${miner.login.substring(miner.login.length-7)}`,
                'IP': miner.ip.replace('::ffff:', ''),
                'PORT': miner.port,
                'WORKER_NAME': miner.workerName !== 'undefined' ? miner.workerName : ''
            });
        }
    });
    if (config.poolServer.mergedMining) {
        redisClient.sadd(`${config.childPools[miner.activeChildPool].coin}:workers_ip:${miner.childLogin}`, miner.ip);
        redisClient.hincrby(`${config.childPools[miner.activeChildPool].coin}:ports:${miner.port}`, 'users', 1);

        redisClient.hincrby(`${config.childPools[miner.activeChildPool].coin}:active_connections${miner.childRewardTypeAsKey}`, `${miner.childLogin}~${miner.workerName}`, 1, function(error, connectedWorkers) {
        });


        let redisCommands  = config.childPools.map(item => {
            return ['hdel', `${config.coin}:workers:${miner.login}`, `${item.coin}`,]
        })
        redisClient.multi(redisCommands).exec(function(error, replies) {
            if(error) {
                log('error', logSystem, 'Failed to clear childCoins from parent in redis %j \n %j', [err, redisCommands]);
            }
        })

        redisClient.hset(`${config.coin}:workers:${miner.login}`, `${config.childPools[miner.activeChildPool].coin}`, miner.childLogin)

        redisClient.hset(`${config.childPools[miner.activeChildPool].coin}:workers:${miner.childLogin}`, `${config.coin}`, miner.login)

    }
}

/**
 * Remove connected worker
 **/
function removeConnectedWorker(miner, reason){
    redisClient.hincrby(`${config.coin}:ports:${miner.port}`, 'users', '-1');
    if (mergedMining) {
        redisClient.hincrby(`${config.childPools[miner.activeChildPool].coin}:ports:${miner.port}`, 'users', '-1');
        redisClient.hincrby(`${config.childPools[miner.activeChildPool].coin}:active_connections${miner.childRewardTypeAsKey}`, `${miner.childLogin}~${miner.workerName}`, 1, function(error, connectedWorkers) {
        });
    }

    redisClient.hincrby(`${config.coin}:active_connections${miner.rewardTypeAsKey}`, `${miner.login}~${miner.workerName}`, -1, function(error, connectedWorkers) {
        if (reason === 'banned') {
            notifications.sendToMiner(miner.login, 'workerBanned', {
                'LOGIN' : miner.login,
                'MINER': `${miner.login.substring(0,7)}...${miner.login.substring(miner.login.length-7)}`,
                'IP': miner.ip.replace('::ffff:', ''),
                'PORT': miner.port,
                'WORKER_NAME': miner.workerName !== 'undefined' ? miner.workerName : ''
            });
        } else if (!connectedWorkers || connectedWorkers <= 0) {
            notifications.sendToMiner(miner.login, 'workerTimeout', {
                'LOGIN' : miner.login,
                'MINER': `${miner.login.substring(0,7)}...${miner.login.substring(miner.login.length-7)}`,
                'IP': miner.ip.replace('::ffff:', ''),
                'PORT': miner.port,
                'WORKER_NAME': miner.workerName !== 'undefined' ? miner.workerName : '',
                'LAST_HASH': utils.dateFormat(new Date(miner.lastBeat), 'yyyy-mm-dd HH:MM:ss Z')
            });
       }
    });
}

/**
 * Return if IP has been banned
 **/
function IsBannedIp(ip){
    if (!banningEnabled || !bannedIPs[ip]) return false;

    let bannedTime = bannedIPs[ip];
    let bannedTimeAgo = Date.now() - bannedTime;
    let timeLeft = config.poolServer.banning.time * 1000 - bannedTimeAgo;
    if (timeLeft > 0){
        return true;
    }
    else {
        delete bannedIPs[ip];
        log('info', logSystem, 'Ban dropped for %s', [ip]);
        return false;
    }
}

function recordShareData(miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate, pool){
    let dateNow = Date.now();
    let dateNowSeconds = dateNow / 1000 | 0;
    let coin = pool !== null ? pool.coin : config.coin;
    let login = pool !== null ? miner.childLogin : miner.login;
    let job_height =  pool !== null ? job.childHeight : job.height
    let workerName = miner.workerName;
    let rewardType = pool !== null ? miner.childRewardType : miner.rewardType

    let updateScore;
    // Weighting older shares lower than newer ones to prevent pool hopping
    if (slushMiningEnabled) {
        // We need to do this via an eval script because we need fetching the last block time and
        // calculating the score to run in a single transaction (otherwise we could have a race
        // condition where a block gets discovered between the time we look up lastBlockFound and
        // insert the score, which would give the miner an erroneously huge proportion on the new block)
        updateScore = ['eval', `
            local age = (ARGV[3] - redis.call('hget', KEYS[2], 'lastBlockFound')) / 1000
            local score = string.format('%.17g', ARGV[2] * math.exp(age / ARGV[4]))
            redis.call('hincrbyfloat', KEYS[1], ARGV[1], score)
            return {score, tostring(age)}
            `,
            2 /*keys*/, coin + ':scores:roundCurrent', coin + ':stats',
            /* args */ login, job.difficulty, Date.now(), config.poolServer.slushMining.weight];
    }
    else {
        job.score = job.difficulty;
        updateScore = ['hincrbyfloat', `${coin}:scores:${rewardType}:roundCurrent`, login, job.score]
    }

    let redisCommands = [
        updateScore,
        ['hincrby', `${coin}:shares_actual:${rewardType}:roundCurrent`, login, job.difficulty],
        ['zadd', `${coin}:hashrate`, dateNowSeconds, [job.difficulty, login, dateNow, rewardType].join(':')],
        ['hincrby', `${coin}:workers:${login}`, 'hashes', job.difficulty],
        ['hset', `${coin}:workers:${login}`, 'lastShare', dateNowSeconds],
        ['expire', `${coin}:workers:${login}`, (86400 * cleanupInterval)],
        ['expire', `${coin}:payments:${login}`, (86400 * cleanupInterval)]
    ];

    if (workerName) {
        redisCommands.push(['zadd', `${coin}:hashrate`, dateNowSeconds, [job.difficulty, login + '~' + workerName, dateNow, rewardType].join(':')]);
        redisCommands.push(['hincrby', `${coin}:unique_workers:${login}~${workerName}`, 'hashes', job.difficulty]);
        redisCommands.push(['hset', `${coin}:unique_workers:${login}~${workerName}`, 'lastShare', dateNowSeconds]);
        redisCommands.push(['expire', `${coin}:unique_workers:${login}~${workerName}`, (86400 * cleanupInterval)]);
    }

    if (blockCandidate){
        redisCommands.push(['hset', `${coin}:stats`, `lastBlockFound${rewardType}`, Date.now()]);
        redisCommands.push(['rename', `${coin}:scores:prop:roundCurrent`, coin + ':scores:prop:round' + job_height]);
        redisCommands.push(['rename', `${coin}:scores:solo:roundCurrent`, coin + ':scores:solo:round' + job_height]);
        redisCommands.push(['rename', `${coin}:shares_actual:prop:roundCurrent`, `${coin}:shares_actual:prop:round${job_height}`]);
        redisCommands.push(['rename', `${coin}:shares_actual:solo:roundCurrent`, `${coin}:shares_actual:solo:round${job_height}`]);
        if (rewardType === 'prop') {
            redisCommands.push(['hgetall', `${coin}:scores:prop:round${job_height}`]);
            redisCommands.push(['hgetall', `${coin}:shares_actual:prop:round${job_height}`]);
	    }
        if (rewardType === 'solo') {
            redisCommands.push(['hget', `${coin}:scores:solo:round${job_height}`, login]);
            redisCommands.push(['hget', `${coin}:shares_actual:solo:round${job_height}`, login]);
        }

    }

    redisClient.multi(redisCommands).exec(function(err, replies){
        if (err){
            log('error', logSystem, 'Failed to insert share data into redis %j \n %j', [err, redisCommands]);
            return;
        }

        if (slushMiningEnabled) {
            job.score = parseFloat(replies[0][0]);
            let age = parseFloat(replies[0][1]);
            log('info', logSystem, 'Submitted score ' + job.score + ' for difficulty ' + job.difficulty + ' and round age ' + age + 's');
        }

        if (blockCandidate){
            let workerScores = replies[replies.length - 2];
            let workerShares = replies[replies.length - 1];
	    let totalScore = 0;
	    let totalShares = 0;
	    if (rewardType === 'solo') {
		totalScore = workerScores
		totalShares = workerShares
	    }
	    if (rewardType === 'prop') {
                totalScore = Object.keys(workerScores).reduce(function(p, c){
                    return p + parseFloat(workerScores[c])
                }, 0);
                totalShares = Object.keys(workerShares).reduce(function(p, c){
                    return p + parseInt(workerShares[c])
                }, 0);
	    }
            redisClient.zadd(coin + ':blocks:candidates', job_height, [
        		rewardType,
        		login,
                hashHex,
                Date.now() / 1000 | 0,
                blockTemplate.difficulty,
                totalShares,
                totalScore
            ].join(':'), function(err, result){
                if (err){
                    log('error', logSystem, 'Failed inserting block candidate %s \n %j', [hashHex, err]);
                }
            });

            notifications.sendToAll('blockFound', {
                'HEIGHT': job_height,
                'HASH': hashHex,
                'DIFFICULTY': blockTemplate.difficulty,
                'SHARES': totalShares,
                'MINER': login.substring(0,7)+'...'+login.substring(login.length-7)
            });
        }

    });

    log('info', logSystem, 'Accepted %s share at difficulty %d/%d from %s@%s', [shareType, job.difficulty, shareDiff, login, miner.ip]);
}

function getShareBuffer(miner, job, blockTemplate, params) {
    let nonce = params.nonce;
    let resultHash = params.result;
    let template = Buffer.alloc(blockTemplate.buffer.length);
    if (!miner.proxy) {
        blockTemplate.buffer.copy(template);
        template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
    } else {
        blockTemplate.buffer.copy(template);
        template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
        template.writeUInt32BE(params.poolNonce, job.clientPoolLocation);
        template.writeUInt32BE(params.workerNonce, job.clientNonceLocation);
    }

    try {
        let shareBuffer = utils.cnUtil.construct_block_blob(template, Buffer.from(nonce, 'hex'), cnBlobType);
        return shareBuffer;
    } catch (e) {
        log('error', logSystem, "Can't get share buffer with nonce %s from %s@%s: %s", [nonce, miner.login, miner.ip, e]);
        return null;
    }
}

/**
 * Process miner share data
 **/
function processShare(miner, job, blockTemplate, params){
    let shareBuffer = getShareBuffer(miner, job, blockTemplate, params)
    if (!shareBuffer) {
        return false
    }
    let resultHash = params.result
    let hash;
    let shareType;

    if (shareTrustEnabled && miner.trust.threshold <= 0 && miner.trust.penalty <= 0 && Math.random() > miner.trust.probability){
        hash = Buffer.from(resultHash, 'hex');
        shareType = 'trusted';
    }
    else {
        let convertedBlob = utils.cnUtil.convert_blob(shareBuffer, cnBlobType);
        let hard_fork_version = convertedBlob[0];

        if (blockTemplate.isRandomX) {
            hash = cryptoNight(convertedBlob, Buffer.from(blockTemplate.seed_hash, 'hex'), cnVariant);
        } else {
            if (typeof config.includeHeight !== "undefined" && config.includeHeight)
                hash = cryptoNight(convertedBlob, cnVariant, job.height);
            else
                hash = cryptoNight(convertedBlob, cnVariant);
        }
        log('info', logSystem, 'Mining pool algorithm: %s variant %d, Hard fork version: %d', [cnAlgorithm, cnVariant, hard_fork_version]);
	shareType = 'valid'
    }

    if (hash.toString('hex') !== resultHash) {
        log('warn', logSystem, 'Bad hash from miner %s@%s', [miner.login, miner.ip]);
        return false;
    }

    let hashArray = hash.toByteArray().reverse();
    let hashNum = bignum.fromBuffer(Buffer.from(hashArray));
    let hashDiff = diff1.div(hashNum);

    if (hashDiff.ge(blockTemplate.difficulty)){

        apiInterfaces.rpcDaemon('submitblock', [shareBuffer.toString('hex')], function(error, result){
            if (error){
                log('error', logSystem, 'Error submitting block at height %d from %s@%s, share type: "%s" - %j', [job.height, miner.login, miner.ip, shareType, error]);
            }
            else{
                let blockFastHash = utils.cnUtil.get_block_id(shareBuffer, cnBlobType).toString('hex');
                log('info', logSystem,
                    'Block %s found at height %d by miner %s@%s - submit result: %j',
                    [blockFastHash.substr(0, 6), job.height, miner.login, miner.ip, result]
                );
                recordShareData(miner, job, hashDiff.toString(), true, blockFastHash, shareType, blockTemplate, null);
            }
        });
    }
    else if (hashDiff.lt(job.difficulty)){
        log('warn', logSystem, 'Rejected low difficulty share of %s from %s@%s', [hashDiff.toString(), miner.login, miner.ip]);
        return false;
    }
    else{
        recordShareData(miner, job, hashDiff.toString(), false, null, shareType, null, null);
    }

    if (!job.childHeight)
        return true

    var childBlockTemplate = blockTemplate.childBlockTemplate;

    if (childBlockTemplate) {
        if (mergedMining){
    	    let pool = config.childPools[miner.activeChildPool]
            if (hashDiff.ge(childBlockTemplate.difficulty)){
                let mergedBuffer = null
                try {
                    mergedBuffer = utils.cnUtil.construct_mm_child_block_blob(shareBuffer, cnBlobType, childBlockTemplate.buffer);
                } catch (e) {
                    log('error', logSystem, "Failed to construct MM child block: " + e);
                }
                if (mergedBuffer === null) {
                    recordShareStatusMerged(miner, 'invalid');
                } else {

                    let onChildSuccess = (result) => {
                        let blockFastHash = utils.cnUtil.get_block_id(mergedBuffer, 2).toString('hex')
                        log('info', logSystem,
                                'Child Block %s found at height %d by miner %s@%s - submit result: %j',
                                [blockFastHash.substr(0, 6), job.childHeight, miner.workerName, miner.ip, result]);
                        recordShareData(miner, job, hashDiff.toString(), true, blockFastHash, shareType, childBlockTemplate, pool);
                    }

                    apiInterfaces.rpcDaemon('submitblock', [mergedBuffer.toString('hex')], function(error, result){
                        if (error){
                            log('error', logSystem, 'Error submitting  child block at height %d from %s@%s, share type: "%s" - %j', [job.childHeight, miner.login, miner.ip, shareType, error]);
                        }
                        else{
                            onChildSuccess(result)
                        }
                    }, pool.childDaemon);
                }
            }
            else if (hashDiff.lt(job.difficulty)){
                log('warn', logSystem, 'Rejected low difficulty share of %s from %s@%s', [hashDiff.toString(), miner.workerName, miner.ip]);
                return false;
            }
            else{
                recordShareData(miner, job, hashDiff.toString(), false, null, shareType, null, pool);
            }
        }
        return true;
    }
    return true;
}

/**
 * Start pool server on TCP ports
 **/
let httpResponse = ' 200 OK\nContent-Type: text/plain\nContent-Length: 20\n\nMining server online';

function startPoolServerTcp(callback){
    log('info', logSystem, 'Clear values for connected workers in redis database.');
    redisClient.del(config.coin + ':active_connections');

    async.each(config.poolServer.ports, function(portData, cback){
        let handleMessage = function(socket, jsonData, pushMessage){
            if (!jsonData.id) {
                log('warn', logSystem, 'Miner RPC request missing RPC id');
                return;
            }
            else if (!jsonData.method) {
                log('warn', logSystem, 'Miner RPC request missing RPC method');
                return;
            } 
            else if (!jsonData.params) {
                log('warn', logSystem, 'Miner RPC request missing RPC params');
                return;
            }

            let sendReply = function(error, result){
                if(!socket.writable) return;
                let sendData = JSON.stringify({
                    id: jsonData.id,
                    jsonrpc: "2.0",
                    error: error ? {code: -1, message: error} : null,
                    result: result
                }) + "\n";
                socket.write(sendData);
            };

            handleMinerMethod(jsonData.method, jsonData.params, socket.remoteAddress, portData, sendReply, pushMessage);
        };

        let socketResponder = function(socket){
            socket.setKeepAlive(true);
            socket.setEncoding('utf8');

            let dataBuffer = '';

            let pushMessage = function(method, params){
                if(!socket.writable) return;
                let sendData = JSON.stringify({
                    jsonrpc: "2.0",
                    method: method,
                    params: params
                }) + "\n";
                socket.write(sendData);
            };

            socket.on('data', function(d){
                dataBuffer += d;
                if (Buffer.byteLength(dataBuffer, 'utf8') > 10240){ //10KB
                    dataBuffer = null;
                    log('warn', logSystem, 'Socket flooding detected and prevented from %s', [socket.remoteAddress]);
                    socket.destroy();
                    return;
                }
                if (dataBuffer.indexOf('\n') !== -1){
                    let messages = dataBuffer.split('\n');
                    let incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
                    for (let i = 0; i < messages.length; i++){
                        let message = messages[i];
                        if (message.trim() === '') continue;
                        let jsonData;
                        try{
                            jsonData = JSON.parse(message);
                        }
                        catch(e){
                            if (message.indexOf('GET /') === 0) {
                                if (message.indexOf('HTTP/1.1') !== -1) {
                                    socket.end('HTTP/1.1' + httpResponse);
                                    break;
                                }
                                else if (message.indexOf('HTTP/1.0') !== -1) {
                                    socket.end('HTTP/1.0' + httpResponse);
                                    break;
                                }
                            }

                            log('warn', logSystem, 'Malformed message from %s: %s', [socket.remoteAddress, message]);
                            socket.destroy();

                            break;
                        }
                        try {
                            handleMessage(socket, jsonData, pushMessage);
                        } catch (e) {
                            log('warn', logSystem, 'Malformed message from ' + socket.remoteAddress + ' generated an exception. Message: ' + message);
                            if (e.message) log('warn', logSystem, 'Exception: ' + e.message);
                        }
                     }
                    dataBuffer = incomplete;
                }
            }).on('error', function(err){
                if (err.code !== 'ECONNRESET')
                    log('warn', logSystem, 'Socket error from %s %j', [socket.remoteAddress, err]);
            }).on('close', function(){
                pushMessage = function(){};
            });
        };

        if (portData.ssl) {
            if (!config.poolServer.sslCert) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate not configured', [portData.port]);
                cback(true);
            } else if (!config.poolServer.sslKey) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL key not configured', [portData.port]);
                cback(true);
            } else if (!fs.existsSync(config.poolServer.sslCert)) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate file not found (configuration error)', [portData.port]);
                cback(true);
            } else if (!fs.existsSync(config.poolServer.sslKey)) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL key file not found (configuration error)', [portData.port]);
                cback(true);
            } else {
                let options = {
                    key: fs.readFileSync(config.poolServer.sslKey),
                    cert: fs.readFileSync(config.poolServer.sslCert),
                };

                if (config.poolServer.sslCA && fs.existsSync(config.poolServer.sslCA)) {
                    options.ca = fs.readFileSync(config.poolServer.sslCA)
                }

                tls.createServer(options, socketResponder).listen(portData.port, function (error, result) {
                    if (error) {
                        log('error', logSystem, 'Could not start server listening on port %d (SSL), error: $j', [portData.port, error]);
                        cback(true);
                        return;
                    }

                    log('info', logSystem, 'Clear values for SSL port %d in redis database.', [portData.port]);
                    redisClient.del(config.coin + ':ports:'+portData.port);
                    redisClient.hset(config.coin + ':ports:'+portData.port, 'port', portData.port);

                    log('info', logSystem, 'Started server listening on port %d (SSL)', [portData.port]);
                    cback();
                });
            }
        } 
        else {
            net.createServer(socketResponder).listen(portData.port, function (error, result) {
                if (error) {
                    log('error', logSystem, 'Could not start server listening on port %d, error: $j', [portData.port, error]);
                    cback(true);
                    return;
                }

                log('info', logSystem, 'Clear values for port %d in redis database.', [portData.port]);
                redisClient.del(config.coin + ':ports:'+portData.port);
                redisClient.hset(config.coin + ':ports:'+portData.port, 'port', portData.port);

                log('info', logSystem, 'Started server listening on port %d', [portData.port]);
                cback();
            });
        }
    }, function(err){
        if (err)
            callback(false);
        else
            callback(true);
    });
}

/**
 * Initialize pool server
 **/
 
(function init(loop){
     async.waterfall([
         function(callback){
            if (!poolStarted) {
                startPoolServerTcp(function(successful){ poolStarted = true });
                setTimeout(init, 1000, loop);
                return;
            }
            callback(true)
         }
        ],
        function(err){
            if (loop === true){
                setTimeout(function(){
                    init(true);
                },config.poolServer.blockRefreshInterval);
            }
        }
    );
})();

