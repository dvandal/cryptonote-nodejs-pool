const Buffer = require('safe-buffer').Buffer
const multiHashing = require('../build/Release/multihashing')
const assert = require('assert')

console.log('')
console.log('CryptoNight Tests')

var xmrigdata = new Buffer('0100fb8e8ac805899323371bb790db19218afd8db8e3755d8b90f39b3d5506a9abce4fa912244500000000ee8146d49fa93ee724deb57d12cbc6c6f3b924d946127c7a97418f9348828f0f02', 'hex')

var cnfasthash = new Buffer('b542df5b6e7f5f05275c98e7345884e2ac726aeeb07e03e44e0389eb86cd05f0', 'hex')
var xmrigcnvariant0hash = new Buffer('1b606a3f4a07d6489a1bcd07697bd16696b61c8ae982f61a90160f4e52828a7f', 'hex')
var xmrigcnvariant1hash = new Buffer('c9fae8425d8688dc236bcdbc42fdb42d376c6ec190501aa84b04a4b4cf1ee122', 'hex')
var xmrigcnvariant2hash = new Buffer('871fcd6823f6a879bb3f33951c8e8e891d4043880b02dfa1bb3be498b50e7578', 'hex')

var xmrigcnlitevariant0hash = new Buffer('28a22bad3f93d1408fca472eb5ad1cbe75f21d053c8ce5b3af105a57713e21dd', 'hex')
var xmrigcnlitevariant1hash = new Buffer('87c4e570653eb4c2b42b7a0d546559452dfab573b82ec52f152b7ff98e79446f', 'hex')
var xmrigcnlitevariant2hash = new Buffer('b7e78fab22eb19cb8c9c3afe034fb53390321511bab6ab4915cd538a630c3c62', 'hex')

var xmrigcndarkvariant0hash = new Buffer('bea42eadd78614f875e55bb972aa5ec54a5edf2dd7068220fda26bf4b1080fb8', 'hex')
var xmrigcndarkvariant1hash = new Buffer('d18cb32bd5b465e5a7ba4763d60f88b5792f24e513306f1052954294b737e871', 'hex')
var xmrigcndarkvariant2hash = new Buffer('a18a14d94efea108757a42633a1b4d4dc11838084c3c4347850d39ab5211a91f', 'hex')

var xmrigcndarklitevariant0hash = new Buffer('faa7884d9c08126eb164814aeba6547b5d6064277a09fb6b414f5dbc9d01eb2b', 'hex')
var xmrigcndarklitevariant1hash = new Buffer('c75c010780fffd9d5e99838eb093b37c0dd015101c9d298217866daa2993d277', 'hex')
var xmrigcndarklitevariant2hash = new Buffer('fdceb794c1055977a955f31c576a8be528a0356ee1b0a1f9b7f09e20185cda28', 'hex')

var xmrigcnturtlevariant0hash = new Buffer('546c3f1badd7c1232c7a3b88cdb013f7f611b7bd3d1d2463540fccbd12997982', 'hex')
var xmrigcnturtlevariant1hash = new Buffer('29e7831780a0ab930e0fe3b965f30e8a44d9b3f9ad2241d67cfbfea3ed62a64e', 'hex')
var xmrigcnturtlevariant2hash = new Buffer('fc67dfccb5fc90d7855ae903361eabd76f1e40a22a72ad3ef2d6ad27b5a60ce5', 'hex')

var xmrigcnturtlelitevariant0hash = new Buffer('5e1891a15d5d85c09baf4a3bbe33675cfa3f77229c8ad66c01779e590528d6d3', 'hex')
var xmrigcnturtlelitevariant1hash = new Buffer('ae7f864a7a2f2b07dcef253581e60a014972b9655a152341cb989164761c180a', 'hex')
var xmrigcnturtlelitevariant2hash = new Buffer('b2172ec9466e1aee70ec8572a14c233ee354582bcb93f869d429744de5726a26', 'hex')

