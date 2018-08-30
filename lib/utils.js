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
 
var crypto = require('crypto');

var dateFormat = require('dateformat');
exports.dateFormat = dateFormat;

var cnUtil = require('cryptonote-util');
exports.cnUtil = cnUtil;

/**
 * Generate random instance id
 **/
exports.instanceId = function() {
    return crypto.randomBytes(4);
}

/**
 * Validate miner address
 **/
var addressBase58Prefix = parseInt(cnUtil.address_decode(new Buffer(config.poolServer.poolAddress)).toString());
var integratedAddressBase58Prefix = 28822;

// Get address prefix
function getAddressPrefix(address) {
    var addressBuffer = new Buffer(address);

    var addressPrefix = cnUtil.address_decode(addressBuffer);
    
    if (addressPrefix) {
    	addressPrefix = parseInt(addressPrefix.toString());
    }

    if (!addressPrefix) {
        addressPrefix = cnUtil.address_decode_integrated(addressBuffer);
        if (addressPrefix) addressPrefix = parseInt(addressPrefix.toString());
    }

    return addressPrefix || null;
}
exports.getAddressPrefix = getAddressPrefix;

// Validate miner address
exports.validateMinerAddress = function(address) {
    
    if (/\W/.test(address)) {
    	return false;
    }
    
    var addressPrefix = getAddressPrefix(address);
    if (addressPrefix === addressBase58Prefix || addressPrefix === integratedAddressBase58Prefix) {
    	return true;
    }
    return false;
}

// Return if value is an integrated address
exports.isIntegratedAddress = function(address) {
    var addressPrefix = getAddressPrefix(address);
    return (addressPrefix === integratedAddressBase58Prefix);
}

/**
 * Cleanup special characters (fix for non latin characters)
 **/
function cleanupSpecialChars(str) {
    str = str.replace(/[ÀÁÂÃÄÅ]/g,"A");
    str = str.replace(/[àáâãäå]/g,"a");
    str = str.replace(/[ÈÉÊË]/g,"E");
    str = str.replace(/[èéêë]/g,"e");
    str = str.replace(/[ÌÎÏ]/g,"I");
    str = str.replace(/[ìîï]/g,"i");
    str = str.replace(/[ÒÔÖ]/g,"O");
    str = str.replace(/[òôö]/g,"o");
    str = str.replace(/[ÙÛÜ]/g,"U");
    str = str.replace(/[ùûü]/g,"u");
    return str.replace(/[^A-Za-z0-9\-\_]/gi,'');
}
exports.cleanupSpecialChars = cleanupSpecialChars;

/**
 * Get readable hashrate
 **/
exports.getReadableHashRate = function(hashrate){
    var i = 0;
    var byteUnits = [' H', ' KH', ' MH', ' GH', ' TH', ' PH' ];
    while (hashrate > 1000){
        hashrate = hashrate / 1000;
        i++;
    }
    return hashrate.toFixed(2) + byteUnits[i] + '/sec';
}
 
 /**
 * Returns an appropriate unicode smiley for a donation level
 **/
exports.getDonationSmiley = function(level) {
    return (
        level <= 0 ? '😢' :
        level <= 5 ? '😎' :
        level <= 10 ? '😄' :
        '😂');
}
 
/**
 * Get readable coins
 **/
exports.getReadableCoins = function(coins, digits, withoutSymbol){
    var coinDecimalPlaces = config.coinDecimalPlaces || config.coinUnits.toString().length - 1;
    var amount = (parseInt(coins || 0) / config.coinUnits).toFixed(digits || coinDecimalPlaces);
    return amount + (withoutSymbol ? '' : (' ' + config.symbol));
}

/**
 * Generate unique id
 **/
exports.uid = function(){
    var min = 100000000000000;
    var max = 999999999999999;
    var id = Math.floor(Math.random() * (max - min + 1)) + min;
    return id.toString();
};

/**
 * Ring buffer
 **/
exports.ringBuffer = function(maxSize){
    var data = [];
    var cursor = 0;
    var isFull = false;

    return {
        append: function(x){
            if (isFull){
                data[cursor] = x;
                cursor = (cursor + 1) % maxSize;
            }
            else{
                data.push(x);
                cursor++;
                if (data.length === maxSize){
                    cursor = 0;
                    isFull = true;
                }
            }
        },
        avg: function(plusOne){
            var sum = data.reduce(function(a, b){ return a + b }, plusOne || 0);
            return sum / ((isFull ? maxSize : cursor) + (plusOne ? 1 : 0));
        },
        size: function(){
            return isFull ? maxSize : cursor;
        },
        clear: function(){
            data = [];
            cursor = 0;
            isFull = false;
        }
    };
};