/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Telegram bot
 *
 * Author: Daniel Vandal
 **/

// Load required modules
process.env.NTBA_FIX_319 = 1;
var TelegramBot = require('node-telegram-bot-api');

var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
var notifications = require('./notifications.js');
var utils = require('./utils.js');

// Initialize log system
var logSystem = 'telegramBot';
require('./exceptionWriter.js')(logSystem);

/**
 * Check telegram configuration
 **/

if (!config.telegram) {
    log('error', logSystem, 'Telegram is not enabled');
}
else if (!config.telegram.enabled) {
    log('error', logSystem, 'Telegram is not enabled');
}
else if (!config.telegram.token) {
    log('error', logSystem, 'No telegram token found in configuration');
}

/**
 * Initialize new telegram bot
 **/

log('info', logSystem, 'Started');

var token = config.telegram.token;
var bot = new TelegramBot(token, {polling: true});

/**
 * Handle "/start" or "/help"
 **/
bot.onText(/\/(start|help)/, (msg) => {
    var chatId = msg.chat.id;

    log('info', logSystem, 'Commands list request from @%s (%s)', [msg.chat.username, chatId]);

    bot.sendMessage(chatId,
        'Hi @' + msg.chat.username + ',\n\n' +
	'Here are the commands you can use:\n' +
	'/stats - Pool statistics\n' +
	'/enable <address> - Enable notifications\n' +
	'/disable <address> - Disable notifications\n\n' +
	'Thank you!'
    );
});

/**
 * Pool statistics
 **/
bot.onText(/\/stats/, (msg) => {
    var chatId = msg.chat.id;

    log('info', logSystem, 'Pool statistics request from @%s (%s)', [msg.chat.username, chatId]);
    
    apiInterfaces.pool('/stats', function(error, stats) {    
        if (error) {
            log('error', logSystem, 'Unable to get API data for stats: ' + error);
	    return bot.sendMessage(id, 'Unable to get pool statistics. Please retry.');
        }

	var response = '';
	response += 'Pool Hashrate: ' + utils.getReadableHashRate(stats.pool.hashrate) + '\n';
	response += 'Network Hashrate: ' +  utils.getReadableHashRate(stats.network.difficulty / stats.config.coinDifficultyTarget) + '\n';
	response += 'Network Difficulty: ' + stats.network.difficulty + '\n';
	response += 'Blockchain Height: ' + stats.network.height + '\n';
	response += 'Connected Miners: ' + stats.pool.miners + '\n';
	response += 'Active Workers: ' + stats.pool.workers + '\n';
	response += 'Blocks Found: ' + stats.pool.totalBlocks + '\n';
	response += 'Last block: ' + notifications.formatDate(new Date(parseInt(stats.pool.lastBlockFound))) + '\n';
	response += 'Current Effort: ' + (stats.pool.roundHashes / stats.network.difficulty * 100).toFixed(1) + '%';

        return bot.sendMessage(chatId, response);	
    });
});

/**
 * Enable miner notifications
 **/
bot.onText(/^\/enable(.*)$/, (msg, match) => {
    var chatId = msg.chat.id;
    var address = (match && match[1]) ? match[1].trim() : '';

    log('info', logSystem, 'Enable miner notifications request from @%s (%s)', [msg.chat.username, chatId]);

    if (!address || address == '') {
        return bot.sendMessage(chatId, 'No address specified!');
    }
    
    var apiRequest = '/set_telegram_notifications?chatId='+chatId+'&address='+address+'&action=enable';
    apiInterfaces.pool(apiRequest, function(error, response) {
        if (error) {            
            log('error', logSystem, 'Unable to enable telegram notifications: ' + error);
	    return bot.sendMessage(chatId, 'An error occurred. Please retry.');
        }
	if (response.status != 'done') {
	    return bot.sendMessage(chatId, response.status);
	}
        return bot.sendMessage(chatId, 'Notifications enabled for ' + address);
    });
});

/**
 * Disable miner notifications
 **/
bot.onText(/^\/disable(.*)$/, (msg, match) => {
    var chatId = msg.chat.id;
    var address = (match && match[1]) ? match[1].trim() : '';

    log('info', logSystem, 'Disable miner notifications request from @%s (%s)', [msg.chat.username, chatId]);
    
    if (!address || address == '') {
        return bot.sendMessage(chatId, 'No address specified!');
    }
    
    var apiRequest = '/set_telegram_notifications?chatId='+chatId+'&address='+address+'&action=disable';
    apiInterfaces.pool(apiRequest, function(error, response) {
        if (error) {            
            log('error', logSystem, 'Unable to disable telegram notifications: ' + error);
	    return bot.sendMessage(chatId, 'An error occurred. Please retry.');
        }
	if (response.status != 'done') {
	    return bot.sendMessage(chatId, response.status);
	}
        return bot.sendMessage(chatId, 'Notifications disabled for ' + address);
    });
});