var cnsoftshellHashv0 = []
cnsoftshellHashv0.push(new Buffer('5e1891a15d5d85c09baf4a3bbe33675cfa3f77229c8ad66c01779e590528d6d3', 'hex'))
cnsoftshellHashv0.push(new Buffer('e1239347694df77cab780b7ec8920ec6f7e48ecef1d8c368e06708c08e1455f1', 'hex'))
cnsoftshellHashv0.push(new Buffer('118a03801c564d12f7e68972419303fe06f7a54ab8f44a8ce7deafbc6b1b5183', 'hex'))
cnsoftshellHashv0.push(new Buffer('8be48f7955eb3f9ac2275e445fe553f3ef359ea5c065cde98ff83011f407a0ec', 'hex'))
cnsoftshellHashv0.push(new Buffer('d33da3541960046e846530dcc9872b1914a62c09c7d732bff03bec481866ae48', 'hex'))
cnsoftshellHashv0.push(new Buffer('8be48f7955eb3f9ac2275e445fe553f3ef359ea5c065cde98ff83011f407a0ec', 'hex'))
cnsoftshellHashv0.push(new Buffer('118a03801c564d12f7e68972419303fe06f7a54ab8f44a8ce7deafbc6b1b5183', 'hex'))
cnsoftshellHashv0.push(new Buffer('e1239347694df77cab780b7ec8920ec6f7e48ecef1d8c368e06708c08e1455f1', 'hex'))
cnsoftshellHashv0.push(new Buffer('5e1891a15d5d85c09baf4a3bbe33675cfa3f77229c8ad66c01779e590528d6d3', 'hex'))
cnsoftshellHashv0.push(new Buffer('e1239347694df77cab780b7ec8920ec6f7e48ecef1d8c368e06708c08e1455f1', 'hex'))
cnsoftshellHashv0.push(new Buffer('118a03801c564d12f7e68972419303fe06f7a54ab8f44a8ce7deafbc6b1b5183', 'hex'))
cnsoftshellHashv0.push(new Buffer('8be48f7955eb3f9ac2275e445fe553f3ef359ea5c065cde98ff83011f407a0ec', 'hex'))
cnsoftshellHashv0.push(new Buffer('d33da3541960046e846530dcc9872b1914a62c09c7d732bff03bec481866ae48', 'hex'))
cnsoftshellHashv0.push(new Buffer('8be48f7955eb3f9ac2275e445fe553f3ef359ea5c065cde98ff83011f407a0ec', 'hex'))
cnsoftshellHashv0.push(new Buffer('118a03801c564d12f7e68972419303fe06f7a54ab8f44a8ce7deafbc6b1b5183', 'hex'))
cnsoftshellHashv0.push(new Buffer('e1239347694df77cab780b7ec8920ec6f7e48ecef1d8c368e06708c08e1455f1', 'hex'))
cnsoftshellHashv0.push(new Buffer('5e1891a15d5d85c09baf4a3bbe33675cfa3f77229c8ad66c01779e590528d6d3', 'hex'))

var cnsoftshellHashv1 = []
cnsoftshellHashv1.push(new Buffer('ae7f864a7a2f2b07dcef253581e60a014972b9655a152341cb989164761c180a', 'hex'))
cnsoftshellHashv1.push(new Buffer('ce8687bdd08c49bd1da3a6a74bf28858670232c1a0173ceb2466655250f9c56d', 'hex'))
cnsoftshellHashv1.push(new Buffer('ddb6011d400ac8725995fb800af11646bb2fef0d8b6136b634368ad28272d7f4', 'hex'))
cnsoftshellHashv1.push(new Buffer('02576f9873dc9c8b1b0fc14962982734dfdd41630fc936137a3562b8841237e1', 'hex'))
cnsoftshellHashv1.push(new Buffer('d37e2785ab7b3d0a222940bf675248e7b96054de5c82c5f0b141014e136eadbc', 'hex'))
cnsoftshellHashv1.push(new Buffer('02576f9873dc9c8b1b0fc14962982734dfdd41630fc936137a3562b8841237e1', 'hex'))
cnsoftshellHashv1.push(new Buffer('ddb6011d400ac8725995fb800af11646bb2fef0d8b6136b634368ad28272d7f4', 'hex'))
cnsoftshellHashv1.push(new Buffer('ce8687bdd08c49bd1da3a6a74bf28858670232c1a0173ceb2466655250f9c56d', 'hex'))
cnsoftshellHashv1.push(new Buffer('ae7f864a7a2f2b07dcef253581e60a014972b9655a152341cb989164761c180a', 'hex'))
cnsoftshellHashv1.push(new Buffer('ce8687bdd08c49bd1da3a6a74bf28858670232c1a0173ceb2466655250f9c56d', 'hex'))
cnsoftshellHashv1.push(new Buffer('ddb6011d400ac8725995fb800af11646bb2fef0d8b6136b634368ad28272d7f4', 'hex'))
cnsoftshellHashv1.push(new Buffer('02576f9873dc9c8b1b0fc14962982734dfdd41630fc936137a3562b8841237e1', 'hex'))
cnsoftshellHashv1.push(new Buffer('d37e2785ab7b3d0a222940bf675248e7b96054de5c82c5f0b141014e136eadbc', 'hex'))
cnsoftshellHashv1.push(new Buffer('02576f9873dc9c8b1b0fc14962982734dfdd41630fc936137a3562b8841237e1', 'hex'))
cnsoftshellHashv1.push(new Buffer('ddb6011d400ac8725995fb800af11646bb2fef0d8b6136b634368ad28272d7f4', 'hex'))
cnsoftshellHashv1.push(new Buffer('ce8687bdd08c49bd1da3a6a74bf28858670232c1a0173ceb2466655250f9c56d', 'hex'))
cnsoftshellHashv1.push(new Buffer('ae7f864a7a2f2b07dcef253581e60a014972b9655a152341cb989164761c180a', 'hex'))

