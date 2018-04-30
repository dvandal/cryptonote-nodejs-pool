/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Utilities functions
 **/

/**
 * Cleanup special characters
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
    return str.replace(/[^A-Za-z0-9]/gi,'');
}
exports.cleanupSpecialChars = cleanupSpecialChars;

/**
 * Parse miner address to split wallet address and worker name
 **/
exports.getAddressParts = function(miner) {
    var address = '';
    var workerName = '';
    
    var nameOffset = miner.indexOf('+');
    if (nameOffset !== -1) {
        address = miner.substr(0, nameOffset);
        workerName = cleanupSpecialChars(miner.substr(nameOffset + 1));
    }
    else {
        address = miner;
    }
    return { address: address, workerName: workerName };
};

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
 * Get readable coins
 **/
exports.getReadableCoins = function(coins, digits, withoutSymbol){
    var amount = (parseInt(coins || 0) / config.coinUnits).toFixed(digits || config.coinUnits.toString().length - 1);
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