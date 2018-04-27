var https = require('https');
var querystring = require('querystring');
var logSystem = 'telegram';

exports.sendMessage = function(messageText) {
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
    
    // Check telegram bot token
    if (!config.telegram.token || config.telegram.token === '') {
        log('error', logSystem, 'No telegram token specified in configuration!');
        return ;
    }
    var token = config.telegram.token;
    
    // Check if channel has been specified
    if (!config.telegram.channel || config.telegram.channel === '' || config.telegram.channel === '@') {
        log('error', logSystem, 'No telegram channel specified in configuration!');
        return ;
    }
    var channel = config.telegram.channel.replace(/@/, '');

    // Set telegram API URL
    var action = "sendMessage";
    var params = { chat_id: '@' + channel, text: '*' + messageText + '*', parse_mode: 'Markdown' };

    var apiURL = 'https://api.telegram.org/bot' + token + '/' + action;
    apiURL += '?' + querystring.stringify(params);

    https.get(apiURL, function(request) {
        var data = '';
        request.on("data", function(chunk) { data += chunk; });
        request.on("end", function() {
            if (!data) {
                log('error', logSystem, 'Telegram request failed: communication error (no data)');
                return ;
            }
            var response = JSON.parse(data);
            if (response && !response.ok) {
                log('error', logSystem, 'Telegram API error: [%s] %s', [response.error_code, response.description]);
                return ;
            }
	    log('info', logSystem, 'Telegram message sent to @%s: %s', [channel, messageText]);
        });
    }).on("error", function(error) {
        log('error', logSystem, 'Telegram request failed: %s', [error.message]);
        return ;
    });
}
