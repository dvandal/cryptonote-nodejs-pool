/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Handle communications to APIs
 **/

// Load required modules
var request = require("request-promise");
var queue = require("promise-queue");
var http = require("http");
var https = require("https");

var request_agent = new http.Agent({keepAlive: true, maxSockets: 1})
var request_queue = new queue(1, Infinity)

/**
 * Send generic API request (i.e. market price)
 **/
function jsonHttpRequest(host, port, data, callback, path){
    path = path || '/json_rpc';
    callback = callback || function(){};

    var options = {
        hostname: host,
        port: port,
        path: path,
        method: data ? 'POST' : 'GET',
        headers: {
            'Content-Length': data.length,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    var req = (port === 443 ? https : http).request(options, function(res){
        var replyData = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk){
            replyData += chunk;
        });
        res.on('end', function(){
            var replyJson;
            try{
                replyJson = JSON.parse(replyData);
            }
            catch(e){
                callback(e, {});
                return;
            }
            callback(null, replyJson);
        });
    });

    req.on('error', function(e){
        callback(e, {});
    });

    req.end(data);
}

/**
 * Send RPC request to daemon or wallet
 **/
function rpc(host, port, method, params={}, auth={}, callback=false) {
    var options = {
        uri: `http://${host}:${port}/json_rpc`,
        method: "POST",
        agent: request_agent,
        json: {
            jsonrpc: "2.0",
            id: "0",
            method: method
        }
    };
    if(Object.keys(params).length !== 0) {
        options.json.params = params
    }
    if(Object.keys(auth).length !== 0) {
        options.auth = auth;
        options.auth.sendImmediately = false;
    }

    request_queue.add(() => {
        return request(options)
            .then((response) => {
                if(response.hasOwnProperty("error")) {
                    if(typeof callback === "function") {
                        callback(response.error, {});
                    }
                    return;
                }
                if(typeof callback === "function") {
                    callback(false, response.result)
                }
            }).catch(error => {
                if(typeof callback === "function") {
                    callback(error, {});
                }
                return;
            });
    });
}

/**
 * Send request to pool API for graphs
 **/
function poolRpc(host, port, path, callback){
    jsonHttpRequest(host, port, '', callback, path);
}

/**
 * Exports API interfaces functions
 **/
module.exports = function(daemonConfig, walletConfig, poolApiConfig){

    return {
        rpcDaemon: function(method, params, callback){
            var auth = {};
            if(daemonConfig.hasOwnProperty("user") && daemonConfig.user &&
               daemonConfig.hasOwnProperty("pass") && daemonConfig.pass) {
                auth.user = daemonConfig.user;
                auth.pass = daemonConfig.pass;
            }
            rpc(daemonConfig.host, daemonConfig.port, method, params, auth, callback);
        },
        rpcWallet: function(method, params, callback){
            var auth = {};
            if(walletConfig.hasOwnProperty("user") && walletConfig.user &&
               walletConfig.hasOwnProperty("pass") && walletConfig.pass) {
                auth.user = walletConfig.user;
                auth.pass = walletConfig.pass;
            }
            rpc(walletConfig.host, walletConfig.port, method, params, auth, callback);
        },
        pool: function(path, callback){
            var bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
            var poolApi = (bindIp !== "0.0.0.0" ? poolApiConfig.bindIp : "127.0.0.1");
            poolRpc(poolApi, poolApiConfig.port, path, callback);
        },
        jsonHttpRequest: jsonHttpRequest
    }
};
