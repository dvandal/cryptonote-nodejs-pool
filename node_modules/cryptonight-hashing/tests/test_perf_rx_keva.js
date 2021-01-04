"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

const ITER = 200;
const seed  = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');

multiHashing.randomx(Buffer.from("test"), seed, 19);

let start = Date.now();
for (let i = ITER; i; -- i) {
  multiHashing.randomx(Buffer.from("test" + i), seed, 19);
}
let end = Date.now();
console.log("Perf: " + 1000 * ITER / (end - start) + " H/s");
