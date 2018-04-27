var fs = require('fs');

var async = require('async');

var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);

var emailSystem = require('./email.js');

var logSystem = 'payments';
require('./exceptionWriter.js')(logSystem);

log('info', logSystem, 'Started');

if (!config.poolServer.paymentId) config.poolServer.paymentId = {};
if (!config.poolServer.paymentId.addressSeparator) config.poolServer.paymentId.addressSeparator = ".";
if (!config.payments.priority) config.payments.priority = 0;

function getReadableCoins(coins, digits, withoutSymbol){
    var amount = (parseInt(coins || 0) / config.coinUnits).toFixed(digits || config.coinUnits.toString().length - 1);
    return amount + (withoutSymbol ? '' : (' ' + config.symbol));
}

function runInterval(){
    async.waterfall([

        // Get worker keys
        function(callback){
            redisClient.keys(config.coin + ':workers:*', function(error, result) {
                if (error) {
                    log('error', logSystem, 'Error trying to get worker balances from redis %j', [error]);
                    callback(true);
                    return;
                }
                callback(null, result);
            });
        },

        // Get worker balances
        function(keys, callback){
            var redisCommands = keys.map(function(k){
                return ['hget', k, 'balance'];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting balances from redis %j', [error]);
                    callback(true);
                    return;
                }

                var balances = {};
                for (var i = 0; i < replies.length; i++){
                    var parts = keys[i].split(':');
                    var workerId = parts[parts.length - 1];

                    balances[workerId] = parseInt(replies[i]) || 0;
                }
                callback(null, keys, balances);
            });
        },

        // Get worker minimum payout
        function(keys, balances, callback){
            var redisCommands = keys.map(function(k){
                return ['hget', k, 'minPayoutLevel'];
            });
            redisClient.multi(redisCommands).exec(function(error, replies){
                if (error){
                    log('error', logSystem, 'Error with getting minimum payout from redis %j', [error]);
                    callback(true);
                    return;
                }

                var minPayoutLevel = {};
                for (var i = 0; i < replies.length; i++){
                    var parts = keys[i].split(':');
                    var workerId = parts[parts.length - 1];

                    var defaultLevel = config.payments.minPayment;
                    var payoutLevel = parseInt(replies[i]) || defaultLevel;
                    if (payoutLevel < defaultLevel) payoutLevel = defaultLevel;
                    minPayoutLevel[workerId] = payoutLevel;

                    if (payoutLevel !== defaultLevel) {
                        log('info', logSystem, 'Using payout level %d for worker %s (default: %d)', [minPayoutLevel[workerId], workerId, defaultLevel]);
                    }
                }
                callback(null, balances, minPayoutLevel);
            });
        },

        // Filter workers under balance threshold for payment
        function(balances, minPayoutLevel, callback){
            var payments = {};

            for (var worker in balances){
                var balance = balances[worker];
                if (balance >= minPayoutLevel[worker]){
                    var remainder = balance % config.payments.denomination;
                    var payout = balance - remainder;

                    if (config.payments.dynamicTransferFee && config.payments.minerPayFee){
                        payout -= config.payments.transferFee;
                    }
                    if (payout < 0) continue;

                    payments[worker] = payout;
                }
            }

            if (Object.keys(payments).length === 0){
                log('info', logSystem, 'No workers\' balances reached the minimum payment threshold');
                callback(true);
                return;
            }

            var transferCommands = [];
            var addresses = 0;
            var commandAmount = 0;
            var commandIndex = 0;
            
            for (var worker in payments){
                var amount = parseInt(payments[worker]);
                if(config.payments.maxTransactionAmount && amount + commandAmount > config.payments.maxTransactionAmount) {
                    amount = config.payments.maxTransactionAmount - commandAmount;
                }
                
                var address = worker;
                var payment_id = null;

                var with_payment_id = false;

                var addr = worker.split(config.poolServer.paymentId.addressSeparator);
                if ((addr.length === 1 && worker.length === 106) || addr.length >= 2){
                    with_payment_id = true;
                    if (addr.length >= 2){
                        address = addr[0];
                        payment_id = addr[1];
                        payment_id = payment_id.replace(/[^A-Za-z0-9]/g,'');
                        if (payment_id.length !== 16 && payment_id.length !== 64) {
                            with_payment_id = false;
                            payment_id = null;
                        }
                    }
                    if (addresses > 0){
                        commandIndex++;
                        addresses = 0;
                        commandAmount = 0;
                    }
                }

                if(!transferCommands[commandIndex]) {
                    transferCommands[commandIndex] = {
                        redis: [],
                        amount : 0,
                        rpc: {
                            destinations: [],
                            fee: config.payments.transferFee,
                            mixin: config.payments.mixin,
                            priority: config.payments.priority,
                            unlock_time: 0
                        }
                    };
                }

                transferCommands[commandIndex].rpc.destinations.push({amount: amount, address: address});
                if (payment_id) transferCommands[commandIndex].rpc.payment_id = payment_id;

                transferCommands[commandIndex].redis.push(['hincrby', config.coin + ':workers:' + worker, 'balance', -amount]);
                if(config.payments.dynamicTransferFee && config.payments.minerPayFee){
                    transferCommands[commandIndex].redis.push(['hincrby', config.coin + ':workers:' + worker, 'balance', -config.payments.transferFee]);
                }
                transferCommands[commandIndex].redis.push(['hincrby', config.coin + ':workers:' + worker, 'paid', amount]);
                transferCommands[commandIndex].amount += amount;

                addresses++;
                commandAmount += amount;

                if (config.payments.dynamicTransferFee){
                    transferCommands[commandIndex].rpc.fee = config.payments.transferFee * addresses;
                }

                if (addresses >= config.payments.maxAddresses || (config.payments.maxTransactionAmount && commandAmount >= config.payments.maxTransactionAmount) || with_payment_id) {
                    commandIndex++;
                    addresses = 0;
                    commandAmount = 0;
                }
            }

            var timeOffset = 0;

            async.filter(transferCommands, function(transferCmd, cback){
                apiInterfaces.rpcWallet('transfer', transferCmd.rpc, function(error, result){
                    if (error){
                        log('error', logSystem, 'Error with transfer RPC request to wallet daemon %j', [error]);
                        log('error', logSystem, 'Payments failed to send to %j', transferCmd.rpc.destinations);
                        cback(false);
                        return;
                    }

                    var now = (timeOffset++) + Date.now() / 1000 | 0;
                    var txHash = result.tx_hash.replace('<', '').replace('>', '');


                    transferCmd.redis.push(['zadd', config.coin + ':payments:all', now, [
                        txHash,
                        transferCmd.amount,
                        transferCmd.rpc.fee,
                        transferCmd.rpc.mixin,
                        Object.keys(transferCmd.rpc.destinations).length
                    ].join(':')]);


                    for (var i = 0; i < transferCmd.rpc.destinations.length; i++){
                        var destination = transferCmd.rpc.destinations[i];
                        if (transferCmd.rpc.payment_id){
                            destination.address += config.poolServer.paymentId.addressSeparator + transferCmd.rpc.payment_id;
                        }
                        transferCmd.redis.push(['zadd', config.coin + ':payments:' + destination.address, now, [
                            txHash,
                            destination.amount,
                            transferCmd.rpc.fee,
                            transferCmd.rpc.mixin
                        ].join(':')]);

                        redisClient.hget(config.coin + ':notifications', destination.address, function(error, email) {
                            if (error || !email) return ;

                            emailSystem.sendEmail(
                                email,
                                'We sent you a payment',
                                'payment',
                                { 'AMOUNT': getReadableCoins(destination.amount, 4, false), 'ADDRESS': destination.address }
                            );
                        });
                    }


                    log('info', logSystem, 'Payments sent via wallet daemon %j', [result]);
                    redisClient.multi(transferCmd.redis).exec(function(error, replies){
                        if (error){
                            log('error', logSystem, 'Super critical error! Payments sent yet failing to update balance in redis, double payouts likely to happen %j', [error]);
                            log('error', logSystem, 'Double payments likely to be sent to %j', transferCmd.rpc.destinations);
                            cback(false);
                            return;
                        }
                        cback(true);
                    });
                });
            }, function(succeeded){
                var failedAmount = transferCommands.length - succeeded.length;
                log('info', logSystem, 'Payments splintered and %d successfully sent, %d failed', [succeeded.length, failedAmount]);
                callback(null);
            });

        }

    ], function(error, result){
        setTimeout(runInterval, config.payments.interval * 1000);
    });
}

runInterval();
