var fs = require('fs');
var net = require('net');
var tls = require('tls');
var crypto = require('crypto');

var async = require('async');
var bignum = require('bignum');
var multiHashing = require('cryptonight-hashing');
var cnUtil = require('cryptonote-util');

var dateFormat = require('dateformat');
var emailSystem = require('./email.js');

// Must exactly be 8 hex chars
var noncePattern = new RegExp("^[0-9A-Fa-f]{8}$");

var threadId = '(Thread ' + process.env.forkId + ') ';

var logSystem = 'pool';
require('./exceptionWriter.js')(logSystem);

var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
var utils = require('./utils.js');

Buffer.prototype.toByteArray = function () {
    return Array.prototype.slice.call(this, 0);
}

var log = function(severity, system, text, data){
    global.log(severity, system, threadId + text, data);
};

var cryptoNight = multiHashing['cryptonight'];

var diff1 = bignum('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 16);

var instanceId = crypto.randomBytes(4);

var validBlockTemplates = [];
var currentBlockTemplate;

// Vars for slush mining
var scoreTime;
var lastChecked = 0;

var poolStarted = false;
var connectedMiners = {};
var connectedWorkers = {};

var bannedIPs = {};
var perIPStats = {};

var shareTrustEnabled = config.poolServer.shareTrust && config.poolServer.shareTrust.enabled;
var shareTrustStepFloat = shareTrustEnabled ? config.poolServer.shareTrust.stepDown / 100 : 0;
var shareTrustMinFloat = shareTrustEnabled ? config.poolServer.shareTrust.min / 100 : 0;

var banningEnabled = config.poolServer.banning && config.poolServer.banning.enabled;

var addressBase58Prefix = cnUtil.address_decode(new Buffer(config.poolServer.poolAddress));
var integratedAddressBase58Prefix = addressBase58Prefix + 1; // Integrated address prefixes are address prefix + 1

if (!config.poolServer.paymentId) config.poolServer.paymentId = {};
if (!config.poolServer.paymentId.addressSeparator) config.poolServer.paymentId.addressSeparator = ".";

/* Fix bad workers bug in 1.2.0 */
redisClient.keys(config.coin + ':workers:*', function(error, result) {
    var badWorkers = [];
    for (var i = 0; i < result.length; i++) {
        var parts = result[i].split(':');
        var workerId = parts[parts.length - 1];
        if (workerId.indexOf('+') != -1) {
            badWorkers.push(workerId);
        }
    }
    if (badWorkers.length > 0) {
        var redisCommands = badWorkers.map(function(k){
            return ['hget', k, 'balance'];
        });
        redisClient.multi(redisCommands).exec(function(error, replies){
            var fixCommands = [];
            for (var i = 0; i < replies.length; i++){
                var workerId = badWorkers[i];
                var minerId = workerId.substr(0, workerId.indexOf('+'));
                var balance = parseInt(replies[i]) || 0;
                fixCommands.push(['hincrby', config.coin + ':workers:' + minerId, 'balance', balance]);
                fixCommands.push(['del', config.coin + ':workers:' + workerId]);
                fixCommands.push(['hdel', config.coin + ':shares:roundCurrent', workerId]);
            }
            redisClient.multi(fixCommands).exec(function(error, replies){});
        });
    }
});


/* Variable difficulty retarget */
setInterval(function(){
    var now = Date.now() / 1000 | 0;
    for (var minerId in connectedMiners){
        var miner = connectedMiners[minerId];
        if(!miner.noRetarget) {
            miner.retarget(now);
        }
    }
}, config.poolServer.varDiff.retargetTime * 1000);


/* Every 30 seconds clear out timed-out miners and old bans */
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


process.on('message', function(message) {
    switch (message.type) {
        case 'banIP':
            bannedIPs[message.ip] = Date.now();
            break;
    }
});


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


function BlockTemplate(template){
    this.blob = template.blocktemplate_blob;
    this.difficulty = template.difficulty;
    this.height = template.height;
    this.reserveOffset = template.reserved_offset;
    this.buffer = new Buffer(this.blob, 'hex');
    instanceId.copy(this.buffer, this.reserveOffset + 4, 0, 3);
    this.previous_hash = new Buffer(32);
    this.buffer.copy(this.previous_hash,0,7,39);
    this.extraNonce = 0;
}
BlockTemplate.prototype = {
    nextBlob: function(){
        this.buffer.writeUInt32BE(++this.extraNonce, this.reserveOffset);
        return cnUtil.convert_blob(this.buffer).toString('hex');
    }
};


function getBlockTemplate(callback){
    apiInterfaces.rpcDaemon('getblocktemplate', {reserve_size: 8, wallet_address: config.poolServer.poolAddress}, callback);
}


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
        var buffer = new Buffer(result.blocktemplate_blob, 'hex');
        var previous_hash = new Buffer(32);
        buffer.copy(previous_hash,0,7,39);
        if (!currentBlockTemplate || previous_hash.toString('hex') != currentBlockTemplate.previous_hash.toString('hex')){
            log('info', logSystem, 'New block to mine at height %d w/ difficulty of %d', [result.height, result.difficulty]);
            processBlockTemplate(result);
        }
        if (!poolStarted) {
            startPoolServerTcp(function(successful){ poolStarted = true });
        }
        callback(true);
    })
}


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


