"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');
let fs = require('fs');
let lineReader = require('readline');

let testsFailed = 0, testsPassed = 0;
let lr = lineReader.createInterface({
     input: fs.createReadStream('rx_arq.txt')
});
lr.on('line', function (line) {
     const line_data0 = line.split(" ");
     const line_data = line_data0.slice(0, 2).concat(line_data0.slice(2).join(" "));
     let result = multiHashing.randomx(Buffer.from(line_data[2]), Buffer.from(line_data[1]), 2).toString('hex');
     if (line_data[0] !== result) {
         console.error(line_data[1] + " '" + line_data[2] + "': " + result);
         testsFailed += 1;
     } else {
         testsPassed += 1;
     }
});
lr.on('close', function(){
    if (testsFailed > 0){
        console.log(testsFailed + '/' + (testsPassed + testsFailed) + ' tests failed on: rx/arq');
        process.exit(1);
    } else {
        console.log(testsPassed + ' tests passed on: rx/arq');
    }
});
