"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

let result = multiHashing.astrobwt(Buffer.from('0305a0dbd6bf05cf16e503f3a66f78007cbf34144332ecbfc22ed95c8700383b309ace1923a0964b00000008ba939a62724c0d7581fce5761e9d8a0e6a1c3f924fdd8493d1115649c05eb601', 'hex'), 0).toString('hex');
if (result == '7e8844f2d6b7a43498fe6d226527689023da8a52f9fc4ec69e5aaaa63edce1c1')
	console.log('AstroBWT (DERO) test passed');
else {
	console.log('AstroBWT (DERO) test failed: ' + result);
                process.exit(1);
}

result = multiHashing.randomx(Buffer.from('This is a test'), Buffer.from('000000000000000100000000000000000000000f000000042000000000000000', 'hex'), 18).toString('hex');
if (result == '3c1f6d871c8571ae74cce3c6ff7d11ed7f5848c19a26d9c5972869cfabc449a8')
	console.log('RandomX-Loki test passed');
else {
	console.log('RandomX-Loki test failed: ' + result);
                process.exit(1);
}

result = multiHashing.argon2(Buffer.from('0305a0dbd6bf05cf16e503f3a66f78007cbf34144332ecbfc22ed95c8700383b309ace1923a0964b00000008ba939a62724c0d7581fce5761e9d8a0e6a1c3f924fdd8493d1115649c05eb601', 'hex'), 0).toString('hex');
if (result == 'c158a105ae75c7561cfd029083a47a87653d51f914128e21c1971d8b10c49034')
	console.log('Argon2-Chukwa test passed');
else {
	console.log('Argon2-Chukwa test failed: ' + result);
                process.exit(1);
}

result = multiHashing.astrobwt(Buffer.from('0305a0dbd6bf05cf16e503f3a66f78007cbf34144332ecbfc22ed95c8700383b309ace1923a0964b00000008ba939a62724c0d7581fce5761e9d8a0e6a1c3f924fdd8493d1115649c05eb601', 'hex'), 0).toString('hex');
if (result == '7e8844f2d6b7a43498fe6d226527689023da8a52f9fc4ec69e5aaaa63edce1c1')
	console.log('AstroBWT (DERO) test passed');
else {
	console.log('AstroBWT (DERO) test failed: ' + result);
                process.exit(1);
}



