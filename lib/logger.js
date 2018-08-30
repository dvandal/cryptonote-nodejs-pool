/* Stellite Nodejs Pool
 * Copyright StelliteCoin	<https://github.com/stellitecoin/cryptonote-stellite-pool>
 * Copyright Ahmyi			<https://github.com/ahmyi/cryptonote-stellite-pool>
 * Copyright Dvandal    	<https://github.com/dvandal/cryptonote-nodejs-pool>
 * Copyright Fancoder   	<https://github.com/fancoder/cryptonote-universal-pool>
 * Copyright zone117x		<https://github.com/zone117x/node-cryptonote-pool>
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
 
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


var logFileDisbled = !config.logging.files || !config.logging.files.enabled || false;

if(!logFileDisbled){
	
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

}
/**
 * Add new log entry
 **/
// var debug ="unlocker";
var debug = false;
global.log = function(severity, system, text, data){
	
	if(debug !== false && system !== debug){
		return;
	}
	
    var logConsole =  severityLevels.indexOf(severity) >= severityLevels.indexOf(config.logging.console.level);
    
    logFiles = (!logFileDisbled)? severityLevels.indexOf(severity) >= severityLevels.indexOf(config.logging.files.level):false;
		
    if (!logConsole && !logFiles) {
    	return;
    }

    var time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss');
    var formattedMessage = text;

    if (data) {
        data.unshift(text);
        formattedMessage = util.format.apply(null, data);
    }

    if (logConsole){
        if (config.logging.console.colors){
            console.log(severityMap[severity](time) + clc.white.bold(' [' + system + '] ') + formattedMessage);
        }else{
            console.log(time + ' [' + system + '] ' + formattedMessage);
        }
    }


    if (logFiles) {
        var fileName = logDir + '/' + system + '_' + severity + '.log';
        var fileLine = time + ' ' + formattedMessage + '\n';
        pendingWrites[fileName] = (pendingWrites[fileName] || '') + fileLine;
    }
};