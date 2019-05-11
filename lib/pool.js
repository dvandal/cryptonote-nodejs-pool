/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Pool TCP daemon
 **/

// Load required modules
var fs = require('fs');
var net = require('net');
var tls = require('tls');
var async = require('async');
var bignum = require('bignum');

var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
var notifications = require('./notifications.js');
var utils = require('./utils.js');

var cnHashing = require('cryptonight-hashing');

// Set nonce pattern - must exactly be 8 hex chars
var noncePattern = new RegExp("^[0-9A-Fa-f]{8}$");

// Set redis database cleanup interval
var cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;

// Initialize log system
var logSystem = 'pool';
require('./exceptionWriter.js')(logSystem);

var threadId = '(Thread ' + process.env.forkId + ') ';
var log = function(severity, system, text, data){
    global.log(severity, system, threadId + text, data);
};

// Set cryptonight algorithm
var cnAlgorithm = config.cnAlgorithm || "cryptonight";
var cnVariant = config.cnVariant || 0;
var cnBlobType = config.cnBlobType || 0;

var cryptoNight;
if (!cnHashing || !cnHashing[cnAlgorithm]) {
    log('error', logSystem, 'Invalid cryptonight algorithm: %s', [cnAlgorithm]);
} else {
    cryptoNight = cnHashing[cnAlgorithm];
}

// Set instance id
var instanceId = utils.instanceId();

// Pool variables
var poolStarted = false;
var connectedMiners = {};

// Pool settings
var shareTrustEnabled = config.poolServer.shareTrust && config.poolServer.shareTrust.enabled;
var shareTrustStepFloat = shareTrustEnabled ? config.poolServer.shareTrust.stepDown / 100 : 0;
var shareTrustMinFloat = shareTrustEnabled ? config.poolServer.shareTrust.min / 100 : 0;

var banningEnabled = config.poolServer.banning && config.poolServer.banning.enabled;
var bannedIPs = {};
var perIPStats = {};

var slushMiningEnabled = config.poolServer.slushMining && config.poolServer.slushMining.enabled;

if (!config.poolServer.paymentId) config.poolServer.paymentId = {};
if (!config.poolServer.paymentId.addressSeparator) config.poolServer.paymentId.addressSeparator = "+";


// Block templates
var validBlockTemplates = [];
var currentBlockTemplate;

// Difficulty buffer
var diff1 = bignum('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 16);

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
    var now = Date.now() / 1000 | 0;
    for (var minerId in connectedMiners){
        var miner = connectedMiners[minerId];
        if(!miner.noRetarget) {
            miner.retarget(now);
        }
    }
}, config.poolServer.varDiff.retargetTime * 1000);

