/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Configuration Reader
 **/

// Load required modules
let fs = require('fs');

// Set pool software version
global.version = "v2.0.0";

/**
 * Load pool configuration
 **/

// Get configuration file path
let configFile = (function () {
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i].indexOf('-config=') === 0)
			return process.argv[i].split('=')[1];
	}
	return 'config.json';
})();

// Read configuration file data
try {
	global.config = JSON.parse(fs.readFileSync(configFile));
} catch (e) {
	console.error('Failed to read config file ' + configFile + '\n\n' + e);
	return;
}

/**
 * Developper donation addresses -- thanks for supporting my works!
 **/

let donationAddresses = {
	BTC: '18tytWtmoi3fzEdRFXfa96xHXUfBPvtMj5',
	BCH: 'qpxcm3r90y6cedvazm4phwr82m3ywwn66gzwllq63l',
	ETH: '0x745F2Bc9570B8C8DcD51249d7fdC2528f03efF1c',
	LTC: 'LKF12Fi92zuxDhpHLe7gSWBtTdJbcULa85',
	XMR: '44c7umSm7TyXxKch9q4R5QfoTAf663A8yEFfJbxmxUJ1JCWq2kFu33oAAydrgNDQA8619rSQhZaFV3ScpESWCfcQB3Fqc6w',
	TRTL: 'TRTLv2tGkYa5W7UTH8q9mhhQdY8Ftbo3RNBfpupZYnCm7uHZp6jrxXV3pyPnzdftZj2rfCZsUkpJQWTbdbJ5wx84PB3rTojR7C9',
	DOGE: 'DDrA5dZTjjnyYPxT23wmG5X5sxqt7XNMQe',
	ARMS: 'guns91W8WhUT8mwBRByeh2erje1JcW7Vq8XP7VEL8CS2NPR7oqRK9mv2YN3Vvup9Hk98mpEQ9S9WeLMzgL52CKRY3xVd1WgTKL',
  MNG: 'MEpLh1LswBqihtwVB7VuYAQP7E39SYSwVQwFVyAjpGd6fdALVvZk74YTq5jTo4DNnTdkw2wcWCzJ2EtVJ9k9DhioBWQ7GGq',
  WOO: 'WwaFjmWQrNG1h1bSVcP8UjKYL1nHRHp5sGVVSX9pZmtFjfPFfBi4XoJCWewvjXU4gxGmuiNpZSBLd4sgRWnusrNS15x8facrx'
};

global.donations = {};

global.devFee = config.blockUnlocker.devDonation || 0.2;
if (config.blockUnlocker.devDonation === 0)
	global.devFee = 0.2;

let wallet = donationAddresses[config.symbol.toUpperCase()];
if (devFee && wallet)
	global.donations[wallet] = devFee;
