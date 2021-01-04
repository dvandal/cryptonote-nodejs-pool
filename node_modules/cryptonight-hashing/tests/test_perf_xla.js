"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

const ITER = 200;
let input = Buffer.from("test");

let start = Date.now();
for (let i = ITER; i; -- i) {
  multiHashing.randomx(input, Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'), 3);
}
let end = Date.now();
console.log("Perf: " + 1000 * ITER / (end - start) + " H/s");
