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
	BTC: '392gS9zuYQBghmMpK3NipBTaQcooR9UoGy',
	BCH: 'qp46fz7ht8xdhwepqzhk7ct3aa0ucypfgv5qvv57td',
        XMR: '49WyMy9Q351C59dT913ieEgqWjaN12dWM5aYqJxSTZCZZj1La5twZtC3DyfUsmVD3tj2Zud7m6kqTVDauRz53FqA9zphHaj',
	DASH: 'XgFnxEu1ru7RTiM4uH1GWt2yseU1BVBqWL',
	ETH: '0x8c42D411545c9E1963ff56A91d06dEB8C4A9f444',
	ETC: '0x4208D6775A2bbABe64C15d76e99FE5676F2768Fb',
	LTC: 'LS9To9u2C95VPHKauRMEN5BLatC8C1k4F1',
	USDC: '0xb5c6BEc389252F24dd3899262AC0D2754B0fC1a3',
	REP: '0x5A66CE95ea2428BC5B2c7EeB7c96FC184258f064',
	BAT: '0x5A66CE95ea2428BC5B2c7EeB7c96FC184258f064',
	LINK: '0x5A66CE95ea2428BC5B2c7EeB7c96FC184258f064',
	DAI: '0xF2a50BcCEE8BEb7807dA40609620e454465B40A1',
	OXT: '0xf52488AAA1ab1b1EB659d6632415727108600BCb',
	XTZ: 'tz1T1idcT5hfyjfLHWeqbYvmrcYn5JgwrJKW',
	ZCH: 't1YTGVoVbeCuTn3Pg9MPGrSqweFLPGTQ7on',
	ZRX: '0x4e52AAfC6dAb2b7812A0a7C24a6DF6FAab65Fc9a'
};

global.donations = {};

global.devFee = config.blockUnlocker.devDonation || 0.0;
if (config.blockUnlocker.devDonation === 0){
	global.devFee = 0.0;
}

let wallet = donationAddresses[config.symbol.toUpperCase()];
if (devFee && wallet){
	global.donations[wallet] = devFee;
}
