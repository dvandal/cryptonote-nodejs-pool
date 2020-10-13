"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

let result = multiHashing.randomx(Buffer.from('This is a test'), Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), 17).toString('hex');
if (result == 'dcd9efef9df794171af262df328bd2c16a6d51ae9abdcb9357ce4ab3c0c9a8ba')
	console.log('RandomWOW test passed');
else {
	console.log('RandomWOW test failed: ' + result);
        process.exit(1);
}

