/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Telegram notifications system
 *
 * Author: Daniel Vandal
 **/

// Load required modules
let https = require('https');
let querystring = require('querystring');

// Initialize log system
let logSystem = 'telegram';
require('./exceptionWriter.js')(logSystem);

/**
 * Send telegram message
 **/
exports.sendMessage = function(chatId, messageText) {
    // Return error if no text content
    if (!messageText) {
        log('warn', logSystem, 'No text to send.');
        return ;
    }

    // Check telegram configuration
    if (!config.telegram) {
        log('error', logSystem, 'Telegram is not configured!');
        return ;
    }
    
    // Do nothing if telegram is disabled
    if (!config.telegram.enabled) return ;
    
    // Telegram bot token
    let token = config.telegram.token || '';
    if (!token || token === '') {
        log('error', logSystem, 'No telegram token specified in configuration!');
        return ;
    }
    
    // Telegram chat id
    if (!chatId || chatId === '' || chatId === '@') {
        log('error', logSystem, 'No telegram chat id specified!');
        return ;
    }

    // Set telegram API URL
    let action = "sendMessage";
    let params = { chat_id: chatId, text: messageText, parse_mode: 'Markdown' };

    let apiURL = 'https://api.telegram.org/bot' + token + '/' + action;
    apiURL += '?' + querystring.stringify(params);

    https.get(apiURL, function(request) {
        let data = '';
        request.on("data", function(chunk) { data += chunk; });
        request.on("end", function() {
            if (!data) {
                log('error', logSystem, 'Telegram request failed: communication error (no data)');
                return ;
            }
            let response = JSON.parse(data);
            if (response && !response.ok) {
                log('error', logSystem, 'Telegram API error: [%s] %s', [response.error_code, response.description]);
                return ;
            }
            log('info', logSystem, 'Telegram message sent to %s: %s', [params.chat_id, messageText]);
        });
    }).on("error", function(error) {
        log('error', logSystem, 'Telegram request failed: %s', [error.message]);
        return ;
    });
}
