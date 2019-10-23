/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Log system
 **/

// Load required modules
var fs = require('fs');
var util = require('util');
var dateFormat = require('dateformat');
var clc = require('cli-color');

/**
 * Initialize log system
 **/
 
// Set CLI colors
var severityMap = {
    'info': clc.blue,
    'warn': clc.yellow,
    'error': clc.red
};

// Set severity levels
var severityLevels = ['info', 'warn', 'error'];

// Set log directory
var logDir = config.logging.files.directory;

// Create log directory if not exists
if (!fs.existsSync(logDir)){
    try {
        fs.mkdirSync(logDir);
    }
    catch(e){
        throw e;
    }
}

/**
 * Write log entries to file at specified flush interval
 **/ 
var pendingWrites = {};

setInterval(function(){
    for (var fileName in pendingWrites){
        var data = pendingWrites[fileName];
        fs.appendFile(fileName, data, function(err) {
            if (err) {
                console.log("Error writing log data to disk: %s", err);
                callback(null, "Error writing data to disk");
            }
        });
        delete pendingWrites[fileName];
    }
}, config.logging.files.flushInterval * 1000);

/**
 * Add new log entry
 **/
global.log = function(severity, system, text, data){

    var logConsole = severityLevels.indexOf(severity) >= severityLevels.indexOf(config.logging.console.level);
    var logFiles = severityLevels.indexOf(severity) >= severityLevels.indexOf(config.logging.files.level);

    if (!logConsole && !logFiles) return;

    var time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss');
    var formattedMessage = text;

    if (data) {
        data.unshift(text);
        formattedMessage = util.format.apply(null, data);
    }

    if (logConsole){
        if (config.logging.console.colors)
            console.log(severityMap[severity](time) + clc.white.bold(' [' + system + '] ') + formattedMessage);
        else
            console.log(time + ' [' + system + '] ' + formattedMessage);
    }


    if (logFiles) {
        var fileName = logDir + '/' + system + '_' + severity + '.log';
        var fileLine = time + ' ' + formattedMessage + '\n';
        pendingWrites[fileName] = (pendingWrites[fileName] || '') + fileLine;
    }
};