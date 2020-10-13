const Buffer = require('safe-buffer').Buffer
const multiHashing = require('../build/Release/multihashing')
const assert = require('assert')

var tests = [
  new Buffer('This is a test This is a test This is a test'),
  new Buffer('74d15836e33d14e164c2494648996eb5ed71a3ec2c72c2be225eda1b8a857aba', 'hex'),
  new Buffer('0157c5ee188bbec8975285a3064ee92065217672fd69a1aebd0766c7b56ee0bd', 'hex'),
  new Buffer('353fdc068fd47b03c04b9431e005e00b68c2168a3cc7335c8b9b308156591a4f', 'hex'),
  new Buffer('Lorem ipsum dolor sit amet, consectetur adipiscing'),
  new Buffer('22ec483997cba20105378af3ec647ee5d20401d7df21c0bf4bf866bc55383e92', 'hex'),
  new Buffer('755d58e48e53f795a0ed6b27c794018372922e5d1a256cdbf9fc442f59f284c9', 'hex'),
  new Buffer('72f134fc50880c330fe65a2cb7896d59b2e708a0221c6a9da3f69b3a702d8682', 'hex'),
  new Buffer('elit, sed do eiusmod tempor incididunt ut labore'),
  new Buffer('c5efc04bf88b450e86537dc046339b16d35133c4d905ec7fa16bd28a67c4f2fe', 'hex'),
  new Buffer('7158c9c0d5082df7f2ee236b994f385bd96fd09eda30e21643cb7351fd7301ce', 'hex'),
  new Buffer('410919660ec540fc49d8695ff01f974226a2a28dbbac82949c12f541b9a62d2f', 'hex'),
  new Buffer('et dolore magna aliqua. Ut enim ad minim veniam,'),
  new Buffer('628c400e4712cecb44d88572e9e8bb9be9a1221da1cb52ff8eefaf4adcc172eb', 'hex'),
  new Buffer('7329cde3fbf98bec02578fcdcfeaf2cf11e2a1f105324f89c36470708bd6db16', 'hex'),
  new Buffer('4472fecfeb371e8b7942ce0378c0ba5e6d0c6361b669c587807365c787ae652d', 'hex'),
  new Buffer('quis nostrud exercitation ullamco laboris nisi'),
  new Buffer('a0351d7aa54c2e7c774695af86f8bbb859a0ef9b0d4f0031dd1df5ea7ccc752d', 'hex'),
  new Buffer('05066660ea3bc0568269cd95c212ad2bf2f2ced4e4cdb1f2bc5f766e88e4862b', 'hex'),
  new Buffer('577568395203f1f1225f2982b637f7d5e61b47a0f546ba16d46020b471b74076', 'hex'),
  new Buffer('ut aliquip ex ea commodo consequat. Duis aute'),
  new Buffer('677b3a14c1875eda0ca0c3d6c340413848b1ab0bf9d448dddd5714cbc6d170b9', 'hex'),
  new Buffer('edc9f99dfd626ddc5604f8b387c7a88cc6fcb17cef46a3b917c2f8ffbd449982', 'hex'),
  new Buffer('f6fd7efe95a5c6c4bb46d9b429e3faf65b1ce439e116742d42b928e61de52385', 'hex'),
  new Buffer('irure dolor in reprehenderit in voluptate velit'),
  new Buffer('8a73c33ebfd11d78db984486a298149d034051c61cdaf6ff7e783e46a6763edf', 'hex'),
  new Buffer('44df1cbd33439b82f901bcad232f3908331330edad0c9b9af35d62f524fd92b4', 'hex'),
  new Buffer('422f8cfe8060cf6c3d9fd66f68e3c9977adb683aea2788029308bbe9bc50d728', 'hex'),
  new Buffer('esse cillum dolore eu fugiat nulla pariatur.'),
  new Buffer('021007fa46b46110e7dd6c7f1bb392499d7461950efd884e6bb4260d57906b6f', 'hex'),
  new Buffer('0fa9723e149c0772d16ae95b744186f419b48adcbfe685c99b53f6db44ba2668', 'hex'),
  new Buffer('512e62c8c8c833cfbd9d361442cb00d63c0a3fd8964cfd2fedc17c7c25ec2d4b', 'hex'),
  new Buffer('Excepteur sint occaecat cupidatat non proident,'),
  new Buffer('d61f8a0722e9d38c691fe22613ef68c83a498dd24e3c382ee1abfa665d632371', 'hex'),
  new Buffer('90c71412c2ca0c2e5789a98fb7ce36179d3c7f8b164f9aa07df56d44c9e9e96d', 'hex'),
  new Buffer('12a794c1aa13d561c9c6111cee631ca9d0a321718d67d3416add9de1693ba41e', 'hex'),
  new Buffer('sunt in culpa qui officia deserunt mollit anim id est laborum.'),
  new Buffer('75a105029f6b8c00429c427ffc7a64d84dbcdf2728ce0d2df9133cef91c9f8d3', 'hex'),
  new Buffer('5944b5b0480e84dc233bcc37101c23077542433c868c67325e9c501cfd1b8151', 'hex'),
  new Buffer('2659ff95fc74b6215c1dc741e85b7a9710101b30620212f80eb59c3c55993f9d', 'hex')
]

for (var i = 0; i < 10; ++i) {
  for (var variant = 0; variant <= 2; ++variant) {
    var hash = multiHashing['cryptonight'](tests[i * 4], variant)
    assert.deepEqual(hash, tests[i * 4 + variant + 1])
  }
}
