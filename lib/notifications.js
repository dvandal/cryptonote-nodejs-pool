/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Notifications system
 * Supports: email, telegram
 *
 * Author: Daniel Vandal
 **/

// Load required modules
var fs = require('fs');
var dateFormat = require('dateformat');

var emailSystem = require('./email.js');
var telegram = require('./telegram.js');
var utils = require('./utils.js');

// Initialize log system
var logSystem = 'notifications';
require('./exceptionWriter.js')(logSystem);

// Load notification settings
var notificationSettings = {
    poolHost: null,
    coinDecimals: 4,
    emailTemplate: "email/template.txt",
    emailSubject: {
        emailAdded: "Your email was registered",
        telegramEnabled: "Telegram notifications enabled",
        workerConnected: "Worker %WORKER_NAME% connected",
        workerTimeout: "Worker %WORKER_NAME% stopped hashing",
        workerBanned: "Worker %WORKER_NAME% banned",
        blockFound: "Block %HEIGHT% found !",
        blockUnlocked: "Block %HEIGHT% unlocked !",
        blockOrphaned: "Block %HEIGHT% orphaned !",
        payment: "We sent you a payment !"
    },
    emailMessage: {
        emailAdded: "Your email has been registered to receive pool notifications.",
        telegramEnabled: "You will now receive telegram notifications to %CHATID%.",
        workerConnected: "Your worker %WORKER_NAME% is now connected.",
        workerTimeout: "Your worker %WORKER_NAME% has stopped submitting hashes on %LAST_HASH%.",
        workerBanned: "Your worker %WORKER_NAME% has been banned.",
        blockFound: "Block found at height %HEIGHT% by miner %MINER% on %TIME%. Waiting maturity.",
        blockUnlocked: "Block mined at %HEIGHT% with %REWARD% and %EFFORT% effort on %TIME%.",
        blockOrphaned: "Block orphaned at height %HEIGHT% :(",
        payment: "A payment of %AMOUNT% has been sent to %ADDRESS% wallet."
    },
    telegramMessage: {
        telegramEnabled: "Hi, you will now receive pool notifications!",
        emailAdded: "You will now receive email notifications to %EMAIL%.",
        workerConnected: "Your worker %WORKER_NAME% is now connected.",
        workerTimeout: "Your worker %WORKER_NAME% has stopped submitting hashes on %LAST_HASH%.",
        workerBanned: "Your worker %WORKER_NAME% has been banned.",
        blockFound: "Block found at height %HEIGHT% by miner %MINER%. Waiting maturity.",
        blockUnlocked: "Block mined at %HEIGHT% with %REWARD% and %EFFORT% effort on %TIME%.",
        blockOrphaned: "Block orphaned at height %HEIGHT% :(",
        payment: "A payment of %AMOUNT% has been sent."
    }
};

if (config.notifications) {
    Object.assign(notificationSettings, config.notifications);
}

// Test notification message
notificationSettings.emailSubject['test'] = "Test notification";
notificationSettings.emailMessage['test'] = "This is a test notification from the pool.";
notificationSettings.telegramMessage['test'] = "This is a test notification from the pool.";

/**
 * Send global notification
 **/
exports.sendToAll = function(id, variables) {
    // Set custom variables
    variables = setCustomVariables(variables);

    // Send telegram to channel
    if (config.telegram && config.telegram.enabled) {
        var message = getTelegramMessage(id, variables);
        if (!message) {
            log('error', logSystem, 'Empty telegram message for %s', [id]);
            return;
        }

        var channel = config.telegram.channel.replace(/@/, '') || '';
        if (!channel) {
            log('error', logSystem, 'No telegram channel specified in configuration!');
            return ;
        }

        var chatId = '@' + channel;
        telegram.sendMessage(chatId, '*'+message+'*');
    }
    
    // Send email
    if (config.email && config.email.enabled) {
        var subject = getEmailSubject(id, variables);
        var content = getEmailContent(id, variables);
        if (!content) {
            log('error', logSystem, 'Empty email content for %s', [id]);
            return;
        }

        redisClient.hgetall(config.coin + ':notifications', function(error, data) {
            if (error || !data) return ;
            for (var address in data) {
                var email = data[address];
                emailSystem.sendEmail(email, subject, content);
            }
        });
    }
}

