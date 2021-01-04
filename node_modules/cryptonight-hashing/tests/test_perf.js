"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

const ITER = 200;
let input = Buffer.from("test");

let start = Date.now();
for (let i = ITER; i; -- i) {
  multiHashing.cryptonight(input, 8);
}
let end = Date.now();
console.log("Perf: " + 1000 * ITER / (end - start) + " H/s");
