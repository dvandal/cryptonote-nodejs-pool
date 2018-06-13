/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Handle communications to APIs
 **/

// Load required modules
var request = require('request');

/**
 * Send API request using JSON HTTP
 **/
function jsonHttpRequest(host, port, data, callback, path, auth) {
    path = path || '/json_rpc';
    callback = callback || function(){};
    if (auth) {
        var username = auth, password = '';
        var split = auth.indexOf(":");
        if (split >= 0) {
            username = auth.substr(0, split);
            password = auth.substr(split+1);
        }
        auth = { 'user': username, 'pass': password, 'sendImmediately': false };
    }
    else {
        auth = undefined;
    }

    var options = {
        url: (port == 443 ? 'https': 'http') + '://' + host + (port != 80 && port != 443 ? ':' + port : '') + path,
        method: data ? 'POST' : 'GET',
        body: data,
        auth: auth,
        forever: true,
        headers: {
            'Content-Length': data.length,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    var req = request(options, function(error, res, replyData){
        if (error) {
            callback(error, {});
            return;
        }
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
}

/**
 * Send RPC request
 **/
function rpc(host, port, method, params, callback, auth){
    var data = JSON.stringify({
        id: "0",
        jsonrpc: "2.0",
        method: method,
        params: params
    });
    jsonHttpRequest(host, port, data, function(error, replyJson){
        if (error){
            callback(error, {});
            return;
        }
        callback(replyJson.error, replyJson.result)
    }, undefined, auth);
}

/**
 * Send RPC requests in batch mode
 **/
function batchRpc(host, port, array, callback, auth){
    var rpcArray = [];
    for (var i = 0; i < array.length; i++){
        rpcArray.push({
            id: i.toString(),
            jsonrpc: "2.0",
            method: array[i][0],
            params: array[i][1]
        });
    }
    var data = JSON.stringify(rpcArray);
    jsonHttpRequest(host, port, data, callback, undefined, auth);
}

/**
 * Send RPC request to pool API
 **/
function poolRpc(host, port, path, callback){
    jsonHttpRequest(host, port, '', callback, path);
}

/**
 * Exports API interfaces functions
 **/
module.exports = function(daemonConfig, walletConfig, poolApiConfig){
    return {
        batchRpcDaemon: function(batchArray, callback){
            batchRpc(daemonConfig.host, daemonConfig.port, batchArray, callback, daemonConfig.auth);
        },
        rpcDaemon: function(method, params, callback){
            rpc(daemonConfig.host, daemonConfig.port, method, params, callback, daemonConfig.auth);
        },
        rpcWallet: function(method, params, callback){
            rpc(walletConfig.host, walletConfig.port, method, params, callback, walletConfig.auth);
        },
        pool: function(path, callback){
            var bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
            var poolApi = (bindIp !== "0.0.0.0" ? poolApiConfig.bindIp : "127.0.0.1");
            poolRpc(poolApi, poolApiConfig.port, path, callback);
        },
        jsonHttpRequest: jsonHttpRequest
    }
};