/**
 * Send miner notification
 **/
exports.sendToMiner = function(miner, id, variables) {
    // Set custom variables
    variables = setCustomVariables(variables);

    // Send telegram
    if (config.telegram && config.telegram.enabled) {
    var message = getTelegramMessage(id, variables);
        if (!message) {
            log('error', logSystem, 'Empty telegram message for %s', [id]);
            return;
        }

        redisClient.hget(config.coin + ':telegram', miner, function(error, chatId) {
            if (error || !chatId) return;
            telegram.sendMessage(chatId, message);
        });
    }
    
    // Send email
    if (config.email && config.email.enabled) {
        var subject = getEmailSubject(id, variables);
        var content = getEmailContent(id, variables);
        if (!content) {
            log('error', logSystem, 'Empty email content for %s', [id]);
            return;
        }

        redisClient.hget(config.coin + ':notifications', miner, function(error, email) {
            if (error || !email) return ;
            emailSystem.sendEmail(email, subject, content);
        });
    }
}

/**
 * Send telegram channel notification
 **/
exports.sendToTelegramChannel = function(id, variables) {
    // Set custom variables
    variables = setCustomVariables(variables);
    
    // Send notification
    if (config.telegram && config.telegram.enabled) {
        var message = getTelegramMessage(id, variables);
        if (!message) {
            log('error', logSystem, 'Empty telegram message for %s', [id]);
            return ;
        }

        var channel = config.telegram.channel.replace(/@/, '') || '';
        if (!channel) {
            log('error', logSystem, 'No telegram channel specified in configuration!');
            return ;
        }

        var chatId = '@' + channel;
        telegram.sendMessage(chatId, message);
    }
}
 
/**
 * Send email notification
 **/
exports.sendToEmail = function(email, id, variables) {
    // Set custom variables
    variables = setCustomVariables(variables);
    
    // Send notification
    if (config.email && config.email.enabled) {
        var subject = getEmailSubject(id, variables);
        var content = getEmailContent(id, variables);
        if (!content) {
            log('error', logSystem, 'Empty email content for %s', [id]);
            return;
        }

        emailSystem.sendEmail(email, subject, content);
    }
}

/**
 * Date formatting
 **/
function formatDate(dateObj) {
    return dateFormat(dateObj, 'yyyy-mm-dd HH:MM:ss Z');
}
exports.formatDate = formatDate;

/**
 * Get readable coins
 **/
exports.getReadableCoins = function(coins) {
    var digits = notificationSettings.coinDecimals || config.coinUnits.toString().length - 1;
    return utils.getReadableCoins(coins, digits, false);
}
 
/**
 * Email functions
 **/

// Get email subject
function getEmailSubject(id, variables) {
    var subject = replaceVariables(notificationSettings.emailSubject[id], variables) || '';
    return subject;
}

// Get email content
function getEmailContent(id, variables) {
    var message = notificationSettings.emailMessage[id] || '';
    if (!message) return '';
    
    var content = message;
    if (notificationSettings.emailTemplate) {
        if (!fs.existsSync(notificationSettings.emailTemplate)) {
            log('warn', logSystem, 'Email template file not found: %s', [notificationSettings.emailTemplate]);
        }
        content = fs.readFileSync(notificationSettings.emailTemplate, 'utf8');
        content = content.replace(/%MESSAGE%/, message);
    }
    content = replaceVariables(content, variables);
    return content;
}

/**
 * Telegram functions
 **/

// Get telegram message
function getTelegramMessage(id, variables) {
    var message = replaceVariables(notificationSettings.telegramMessage[id], variables) || '';
    return message;
}

/**
 * Handle variables in texts
 **/
 
// Set custom variables
function setCustomVariables(variables) {
    if (!variables) variables = {};
    variables['TIME'] = formatDate(Date.now());
    variables['POOL_HOST'] = notificationSettings.poolHost || '';
    return variables;
}

// Replace variables in a string
function replaceVariables(string, variables) {
    if (!string) return '';
    if (variables) {
        for (var varName in variables) {
            string = string.replace(new RegExp('%'+varName+'%', 'g'), variables[varName]);
        }
        string = string.replace(/  /, ' ');
    }
    return string;
}