(function init(){
    jobRefresh(true, function(sucessful){ });
})();

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

function Miner(id, login, pass, ip, port, workerName, email, startingDiff, noRetarget, pushMessage){
    this.id = id;
    this.login = login;
    this.pass = pass;
    this.ip = ip;
    this.port = port;
    this.workerName = workerName;
    this.email = email;
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

        var padded = new Buffer(32);
        padded.fill(0);

        var diffBuff = diff1.div(this.difficulty).toBuffer();
        diffBuff.copy(padded, 32 - diffBuff.length);

        var buff = padded.slice(0, 4);
        var buffArray = buff.toByteArray().reverse();
        var buffReversed = new Buffer(buffArray);
        this.target = buffReversed.readUInt32BE(0);
        var hex = buffReversed.toString('hex');
        return hex;
    },
    getJob: function(){
        if (this.lastBlockHeight === currentBlockTemplate.height && !this.pendingDifficulty) {
            return {
                blob: '',
                job_id: '',
                target: ''
            };
        }

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

        return {
            blob: blob,
            job_id: newJob.id,
            target: target,
            id: this.id
        };
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



function newConnectedWorker(miner){
    log('info', logSystem, 'Miner connected %s@%s on port', [miner.login, miner.ip, miner.port]);
    if (miner.workerName != 'undefined') log('info', logSystem, 'Worker Name: %s', [miner.workerName]);
    if (miner.email) log('info', logSystem, 'E-Mail Address: %s', [miner.email]);
    if (miner.difficulty) log('info', logSystem, 'Miner difficulty fixed to %s', [miner.difficulty]);

    if (!connectedWorkers[miner.workerName]) connectedWorkers[miner.workerName] = 0;
    connectedWorkers[miner.workerName]++;

    redisClient.hincrby([config.coin + ':ports:'+miner.port, 'users', '1']);

    if (miner.email && connectedWorkers[miner.workerName] == 1) {
        emailSystem.sendEmail(
            miner.email,
            'Worker %WORKER_NAME% connected',
            'worker_connected',
            {'WORKER_NAME': miner.workerName != 'undefined' ? miner.workerName : ''}
        );
    }
}

function removeConnectedWorker(miner, reason){
    if (!connectedWorkers[miner.workerName]) connectedWorkers[miner.workerName] = 0;
    if (connectedWorkers[miner.workerName] > 0) connectedWorkers[miner.workerName]--;
    if (connectedWorkers[miner.workerName] <= 0) delete connectedWorkers[miner.workerName];

    redisClient.hincrby([config.coin + ':ports:'+miner.port, 'users', '-1']);

    if (miner.email) {
        if (reason == 'banned') {
            emailSystem.sendEmail(
                this.email,
                'Worker %WORKER_NAME% banned',
                'worker_banned',
                {'WORKER_NAME': this.workerName != 'undefined' ? this.workerName : ''}
            );
        } else if (!connectedWorkers[miner.workerName]) {
            emailSystem.sendEmail(
                miner.email,
                'Worker %WORKER_NAME% stopped hashing',
                'worker_timeout',
                {'WORKER_NAME': miner.workerName != 'undefined' ? miner.workerName : '',
                 'LAST_HASH': dateFormat(new Date(miner.lastBeat), 'yyyy-mm-dd HH:MM:ss Z')}
            );
        }        
    }
}



function recordShareData(miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate){

    var dateNow = Date.now();
    var dateNowSeconds = dateNow / 1000 | 0;

    // Weighting older shares lower than newer ones to prevent pool hopping
    if (config.poolServer.slushMining.enabled) {                
        if (lastChecked + config.poolServer.slushMining.lastBlockCheckRate <= dateNowSeconds || lastChecked == 0) {
            redisClient.hget(config.coin + ':stats', 'lastBlockFound', function(error, result) {
                if (error) {
                    log('error', logSystem, 'Unable to determine the timestamp of the last block found');
                    return;
                }
                scoreTime = result / 1000 | 0; //scoreTime could potentially be something else than the beginning of the current round, though this would warrant changes in api.js (and potentially the redis db)
                lastChecked = dateNowSeconds;
            });
        }
        
        job.score = job.difficulty * Math.pow(Math.E, ((dateNowSeconds - scoreTime) / config.poolServer.slushMining.weight)); // Score Calculation
        log('info', logSystem, 'Submitted score ' + job.score + ' with difficulty ' + job.difficulty + ' and the time ' + scoreTime);
    }
    else {
        job.score = job.difficulty;
    }

    var cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;
    
    var redisCommands = [
        ['hincrby', config.coin + ':shares:roundCurrent', miner.login, job.score],
        ['zadd', config.coin + ':hashrate', dateNowSeconds, [job.difficulty, miner.login, dateNow].join(':')],
        ['hincrby', config.coin + ':workers:' + miner.login, 'hashes', job.difficulty],
        ['hset', config.coin + ':workers:' + miner.login, 'lastShare', dateNowSeconds],
        ['expire', config.coin + ':workers:' + miner.login, (86400 * config.redis.cleanupInterval)],
        ['expire', config.coin + ':payments:' + miner.login, (86400 * config.redis.cleanupInterval)]
    ];

    if (miner.workerName) {
        redisCommands.push(['zadd', config.coin + ':hashrate', dateNowSeconds, [job.difficulty, miner.login + '+' + miner.workerName, dateNow].join(':')]);
        redisCommands.push(['hincrby', config.coin + ':unique_workers:' + miner.login + '+' + miner.workerName, 'hashes', job.difficulty]);
        redisCommands.push(['hset', config.coin + ':unique_workers:' + miner.login + '+' + miner.workerName, 'lastShare', dateNowSeconds]);
        redisCommands.push(['expire', config.coin + ':unique_workers:' + miner.login + '+' + miner.workerName, (86400 * config.redis.cleanupInterval)]);
    }
    
    if (blockCandidate){
        redisCommands.push(['hset', config.coin + ':stats', 'lastBlockFound', Date.now()]);
        redisCommands.push(['rename', config.coin + ':shares:roundCurrent', config.coin + ':shares:round' + job.height]);
        redisCommands.push(['hgetall', config.coin + ':shares:round' + job.height]);
    }

    redisClient.multi(redisCommands).exec(function(err, replies){
        if (err){
            log('error', logSystem, 'Failed to insert share data into redis %j \n %j', [err, redisCommands]);
            return;
        }
        if (blockCandidate){
            var workerShares = replies[replies.length - 1];
            var totalShares = Object.keys(workerShares).reduce(function(p, c){
                return p + parseInt(workerShares[c])
            }, 0);
            redisClient.zadd(config.coin + ':blocks:candidates', job.height, [
                hashHex,
                Date.now() / 1000 | 0,
                blockTemplate.difficulty,
                totalShares
            ].join(':'), function(err, result){
                if (err){
                    log('error', logSystem, 'Failed inserting block candidate %s \n %j', [hashHex, err]);
                }
            });
        }

    });

    log('info', logSystem, 'Accepted %s share at difficulty %d/%d from %s@%s', [shareType, job.difficulty, shareDiff, miner.login, miner.ip]);
}

function processShare(miner, job, blockTemplate, nonce, resultHash){
    var template = new Buffer(blockTemplate.buffer.length);
    blockTemplate.buffer.copy(template);
    template.writeUInt32BE(job.extraNonce, blockTemplate.reserveOffset);
    var shareBuffer = cnUtil.construct_block_blob(template, new Buffer(nonce, 'hex'));

    var convertedBlob;
    var hash;
    var shareType;

    if (shareTrustEnabled && miner.trust.threshold <= 0 && miner.trust.penalty <= 0 && Math.random() > miner.trust.probability){
        hash = new Buffer(resultHash, 'hex');
        shareType = 'trusted';
    }
    else {
        convertedBlob = cnUtil.convert_blob(shareBuffer);

        var cn_variant = convertedBlob[0] >= 7 ? 1 : 0;
	if (config.cnVariant) cn_variant = parseInt(config.cnVariant);

        hash = cryptoNight(convertedBlob, cn_variant);
        shareType = 'valid';
    }

    if (hash.toString('hex') !== resultHash) {
        log('warn', logSystem, 'Bad hash from miner %s@%s', [miner.login, miner.ip]);
        return false;
    }

    var hashArray = hash.toByteArray().reverse();
    var hashNum = bignum.fromBuffer(new Buffer(hashArray));
    var hashDiff = diff1.div(hashNum);



    if (hashDiff.ge(blockTemplate.difficulty)){

        apiInterfaces.rpcDaemon('submitblock', [shareBuffer.toString('hex')], function(error, result){
            if (error){
                log('error', logSystem, 'Error submitting block at height %d from %s@%s, share type: "%s" - %j', [job.height, miner.login, miner.ip, shareType, error]);
                recordShareData(miner, job, hashDiff.toString(), false, null, shareType);
            }
            else{
                var blockFastHash = cnUtil.get_block_id(shareBuffer).toString('hex');
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


function handleMinerMethod(method, params, ip, portData, sendReply, pushMessage){
    var miner = connectedMiners[params.id];

    // Check for ban here, so preconnected attackers can't continue to screw you
    if (IsBannedIp(ip)){
        sendReply('your IP is banned');
        return;
    }

    switch(method){
        case 'login':
            var login = params.login;
            if (!login){
                sendReply('missing login');
                return;
            }

            var port = portData.port;

            var pass = params.pass;
            var email = '';
            var workerName = '';
            if (params.rigid) {
                workerName = params.rigid.trim();
            }
            else if (pass) {
                workerName = pass.trim();
                if (pass.indexOf(':') >= 0 && pass.indexOf('@') >= 0) {
                    passDelimiterPos = pass.lastIndexOf(':');
                    workerName = pass.substr(0, passDelimiterPos).trim();
                    email = pass.substr(passDelimiterPos + 1).trim();
                }
                workerName = workerName.replace(/:/g, '');
                workerName = workerName.replace(/\+/g, '');
                workerName = workerName.replace(/\s/g, '');
                if (workerName.toLowerCase() == 'x') {
                    workerName = '';
                }
            }
            if (!workerName || workerName == '') {
                workerName = 'undefined';
            }
        
            var difficulty = portData.difficulty;
            var noRetarget = false;
            if(config.poolServer.fixedDiff.enabled) {
                var fixedDiffCharPos = login.lastIndexOf(config.poolServer.fixedDiff.addressSeparator);
                if (fixedDiffCharPos != -1 && (login.length - fixedDiffCharPos < 32)){
                    diffValue = login.substr(fixedDiffCharPos + 1);
                    difficulty = parseInt(diffValue);
                    if (!difficulty || difficulty != diffValue) {
                        log('warn', logSystem, 'Invalid difficulty value "%s" for login: %s', [diffValue, address]);
                    } else {
                        noRetarget = true;
                        if (difficulty < config.poolServer.varDiff.minDiff) {
                            difficulty = config.poolServer.varDiff.minDiff;
                        }
                    }
                    login = login.substr(0, fixedDiffCharPos);
                }
            }

            var addr = login.split(config.poolServer.paymentId.addressSeparator);
            var address = addr[0];

            var addressPrefix = cnUtil.address_decode(new Buffer(address));
            if (addressBase58Prefix !== addressPrefix && integratedAddressBase58Prefix !== addressPrefix){
                log('warn', logSystem, 'Invalid address used for login: %s', [address]);
                sendReply('invalid address used for login');
                return;
            }
        
            var minerId = utils.uid();
            miner = new Miner(minerId, login, pass, ip, port, workerName, email, difficulty, noRetarget, pushMessage);
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

            if (job.submissions.indexOf(params.nonce) !== -1){
                var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
                log('warn', logSystem, 'Duplicate share: ' + JSON.stringify(params) + ' from ' + minerText);
                perIPStats[miner.ip] = { validShares: 0, invalidShares: 999999 };
                miner.checkBan(false);
                sendReply('Duplicate share');
                return;
            }

            job.submissions.push(params.nonce);

            var blockTemplate = currentBlockTemplate.height === job.height ? currentBlockTemplate : validBlockTemplates.filter(function(t){
                return t.height === job.height;
            })[0];

            if (!blockTemplate){
                sendReply('Block expired');
                return;
            }

            var shareAccepted = processShare(miner, job, blockTemplate, params.nonce, params.result);
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
                sendReply('Low difficulty share');
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
            miner.heartbeat()
            sendReply(null, { status:'KEEPALIVED' });
            break;
        default:
            sendReply("invalid method");
            var minerText = miner ? (' ' + miner.login + '@' + miner.ip) : '';
            log('warn', logSystem, 'Invalid method: %s (%j) from %s', [method, params, minerText]);
            break;
    }
}


var httpResponse = ' 200 OK\nContent-Type: text/plain\nContent-Length: 20\n\nmining server online';

function startPoolServerTcp(callback){
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
                        handleMessage(socket, jsonData, pushMessage);
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
                redisClient.del([config.coin + ':ports:'+portData.port]);
                redisClient.hset([config.coin + ':ports:'+portData.port, 'port', portData.port ]);

                log('info', logSystem, 'Started server listening on port %d (SSL)', [portData.port]);
                cback();
            });
        } 
        else {
            net.createServer(socketResponder).listen(portData.port, function (error, result) {
                if (error) {
                    log('error', logSystem, 'Could not start server listening on port %d, error: $j', [portData.port, error]);
                    cback(true);
                    return;
                }

                log('info', logSystem, 'Clear values for port %d in redis database.', [portData.port]);
                redisClient.del([config.coin + ':ports:'+portData.port]);
                redisClient.hset([config.coin + ':ports:'+portData.port, 'port', portData.port ]);

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
