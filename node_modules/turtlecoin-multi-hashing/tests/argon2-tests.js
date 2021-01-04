const Buffer = require('safe-buffer').Buffer
const multiHashing = require('../')
const assert = require('assert')

console.log('')
console.log('Argon2 Tests')

const xmrigdata = new Buffer('0100fb8e8ac805899323371bb790db19218afd8db8e3755d8b90f39b3d5506a9abce4fa912244500000000ee8146d49fa93ee724deb57d12cbc6c6f3b924d946127c7a97418f9348828f0f02', 'hex')

const chukwa = new Buffer('c0dad0eeb9c52e92a1c3aa5b76a3cb90bd7376c28dce191ceeb1096e3a390d2e', 'hex')

const chukwaData = multiHashing['chukwa'](xmrigdata)

console.log('')
console.log('[#1] Chukwa: ', chukwaData.toString('hex'))
assert.deepEqual(chukwaData, chukwa)
