/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Handle communications to APIs
 **/

// Load required modules
let http = require('http');
let https = require('https');
let request = require('request-promise-native');

/**
 * Send API request using JSON HTTP
 **/
function jsonHttpRequest(host, port, data, callback, path){
    try {
        path = path || '/json_rpc';
        callback = callback || function(){}; 
        let options = {
            'uri': `${(port === 443 ? 'https' : 'http')}://${host}:${port}${path}`,
            'method': data ? 'POST' : 'GET',
            'headers' : { 
                        'Content-Length': data.length,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                     }
        }
        options['json'] = data

        request(options)
            .then(response => {
                response = response ? response : {}
                if (response instanceof Array || response instanceof Object) {
                    callback(null, response)
                } else {
                    callback(null, JSON.parse(response))
                }
            })
            .catch(error => {
                callback(error, {})
            })
    } catch(error){
        console.log('catch ' , error)
        callback(error, {})
    }
}

/**
 * Send RPC request
 **/
function rpc(host, port, method, params, callback, username, password){
    let payload = {
        id: "0",
        jsonrpc: "2.0",
        method: method,
        params: params
    };
    if (password !== undefined) {
        if (username !== undefined){
            payload['auth'] = {'user': username, 'password': password, 'sendImmediately':false}
            payload['agent'] = new http.Agent({'keepAlive': true, 'maxSockets': 1})
            payload['forever'] = true
        } else {
            payload['password'] = password;
        }
    }
    //let data = JSON.stringify(payload);
    jsonHttpRequest(host, port, payload, function(error, replyJson){
        if (error){
            callback(error, {});
            return;
        }
        callback(replyJson.error, replyJson.result)
    });
}

/**
 * Send RPC requests in batch mode
 **/
function batchRpc(host, port, array, callback){
    let rpcArray = [];
    for (let i = 0; i < array.length; i++){
        rpcArray.push({
            id: i.toString(),
            jsonrpc: "2.0",
            method: array[i][0],
            params: array[i][1]
        });
    }
    let data = JSON.stringify(rpcArray);
    jsonHttpRequest(host, port, data, callback);
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
            batchRpc(daemonConfig.host, daemonConfig.port, batchArray, callback);
        },
        rpcDaemon: function(method, params, callback){
            rpc(daemonConfig.host, daemonConfig.port, method, params, callback,
                daemonConfig.user, daemonConfig.pass);
        },
        rpcWallet: function(method, params, callback){
            rpc(walletConfig.host, walletConfig.port, method, params, callback,
                walletConfig.user, walletConfig.pass);
        },
        pool: function(path, callback){
            let bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
            let poolApi = (bindIp !== "0.0.0.0" ? poolApiConfig.bindIp : "127.0.0.1");
            poolRpc(poolApi, poolApiConfig.port, path, callback);
        },
        jsonHttpRequest: jsonHttpRequest
    }
};