// Every 30 seconds clear out timed-out miners and old bans
setInterval(function(){
    var now = Date.now();
    var timeout = config.poolServer.minerTimeout * 1000;
    for (var minerId in connectedMiners){
        var miner = connectedMiners[minerId];
        if (now - miner.lastBeat > timeout){
            log('warn', logSystem, 'Miner timed out and disconnected %s@%s', [miner.login, miner.ip]);
            delete connectedMiners[minerId];
            removeConnectedWorker(miner, 'timeout');
        }
    }    

    if (banningEnabled){
        for (ip in bannedIPs){
            var banTime = bannedIPs[ip];
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
    }
});

/**
 * Block template
 **/
function BlockTemplate(template){
    this.blob = template.blocktemplate_blob;
    this.difficulty = template.difficulty;
    this.height = template.height;
    this.reserveOffset = template.reserved_offset;
    this.buffer = Buffer.from(this.blob, 'hex');
    instanceId.copy(this.buffer, this.reserveOffset + 4, 0, 3);
    this.extraNonce = 0;

    // The clientNonceLocation is the location at which the client pools should set the nonces for each of their clients.
    this.clientNonceLocation = this.reserveOffset + 12;
    // The clientPoolLocation is for multi-thread/multi-server pools to handle the nonce for each of their tiers.
    this.clientPoolLocation = this.reserveOffset + 8;
}
BlockTemplate.prototype = {
    
    nextBlob: function(){
        this.buffer.writeUInt32BE(++this.extraNonce, this.reserveOffset);
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
function getBlockTemplate(callback){
    apiInterfaces.rpcDaemon('getblocktemplate',
                            {reserve_size: 17, wallet_address: config.poolServer.poolAddress},
                            callback)
}

/**
 * Process block template
 **/
function processBlockTemplate(template){
    if (currentBlockTemplate)
        validBlockTemplates.push(currentBlockTemplate);

    if (validBlockTemplates.length > 3)
        validBlockTemplates.shift();

    currentBlockTemplate = new BlockTemplate(template);

    for (var minerId in connectedMiners){
        var miner = connectedMiners[minerId];
        miner.pushMessage('job', miner.getJob());
    }
}

/**
 * Job refresh
 **/
function jobRefresh(loop, callback){
    callback = callback || function(){};
    getBlockTemplate(function(error, result){
         if (loop)
            setTimeout(function(){
                jobRefresh(true);
            }, config.poolServer.blockRefreshInterval);
        
        if (error){
            log('error', logSystem, 'Error polling getblocktemplate %j', [error]);
            if (!poolStarted) log('error', logSystem, 'Could not start pool');
            callback(false);
            return;
        }

        if (!currentBlockTemplate || result.height > currentBlockTemplate.height) {
            log('info', logSystem, 'New block to mine at height %d w/ difficulty of %d', [result.height, result.difficulty]);
            processBlockTemplate(result);
        }
        if (!poolStarted) {
            startPoolServerTcp(function(successful){ poolStarted = true });
        }
        callback(true);
    })
}

/**
 * Variable difficulty
 **/
var VarDiff = (function(){
    var variance = config.poolServer.varDiff.variancePercent / 100 * config.poolServer.varDiff.targetTime;
    return {
        variance: variance,
        bufferSize: config.poolServer.varDiff.retargetTime / config.poolServer.varDiff.targetTime * 4,
        tMin: config.poolServer.varDiff.targetTime - variance,
        tMax: config.poolServer.varDiff.targetTime + variance,
        maxJump: config.poolServer.varDiff.maxJump
    };
})();

/**
 * Miner
 **/
function Miner(id, login, pass, ip, port, agent, workerName, startingDiff, noRetarget, pushMessage){
    this.id = id;
    this.login = login;
    this.pass = pass;
    this.ip = ip;
    this.port = port;
    this.proxy = false;
    if (agent && agent.includes('xmr-node-proxy')) {
        this.proxy = true;
    }
    this.workerName = workerName;
    this.pushMessage = pushMessage;
    this.heartbeat();
    this.noRetarget = noRetarget;
    this.difficulty = startingDiff;
    this.validJobs = [];

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

        var options = config.poolServer.varDiff;

        var sinceLast = now - this.lastShareTime;
        var decreaser = sinceLast > VarDiff.tMax;

        var avg = this.shareTimeRing.avg(decreaser ? sinceLast : null);
        var newDiff;

        var direction;

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
            var change = options.maxJump / 100 * this.difficulty * direction;
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

        var padded = Buffer.alloc(32);
        padded.fill(0);

        var diffBuff = diff1.div(this.difficulty).toBuffer();
        diffBuff.copy(padded, 32 - diffBuff.length);

        var buff = padded.slice(0, 4);
        var buffArray = buff.toByteArray().reverse();
        var buffReversed = Buffer.from(buffArray);
        this.target = buffReversed.readUInt32BE(0);
        var hex = buffReversed.toString('hex');
        return hex;
    },
    getJob: function(){
        if (this.lastBlockHeight === currentBlockTemplate.height && !this.pendingDifficulty && this.cachedJob !== null) {
            return this.cachedJob;
        }
        if (!this.proxy) {
            var blob = currentBlockTemplate.nextBlob();
            this.lastBlockHeight = currentBlockTemplate.height;
            var target = this.getTargetHex();

            var newJob = {
                id: utils.uid(),
                extraNonce: currentBlockTemplate.extraNonce,
                height: currentBlockTemplate.height,
                difficulty: this.difficulty,
                diffHex: this.diffHex,
                submissions: []
            };

            this.validJobs.push(newJob);

            if (this.validJobs.length > 4)
                this.validJobs.shift();

            this.cachedJob = {
                blob: blob,
                job_id: newJob.id,
                target: target,
                id: this.id
            };
        }else {
            var blob = currentBlockTemplate.nextBlobWithChildNonce();

            this.lastBlockHeight = currentBlockTemplate.height;
            var target = this.getTargetHex();

            let newJob = {
                id: utils.uid(),
                extraNonce: currentBlockTemplate.extraNonce,
                height: currentBlockTemplate.height,
                difficulty: this.difficulty,
                diffHex: this.diffHex,
                clientPoolLocation: currentBlockTemplate.clientPoolLocation,
                clientNonceLocation: currentBlockTemplate.clientNonceLocation,
                submissions: []
            };

            this.validJobs.push(newJob);

            if (this.validJobs.length > 4)
                this.validJobs.shift();

            this.cachedJob = {
                blocktemplate_blob: blob,
                difficulty: currentBlockTemplate.difficulty,
                height: currentBlockTemplate.height,
                reserved_offset: currentBlockTemplate.reserveOffset,
                client_nonce_offset: currentBlockTemplate.clientNonceLocation,
                client_pool_offset: currentBlockTemplate.clientPoolLocation,
                target_diff: this.difficulty,
                target_diff_hex: this.diffHex,
                job_id: newJob.id,
                id: this.id
            };
        }
        if (typeof config.includeAlgo !== "undefined" && config.includeAlgo)
            this.cachedJob['algo'] = config.includeAlgo
        if (typeof config.includeHeight !== "undefined" && config.includeHeight)
            this.cachedJob['height'] = currentBlockTemplate.height
        return this.cachedJob;
    },
    checkBan: function(validShare){
        if (!banningEnabled) return;
    
        // Init global per-ip shares stats
        if (!perIPStats[this.ip]){
            perIPStats[this.ip] = { validShares: 0, invalidShares: 0 };
        }
    
        var stats = perIPStats[this.ip];
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

/**
 * Handle miner method
 **/
function handleMinerMethod(method, params, ip, portData, sendReply, pushMessage){
    var miner = connectedMiners[params.id];

    // Check for ban here, so preconnected attackers can't continue to screw you
    if (IsBannedIp(ip)){
        sendReply('Your IP is banned');
        return;
    }

    switch(method){
        case 'login':
            var login = params.login;
            if (!login){
                sendReply('Missing login');
                return;
            }

            var port = portData.port;

            var pass = params.pass;
            var workerName = '';
            if (params.rigid) {
                workerName = params.rigid.trim();
            }
            else if (pass) {
                workerName = pass.trim();
                if (pass.indexOf(':') >= 0 && pass.indexOf('@') >= 0) {
                    passDelimiterPos = pass.lastIndexOf(':');
                    workerName = pass.substr(0, passDelimiterPos).trim();
                }
                workerName = workerName.replace(/:/g, '');
                workerName = workerName.replace(/\+/g, '');
                workerName = workerName.replace(/\s/g, '');
                if (workerName.toLowerCase() === 'x') {
                    workerName = '';
                }
            }
            if (!workerName || workerName === '') {
                workerName = 'undefined';
            }
            workerName = utils.cleanupSpecialChars(workerName);
        
            var difficulty = portData.difficulty;
            var noRetarget = false;
            if(config.poolServer.fixedDiff.enabled) {
                var fixedDiffCharPos = login.lastIndexOf(config.poolServer.fixedDiff.addressSeparator);
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

            var addr = login.split(config.poolServer.paymentId.addressSeparator);
            var address = addr[0] || null;
            var paymentId = addr[1] || null;
            
            if (!address) {
                log('warn', logSystem, 'No address specified for login');
                sendReply('Invalid address used for login');
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
                var addressPrefix = utils.getAddressPrefix(address);
                if (!addressPrefix) addressPrefix = 'N/A';

                log('warn', logSystem, 'Invalid address used for login (prefix: %s): %s', [addressPrefix, address]);
                sendReply('Invalid address used for login');
                return;
            }

            var minerId = utils.uid();
        miner = new Miner(minerId, login, pass, ip, port, params.agent, workerName, difficulty, noRetarget, pushMessage);
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

            var job = miner.validJobs.filter(function(job){
                return job.id === params.job_id;
            })[0];

            if (!job){
                sendReply('Invalid job id');
                return;
            }

            if (!params.nonce || !params.result) {
                sendReply('Attack detected');
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Malformed miner share: ' + JSON.stringify(params) + ' from ' + minerText);
                return;
            }

            if (!noncePattern.test(params.nonce)) {
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Malformed nonce: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share');
                return;
            }

            // Force lowercase for further comparison
            params.nonce = params.nonce.toLowerCase();

        if (!miner.proxy) {
            if (job.submissions.indexOf(params.nonce) !== -1){
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share');
                return;
            }

            job.submissions.push(params.nonce);
        } else {
            if (!Number.isInteger(params.poolNonce) || !Number.isInteger(params.workerNonce)) {
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Malformed nonce: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share');
                return;
            }
            let nonce_test = `${params.nonce}_${params.poolNonce}_${params.workerNonce}`;
            if (job.submissions.indexOf(nonce_test) !== -1) {
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share');
                return;
            }
            job.submissions.push(nonce_test);

        }

            var blockTemplate = currentBlockTemplate.height === job.height ? currentBlockTemplate : validBlockTemplates.filter(function(t){
                return t.height === job.height;
            })[0];

            if (!blockTemplate){
                sendReply('Block expired');
                return;
            }

            var shareAccepted = processShare(miner, job, blockTemplate, params);
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

            var now = Date.now() / 1000 | 0;
            miner.shareTimeRing.append(now - miner.lastShareTime);
            miner.lastShareTime = now;
            //miner.retarget(now);

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
            var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
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

    redisClient.sadd(config.coin + ':workers_ip:' + miner.login, miner.ip);
    redisClient.hincrby(config.coin + ':ports:'+miner.port, 'users', 1);

    redisClient.hincrby(config.coin + ':active_connections', miner.login + '~' + miner.workerName, 1, function(error, connectedWorkers) {
        if (connectedWorkers === 1) {
            notifications.sendToMiner(miner.login, 'workerConnected', {
                'LOGIN' : miner.login,
                'MINER': miner.login.substring(0,7)+'...'+miner.login.substring(miner.login.length-7),
                'IP': miner.ip.replace('::ffff:', ''),
                'PORT': miner.port,
                'WORKER_NAME': miner.workerName !== 'undefined' ? miner.workerName : ''
            });
        }
    });
}

/**
 * Remove connected worker
 **/
function removeConnectedWorker(miner, reason){
    redisClient.hincrby(config.coin + ':ports:'+miner.port, 'users', '-1');

    redisClient.hincrby(config.coin + ':active_connections', miner.login + '~' + miner.workerName, -1, function(error, connectedWorkers) {
        if (reason === 'banned') {
            notifications.sendToMiner(miner.login, 'workerBanned', {
                'LOGIN' : miner.login,
                'MINER': miner.login.substring(0,7)+'...'+miner.login.substring(miner.login.length-7),
                'IP': miner.ip.replace('::ffff:', ''),
                'PORT': miner.port,
                'WORKER_NAME': miner.workerName !== 'undefined' ? miner.workerName : ''
            });
        } else if (!connectedWorkers || connectedWorkers <= 0) {
            notifications.sendToMiner(miner.login, 'workerTimeout', {
                'LOGIN' : miner.login,
                'MINER': miner.login.substring(0,7)+'...'+miner.login.substring(miner.login.length-7),
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

    var bannedTime = bannedIPs[ip];
    var bannedTimeAgo = Date.now() - bannedTime;
    var timeLeft = config.poolServer.banning.time * 1000 - bannedTimeAgo;
    if (timeLeft > 0){
        return true;
    }
    else {
        delete bannedIPs[ip];
        log('info', logSystem, 'Ban dropped for %s', [ip]);
        return false;
    }
}

/**
 * Record miner share data
 **/
function recordShareData(miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate){
    var dateNow = Date.now();
    var dateNowSeconds = dateNow / 1000 | 0;

    var updateScore;
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
            2 /*keys*/, config.coin + ':scores:roundCurrent', config.coin + ':stats',
            /* args */ miner.login, job.difficulty, Date.now(), config.poolServer.slushMining.weight];
    }
    else {
        job.score = job.difficulty;
        updateScore = ['hincrbyfloat', config.coin + ':scores:roundCurrent', miner.login, job.score]
    }

    var redisCommands = [
        updateScore,
        ['hincrby', config.coin + ':shares_actual:roundCurrent', miner.login, job.difficulty],
        ['zadd', config.coin + ':hashrate', dateNowSeconds, [job.difficulty, miner.login, dateNow].join(':')],
        ['hincrby', config.coin + ':workers:' + miner.login, 'hashes', job.difficulty],
        ['hset', config.coin + ':workers:' + miner.login, 'lastShare', dateNowSeconds],
        ['expire', config.coin + ':workers:' + miner.login, (86400 * cleanupInterval)],
        ['expire', config.coin + ':payments:' + miner.login, (86400 * cleanupInterval)]
    ];

    if (miner.workerName) {
        redisCommands.push(['zadd', config.coin + ':hashrate', dateNowSeconds, [job.difficulty, miner.login + '~' + miner.workerName, dateNow].join(':')]);
        redisCommands.push(['hincrby', config.coin + ':unique_workers:' + miner.login + '~' + miner.workerName, 'hashes', job.difficulty]);
        redisCommands.push(['hset', config.coin + ':unique_workers:' + miner.login + '~' + miner.workerName, 'lastShare', dateNowSeconds]);
        redisCommands.push(['expire', config.coin + ':unique_workers:' + miner.login + '~' + miner.workerName, (86400 * cleanupInterval)]);
    }
    
    if (blockCandidate){
        redisCommands.push(['hset', config.coin + ':stats', 'lastBlockFound', Date.now()]);
        redisCommands.push(['rename', config.coin + ':scores:roundCurrent', config.coin + ':scores:round' + job.height]);
        redisCommands.push(['rename', config.coin + ':shares_actual:roundCurrent', config.coin + ':shares_actual:round' + job.height]);
        redisCommands.push(['hgetall', config.coin + ':scores:round' + job.height]);
        redisCommands.push(['hgetall', config.coin + ':shares_actual:round' + job.height]);
    }

    redisClient.multi(redisCommands).exec(function(err, replies){
        if (err){
            log('error', logSystem, 'Failed to insert share data into redis %j \n %j', [err, redisCommands]);
            return;
        }

        if (slushMiningEnabled) {
            job.score = parseFloat(replies[0][0]);
            var age = parseFloat(replies[0][1]);
            log('info', logSystem, 'Submitted score ' + job.score + ' for difficulty ' + job.difficulty + ' and round age ' + age + 's');
        }

        if (blockCandidate){
            var workerScores = replies[replies.length - 2];
            var workerShares = replies[replies.length - 1];
            var totalScore = Object.keys(workerScores).reduce(function(p, c){
                return p + parseFloat(workerScores[c])
            }, 0);
            var totalShares = Object.keys(workerShares).reduce(function(p, c){
                return p + parseInt(workerShares[c])
            }, 0);
            redisClient.zadd(config.coin + ':blocks:candidates', job.height, [
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
                'HEIGHT': job.height,
                'HASH': hashHex,
                'DIFFICULTY': blockTemplate.difficulty,
                'SHARES': totalShares,
                'MINER': miner.login.substring(0,7)+'...'+miner.login.substring(miner.login.length-7)
            });
        }

    });

    log('info', logSystem, 'Accepted %s share at difficulty %d/%d from %s@%s', [shareType, job.difficulty, shareDiff, miner.login, miner.ip]);
}

/**
 * Process miner share data
 **/
function processShare(miner, job, blockTemplate, params){
    var nonce = params.nonce;
    var resultHash = params.result;
    var template = Buffer.alloc(blockTemplate.buffer.length);
    if (!miner.proxy) {
        blockTemplate.buffer.copy(template);
        template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
    } else {
        blockTemplate.buffer.copy(template);
        template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
        template.writeUInt32BE(params.poolNonce, job.clientPoolLocation);
        template.writeUInt32BE(params.workerNonce, job.clientNonceLocation);
    }
    var shareBuffer = utils.cnUtil.construct_block_blob(template, Buffer.from(nonce, 'hex'), cnBlobType);

    var convertedBlob;
    var hash;
    var shareType;

    if (shareTrustEnabled && miner.trust.threshold <= 0 && miner.trust.penalty <= 0 && Math.random() > miner.trust.probability){
        hash = Buffer.from(resultHash, 'hex');
        shareType = 'trusted';
    }
    else {
        convertedBlob = utils.cnUtil.convert_blob(shareBuffer, cnBlobType);
        var hard_fork_version = convertedBlob[0];
        if (typeof config.includeHeight !== "undefined" && config.includeHeight)
            hash = cryptoNight(convertedBlob, cnVariant, job.height);
        else
            hash = cryptoNight(convertedBlob, cnVariant);
        log('info', logSystem, 'Mining pool algorithm: %s variant %d, Hard fork version: %d', [cnAlgorithm, cnVariant, hard_fork_version]);
        shareType = 'valid';
    }

    if (hash.toString('hex') !== resultHash) {
        log('warn', logSystem, 'Bad hash from miner %s@%s', [miner.login, miner.ip]);
        return false;
    }

    var hashArray = hash.toByteArray().reverse();
    var hashNum = bignum.fromBuffer(Buffer.from(hashArray));
    var hashDiff = diff1.div(hashNum);

    if (hashDiff.ge(blockTemplate.difficulty)){

        apiInterfaces.rpcDaemon('submitblock', [shareBuffer.toString('hex')], function(error, result){
            if (error){
                log('error', logSystem, 'Error submitting block at height %d from %s@%s, share type: "%s" - %j', [job.height, miner.login, miner.ip, shareType, error]);
                recordShareData(miner, job, hashDiff.toString(), false, null, shareType);
            }
            else{
                var blockFastHash = utils.cnUtil.get_block_id(shareBuffer, cnBlobType).toString('hex');
                log('info', logSystem,
                    'Block %s found at height %d by miner %s@%s - submit result: %j',
                    [blockFastHash.substr(0, 6), job.height, miner.login, miner.ip, result]
                );
                recordShareData(miner, job, hashDiff.toString(), true, blockFastHash, shareType, blockTemplate);
                jobRefresh();
            }
        });
    }

    else if (hashDiff.lt(job.difficulty)){
        log('warn', logSystem, 'Rejected low difficulty share of %s from %s@%s', [hashDiff.toString(), miner.login, miner.ip]);
        return false;
    }
    else{
        recordShareData(miner, job, hashDiff.toString(), false, null, shareType);
    }

    return true;
}

/**
 * Start pool server on TCP ports
 **/
var httpResponse = ' 200 OK\nContent-Type: text/plain\nContent-Length: 20\n\nMining server online';

function startPoolServerTcp(callback){
    log('info', logSystem, 'Clear values for connected workers in redis database.');
    redisClient.del(config.coin + ':active_connections');

    async.each(config.poolServer.ports, function(portData, cback){
        var handleMessage = function(socket, jsonData, pushMessage){
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

            var sendReply = function(error, result){
                if(!socket.writable) return;
                var sendData = JSON.stringify({
                    id: jsonData.id,
                    jsonrpc: "2.0",
                    error: error ? {code: -1, message: error} : null,
                    result: result
                }) + "\n";
                socket.write(sendData);
            };

            handleMinerMethod(jsonData.method, jsonData.params, socket.remoteAddress, portData, sendReply, pushMessage);
        };

        var socketResponder = function(socket){
            socket.setKeepAlive(true);
            socket.setEncoding('utf8');

            var dataBuffer = '';

            var pushMessage = function(method, params){
                if(!socket.writable) return;
                var sendData = JSON.stringify({
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
                    var messages = dataBuffer.split('\n');
                    var incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
                    for (var i = 0; i < messages.length; i++){
                        var message = messages[i];
                        if (message.trim() === '') continue;
                        var jsonData;
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
            } else if (!config.poolServer.sslCA) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate authority not configured', [portData.port]);
                cback(true);
            } else if (!fs.existsSync(config.poolServer.sslCert)) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate file not found (configuration error)', [portData.port]);
                cback(true);
            } else if (!fs.existsSync(config.poolServer.sslKey)) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL key file not found (configuration error)', [portData.port]);
                cback(true);
            } else if (!fs.existsSync(config.poolServer.sslCA)) {
                log('error', logSystem, 'Could not start server listening on port %d (SSL): SSL certificate authority file not found (configuration error)', [portData.port]);
                cback(true);
            } else {
                var options = {
                    key: fs.readFileSync(config.poolServer.sslKey),
                    cert: fs.readFileSync(config.poolServer.sslCert),
                    ca: fs.readFileSync(config.poolServer.sslCA)
                };
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
 
(function init(){
    jobRefresh(true, function(sucessful){ });
})();
