"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

for (let i = 2; i; -- i) {
  { let result = multiHashing.randomx(Buffer.from('This is a test'), Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), 17).toString('hex');
    if (result == 'dcd9efef9df794171af262df328bd2c16a6d51ae9abdcb9357ce4ab3c0c9a8ba')
    	console.log('RandomWOW test passed');
    else {
	console.log('RandomWOW test failed: ' + result);
        process.exit(1);
    }
  }

  { let result = multiHashing.randomx(Buffer.from('This is a test'), Buffer.from('000000000000000100000000000000000000000f000000042000000000000000', 'hex'), 18).toString('hex');
    if (result == '3c1f6d871c8571ae74cce3c6ff7d11ed7f5848c19a26d9c5972869cfabc449a8')
    	console.log('RandomX-Loki test passed');
    else {
 	console.log('RandomX-Loki test failed: ' + result);
        process.exit(1);
    }
  }
}

