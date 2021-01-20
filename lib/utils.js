/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Utilities functions
 **/

// Load required module
let crypto = require('crypto');

let dateFormat = require('dateformat');
exports.dateFormat = dateFormat;

let cnUtil = require('cryptoforknote-util');
exports.cnUtil = cnUtil;

/**
 * Generate random instance id
 **/
exports.instanceId = function () {
	return crypto.randomBytes(4);
}

/**
 * Validate miner address
 **/
var addressBase58Prefix = config.poolServer.pubAddressPrefix ? parseInt(config.poolServer.pubAddressPrefix) : parseInt(cnUtil.address_decode(Buffer.from(config.poolServer.poolAddress)).toString());
let integratedAddressBase58Prefix = config.poolServer.intAddressPrefix ? parseInt(config.poolServer.intAddressPrefix) : addressBase58Prefix + 1;
let subAddressBase58Prefix = config.poolServer.subAddressPrefix ? parseInt(config.poolServer.subAddressPrefix) : "N/A";

// Get address prefix
function getAddressPrefix (address) {
	let addressBuffer = Buffer.from(address);

	let addressPrefix = cnUtil.address_decode(addressBuffer);
	if (addressPrefix) {
		addressPrefix = parseInt(addressPrefix.toString());
	}
	if (!addressPrefix) {
		addressPrefix = cnUtil.address_decode_integrated(addressBuffer);
	}

	return addressPrefix || null;
}
exports.getAddressPrefix = getAddressPrefix;

// Validate miner address
exports.validateMinerAddress = function (address) {
	let addressPrefix = getAddressPrefix(address);
	if (addressPrefix === addressBase58Prefix) return true;
	else if (addressPrefix === integratedAddressBase58Prefix) return true;
	else if (addressPrefix === subAddressBase58Prefix) return true;
	return false;
}

function characterCount (string, char) {
	let re = new RegExp(char, "gi")
	let matches = string.match(re)
	return matches === null ? 0 : matches.length;
}
exports.characterCount = characterCount;

// Validate miner address
exports.validateChildMinerAddress = (address, index) => {
	let childAddressBase58Prefix = parseInt(cnUtil.address_decode(Buffer.from(config.childPools[index].poolAddress)).toString());
	let childIntegratedAddressBase58Prefix = config.poolServer.intChildAddressPrefix ? parseInt(config.childPools[index].intAddressPrefix) : childAddressBase58Prefix + 1;

	let addressPrefix = getAddressPrefix(address);
	if (addressPrefix === childAddressBase58Prefix) return true;
	else if (addressPrefix === childIntegratedAddressBase58Prefix) return true;
	return false;
}

// Return if value is an integrated address
exports.isIntegratedAddress = function (address) {
	let addressPrefix = getAddressPrefix(address);
	return (addressPrefix === integratedAddressBase58Prefix);
}

exports.determineRewardData = (value) => {
	let calculatedData = {
		'address': value,
		'rewardType': 'prop'
	}
	if (/^solo:/i.test(value)) {
		calculatedData['address'] = value.substr(5)
		calculatedData['rewardType'] = 'solo'
		return calculatedData
	}
	if (/^prop:/i.test(value)) {
		calculatedData['address'] = value.substr(5)
		calculatedData['rewardType'] = 'prop'
		return calculatedData
	}
	return calculatedData
}

/**
 * Cleanup special characters (fix for non latin characters)
 **/
function cleanupSpecialChars (str) {
	str = str.replace(/[ÀÁÂÃÄÅ]/g, "A");
	str = str.replace(/[àáâãäå]/g, "a");
	str = str.replace(/[ÈÉÊË]/g, "E");
	str = str.replace(/[èéêë]/g, "e");
	str = str.replace(/[ÌÎÏ]/g, "I");
	str = str.replace(/[ìîï]/g, "i");
	str = str.replace(/[ÒÔÖ]/g, "O");
	str = str.replace(/[òôö]/g, "o");
	str = str.replace(/[ÙÛÜ]/g, "U");
	str = str.replace(/[ùûü]/g, "u");
	return str.replace(/[^A-Za-z0-9\-\_+]/gi, '');
}
exports.cleanupSpecialChars = cleanupSpecialChars;

/**
 * Get readable hashrate
 **/
exports.getReadableHashRate = function (hashrate) {
	let i = 0;
	let byteUnits = [' H', ' KH', ' MH', ' GH', ' TH', ' PH'];
	while (hashrate > 1000) {
		hashrate = hashrate / 1000;
		i++;
	}
	return hashrate.toFixed(2) + byteUnits[i] + '/sec';
}

/**
 * Get readable coins
 **/
exports.getReadableCoins = function (coins, digits, withoutSymbol) {
	let coinDecimalPlaces = config.coinDecimalPlaces || config.coinUnits.toString().length - 1;
	let amount = (parseInt(coins || 0) / config.coinUnits).toFixed(digits || coinDecimalPlaces);
	return amount + (withoutSymbol ? '' : (' ' + config.symbol));
}

/**
 * Generate unique id
 **/
exports.uid = function () {
	let min = 100000000000000;
	let max = 999999999999999;
	let id = Math.floor(Math.random() * (max - min + 1)) + min;
	return id.toString();
};

/**
 * Ring buffer
 **/
exports.ringBuffer = function (maxSize) {
	let data = [];
	let cursor = 0;
	let isFull = false;

	return {
		append: function (x) {
			if (isFull) {
				data[cursor] = x;
				cursor = (cursor + 1) % maxSize;
			} else {
				data.push(x);
				cursor++;
				if (data.length === maxSize) {
					cursor = 0;
					isFull = true;
				}
			}
		},
		avg: function (plusOne) {
			let sum = data.reduce(function (a, b) {
				return a + b
			}, plusOne || 0);
			return sum / ((isFull ? maxSize : cursor) + (plusOne ? 1 : 0));
		},
		size: function () {
			return isFull ? maxSize : cursor;
		},
		clear: function () {
			data = [];
			cursor = 0;
			isFull = false;
		}
	};
};
