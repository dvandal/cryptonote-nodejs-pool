"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

let result = multiHashing.argon2(Buffer.from('0305a0dbd6bf05cf16e503f3a66f78007cbf34144332ecbfc22ed95c8700383b309ace1923a0964b00000008ba939a62724c0d7581fce5761e9d8a0e6a1c3f924fdd8493d1115649c05eb601', 'hex'), 1).toString('hex');
if (result == '35e083d4b9c64c2a68820a431f61311998a8cd1864dba4077e25b7f121d54bd1')
	console.log('Argon2-WRKZ test passed');
else {
	console.log('Argon2-WRKZ test failed: ' + result);
                process.exit(1);
}
