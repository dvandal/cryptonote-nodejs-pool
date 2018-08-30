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
 
const notifications = require('./events/notifications.js');

const eventDisabled = !config.event || !config.event.enabled;

exports.blockOrphaned = function(data) {
	if(eventDisabled){
		return;
	}
	notifications.sendToAll('blockOrphaned', data);
};
exports.blockFound = function(data){
	if(eventDisabled){
		return;
	}
	
	notifications.sendToAll('blockFound',data);
}
exports.blockUnlocked = function(data){
	if(eventDisabled){
		return;
	}
	notifications.sendToAll('blockUnlocked', data);
}   

exports.paymentRecieved = function(data){
	if(eventDisabled){
		return;
	}
	
	for (let m in data.miners) {
        const notify = data.miners[m];
        log('info', logSystem, 'Payment of %s to %s', [ utils.getReadableCoins(notify.amount), notify.address ]);
        notifications.sendToMiner(notify.address, 'payment', {
            'ADDRESS': notify.address.substring(0,7)+'...'+notify.address.substring(notify.address.length-7),
            'AMOUNT': utils.getReadableCoins(notify.amount),
	    });
    }
}

exports.connectedMiner = function(data){
	if(eventDisabled){
		return;
	}
	notifications.sendToMiner(data.LOGIN, 'workerConnected', data);
}

exports.workerBanned = function(data){
	if(eventDisabled){
		return;
	}
	notifications.sendToMiner(data.LOGIN, 'workerBanned', data);
}

exports.workerTimeout = function(data){
	if(eventDisabled){
		return;
	}
	notifications.sendToMiner(data.LOGIN, 'workerTimeout', data);
}
