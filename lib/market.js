/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Market Exchanges
 **/

// Load required modules
var apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet);

// Initialize log system
var logSystem = 'market';
require('./exceptionWriter.js')(logSystem);

/**
 * Get market prices
 **/
exports.get = function(exchange, tickers, callback) {
    if (!exchange) { 
        callback('No exchange specified', null);
    }
    exchange = exchange.toLowerCase();

    if (!tickers || tickers.length === 0) {
        callback('No tickers specified', null);
    }

    var marketPrices = [];
    var numTickers = tickers.length;
    var completedFetches = 0;

    getExchangeMarkets(exchange, function(error, marketData) {
        if (!marketData || marketData.length === 0) {
            callback({});
            return ;
        }

        for (var i in tickers) {
            (function(i){
                var pairName = tickers[i];
                var pairParts = pairName.split('-');
                var base = pairParts[0] || null;
                var target = pairParts[1] || null;

                if (!marketData[base]) {
                    completedFetches++;
                    if (completedFetches === numTickers) callback(marketPrices);
                } else {
                    var price = marketData[base][target] || null;
                    if (!price || price === 0) {
                        var cryptonatorBase;
                        if (marketData[base]['BTC']) cryptonatorBase = 'BTC';
                        else if (marketData[base]['ETH']) cryptonatorBase = 'ETH';
                        else if (marketData[base]['LTC']) cryptonatorBase = 'LTC';

                        if (!cryptonatorBase) {
                            completedFetches++;
                            if (completedFetches === numTickers) callback(marketPrices);
                        } else {
                            getExchangePrice("cryptonator", cryptonatorBase, target, function(error, tickerData) {
                                completedFetches++;
                                if (tickerData && tickerData.price) {
                                    marketPrices[i] = {
                                        ticker: pairName,
                                        price: tickerData.price * marketData[base][cryptonatorBase],
                                        source: tickerData.source
                                    };
                                }
                                if (completedFetches === numTickers) callback(marketPrices);
                            });
                        }
                    } else {
                        completedFetches++;
                        marketPrices[i] = { ticker: pairName, price: price, source: exchange };
                        if (completedFetches === numTickers) callback(marketPrices);
                    }
                }
            })(i);
        }
    });
}

/**
 * Get Exchange Market Prices
 **/

var marketRequestsCache = {};

