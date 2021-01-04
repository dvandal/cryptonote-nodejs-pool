"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');
let fs = require('fs');
let lineReader = require('readline');

let hashes = {
    'CryptoNight': {
        'file': 'cryptonight.txt',
        'fileFormat': 'cn',
        'function': multiHashing.cryptonight
    },
};

for (let hashType in hashes){
    if (hashes.hasOwnProperty(hashType)){
        let testsFailed = 0, testsPassed = 0;
        let lr = lineReader.createInterface({
            input: fs.createReadStream(hashes[hashType].file)
        });
        lr.on('line', function (line) {
            if (hashes[hashType].fileFormat === 'cn'){
                let line_data = line.split(/ (.+)/);
                let result = hashes[hashType].function(Buffer.from(line_data[1])).toString('hex');
                if (line_data[0] !== result){
                    console.error(line_data[1] + ": " + result);
                    testsFailed += 1;
                } else {
                    testsPassed += 1;
                }
            }
        });
        lr.on('close', function(){
            if (testsFailed > 0){
                console.log(testsFailed + '/' + (testsPassed + testsFailed) + ' tests failed on: ' + hashType);
                process.exit(1);
            } else {
                console.log(testsPassed + ' tests passed on: ' +hashType);
            }
        });
    }
}