var fastHashData = multiHashing['cryptonight'](xmrigdata, true)
var cnvariant0Data = multiHashing['cryptonight'](xmrigdata)
var cnvariant1Data = multiHashing['cryptonight'](xmrigdata, 1)
var cnvariant2Data = multiHashing['cryptonight'](xmrigdata, 2)
var cnlitevariant0Data = multiHashing['cryptonight-lite'](xmrigdata, 0)
var cnlitevariant1Data = multiHashing['cryptonight-lite'](xmrigdata, 1)
var cnlitevariant2Data = multiHashing['cryptonight-lite'](xmrigdata, 2)
var cndarkvariant0Data = multiHashing['cryptonight-dark'](xmrigdata, 0)
var cndarkvariant1Data = multiHashing['cryptonight-dark'](xmrigdata, 1)
var cndarkvariant2Data = multiHashing['cryptonight-dark'](xmrigdata, 2)
var cndarklitevariant0Data = multiHashing['cryptonight-dark-lite'](xmrigdata, 0)
var cndarklitevariant1Data = multiHashing['cryptonight-dark-lite'](xmrigdata, 1)
var cndarklitevariant2Data = multiHashing['cryptonight-dark-lite'](xmrigdata, 2)
var cnturtlevariant0Data = multiHashing['cryptonight-turtle'](xmrigdata, 0)
var cnturtlevariant1Data = multiHashing['cryptonight-turtle'](xmrigdata, 1)
var cnturtlevariant2Data = multiHashing['cryptonight-turtle'](xmrigdata, 2)
var cnturtlelitevariant0Data = multiHashing['cryptonight-turtle-lite'](xmrigdata, 0)
var cnturtlelitevariant1Data = multiHashing['cryptonight-turtle-lite'](xmrigdata, 1)
var cnturtlelitevariant2Data = multiHashing['cryptonight-turtle-lite'](xmrigdata, 2)

// Easy fill soft shell data
var cnsoftshellDatav0 = []
for (var i = 0; i <= 8192; i += 512) {
  cnsoftshellDatav0.push({ height: i, hash: multiHashing['cryptonight-soft-shell'](xmrigdata, 0, i) })
}

// Easy fill soft shell data
var cnsoftshellDatav1 = []
for (i = 0; i <= 8192; i += 512) {
  cnsoftshellDatav1.push({ height: i, hash: multiHashing['cryptonight-soft-shell'](xmrigdata, 1, i) })
}

// Easy fill soft shell data
var cnsoftshellDatav2 = []
for (i = 0; i <= 8192; i += 512) {
  cnsoftshellDatav2.push({ height: i, hash: multiHashing['cryptonight-soft-shell'](xmrigdata, 2, i) })
}

