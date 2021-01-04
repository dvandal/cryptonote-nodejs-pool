"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');
let fs = require('fs');
let lineReader = require('readline');

let testsFailed = 0, testsPassed = 0, line_count=0;
let lr = lineReader.createInterface({
     input: fs.createReadStream('cryptonight.txt')
});
lr.on('line', function (line) {
    let line_data = line.split(/ (.+)/);
    line_count += 1;
    multiHashing.cryptonight_async(Buffer.from(line_data[1]), function(err, result){
        result = result.toString('hex');
        if (line_data[0] !== result){
            testsFailed += 1;
        } else {
            testsPassed += 1;
        }
        let result2 = multiHashing.cryptonight(Buffer.from(line_data[1])).toString('hex');
        if (result !== result2){
            console.log('line_data[1]: the two functions do not agree: ' + result + ' and ' + result2);
        }
        if (line_count === (testsFailed + testsPassed)){
            if (testsFailed > 0){
                console.log(testsFailed + '/' + (testsPassed + testsFailed) + ' comparision tests failed');
                process.exit(1);
            } else {
                console.log(testsPassed + ' comparision tests passed');
            }
        }
    });
});
