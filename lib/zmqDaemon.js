let logSystem = "ZMQ"
require('./exceptionWriter.js')(logSystem);
let zmq = require("zeromq"),
dealer = zmq.socket("dealer");
const { fromEvent } = require('rxjs');

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function randomString() {
  var source = 'abcdefghijklmnopqrstuvwxyz'
  var target = [];
  for (var i = 0; i < 20; i++) {
    target.push(source[randomBetween(0, source.length)]);
  }
  return target.join('');
}


function startZMQ() {
    dealer.identity = randomString();
    dealer.connect(`tcp://${config.zmq.host}:${config.zmq.port}`);
    log('info', logSystem, 'Dealer connected to port %s:%s', [config.zmq.host, config.zmq.port]);
    return fromEvent(dealer, "message");
}

exports.startZMQ = startZMQ

function sendMessage(type, address) {
    if (type === 'getinfo') {
        let getinfo = {"jsonrpc": "2.0",
                       "id": "1",
                       "method": "get_info",
                       "params": {}}
        dealer.send(["", JSON.stringify(getinfo)]);
    }
    if (type === 'get_block_template') {
        let getblocktemplate = {"jsonrpc":"2.0",
                                "id":"0",
                                "method":"get_block_template",
                                "params":{"reserve_size":17,
                                           "wallet_address":address} }

        dealer.send(["", JSON.stringify(getblocktemplate)]);
    }

}

exports.sendMessage = sendMessage

process.on('SIGINT', () => {
    dealer.send(["", "EVICT"]);
    dealer.close()
    console.log('\nClosed')
})
