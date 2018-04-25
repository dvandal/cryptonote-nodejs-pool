/**
 * Common javascript code for cryptonote-nodejs-pool
 * Author: Daniel Vandal
 * GitHub: https://github.com/dvandal/cryptonote-nodejs-pool
 **/

/**
 * Layout
 **/
 
// Collapse menu on load for mobile devices
$('#menu-content').collapse('hide');

/**
 * Cookies handler
 **/

var docCookies = {
    getItem: function (sKey) {
        return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
    },
    setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
        if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
        var sExpires = "";
        if (vEnd) {
            switch (vEnd.constructor) {
                case Number:
                    sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + vEnd;
                    break;
                case String:
                    sExpires = "; expires=" + vEnd;
                    break;
                case Date:
                    sExpires = "; expires=" + vEnd.toUTCString();
                    break;
            }
        }
        document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
        return true;
    },
    removeItem: function (sKey, sPath, sDomain) {
        if (!sKey || !this.hasItem(sKey)) { return false; }
        document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + ( sDomain ? "; domain=" + sDomain : "") + ( sPath ? "; path=" + sPath : "");
        return true;
    },
    hasItem: function (sKey) {
        return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
    }
};

/**
 * Pages routing
 **/

// Current page
var currentPage;

// Handle hash change
window.onhashchange = function(){
    routePage();
};

// Route to page
var xhrPageLoading;
function routePage(loadedCallback) {
    if (currentPage) currentPage.destroy();
    $('#page').html('');
    $('#loading').show();

    if (xhrPageLoading) {
        xhrPageLoading.abort();
    }

    $('.hot_link').parent().removeClass('active');
    var $link = $('a.hot_link[href="' + (window.location.hash || '#') + '"]');
    
    $link.parent().addClass('active');
    var page = $link.data('page');

    xhrPageLoading = $.ajax({
        url: 'pages/' + page,
        cache: false,
        success: function (data) {
            $('#menu-content').collapse('hide');
            $('#loading').hide();
            $('#page').show().html(data);
            if (currentPage) currentPage.update();
            if (loadedCallback) loadedCallback();
        }
    });
}

/**
 * Strings
 **/
 
// Add .update() custom jQuery function to update text content
$.fn.update = function(txt){
    var el = this[0];
    if (el.textContent !== txt)
        el.textContent = txt;
    return this;
};

// Update Text classes
function updateTextClasses(className, text){
    var els = document.getElementsByClassName(className);
    if (els) {
        for (var i = 0; i < els.length; i++){
            var el = els[i];
            if (el && el.textContent !== text)
                el.textContent = text;
        }
    }
}

// Update Text content
function updateText(elementId, text){
    var el = document.getElementById(elementId);
    if (el && el.textContent !== text){
        el.textContent = text;
    }
    return el;
}

// Convert float to string
function floatToString(float) {
    return float.toFixed(6).replace(/[0\.]+$/, '');
}

// Format number
function formatNumber(number, delimiter){
    if(number != '') {
        number = number.split(delimiter).join('');

        var formatted = '';
        var sign = '';

        if(number < 0){
            number = -number;
            sign = '-';
        }

        while(number >= 1000){
            var mod = number % 1000;

            if(formatted != '') formatted = delimiter + formatted;
            if(mod == 0) formatted = '000' + formatted;
            else if(mod < 10) formatted = '00' + mod + formatted;
            else if(mod < 100) formatted = '0' + mod + formatted;
            else formatted = mod + formatted;

            number = parseInt(number / 1000);
        }

        if(formatted != '') formatted = sign + number + delimiter + formatted;
        else formatted = sign + number;
        return formatted;
    }
    return '';
}

// Format date
function formatDate(time){
    if (!time) return '';
    return new Date(parseInt(time) * 1000).toLocaleString();
}

// Format percentage
function formatPercent(percent) {
    if (!percent && percent !== 0) return '';
    return percent + '%';
}

