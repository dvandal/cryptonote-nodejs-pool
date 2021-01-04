"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

let result = multiHashing.argon2(Buffer.from('0305a0dbd6bf05cf16e503f3a66f78007cbf34144332ecbfc22ed95c8700383b309ace1923a0964b00000008ba939a62724c0d7581fce5761e9d8a0e6a1c3f924fdd8493d1115649c05eb601', 'hex'), 0).toString('hex');
if (result == 'c158a105ae75c7561cfd029083a47a87653d51f914128e21c1971d8b10c49034')
	console.log('Argon2-Chukwa test passed');
else {
	console.log('Argon2-Chukwa test failed: ' + result);
        process.exit(1);
}