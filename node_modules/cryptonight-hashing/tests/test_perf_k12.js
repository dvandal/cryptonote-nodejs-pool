"use strict";
let multiHashing = require('../build/Release/cryptonight-hashing');

const ITER = 2000000;

let start = Date.now();
for (let i = ITER; i; -- i) {
  multiHashing.k12(Buffer.from("test" + i));
}
let end = Date.now();
console.log("Perf: " + 1000 * ITER / (end - start) + " H/s");
