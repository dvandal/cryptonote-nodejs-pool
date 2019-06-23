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

let docCookies = {
    getItem: function (sKey) {
        return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
    },
    setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
        if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
        let sExpires = "";
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
let currentPage;

// Handle hash change
window.onhashchange = function(){
    routePage();
};

// Route to page
let xhrPageLoading;
function routePage(loadedCallback) {
    if (currentPage) currentPage.destroy();
    $('#page').html('');
    $('#loading').show();

    if (xhrPageLoading) {
        xhrPageLoading.abort();
    }

    $('.hot_link').parent().removeClass('active');
    let  $link = $('a.hot_link[href="' + (window.location.hash || '#') + '"]');
    
    $link.parent().addClass('active');
    let page = $link.data('page');
    
    loadTranslations();

    xhrPageLoading = $.ajax({
        url: 'pages/' + page,
        cache: false,
        success: function (data) {
            $('#menu-content').collapse('hide');
            $('#loading').hide();
            $('#page').show().html(data);
	    loadTranslations();
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
    let el = this[0];
    if (el.textContent !== txt)
        el.textContent = txt;
    return this;
};

// Update Text classes
function updateTextClasses(className, text){
    let els = document.getElementsByClassName(className);
    if (els) {
        for (let i = 0; i < els.length; i++){
            let el = els[i];
            if (el && el.textContent !== text)
                el.textContent = text;
        }
    }
}

// Update Text content
function updateText(elementId, text){
    let el = document.getElementById(elementId);
    if (el && el.textContent !== text){
        el.textContent = text;
    }
    return el;
}

// Convert float to string
function floatToString(float) {
    return float.toFixed(6).replace(/\.0+$|0+$/, '');
}

// Format number
function formatNumber(number, delimiter){
    if(number != '') {
        number = number.split(delimiter).join('');

        let formatted = '';
        let sign = '';

        if(number < 0){
            number = -number;
            sign = '-';
        }

        while(number >= 1000){
            let mod = number % 1000;

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
    let units = [ [60, 'second'], [60, 'minute'], [24, 'hour'],
                [7, 'day'], [4, 'week'], [12, 'month'], [1, 'year'] ];

    function formatAmounts(amount, unit){
        let rounded = Math.round(amount);
	unit = unit + (rounded > 1 ? 's' : '');
        if (getTranslation(unit)) unit = getTranslation(unit);
        return '' + rounded + ' ' + unit;
    }

    let amount = seconds;
    for (let i = 0; i < units.length; i++){
        if (amount < units[i][0]) {
            return formatAmounts(amount, units[i][1]);
    }
        amount = amount / units[i][0];
    }
    return formatAmounts(amount,  units[units.length - 1][1]);
}

// Get readable hashrate
function getReadableHashRateString(hashrate){
    if (!hashrate) hashrate = 0;

    let i = 0;
    let byteUnits = [' H', ' kH', ' MH', ' GH', ' TH', ' PH' ];
    if (hashrate > 0) {
        while (hashrate > 1000){
            hashrate = hashrate / 1000;
            i++;
        }
    }
    return parseFloat(hashrate).toFixed(2) + byteUnits[i];
}
    
// Get coin decimal places
function getCoinDecimalPlaces() {
    if (typeof coinDecimalPlaces != "undefined") return coinDecimalPlaces;
    else if (lastStats.config.coinDecimalPlaces) return lastStats.config.coinDecimalPlaces;
    else lastStats.config.coinUnits.toString().length - 1;
}

// Get readable coins
function getReadableCoins(coins, digits, withoutSymbol){
    let coinDecimalPlaces = getCoinDecimalPlaces();
    let amount = parseFloat((parseInt(coins || 0) / lastStats.config.coinUnits).toFixed(digits || coinDecimalPlaces));
    return amount.toString() + (withoutSymbol ? '' : (' ' + lastStats.config.symbol));
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
    let percent = Math.round(shares / difficulty * 100);
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

// Return pool host
function getPoolHost() {
    if (typeof poolHost != "undefined") return poolHost;
    if (lastStats.config.poolHost) return lastStats.config.poolHost;
    else return window.location.hostname;
}

// Return transaction URL
function getTransactionUrl(id) {
    return transactionExplorer.replace(new RegExp('{symbol}', 'g'), lastStats.config.symbol.toLowerCase()).replace(new RegExp('{id}', 'g'), id);
}

// Return blockchain explorer URL
function getBlockchainUrl(id) {
    return blockchainExplorer.replace(new RegExp('{symbol}', 'g'), lastStats.config.symbol.toLowerCase()).replace(new RegExp('{id}', 'g'), id);    
}
 
/**
 * Tables
 **/
 
// Sort table cells
function sortTable() {
    let table = $(this).parents('table').eq(0),
        rows = table.find('tr:gt(0)').toArray().sort(compareTableRows($(this).index()));
    this.asc = !this.asc;
    if(!this.asc) {
        rows = rows.reverse()
    }
    for(let i = 0; i < rows.length; i++) {
        table.append(rows[i])
    }
}

// Compare table rows
function compareTableRows(index) {
    return function(a, b) {
        let valA = getCellValue(a, index), valB = getCellValue(b, index);
        if (!valA) { valA = 0; }
        if (!valB) { valB = 0; }
        return $.isNumeric(valA) && $.isNumeric(valB) ? valA - valB : valA.toString().localeCompare(valB.toString())
    }
}

// Get table cell value
function getCellValue(row, index) {
    return $(row).children('td').eq(index).data("sort")
}

/**
 * Translations
 **/
if (typeof langs == "undefined") {
    langs = { en: 'English' };
}

if (typeof defaultLang == "undefined") {
    defaultLang = 'en';
}

let langCode = defaultLang;
let langData = null; 

function getTranslation(key) {
    if (!langData || !langData[key]) return null;
    return langData[key];    
}

let translate = function(data) {
    $("html")[0].lang = langCode;
    langData = data;

    $("[data-tkey]").each(function(index) {
        let strTr = data[$(this).attr('data-tkey')];
        $(this).html(strTr);
    });

    $("[data-tplaceholder]").each(function(index) {
        let strTr = data[$(this).attr('data-tplaceholder')];
	$(this).attr('placeholder', strTr)
    });

    $("[data-tvalue]").each(function(index) {
        let strTr = data[$(this).attr('data-tvalue')];
        $(this).attr('value', strTr)
    });
} 

// Get language code from URL
const $_GET = {};
const args = location.search.substr(1).split(/&/);
for (let i=0; i<args.length; ++i) {
    const tmp = args[i].split(/=/);
    if (tmp[0] != "") {
        $_GET[decodeURIComponent(tmp[0])] = decodeURIComponent(tmp.slice(1).join("").replace("+", " "));
        langCode = $_GET['lang'];
    }
}

// Load language
function loadTranslations() {
    if (langData) {
        translate(langData);
    }
    else if (langs && langs[langCode]) {
        $.getJSON('lang/'+langCode+'.json', translate);
        $.getScript('lang/timeago/jquery.timeago.'+langCode+'.js');    
    } else {
        $.getJSON('lang/'+defaultLang+'.json', translate);
        $.getScript('lang/timeago/jquery.timeago.'+defaultLang+'.js');    
    }
}

// Language selector
function renderLangSelector() {
    // Desktop
    let html = '';
    let numLangs = 0;
    if (langs) {
        html += '<select id="newLang" class="form-control form-control-sm">';
        for (let lang in langs) {
            let selected = lang == langCode ? ' selected="selected"' : '';
            html += '<option value="' + lang + '"' + selected + '>' + langs[lang] + '</option>';
	    numLangs ++;
        }
	html += '</select>';
    }
    if (html && numLangs > 1) {
        $('#langSelector').html(html);	
        $('#newLang').each(function(){
            $(this).change(function() {
                let newLang = $(this).val();
                let url = '?lang=' + newLang;
                if (window.location.hash) url += window.location.hash;
                window.location.href = url;
            });
        });
    }	

    // Mobile
    html = '';
    numLangs = 0;
    if (langs) {
        html += '<select id="mNewLang" class="form-control form-control-sm">';
        for (let lang in langs) {
            let selected = lang == langCode ? ' selected="selected"' : '';
            html += '<option value="' + lang + '"' + selected + '>' + langs[lang] + '</option>';
	    numLangs ++;
        }
	html += '</select>';
    }
    if (html && numLangs > 1) {
        $('#mLangSelector').html(html);	
        $('#mNewLang').each(function(){
            $(this).change(function() {
                let newLang = $(this).val();
                let url = '?lang=' + newLang;
                if (window.location.hash) url += window.location.hash;
                window.location.href = url;
            });
        });
    }	
}
