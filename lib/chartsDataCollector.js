/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Charts data collector
 **/

// Load required modules
let fs = require('fs');
let async = require('async');
let http = require('http');

let charts = require('./charts.js');

// Initialize log system
let logSystem = 'chartsDataCollector';
require('./exceptionWriter.js')(logSystem);

/**
 * Run charts data collector
 **/

log('info', logSystem, 'Started');
charts.startDataCollectors();