function getExchangeMarkets(exchange, callback) {
    callback = callback || function(){};
    if (!exchange) { 
        callback('No exchange specified', null);
    }
    exchange = exchange.toLowerCase();

    // Return cache if available
    var cacheKey = exchange;
    var currentTimestamp = Date.now() / 1000;

    if (marketRequestsCache[cacheKey] && marketRequestsCache[cacheKey].ts > (currentTimestamp - 60)) {
        callback(null, marketRequestsCache[cacheKey].data);
        return ;
    }

    // Altex
    if (exchange == "altex") {
        apiInterfaces.jsonHttpRequest('api.altex.exchange', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response || !response.success) callback('No market informations', {});

            var data = {};
            for (var ticker in response.data) {
                tickerParts = ticker.split('_');
                var target = tickerParts[0];
                var symbol = tickerParts[1];

                var price = +parseFloat(response.data[ticker].last);
                if (price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/v1/ticker');
    }
    
    // Crex24
    else if (exchange == "crex24") {
        apiInterfaces.jsonHttpRequest('api.crex24.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response || !response.Tickers) callback('No market informations', {});

            var data = {};
            for (var i in response.Tickers) {
                var ticker = response.Tickers[i];

                var pairName = ticker.PairName;
                pairParts = pairName.split('_');
                var target = pairParts[0];
                var symbol = pairParts[1];

                var price = +ticker.Last;
                if (!price || price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/CryptoExchangeService/BotPublic/ReturnTicker');
    }

    // Cryptopia
    else if (exchange == "cryptopia") {
        apiInterfaces.jsonHttpRequest('www.cryptopia.co.nz', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response || !response.Success) callback('No market informations', {});

            var data = {};
            for (var i in response.Data) {
                var ticker = response.Data[i];

                var pairName = ticker.Label;
                var pairParts = pairName.split('/');
                var target = pairParts[1];
                var symbol = pairParts[0];

                var price = +ticker.LastPrice;
                if (!price || price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api/GetMarkets');
    }

    // Stocks.Exchange
    else if (exchange == "stocks.exchange") {
        apiInterfaces.jsonHttpRequest('stocks.exchange', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            if (error) callback(error, {});
            if (!response) callback('No market informations', {});

            var data = {};
            for (var i in response) {
                var ticker = response[i];

                var pairName = ticker.market_name;
                var pairParts = pairName.split('_');
                var target = pairParts[1];
                var symbol = pairParts[0];

                var price = +ticker.last;
                if (!price || price === 0) continue;

                if (!data[symbol]) data[symbol] = {};
                data[symbol][target] = price;
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api2/ticker');
    }
    
    // TradeOgre
    else if (exchange == "tradeogre") {
        apiInterfaces.jsonHttpRequest('tradeogre.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            var data = {};
            if (!error && response) {
                for (var i in response) {
                    for (var pairName in response[i]) {
                        pairParts = pairName.split('-');
                        var target = pairParts[0];
                        var symbol = pairParts[1];

                        var price = +response[i][pairName].price;
                        if (price === 0) continue;

                        if (!data[symbol]) data[symbol] = {};
                        data[symbol][target] = price;
                    }
                }
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api/v1/markets');
    }
    else if (exchange == "maplechange") {
        apiInterfaces.jsonHttpRequest('maplechange.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            var data = {};
            if (!error && response) {
                for (var model in response) {
                        var len = model.length;
                        if (len <= 3) continue;
                        var target = model.substring(len-3, len).toUpperCase();
                        var symbol = model.substring(0, len -3).toUpperCase();

                        var price = +response[model]['ticker']['last'];
                        if (price === 0) continue;

                        if (!data[symbol]) data[symbol] = {};
                        data[symbol][target] = price;
                }
            }
            if (!error) marketRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(null, data);
        }, '/api/v2/tickers');
    }

    // Unknown
    else {
        callback('Exchange not supported: ' + exchange);
    }
}
exports.getExchangeMarkets = getExchangeMarkets;

/**
 * Get Exchange Market Price
 **/

var priceRequestsCache = {};

function getExchangePrice(exchange, base, target, callback) {
    callback = callback || function(){};

    if (!exchange) { 
        callback('No exchange specified');
    }
    else if (!base) {
        callback('No base specified');
    }
    else if (!target) {
        callback('No target specified');
    }

    exchange = exchange.toLowerCase();
    base = base.toUpperCase();
    target = target.toUpperCase();

    // Return cache if available
    var cacheKey = exchange + '-' + base + '-' + target;
    var currentTimestamp = Date.now() / 1000;

    if (priceRequestsCache[cacheKey] && priceRequestsCache[cacheKey].ts > (currentTimestamp - 60)) {
        callback(null, priceRequestsCache[cacheKey].data);
        return ;
    }

    // Cryptonator
    if (exchange == "cryptonator") {
        var ticker = base + '-' + target;
        apiInterfaces.jsonHttpRequest('api.cryptonator.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.error) log('warn', logSystem, 'Cryptonator API error: %s', [response.error]);

            var error = response.error ? response.error : error;
            var price = response.success ? +response.ticker.price : null;
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            var data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/api/ticker/' + ticker);
    }

    // Altex
    else if (exchange == "altex") {
        getExchangeMarkets(exchange, function(error, data) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            var price = null;
            if (!error && data[base] && data[base][target]) {
                price = data[base][target];
            }
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            var data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        });
    }
    
    // Crex24
    else if (exchange == "crex24") {
        var ticker = base + '_' + target;
        apiInterfaces.jsonHttpRequest('api.crex24.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.Error) log('warn', logSystem, 'Crex24 API error: %s', [response.Error]);

            var error = response.Error ? response.Error : error;
            var price = (response.Tickers && response.Tickers[0]) ? +response.Tickers[0].Last : null;
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            var data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/CryptoExchangeService/BotPublic/ReturnTicker?request=[NamePairs=' + ticker + ']');
    }

    // Cryptopia
    else if (exchange == "cryptopia") {
        var ticker = base + '_' + target;
        apiInterfaces.jsonHttpRequest('www.cryptopia.co.nz', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.Error) log('warn', logSystem, 'Cryptopia API error: %s', [response.Error]);

            var error = response.Error ? response.Error : error;
            var price = (response.Data && response.Data.LastPrice) ? +response.Data.LastPrice : null;

            var data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/api/GetMarket/' + ticker);
    }
    
    // Stocks.Exchange
    else if (exchange == "stocks.exchange") {
        getExchangeMarkets(exchange, function(error, data) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);

            var price;
            if (!error && data[base] && data[base][target]) {
                price = data[base][target];
            }
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            var data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        });
    }

    // TradeOgre
    else if (exchange == "tradeogre") {
        var ticker = target + '-' + base;
        apiInterfaces.jsonHttpRequest('tradeogre.com', 443, '', function(error, response) {
            if (error) log('error', logSystem, 'API request to %s has failed: %s', [exchange, error]);
            if (response.message) log('warn', logSystem, 'TradeOgre API error: %s', [response.message]);

            var error = response.message ? response.message : error;
            var price = +response.price || null;
            if (!price) log('warn', logSystem, 'No exchange data for %s using %s', [ticker, exchange]);

            var data = { ticker: ticker, price: price, source: exchange };
            if (!error) priceRequestsCache[cacheKey] = { ts: currentTimestamp, data: data };
            callback(error, data);
        }, '/api/v2/ticker/' + ticker);
    }

    // Unknown
    else {
        callback('Exchange not supported: ' + exchange);
    }
}
exports.getExchangePrice = getExchangePrice;