console.log('')
console.log('[#1] Cryptonight Fast Hash: ', fastHashData.toString('hex'))
assert.deepEqual(fastHashData, cnfasthash)
console.log('')
console.log('[#2] Cryptonight v0: ', cnvariant0Data.toString('hex'))
assert.deepEqual(cnvariant0Data, xmrigcnvariant0hash)
console.log('[#3] Cryptonight v1: ', cnvariant1Data.toString('hex'))
assert.deepEqual(cnvariant1Data, xmrigcnvariant1hash)
console.log('[#4] Cryptonight v2: ', cnvariant2Data.toString('hex'))
assert.deepEqual(cnvariant2Data, xmrigcnvariant2hash)
console.log('')
console.log('[#5] Cryptonight Lite v0: ', cnlitevariant0Data.toString('hex'))
assert.deepEqual(cnlitevariant0Data, xmrigcnlitevariant0hash)
console.log('[#6] Cryptonight Lite v1: ', cnlitevariant1Data.toString('hex'))
assert.deepEqual(cnlitevariant1Data, xmrigcnlitevariant1hash)
console.log('[#7] Cryptonight Lite v2: ', cnlitevariant2Data.toString('hex'))
assert.deepEqual(cnlitevariant2Data, xmrigcnlitevariant2hash)
console.log('')
console.log('[#8] Cryptonight Dark v0: ', cndarkvariant0Data.toString('hex'))
assert.deepEqual(cndarkvariant0Data, xmrigcndarkvariant0hash)
console.log('[#9] Cryptonight Dark v1: ', cndarkvariant1Data.toString('hex'))
assert.deepEqual(cndarkvariant1Data, xmrigcndarkvariant1hash)
console.log('[#10] Cryptonight Dark v2: ', cndarkvariant2Data.toString('hex'))
assert.deepEqual(cndarkvariant2Data, xmrigcndarkvariant2hash)
console.log('')
console.log('[#11] Cryptonight Dark Lite v0: ', cndarklitevariant0Data.toString('hex'))
assert.deepEqual(cndarklitevariant0Data, xmrigcndarklitevariant0hash)
console.log('[#12] Cryptonight Dark Lite v1: ', cndarklitevariant1Data.toString('hex'))
assert.deepEqual(cndarklitevariant1Data, xmrigcndarklitevariant1hash)
console.log('[#13] Cryptonight Dark Lite v2: ', cndarklitevariant2Data.toString('hex'))
assert.deepEqual(cndarklitevariant2Data, xmrigcndarklitevariant2hash)
console.log('')
console.log('[#14] Cryptonight Turtle v0: ', cnturtlevariant0Data.toString('hex'))
assert.deepEqual(cnturtlevariant0Data, xmrigcnturtlevariant0hash)
console.log('[#15] Cryptonight Turtle v1: ', cnturtlevariant1Data.toString('hex'))
assert.deepEqual(cnturtlevariant1Data, xmrigcnturtlevariant1hash)
console.log('[#16] Cryptonight Turtle v2: ', cnturtlevariant2Data.toString('hex'))
assert.deepEqual(cnturtlevariant2Data, xmrigcnturtlevariant2hash)
console.log('')
console.log('[#17] Cryptonight Turtle Lite v0: ', cnturtlelitevariant0Data.toString('hex'))
assert.deepEqual(cnturtlelitevariant0Data, xmrigcnturtlelitevariant0hash)
console.log('[#18] Cryptonight Turtle Lite v1: ', cnturtlelitevariant1Data.toString('hex'))
assert.deepEqual(cnturtlelitevariant1Data, xmrigcnturtlelitevariant1hash)
console.log('[#19] Cryptonight Turtle Lite v2: ', cnturtlelitevariant2Data.toString('hex'))
assert.deepEqual(cnturtlelitevariant2Data, xmrigcnturtlelitevariant2hash)

// Spit out soft shell hashes
var count = 20
console.log('')

for (i = 0; i < cnsoftshellDatav0.length; i++) {
  console.log('[#' + count + '] Cryptonight Soft Shell v0 (' + cnsoftshellDatav0[i].height + '): ', cnsoftshellDatav0[i].hash.toString('hex'))
  count++
}

for (i = 0; i < cnsoftshellDatav0.length; i++) {
  assert.deepEqual(cnsoftshellDatav0[i].hash, cnsoftshellHashv0[i])
}

console.log('')
for (i = 0; i < cnsoftshellDatav1.length; i++) {
  console.log('[#' + count + '] Cryptonight Soft Shell v1 (' + cnsoftshellDatav1[i].height + '): ', cnsoftshellDatav1[i].hash.toString('hex'))
  count++
}

for (i = 0; i < cnsoftshellDatav1.length; i++) {
  assert.deepEqual(cnsoftshellDatav1[i].hash, cnsoftshellHashv1[i])
}

/* We cannot currently generate a valid Soft Shell v2 hash at this time
   that issue will be rectified soon */

/*
console.log('')
for (i = 0; i < cnsoftshellDatav2.length; i++) {
  console.log('[#' + count + '] Cryptonight Soft Shell v2 (' + cnsoftshellDatav2[i].height + '): ', cnsoftshellDatav2[i].hash.toString('hex'))
  count++
}
*/
