/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Telegram/E-mail multipool relay system
 * This module relays notifications generated on remote pools via telegram or email.
 *
 * Author: Jason Rhinelander
 **/

var emailSystem = require('./email.js');
var telegram = require('./telegram.js');

// Initialize log system
var logSystem = 'relayNotify';
require('./exceptionWriter.js')(logSystem);

var telegram_enabled = config.telegram && config.telegram.enabled && config.telegram.token && config.telegram.relay;
var email_enabled = config.email && config.email.enabled && config.email.relay;

// Check settings
if (!telegram_enabled && !email_enabledl) {
    log('error', logSystem, 'Neither telegram nor e-mail is enabled on this pool!');
}
else {
    if (telegram_enabled && config.telegram.remote) {
        log('error', logSystem, 'Telegram relaying disabled: telegram is enabled, but this pool is configured as a Telegram relay remote');
    }
    if (email_enabled && config.email.remote) {
        log('error', logSystem, 'E-mail relaying disabled: e-mail is enabled, but this pool is configured as an e-mail relay remote');
    }
}

var telegram_relay_interval = config.telegram.relay_interval || 3;
var email_relay_interval = config.email.relay_interval || 10;

function telegramInterval(){
    // Pop off any pending telegram notifications and send them via telegram
    redisClient.multi([
            ['lrange', config.coin + ':relay:telegram', 0, -1],
            ['del', config.coin + ':relay:telegram']
    ]).exec(
        function (error, replies) {
            if (error) {
                log('error', logSystem, 'Error retrieving messages for relay: %j', [error]);
            }
            else {
                for (let t of replies[0]) {
                    let tg;
                    try {
                        tg = JSON.parse(t);
                    } catch(e) {
                        log('error', logSystem, 'An error occured while parsing a relayed telegram message: %j', [e]);
                    }
                    telegram.sendMessage(tg.chatId, tg.messageText);
                }
            }

            setTimeout(telegramInterval, telegram_relay_interval * 1000);
        }
    );
}

function emailInterval() {
    // Pop off any pending e-mail notifications and send them
    redisClient.multi([
            ['lrange', config.coin + ':relay:email', 0, -1],
            ['del', config.coin + ':relay:email']
    ]).exec(
        function (error, replies) {
            if (error) {
                log('error', logSystem, 'Error retrieving messages for relay: %j', [error]);
            }
            else {
                for (let t of replies[0]) {
                    let email;
                    try {
                        email = JSON.parse(t);
                    } catch(e) {
                        log('error', logSystem, 'An error occured while parsing a relayed e-mail message: %j', [e]);
                    }
                    emailSystem.sendEmail(email.email, email.subject, email.content);
                }
            }

            setTimeout(emailInterval, email_relay_interval * 1000);
        }
    );
}

if (telegram_enabled && !config.telegram.remote)
    telegramInterval();
if (email_enabled && !config.email.remote)
    emailInterval();

