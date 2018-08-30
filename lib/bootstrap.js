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
 
const fs = require('fs');

global.contributions = {};

const APP_VER_MAJOR  = 1;
const APP_VER_MINOR  = 4;
const APP_VER_PATCH  = 0;

const version = APP_VER_MAJOR+"."+APP_VER_MINOR+"."+APP_VER_PATCH;


module.exports = function(configFile){
	// Set pool software version
	
	try {
    	config = JSON.parse(fs.readFileSync(configFile));
    	
	} catch(e){
	    console.error('Failed to read config file ' + configFile + '\n\n' + e);
	    process.exit();
	}
	
	global.version = version;
	
	if (!config.poolServer.paymentId || !config.poolServer.paymentId.addressSeparator) {
		config.poolServer.paymentId = {
			addressSeparator:"."
		};
	}
	
	if (!config.poolServer.donations || !config.poolServer.donations.addressSeparator) {
		config.poolServer.donations = {
			addressSeparator:"%"
		};
	}
	
	if (!config.poolServer.fixedDiff || !config.poolServer.fixedDiff.addressSeparator) {
		config.poolServer.fixedDiff = {
			addressSeparator:"+"
		};
	}
	 
	
	// if (global.config.contributions) {
	// 	for(var wallet in global.config.contributions){
	// 	    global.contributions[wallet] =  global.config.contributions[wallet].percent;
	// 	}
	// }

	return config;
}
