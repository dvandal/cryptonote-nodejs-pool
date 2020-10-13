const Buffer = require('safe-buffer').Buffer
const multiHashing = require('../build/Release/multihashing')

const algorithms = ['keccak', 'groestl', 'skein', 'blake', 'cryptonight', 'cryptonight v7']

var data = new Buffer('7000000001e980924e4e1109230383e66d62945ff8e749903bea4336755c00000000000051928aff1b4d72416173a8c3948159a09a73ac3bb556aa6bfbcad1a85da7f4c1d13350531e24031b939b9e2b', 'hex')

var hashedData = algorithms.map(function (algo) {
  if (algo === 'cryptonight v7') {
    return multiHashing['cryptonight'](data, 1)
  } else {
    return multiHashing[algo](data)
  }
})

console.log(hashedData)
