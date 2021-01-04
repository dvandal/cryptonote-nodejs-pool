"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');
let fs = require('fs');
let lineReader = require('readline');

let testsFailed = 0, testsPassed = 0, line_count = 0;
let lr = lineReader.createInterface({
     input: fs.createReadStream('cryptonight_light-1.txt')
});
lr.on('line', function (line) {
     let line_data = line.split(/ (.+)/);
     line_count += 1;
     multiHashing.cryptonight_light_async(Buffer.from(line_data[1], 'hex'), 1, function(err, result){
         result = result.toString('hex');
         if (line_data[0] !== result){
             console.error(line_data[1] + ": " + result);
             testsFailed += 1;
         } else {
             testsPassed += 1;
         }
         if (line_count === (testsFailed + testsPassed)){
             if (testsFailed > 0){
                 console.log(testsFailed + '/' + (testsPassed + testsFailed) + ' tests failed on: cryptonight_light_async');
                 process.exit(1);
             } else {
                 console.log(testsPassed + ' tests passed on: cryptonight_light_async');
             }
         }
     });
});
