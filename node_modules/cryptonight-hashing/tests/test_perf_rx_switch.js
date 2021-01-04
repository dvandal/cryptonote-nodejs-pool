"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

const ITER = 100;
const seed  = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');

multiHashing.randomx(Buffer.from("test"), seed, 17);
multiHashing.randomx(Buffer.from("test"), seed, 18);
multiHashing.randomx(Buffer.from("test"), seed, 0);

let start = Date.now();
for (let i = ITER; i; -- i) {
  multiHashing.randomx(Buffer.from("test" + i), seed, 17);
  multiHashing.randomx(Buffer.from("test" + i), seed, 18);
  multiHashing.randomx(Buffer.from("test" + i), seed, 0);
}
let end = Date.now();
console.log("Perf: " + 1000 * ITER * 3 / (end - start) + " H/s");
