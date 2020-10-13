"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

const ITER = 100;
let input1 = Buffer.from('ffeeddccbbaa9988776655443322110000112233445566778899aabbccddeefff0debc9a78563412', 'hex');
let input2 = Buffer.from('fc3c8e41e0be24c8', 'hex');

let start = Date.now();
for (let i = ITER; i; -- i) {
  multiHashing.kawpow(30000, input1, input2);
}
let end = Date.now();
console.log("Perf: " + 1000 * ITER / (end - start) + " H/s");