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
var cluster = require('cluster');
var dateFormat = require('dateformat');

/**
 * Handle exceptions
 **/
module.exports = function(logSystem){
    process.on('uncaughtException', function(err) {
        // console.log('\n' + err.stack + '\n');
        console.log(err);
        var time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss');
        if(global.config.logging.files.enabled){
	        fs.appendFile(global.config.logging.files.directory + '/' + logSystem + '_crash.log', time + '\n' + err.stack + '\n\n', function(err){
	            if (cluster.isWorker){
	                process.exit();
	            }
	        });
        }else if (cluster.isWorker){
			process.exit();
        }
    });
};