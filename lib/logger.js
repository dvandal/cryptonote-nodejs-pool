/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Log system
 **/

// Load required modules
let fs = require('fs');
let util = require('util');
let dateFormat = require('dateformat');
let clc = require('cli-color');

/**
 * Initialize log system
 **/
 
// Set CLI colors
let severityMap = {
    'info': clc.blue,
    'warn': clc.yellow,
    'error': clc.red
};

// Set severity levels
let severityLevels = ['info', 'warn', 'error'];

// Set log directory
let logDir = config.logging.files.directory;

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
let pendingWrites = {};

setInterval(function(){
    for (let fileName in pendingWrites){
        let data = pendingWrites[fileName];
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

    let logConsole = severityLevels.indexOf(severity) >= severityLevels.indexOf(config.logging.console.level);
    let logFiles = severityLevels.indexOf(severity) >= severityLevels.indexOf(config.logging.files.level);

    if (!logConsole && !logFiles) return;

    let time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss');
    let formattedMessage = text;

    if (data) {
        data.unshift(text);
        formattedMessage = util.format.apply(null, data);
    }

    if (logConsole){
        if (config.logging.console.colors)
	    if (system === 'daemon' || system === 'childDaemon') {
                console.log(severityMap[severity](time) + clc.green.bold(' [' + system + '] ' + formattedMessage));
	    }
	    else {
                console.log(severityMap[severity](time) + clc.white.bold(' [' + system + '] ') + formattedMessage);
	    }
        else
            console.log(time + ' [' + system + '] ' + formattedMessage);
    }


    if (logFiles) {
        let fileName = logDir + '/' + system + '_' + severity + '.log';
        let fileLine = time + ' ' + formattedMessage + '\n';
        pendingWrites[fileName] = (pendingWrites[fileName] || '') + fileLine;
    }
};