// Get readable time
function getReadableTime(seconds){
    var units = [ [60, 'second'], [60, 'minute'], [24, 'hour'],
                [7, 'day'], [4, 'week'], [12, 'month'], [1, 'year'] ];

    function formatAmounts(amount, unit){
        var rounded = Math.round(amount);
        return '' + rounded + ' ' + unit + (rounded > 1 ? 's' : '');
    }

    var amount = seconds;
    for (var i = 0; i < units.length; i++){
        if (amount < units[i][0]) {
            return formatAmounts(amount, units[i][1]);
    }
        amount = amount / units[i][0];
    }
    return formatAmounts(amount,  units[units.length - 1][1]);
}

// Get readable hashrate
function getReadableHashRateString(hashrate){
    var i = 0;
    var byteUnits = [' H', ' KH', ' MH', ' GH', ' TH', ' PH' ];
    while (hashrate > 1000){
        hashrate = hashrate / 1000;
        i++;
    }
    return hashrate.toFixed(2) + byteUnits[i];
}
    
// Get readable coins
function getReadableCoins(coins, digits, withoutSymbol){
    var amount = (parseInt(coins || 0) / lastStats.config.coinUnits).toFixed(digits || lastStats.config.coinUnits.toString().length - 1);
    return amount + (withoutSymbol ? '' : (' ' + lastStats.config.symbol));
}

// Format payment link
function formatPaymentLink(hash){
    return '<a target="_blank" href="' + getTransactionUrl(hash) + '">' + hash + '</a>';
}

// Format difficulty
function formatDifficulty(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Format luck / current effort
function formatLuck(difficulty, shares) {
    // Only an approximation to reverse the calculations done in pool.js, because the shares with their respective times are not recorded in redis
    // Approximation assumes equal pool hashrate for the whole round
    // Could potentially be replaced by storing the sum of all job.difficulty in the redis db.
    if (lastStats.config.slushMiningEnabled) {
        // Uses integral calculus to calculate the average of a dynamic function
        var accurateShares = 1/lastStats.config.blockTime * (  // 1/blockTime to get the average
            shares * lastStats.config.weight * (                  // Basically calculates the 'area below the graph' between 0 and blockTime
                1 - Math.pow( 
                    Math.E, 
                    ((- lastStats.config.blockTime) / lastStats.config.weight)  // blockTime is equal to the highest possible result of (dateNowSeconds - scoreTime)
                )
            )
        );
    }
    else {
        var accurateShares = shares;
    }
        
    var percent = Math.round(accurateShares / difficulty * 100);
    if(!percent){
        return '<span class="luckGood">?</span>';
    }
    else if(percent <= 100){
        return '<span class="luckGood">' + percent + '%</span>';
    }
    else if(percent >= 101 && percent <= 150){
        return '<span class="luckMid">' + percent + '%</span>';
    }
    else{
        return '<span class="luckBad">' + percent + '%</span>';
    }    
}

/**
 * URLs
 **/

// Return transaction URL
function getTransactionUrl(id) {
    return transactionExplorer.replace('{symbol}', lastStats.config.symbol.toLowerCase()).replace('{id}', id);
}

// Return blockchain explorer URL
function getBlockchainUrl(id) {
    return blockchainExplorer.replace('{symbol}', lastStats.config.symbol.toLowerCase()).replace('{id}', id);    
}
 
/**
 * Tables
 **/
 
// Sort table cells
function sortTable() {
    var table = $(this).parents('table').eq(0),
        rows = table.find('tr:gt(0)').toArray().sort(compareTableRows($(this).index()));
    this.asc = !this.asc;
    if(!this.asc) {
        rows = rows.reverse()
    }
    for(var i = 0; i < rows.length; i++) {
        table.append(rows[i])
    }
}

// Compare table rows
function compareTableRows(index) {
    return function(a, b) {
        var valA = getCellValue(a, index), valB = getCellValue(b, index);
        if (!valA) { valA = 0; }
        if (!valB) { valB = 0; }
        return $.isNumeric(valA) && $.isNumeric(valB) ? valA - valB : valA.toString().localeCompare(valB.toString())
    }
}

// Get table cell value
function getCellValue(row, index) {
    return $(row).children('td').eq(index).data("sort")
}
