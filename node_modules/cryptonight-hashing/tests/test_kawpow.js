"use strict";
const multiHashing = require('../build/Release/cryptonight-hashing');

const result = multiHashing.kawpow(
	30000, Buffer.from('ffeeddccbbaa9988776655443322110000112233445566778899aabbccddeefff0debc9a78563412', 'hex'),
	Buffer.from('fc3c8e41e0be24c8', 'hex')
);

if (result !== null && result.toString('hex') === '177b565752a375501e11b6d9d3679c2df6197b2cab3a1ba2d6b10b8c71a3d459')
	console.log('KawPow test passed');
else {
	console.log('KawPow test failed: ' + (result ? result.toString('hex') : result));
        process.exit(1);
}

