"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

let result = multiHashing.randomx(Buffer.from('This is a test'), Buffer.from('000000000000000100000000000000000000000f000000042000000000000000', 'hex'), 18).toString('hex');
if (result == '3c1f6d871c8571ae74cce3c6ff7d11ed7f5848c19a26d9c5972869cfabc449a8')
	console.log('RandomX-Loki test passed');
else {
	console.log('RandomX-Loki test failed: ' + result);
        process.exit(1);
}

