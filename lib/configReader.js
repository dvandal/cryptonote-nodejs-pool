/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Configuration Reader
 **/

// Load required modules
var fs = require('fs');

// Set pool software version
global.version = "v1.3.5";

/**
 * Load pool configuration
 **/
 
// Get configuration file path
var configFile = (function(){
    for (var i = 0; i < process.argv.length; i++){
        if (process.argv[i].indexOf('-config=') === 0)
            return process.argv[i].split('=')[1];
    }
    return 'config.json';
})();

// Read configuration file data
try {
    global.config = JSON.parse(fs.readFileSync(configFile));
}
catch(e){
    console.error('Failed to read config file ' + configFile + '\n\n' + e);
    return;
}

/**
 * Developper donation addresses -- thanks for supporting my works!
 **/
 
var donationAddresses = {
    BTC: '35kAuFPUS1REXQnGM2TxqMbwkKZ9hA4ZfW',
    ETH: '0x1f6177295A6630858BFA25fD60effA048B307674',
    LTC: 'MPoYzJjr7FhRqwgSNNYi6Ai9uQ9MeiR5Yy',
    XMR: '49nCLA3KtAx5MTWidB3opHif7cwnXXHcn6occpXB8DTe6B4QjcAqG4SH7TrGPVuE4n1ygE6is5nER4ms1Yb1hnmYMkBwN4L',
    MCN: 'VduTsfyVGBAA2CqdqEh4Vya7B1im7sf1PDbntv1GomLxQpXNxwucsww4ArmR6uLK7PQCY4kVnPGXr8evyXDFNmkk2aBv178S6'
};

global.donations = {};

var percent = config.blockUnlocker.devDonation;
var wallet = donationAddresses[config.symbol];
if (percent && wallet) {
    global.donations[wallet] = percent;
}
