"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

let result = multiHashing.randomx(Buffer.from('This is a test'), Buffer.from('1000000000000000000000000000000000000000000000000000000000000000', 'hex'), 1).toString('hex');
if (result == 'b7a974208efe1759adbb7d160f5b76e850f226265a00cf07b78d8c8c4d55b8bd')
	console.log('DefyX test passed');
else {
	console.log('DefyX test failed: ' + result);
        process.exit(1);
}

