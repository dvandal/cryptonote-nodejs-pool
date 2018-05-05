/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Configuration Reader
 **/

// Load required modules
var fs = require('fs');

// Set pool software version
global.version = "v1.3.1";

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
    BTC: '17XRyHm2gWAj2yfbyQgqxm25JGhvjYmQjm',
    BCH: 'qpl0gr8u3yu7z4nzep955fqy3w8m6w769sec08u3dp',
    ETH: '0x83ECF65934690D132663F10a2088a550cA201353',
    DERO: 'dERojUtWgEsAGjTXEJyezgSqvpEEfRGiWCRxuELx2PXa9gopNwNr7YGPAFNmJzzWgW84wGJ84RS8jAp1GesTeXgY7VDJMBGWYt',
    GRFT: 'GBqRuitSoU3PFPBAkXMEnLdBRWXH4iDSD6RDxnQiEFjVJhWUi1UuqfV5EzosmaXgpPGE6JJQjMYhZZgWY8EJQn8jQTsuTit',
    LTC: 'LS9To9u2C95VPHKauRMEN5BLatC8C1k4F1',
    MSR: '5kNzFdhqZX65yv6Ui9p8uX5k2GvJA8EFMCPMPyjK2j6JHHbKCgUkdgLdVa5C8dg7wzAAoTGF1EZKb7YGUtMpeQzH3nBJ9j9',
    XMR: '49WyMy9Q351C59dT913ieEgqWjaN12dWM5aYqJxSTZCZZj1La5twZtC3DyfUsmVD3tj2Zud7m6kqTVDauRz53FqA9zphHaj',
    SUMO: 'Sumoo4mVXMfYw2PFtPRXzviHfESnx5aW6VrMLoYVeVubYH6snAwr6D9R8j7fuvQvjifDqLLKH1KtMXuv7iHGgCM1fd4spVrvP1T',
    XHV: 'hvxy2RAzE7NfXPLE3AmsuRaZztGDYckCJ14XMoWa6BUqGrGYicLCcjDEjhjGAQaAvHYGgPD7cGUwcYP7nEUs8u6w3uaap9UZTf',
    XTL: 'Se3f1wKeaY88HrhhQGwcvmBWpWcmHRNSXjizaJ43sKF58TZqwjnFYgJG5ZrCUkyxAbaf6d9FAjMWjVmdwrUkLiYB2NPHYCjsX'
};

global.donations = {};

var percent = config.blockUnlocker.devDonation;
var wallet = donationAddresses[config.symbol];
if (percent && wallet) {
    global.donations[wallet] = percent;
}
