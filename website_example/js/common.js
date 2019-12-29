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
    var el = this[0];
    if (el && el.textContent !== txt)
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
	var unit = unit + (rounded > 1 ? 's' : '');
        if (getTranslation(unit)) unit = getTranslation(unit);
        return '' + rounded + ' ' + unit;
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
    if (typeof hashrate != 'number')
	hashrate = 0;
    return hashrate.toFixed(2) + byteUnits[i];
}

function getCoinDecimalPlace(stats)
{
    if (typeof coinDecimalPlaces != "undefined") return coinDecimalPlaces;
    else if (stats.config.coinDecimalPlaces) return stats.config.coinDecimalPlaces;
    else stats.config.coinUnits.toString().length - 1;
}

function getReadableCoin(stats, coins, digits, withoutSymbol) {
    let coinDecimalPlaces = getCoinDecimalPlace(stats)
    let amount = parseFloat((parseInt(coins || 0) / stats.config.coinUnits).toFixed(digits || coinDecimalPlaces))
    return amount.toString() + (withoutSymbol ? '' : (' ' + stats.config.symbol));
}


// Format payment link
function formatPaymentLink(hash, merged){
    return '<a target="_blank" href="' + getTransactionUrl(hash, merged) + '">' + hash + '</a>';
}

// Format difficulty
function formatDifficulty(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Format luck / current effort
function formatLuck(difficulty, shares, solo=false) {
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
        return `<span class="luckGood">?</span>` + (solo === true ? `<span class="fa fa-user luckGood" title="Solo Mined"></span>` : ``);
    }
    else if(percent <= 100){
        return `<span class="luckGood">${percent}%&nbsp;</span>` + (solo === true ? `<span class="fa fa-user luckGood" title="Solo Mined"></span>` : ``);
    }
    else if(percent >= 101 && percent <= 150){
        return `<span class="luckMid">${percent}%&nbsp;</span>` + (solo === true ? `<span class="fa fa-user luckMid" title="Solo Mined"></span>` : ``);
    }
    else{
        return `<span class="luckBad">${percent}%&nbsp;</span>` + (solo === true ? `<span class="fa fa-user luckBad" title="Solo Mined"></span>` : ``);
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
function getTransactionUrl(id, stats) {
    if (stats && blockExplorers){
        return blockExplorers[stats.config.coin].transactionExplorer.replace('{symbol}', stats.config.symbol.toLowerCase()).replace('{id}', id);
    }
}

// Return blockchain explorer URL
function getBlockchainUrl(id, stats) {
    if (stats && blockExplorers){
        return blockExplorers[stats.config.coin].blockchainExplorer.replace('{symbol}', stats.config.symbol.toLowerCase()).replace('{id}', id);
    }
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

/**
 * Translations
 **/

if (typeof langs == "undefined") {
    var langs = { en: 'English' };
}

if (typeof defaultLang == "undefined") {
    var defaultLang = 'en';
}

var langCode = defaultLang;
var langData = null;

function getTranslation(key) {
    if (!langData || !langData[key]) return null;
    return langData[key];
}

var translate = function(data) {
    $("html")[0].lang = langCode;
    langData = data;

    $("[data-tkey]").each(function(index) {
        var strTr = data[$(this).attr('data-tkey')];
        $(this).html(strTr);
    });

    $("[data-tplaceholder]").each(function(index) {
        var strTr = data[$(this).attr('data-tplaceholder')];
	$(this).attr('placeholder', strTr)
    });

    $("[data-tvalue]").each(function(index) {
        var strTr = data[$(this).attr('data-tvalue')];
        $(this).attr('value', strTr)
    });
}

// Get language code from URL
const $_GET = {};
const args = location.search.substr(1).split(/&/);
for (var i=0; i<args.length; ++i) {
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
    var html = '';
    var numLangs = 0;
    if (langs) {
        html += '<select id="newLang" class="form-control form-control-sm">';
        for (var lang in langs) {
            var selected = lang == langCode ? ' selected="selected"' : '';
            html += '<option value="' + lang + '"' + selected + '>' + langs[lang] + '</option>';
	    numLangs ++;
        }
	html += '</select>';
    }
    if (html && numLangs > 1) {
        $('#langSelector').html(html);
        $('#newLang').each(function(){
            $(this).change(function() {
                var newLang = $(this).val();
                var url = '?lang=' + newLang;
                if (window.location.hash) url += window.location.hash;
                window.location.href = url;
            });
        });
    }

    // Mobile
    var html = '';
    var numLangs = 0;
    if (langs) {
        html += '<select id="mNewLang" class="form-control form-control-sm">';
        for (var lang in langs) {
            var selected = lang == langCode ? ' selected="selected"' : '';
            html += '<option value="' + lang + '"' + selected + '>' + langs[lang] + '</option>';
	    numLangs ++;
        }
	html += '</select>';
    }
    if (html && numLangs > 1) {
        $('#mLangSelector').html(html);
        $('#mNewLang').each(function(){
            $(this).change(function() {
                var newLang = $(this).val();
                var url = '?lang=' + newLang;
                if (window.location.hash) url += window.location.hash;
                window.location.href = url;
            });
        });
    }
}


/*
***************************************************************
pool_block methods
***************************************************************
*/

function poolBlocks_GenerateChart(data, displayedChart) {
    if (displayedChart[data.config.coin] || !data.charts.blocks || data.charts.blocks === "undefined" || !data.charts.blocksSolo || data.charts.blocksSolo === "undefined") return ;
    let  chartDays = data.config.blocksChartDays || null;
    let  title = getTranslation('poolBlocks') ? getTranslation('poolBlocks') : 'Blocks found';
    if (chartDays) {
        if (chartDays === 1) title = getTranslation('blocksFoundLast24') ? getTranslation('blocksFoundLast24') : 'Blocks found in the last 24 hours';
        else title = getTranslation('blocksFoundLastDays') ? getTranslation('blocksFoundLastDays') : 'Blocks found in the last {DAYS} days';
        title = title.replace('{DAYS}', chartDays);
    }
    updateText(`blocksChartTitle${data.config.coin}`, title);
    let  labels = [];
    let  values = [];
    let  valuesSolo = [];
    for (let  key in data.charts.blocks) {
        let  label = key;
        if (chartDays && chartDays === 1) {
            let  keyParts = key.split(' ');
            label = keyParts[1].replace(':00', '');
        }
        labels.push(label);
        values.push(data.charts.blocks[key]);
    }
    for (let  key in data.charts.blocksSolo) {
        valuesSolo.push(data.charts.blocksSolo[key]);
    }

    let  $chart = $(`blocksChartObj${data.config.coin}`);
    let  bgcolor = null, bordercolor = null, borderwidth = null;
    let  colorelem = $chart.siblings('a.chart-style');
    if (colorelem.length == 1) {
        bgcolor = colorelem.css('background-color');
        bordercolor = colorelem.css('border-left-color');
        borderwidth = parseFloat(colorelem.css('width'));
    }
    if (bgcolor === null) bgcolor = 'rgba(3, 169, 244, .4)';
    if (bordercolor === null) bordercolor = '#03a9f4';
    if (borderwidth === null || isNaN(borderwidth)) borderwidth = 1;
    let chartElement = document.getElementById(`blocksChartObj${data.config.coin}`)
    if (!chartElement) return
    let  chart = new Chart(chartElement, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Prop Blocks',
                data: values,
                fill: false,
                backgroundColor: bgcolor,
                borderColor: bordercolor,
                borderWidth: borderwidth
            },
            {
                label: 'Solo Blocks',
                data: valuesSolo,
                fill: false,
                backgroundColor: 'rgba(0, 230, 64, 1)',
                borderColor: bordercolor,
                borderWidth: borderwidth
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: { display: false },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true,
                        userCallback: function(label, index, labels) {
                            if (Math.floor(label) === label) return label;
                        }
                    }
                }],
            },
            layout: {
                padding: { top: 0, left: 0, right: 0, bottom: 0 }
            }
        }
    });
    $(`#blocksChart${data.config.coin}`).show();
    displayedChart[data.config.coin] = true;
}

// Parse block data
function poolBlocks_ParseBlock(height, serializedBlock, stats){
    var parts = serializedBlock.split(':');
    let block = {}
    if (parts[0].includes('solo') || parts[0].includes('prop')){
        block = {
            height: parseInt(height),
        solo: parts[0] === 'solo',
        address: parts[1],
            hash: parts[2],
            time: parts[3],
            difficulty: parseInt(parts[4]),
            shares: parseInt(parts[5]),
            orphaned: parts[6],
            reward: parts[7]
        };
    }else{
        block = {
            height: parseInt(height),
        solo: false,
        address: '',
            hash: parts[0],
            time: parts[1],
            difficulty: parseInt(parts[2]),
            shares: parseInt(parts[3]),
            orphaned: parts[4],
            reward: parts[5]
        };
    }

    var toGo = stats.config.depth - (stats.network.height - block.height - 1);
    if(toGo > 1){
        block.maturity = toGo + ' to go';
    }
    else if(toGo == 1){
        block.maturity = "<i class='fa fa-spinner fa-spin'></i>";
    }
    else if(toGo <= 0){
        block.maturity = "<i class='fa fa-unlock-alt'></i>";
    }

    switch (block.orphaned){
        case '0':
            block.status = 'unlocked';
            block.maturity = "<i class='fa fa-unlock-alt'></i>";
            break;
       case '1':
            block.status = 'orphaned';
            block.maturity = "<i class='fa fa-times'></i>";
            block.reward = 0;
            break;
        default:
            block.status = 'pending';
            break;
    }
    return block;
}

// Get block row element
function getBlockRowElement(block, jsonString, stats){
    function formatBlockLink(hash, stats){
        return '<a target="_blank" href="' + getBlockchainUrl(hash, stats) + '">' + hash + '</a>';
    }

    var blockStatusClasses = {
        'pending': 'pending',
        'unlocked': 'unlocked',
        'orphaned': 'orphaned'
    };

    var row = document.createElement('tr');
    row.setAttribute(`data-json`, jsonString);
    row.setAttribute(`data-height`, block.height);
    row.setAttribute('id', `blockRow${stats.config.coin}${block.height}`);
    row.setAttribute('title', block.status);
    row.className = blockStatusClasses[block.status];

    var reward = "";
    if(typeof block.reward == "undefined"){
        reward = "Waiting...";
    }
    else{
        reward = getReadableCoin(stats, block.reward, null, true);
    }

    var columns =
        '<td class="col1">' + formatDate(block.time) + '</td>' +
        '<td class="col2">' + reward + '</td>' +
        '<td class="col3">' + block.height + '</td>' +
        '<td class="col4">' + block.difficulty + '</td>' +
        '<td class="col5">' + formatBlockLink(block.hash, stats) + '</td>' +
        '<td class="col5" title="Miners Address">' + block.address + '</td>' +
        '<td class="col6" align="right" title="' + block.shares + ' shares submitted">' + formatLuck(block.difficulty, block.shares, block.solo) + '</td>' +
        '<td class="col7">' + block.maturity + '</td>';

    row.innerHTML = columns;

    return row;
}

// Render blocks
function poolBlocks_RenderBlocks(blocksResults, stats){
    var $blocksRows = $(`#blocksReport${stats.config.coin}_rows`);

    for (var i = 0; i < blocksResults.length; i += 2){
        var block = poolBlocks_ParseBlock(blocksResults[i + 1], blocksResults[i], stats);
        var blockJson = JSON.stringify(block);

        var existingRow = document.getElementById(`blockRow${stats.config.coin}${block.height}`);
        if (existingRow && existingRow.getAttribute(`data-json`) !== blockJson){
            $(existingRow).replaceWith(getBlockRowElement(block, blockJson, stats));
        }
        else if (!existingRow){
            var blockElement = getBlockRowElement(block, blockJson, stats);

            var inserted = false;
            var rows = $blocksRows.children().get();
            for (var f = 0; f < rows.length; f++) {
                var bHeight = parseInt(rows[f].getAttribute(`data-height`));
                if (bHeight < block.height){
                    inserted = true;
                    $(rows[f]).before(blockElement);
                    break;
                }
            }
            if (!inserted){
                $blocksRows.append(blockElement);
            }
        }
    }
}

// Load more blocks button
function poolBlocks_Setup(api, stats, xhrGetBlocks) {
    $(`#loadMoreBlocks${stats.config.coin}`).click(function(xhrGetBlocks){
        if (xhrGetBlocks[stats.config.coin]) xhrGetBlocks[stats.config.coin].abort();
        xhrGetBlocks[stats.config.coin] = $.ajax({
            url: api + '/get_blocks',
            data: {
                height: $(`#blocksReport${stats.config.coin}_rows`).children().last().data(`height`)
            },
            dataType: 'json',
            cache: 'false',
            success: function(data){
                poolBlocks_RenderBlocks(data, stats);
            }
        });
    });
}

function poolBlocks_InitTemplate(ranOnce, displayedChart, xhrGetBlocks) {
    let coin = lastStats.config.coin
    if ($(`#blocksTabs li:contains(${coin})`).length == 0) {
       let template1 = $('#siblingTemplate').html()
       Mustache.parse(template1)
       let rendered1 = Mustache.render(template1, {coin:lastStats.config.coin, active:'active'})
       $('#tab-content').append(rendered1)

        let template = $('#siblingTabTemplate').html();
        Mustache.parse(template)
        let rendered = Mustache.render(template, {coin:lastStats.config.coin, symbol:`(${lastStats.config.symbol})`, active:'active'});
        $('#blocksTabs').append(rendered)
        
        poolBlocks_Setup(api, lastStats, xhrGetBlocks)
    }


    updateText(`blocksTotal${coin}`, lastStats.pool.totalBlocks.toString());
    if (lastStats.pool.lastBlockFound) {
        var d = new Date(parseInt(lastStats.pool.lastBlockFound)).toISOString();
        $(`#lastBlockFound${coin}`).timeago('update', d);
    }
    else {
        $(`#lastBlockFound${coin}`).removeAttr('title').data('ts', '').update('Never');
    }

    updateText(`blocksTotalSolo${coin}`, lastStats.pool.totalBlocksSolo.toString());
    if (lastStats.pool.lastBlockFoundSolo) {
        var d = new Date(parseInt(lastStats.pool.lastBlockFoundSolo)).toISOString();
        $(`#lastBlockFoundSolo${coin}`).timeago('update', d);
    }
    else {
        $(`#lastBlockFoundSolo${coin}`).removeAttr('title').data('ts', '').update('Never');
    }

    updateText(`blocksMaturityCount${coin}`, lastStats.config.depth.toString());

    $(`#averageLuck${coin}`).html(formatLuck(lastStats.pool.totalDiff, lastStats.pool.totalShares));

    displayedChart[lastStats.config.coin] = false
    if (lastStats.charts.blocks) {
    poolBlocks_GenerateChart(lastStats, displayedChart);
    }

    poolBlocks_RenderBlocks(lastStats.pool.blocks, lastStats);


    Object.keys(mergedStats).forEach(key => {
        if ($(`#blocksTabs li:contains(${key})`).length == 0) {
           let template1 = $('#siblingTemplate').html()
           Mustache.parse(template1)
           let rendered1 = Mustache.render(template1, {coin:key})
           $('#tab-content').append(rendered1)

           let template = $('#siblingTabTemplate').html();
           Mustache.parse(template)
           let rendered = Mustache.render(template, {coin:key, symbol:`(${mergedStats[key].config.symbol})`});
           $('#blocksTabs').append(rendered)

           poolBlocks_Setup(mergedApis[key].api, mergedStats[key])
        }

        updateText(`blocksTotal${key}`, mergedStats[key].pool.totalBlocks.toString());
        if (mergedStats[key].pool.lastBlockFound) {
            var d = new Date(parseInt(mergedStats[key].pool.lastBlockFound)).toISOString();
            $(`#lastBlockFound${key}`).timeago('update', d);
        }
        else {
            $(`#lastBlockFound${key}`).removeAttr('title').data('ts', '').update('Never');
        }

        updateText(`blocksTotalSolo${key}`, mergedStats[key].pool.totalBlocksSolo.toString());
        if (mergedStats[key].pool.lastBlockFoundSolo) {
            var d = new Date(parseInt(mergedStats[key].pool.lastBlockFoundSolo)).toISOString();
            $(`#lastBlockFoundSolo${key}`).timeago('update', d);
        }
        else {
            $(`#lastBlockFoundSolo${key}`).removeAttr('title').data('ts', '').update('Never');
        }

        updateText(`blocksMaturityCount${key}`, mergedStats[key].config.depth.toString());

        $(`#averageLuck${key}`).html(formatLuck(mergedStats[key].pool.totalDiff, mergedStats[key].pool.totalShares));
        displayedChart[key] = false
        if (mergedStats[key].charts.blocks) {
             poolBlocks_GenerateChart(mergedStats[key], displayedChart);
        }
        poolBlocks_RenderBlocks(mergedStats[key].pool.blocks, mergedStats[key]);
    })
    sortElementList($(`#blocksTabs`), $(`#blocksTabs>div`), mergedStats)
    if (!ranOnce) 
        ranOnce = RunOnce()
}

/*
***************************************************************
top10miners methods
***************************************************************
*/

function top10Miners_GetMinerCells(position, data){
    var miner = data.miner;
    var hashrate = data.hashrate ? data.hashrate : 0;
    var lastShare = data.lastShare ? data.lastShare : 0;
    var hashes = (data.hashes || 0).toString();
    
    return '<td class="col1" data-sort="' + position + '">' + position + '</td>' +
           '<td class="col2" data-sort="' + miner + '">' + miner + '</td>' +
           '<td class="col3" data-sort="' + hashrate + '">' + getReadableHashRateString(hashrate) + '/sec</td>' +
           '<td class="col4" data-sort="' + lastShare + '">' + (lastShare ? $.timeago(new Date(parseInt(lastShare) * 1000).toISOString()) : 'Never') + '</td>' +
           '<td class="col5" data-sort="' + hashes + '">' + hashes + '</td>';
}

// Update top10 miners report
function top10Miners_UpdateTop10(xhrGetMiners, endPoint, key) {
    if (xhrGetMiners[key])
        xhrGetMiners[key].abort()

    $( `#top10miners_rows${key}`).empty();

    xhrGetMiners[key] = $.ajax({
        url: `${endPoint}/get_top10miners`,
        data: {
            time: $(`#top10_rows${key}`).children().last().data('time')
        },
        dataType: 'json',
        cache: 'false',
        success: function(data){
            if (!data) return;
            for (var i=0; i<data.length; ++i) {
                $( `#top10miners_rows${key}`).append('<tr>' + top10Miners_GetMinerCells(i+1, data[i]) + '</tr>');
            }
        }
    });
}

function top10Miners_InitTemplate(xhrGetMiners, ranOnce) {
    let coin = lastStats.config.coin
    if ($(`#blocksTabs li:contains(${coin})`).length === 0) {
      let template = $('#siblingTabTemplate').html();
      Mustache.parse(template)
      let rendered = Mustache.render(template, {coin:lastStats.config.coin, symbol:`(${lastStats.config.symbol})`, active: 'active'});
      $('#blocksTabs').append(rendered)

      template = $('#siblingTemplate').html()
      Mustache.parse(template)
      rendered = Mustache.render(template, {coin:coin, active: 'active'})
      $('#tab-content').append(rendered)
    }

    top10Miners_UpdateTop10(xhrGetMiners, api, coin);

    Object.keys(mergedStats).forEach(key => {
        if ($(`#blocksTabs li:contains(${key})`).length === 0) {
            coin = key
            let template = $('#siblingTabTemplate').html();
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:mergedStats[key].config.coin, symbol:`(${mergedStats[key].config.symbol})`});
            $('#blocksTabs').append(rendered)

            template = $('#siblingTemplate').html()
            Mustache.parse(template)
            rendered = Mustache.render(template, {coin:coin})
            $('#tab-content').append(rendered)
        }
        top10Miners_UpdateTop10(xhrGetMiners, mergedApis[key].api, key);
    })
    sortElementList($(`#blocksTabs`), $(`#blocksTabs>li`), mergedStats)
    if (!ranOnce)
        ranOnce = RunOnce()
}

/*
***************************************************************
settings methods
***************************************************************
*/

function settings_Setup(api, stats) {

    var address = getCurrentAddress(stats.config.coin);
    if (address){
        $(`#yourAddress${stats.config.coin}`).val(address);
        settings_GetPayoutLevel(api, address, stats);
        settings_GetEmailAddress(api, address, stats);
    }

    // Handle click on Set button
    $(`#payoutSetButton${stats.config.coin}`).click(function(){
        var address = $(`#yourAddress${stats.config.coin}`).val().trim();
        if (!address || address == '') {
            settings_ShowError('noMinerAddress', 'No miner address specified', '', false);
            return;
        }

        var ip = $(`#yourIP${stats.config.coin}`).val().trim();
        if (!ip || ip == '') {
            settings_ShowError('noMinerIP', 'No miner IP address specified', '', false);
            return;
        }

        var level = $(`#yourPayoutRate${stats.config.coin}`).val().trim();
        if (!level || level < 0) {
            settings_ShowError('noPayoutLevel', 'No payout level specified', '', false);
            return;
        }
        settings_SetPayoutLevel(api, address, ip, level, stats);
    });

    // Handle click on Enable button
    $(`#enableButton${stats.config.coin}`).click(function(){
        var address = $(`#yourAddress${stats.config.coin}`).val().trim();
        var ip = $(`#yourIP${stats.config.coin}`).val().trim();
        var email = $(`#yourEmail${stats.config.coin}`).val();
        settings_SetEmailNotifications(stats, api, email, address, ip, true);
    });

    // Handle click on Disable button
    $(`#disableButton${stats.config.coin}`).click(function(){
        var address = $(`#yourAddress${stats.config.coin}`).val().trim();
        var ip = $(`#yourIP${stats.config.coin}`).val().trim();
        var email = $(`#yourEmail${stats.config.coin}`).val();
        settings_SetEmailNotifications(stats, api, email, address, ip, false);
    });
}

/**
 * Error Message
 **/
function settings_ShowError(id, message, extra, stats) {
    if (getTranslation(id)) message = getTranslation(id);
    message = message.trim();
    if (extra) message += ' ' + extra;
    $(`#action_update_message${stats.config.coin}`).text(message);
    $(`#action_update_message${stats.config.coin}`).removeClass().addClass('alert alert-danger');
}

/**
 * Success Message
 **/
function settings_ShowSuccess(id, message, stats) {
    if (getTranslation(id)) message = getTranslation(id);
    $(`#action_update_message${stats.config.coin}`).text(message);
    $(`#action_update_message${stats.config.coin}`).removeClass().addClass('alert alert-success');
}

/**
 * Payout level
 **/

// Get current payout level
function settings_GetPayoutLevel(api, address, stats) {
    if (!address || address == '') 
        return;
    $.ajax({
        url: `${api}/get_miner_payout_level`,
        data: {
            address: address
        },
        dataType: 'json',
        cache: 'false'
    }).done(function(data){
        if (data.level != undefined) {
            $(`#yourPayoutRate${stats.config.coin}`).val(data.level);
        }
    });
} 

// Set payout level
function settings_SetPayoutLevel(api, address, ip, level, stats) {
    let params = {
            address: address,
            ip: ip,
            level: level
        }
    $.ajax({
        url: `${api}/set_miner_payout_level`,
        data: params,
        dataType: 'json',
        cache: 'false'
    }).done(function(data){
        if (data.status == 'done') {
            settings_ShowSuccess('minerPayoutSet', 'Done! Your minimum payout level was set', stats);
        } else {
            settings_ShowError('Error:', data.status, null, stats);
        }
    });
}

/**
 * Email Notifications
 **/

// Check if specified value is a valid email
function settings_IsEmail(email) {
    var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    return regex.test(email);
}

// Get current email address for notifications
function settings_GetEmailAddress(endPoint, address, stats) {
    if (!address || address == '') return;
    
    $.ajax({
        url: `${endPoint}/get_email_notifications`,
        data: {
            address: address
        },
        dataType: 'json',
        cache: 'false'
    }).done(function(data){
        if (data.email != undefined) {
            $(`#yourEmail${stats.config.coin}`).val(data.email);
        }
    });
}
    
// Set email address for notifications
function settings_SetEmailNotifications(stats, endPoint, email, address, ip, enable) {
    var address = $(`#yourAddress${stats.config.coin}`).val().trim();
    if (!address || address == '') {
        settings_ShowError('noMinerAddress', 'No miner address specified', null, stats);
        return;
    }

    var ip = $(`#yourIP${stats.config.coin}`).val().trim();
    if (!ip || ip == '') {
        settings_ShowError('noMinerIP', 'No miner IP address specified', null, stats);
        return;
    }

    var email = $(`#yourEmail${stats.config.coin}`).val().trim();
    if (enable && !email) {
        settings_ShowError('noEmail', 'No email address specified', null, stats);
        return;
    }
    if (enable && !settings_IsEmail(email)) {
        settings_ShowError('invalidEmail', 'Invalid email address specified', null, stats);
        return;
    }

    $.ajax({
        url: `${endPoint}/set_email_notifications`,
        data: {
            address: address,
            ip: ip,
            email: email,
            action: enable ? 'enable' : 'disable'
        },
        dataType: 'json',
        cache: 'false'
    }).done(function(data){
        if (data.status == "done") {
            if (enable) {
                settings_ShowSuccess('notificationEnabled', 'Done! Email notifications have been enabled', stats);
        } else {
                settings_ShowSuccess('notificationDisabled', 'Done! Email notifications have been disabled', stats);
            }
        } else {
            settings_ShowError('error', 'Error:', data.status, stats);
        }
    });
}

function settings_InitTemplate(ranOnce) {
    if (!lastStats.config.sendEmails) $(`#emailNotifications${lastStats.config.coin}`).hide();

    let coin = lastStats.config.coin
    let template = $('#siblingTemplate').html()
    if ($(`#blocksTabs li:contains(${coin})`).length === 0) {
        Mustache.parse(template)
        let rendered = Mustache.render(template, {coin:coin, active:'active'})
        $('#tab-content').append(rendered)

        template = $('#siblingTabTemplate').html();
        Mustache.parse(template)
        rendered = Mustache.render(template, {coin:lastStats.config.coin, symbol:`(${lastStats.config.symbol})`, active:'active'});
        $('#blocksTabs').append(rendered)
        settings_Setup(api, lastStats)
    }

    Object.keys(mergedStats).forEach(key => {
        if ($(`#blocksTabs li:contains(${key})`).length === 0) {
            if (!mergedStats[key].config.sendEmails) 
                $(`#emailNotifications${mergedStats[key].config.coin}`).hide();
            template = $('#siblingTemplate').html()
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:key})
            $('#tab-content').append(rendered)

            template = $('#siblingTabTemplate').html();
            Mustache.parse(template)
            rendered = Mustache.render(template, {coin:key, symbol:`(${mergedStats[key].config.symbol})`});
            $('#blocksTabs').append(rendered)

            settings_Setup(mergedApis[key].api, mergedStats[key])
        }
    })
    sortElementList($(`#blocksTabs`), $(`#blocksTabs>li`), mergedStats)
    if (!ranOnce) 
      ranOnce = RunOnce()
}

/*
***************************************************************
payments methods
***************************************************************
*/

// Parse payment data
function payments_ParsePayment(time, serializedPayment){
    var parts = serializedPayment.split(':');
    return {
        time: parseInt(time),
        hash: parts[0],
        amount: parts[1],
        fee: parts[2],
        mixin: parts[3],
        recipients: parts[4]
    };
}

// Get payment cells
function payments_GetPaymentCells(payment, stats){
    return '<td class="col1">' + formatDate(payment.time) + '</td>' +
           '<td class="col2">' + formatPaymentLink(payment.hash, stats) + '</td>' +
           '<td class="col3">' + (getReadableCoin(stats, payment.amount)) + '</td>' +
           '<td class="col4">' + (getReadableCoin(stats, payment.fee)) + '</td>' +
           '<td class="col5">' + payment.mixin + '</td>' +
           '<td class="col6">' + payment.recipients + '</td>';
}

// Get payment row element
function payments_GetPaymentRowElement(payment, jsonString, stats){
    var row = document.createElement('tr');
    row.setAttribute(`data-json`, jsonString);
    row.setAttribute(`data-time`, payment.time);
    row.setAttribute('id', `paymentRow${stats.config.coin}${payment.time}`);

    row.innerHTML = payments_GetPaymentCells(payment, stats);

    return row;
}

// Render payments data
function payments_renderPayments(paymentsResults, stats){
    var $paymentsRows = $(`#paymentsReport${stats.config.coin}_rows`);
    for (var i = 0; i < paymentsResults.length; i += 2){
        var payment = payments_ParsePayment(paymentsResults[i + 1], paymentsResults[i]);
        var paymentJson = JSON.stringify(payment);
        var existingRow = document.getElementById(`paymentRow${stats.config.coin}${payment.time}`);

        if (existingRow && existingRow.getAttribute(`data-json`) !== paymentJson){
            $(existingRow).replaceWith(payments_GetPaymentRowElement(payment, paymentJson, stats));
        }
        else if (!existingRow){
            var paymentElement = payments_GetPaymentRowElement(payment, paymentJson, stats);

            var inserted = false;
            var rows = $paymentsRows.children().get();
            for (var f = 0; f < rows.length; f++) {
                var pTime = parseInt(rows[f].getAttribute(`data-time`));
                if (pTime < payment.time){
                    inserted = true;
                    $(rows[f]).before(paymentElement);
                    break;
                }
            }
            if (!inserted) {
                $paymentsRows.append(paymentElement);
            }
        }
    }
}

// Load more payments button
function payments_Setup(xhrGetPayments, api, stats) {
  $(`#loadMorePayments${stats.config.coin}`).click(function(){
      if (xhrGetPayments[stats.config.coin]) xhrGetPayments[stats.config.coin].abort();
          xhrGetPayments[stats.config.coin] = $.ajax({
          url: api + '/get_payments',
          data: {
              time: $(`#paymentsReport${stats.config.coin}_rows`).children().last().data(`time`)
          },
          dataType: 'json',
          cache: 'false',
          success: function(data){
              payments_renderPayments(data, stats);
          }
      });
  });
}

function payments_InitTemplate(xhrGetPayments, ranOnce) {
  let coin = lastStats.config.coin
        if ($(`#blocksTabs li:contains(${coin})`).length === 0) {
          let template1 = $('#siblingTemplate').html()
          Mustache.parse(template1)
          let rendered1 = Mustache.render(template1, {coin:coin, active:'active'})
          $('#tab-content').append(rendered1)

          let template = $('#siblingTabTemplate').html();
          Mustache.parse(template)
          let rendered = Mustache.render(template, {coin:lastStats.config.coin, symbol:`(${lastStats.config.symbol})`, active:'active'});
          $('#blocksTabs').append(rendered)

          payments_Setup(xhrGetPayments, api, lastStats)
        }
        updateText(`paymentsTotal${coin}`, lastStats.pool.totalPayments.toString());
        updateText(`paymentsTotalPaid${coin}`, lastStats.pool.totalMinersPaid.toString());
        updateText(`paymentsInterval${coin}`, getReadableTime(lastStats.config.paymentsInterval));
        updateText(`paymentsMinimum${coin}`, getReadableCoin(lastStats, lastStats.config.minPaymentThreshold));
        updateText(`paymentsDenomination${coin}`, getReadableCoin(lastStats, lastStats.config.denominationUnit, 3));
        payments_renderPayments(lastStats.pool.payments, lastStats);

        Object.keys(mergedStats).forEach(key => {
          if ($(`#blocksTabs li:contains(${key})`).length === 0) {

            let template1 = $('#siblingTemplate').html()
            Mustache.parse(template1)
            let rendered1 = Mustache.render(template1, {coin:key})
            $('#tab-content').append(rendered1)

            let template = $('#siblingTabTemplate').html();
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:key, symbol:`(${mergedStats[key].config.symbol})`});
            $('#blocksTabs').append(rendered)

            payments_Setup(xhrGetPayments, mergedApis[key].api, mergedStats[key])
          }

          updateText(`paymentsTotal${key}`, mergedStats[key].pool.totalPayments.toString());
          updateText(`paymentsTotalPaid${key}`, mergedStats[key].pool.totalMinersPaid.toString());
          updateText(`paymentsInterval${key}`, getReadableTime(mergedStats[key].config.paymentsInterval));
          updateText(`paymentsMinimum${key}`, getReadableCoin(mergedStats[key], mergedStats[key].config.minPaymentThreshold));
          updateText(`paymentsDenomination${key}`, getReadableCoin(mergedStats[key], mergedStats[key].config.denominationUnit, 3));
          payments_renderPayments(mergedStats[key].pool.payments, mergedStats[key]);
        })
        sortElementList($(`#blocksTabs`), $(`#blocksTabs>li`), mergedStats)
        if (!ranOnce) 
          ranOnce = RunOnce()
}

/*
***************************************************************
market methods
***************************************************************
*/

function market_LoadMarketData(api, stats, loadedData, currencyPairs, xhrMarketGets, marketPrices) {
    if (loadedData[stats.config.coin]) return ;
        
    if (typeof marketCurrencies !== 'undefined' && marketCurrencies.length > 0){
        let intervalMarketPolling = setInterval(market_UpdateMarkets(api, stats, currencyPairs, xhrMarketGets, marketPrices), 300000);
        market_UpdateMarkets(api, stats, currencyPairs, xhrMarketGets, marketPrices);
    } else {
        $(`#marketInfos${stats.config.coin}`).hide();
    }
    
    loadedData[stats.config.coin] = true;
}
    
// Market data polling (poll data every 5 minutes)
function market_UpdateMarkets(api, stats, currencyPairs, xhrMarketGets, marketPrices){
    if (typeof marketCurrencies === 'undefined' || marketCurrencies.length === 0) return ;
    
    currencyPairs[stats.config.coin] = []

    for (let i = 0; i < marketCurrencies.length; i++){
        currencyPairs[stats.config.coin].push(marketCurrencies[i].replace('{symbol}', stats.config.symbol).toUpperCase());
    }

    if (xhrMarketGets[stats.config.coin]) xhrMarketGets[stats.config.coin].abort()

    xhrMarketGets[stats.config.coin] = $.ajax({
        url: api + '/get_market',
        data: { tickers: currencyPairs[stats.config.coin] },
        dataType: 'json',
        cache: 'false',
        success: function(data) {
            if (!data || data.length === 0) {
                $(`#marketInfos${stats.config.coin}`).hide();
                return;
            }

            $(`#marketInfos${stats.config.coin}`).empty();
            for (let i in data) {
                if (!data[i] || !data[i].ticker) continue;
                let ticker = data[i].ticker;
                let tickerParts = ticker.split('-');
                let tickerBase = tickerParts[0] || null;
                let tickerTarget = tickerParts[1] || null;

                let price  = data[i].price;
                if (!price || price === 0) continue;

                let dataSource = data[i].source;

                market_RenderMarketPrice(tickerBase, tickerTarget, price, dataSource, stats, marketPrices);
            }
            $(`#marketInfos${stats.config.coin}`).show();
    },
        error: function() {
            $(`#marketInfos${stats.config.coin}`).hide();
        }
    });
}

// Render market price
function market_RenderMarketPrice(base, target, price, source, stats, marketPrices) {
    let icon = 'fa-money';
    if (target == 'BTC') icon = 'fa-btc';
    if (target == 'BCH') icon = 'fa-btc';
    if (target == 'USD') icon = 'fa-dollar';
    if (target == 'CAD') icon = 'fa-dollar';
    if (target == 'EUR') icon = 'fa-eur';
    if (target == 'GBP') icon = 'fa-gbp';
    if (target == 'JPY') icon = 'fa-jpy';
            
    if (base == stats.config.symbol.toUpperCase()) {
        marketPrices[stats.config.coin][target] = price;
    }

    if (target == 'USD' || target == 'CAD' ||  target == 'EUR' || target == 'GBP' || target == 'JPY') {
        price = price.toFixed(4);
    } else {
        price = price.toFixed(8);
    }

    let sourceURL = null;
    if (source == 'cryptonator') sourceURL = 'https://www.cryptonator.com/';
    else if (source == 'altex') sourceURL = 'https://altex.exchange/';
    else if (source == 'crex24') sourceURL = 'https://crex24.com/';
    else if (source == 'cryptopia') sourceURL = 'https://www.cryptopia.co.nz/';
    else if (source == 'stocks.exchange') sourceURL = 'https://stocks.exchange/';
    else if (source == 'tradeogre') sourceURL = 'https://tradeogre.com/';

    source = source.charAt(0).toUpperCase() + source.slice(1);
    if (sourceURL) source = '<a href="'+sourceURL+'" target="_blank" rel="nofollow">'+source+'</a>';

    $(`#marketInfos${stats.config.coin}`).append(
        '<div class="col-lg-3 col-md-4 col-sm-6 marketTicker"><div class="infoBox hoverExpandEffect">' +
        '<div class="icon"><span class="fa '+ icon + '"></span></div>' +
        '<div class="content">' + 
                '<div class="text">' + base + ' to ' + target + '</div>' +
                '<div class="value">' + price + '</div>' +
        '<div class="source">Source: ' + source + '</div>' +
        '</div>' +
        '</div>'
    );
}

/**
 * Market Charts
 **/

// Create charts
function market_CreateCharts(stats) {
    if (!stats || !stats.charts) return ;
    let data = stats.charts;
    let graphData = {
        price: market_GetGraphData(data.price),
        profit: market_GetGraphData(data.profit)
    };

    for(let graphType in graphData) {
        if (graphData[graphType].values.length > 1) {
        let $chart = $(`#chart${stats.config.coin}_${graphType}`);
            let bgcolor = null, bordercolor = null, borderwidth = null;
            let colorelem = $chart.siblings('a.chart-style');
            if (colorelem.length == 1) {
                bgcolor = colorelem.css('background-color');
                bordercolor = colorelem.css('border-left-color');
                borderwidth = parseFloat(colorelem.css('width'));
            }
            if (bgcolor === null) bgcolor = 'rgba(3, 169, 244, .4)';
            if (bordercolor === null) bordercolor = '#03a9f4';
            if (borderwidth === null || isNaN(borderwidth)) borderwidth = 1;
            let chartObj = new Chart(document.getElementById(`chart${stats.config.coin}_${graphType}`), {
                type: 'line',
                data: {
                    labels: graphData[graphType].names,
                    datasets: [{
                        data: graphData[graphType].values,
                        dataType: graphType,
                        fill: true,
                        backgroundColor: bgcolor,
                        borderColor: bordercolor,
                        borderWidth: borderwidth
                    }]
                },
                options: {
                    animation: false,
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: { display: false },
                    elements: { point: { radius: 0, hitRadius: 10, hoverRadius: 5 } },
                    scales: {
                        xAxes: [{
                            display: false,
                            ticks: { display: false },
                            gridLines: { display: false }
                        }],
                        yAxes: [{
                            display: false,
                            ticks: {
                                display: false,
                                beginAtZero: true,
                                userCallback: function(label, index, labels) {
                                    if (Math.floor(label) === label) return label;
                                }
                            },
                            gridLines: { display: false }
                        }]
                    },
                    layout: {
                        padding: { top: 5, left: 10, right: 10, bottom: 10 }
                    },
                    tooltips: {
                        callbacks: {
                            label: function(tooltipItem, data) {
                                let dataType = data.datasets[tooltipItem.datasetIndex].dataType || '';
                                let label = tooltipItem.yLabel;
                                if (dataType == 'price') label = parseFloat(tooltipItem.yLabel).toFixed(4);
                                else if (dataType == 'profit') label = parseFloat(tooltipItem.yLabel).toFixed(10);
                                return ' ' + label;
                            }
                        }
                    }
                }
            });
            $chart.closest('.marketChart').show();
        }
    }
}

// Get chart data
function market_GetGraphData(rawData) {
    let graphData = {
        names: [],
        values: []
    };
    if(rawData) {
        for (let i = 0, xy; xy = rawData[i]; i++) {
            graphData.names.push(new Date(xy[0]*1000).toLocaleString());
            graphData.values.push(xy[1]);
        }
    }
    return graphData;
}


// Calculate current estimation
function market_CalcEstimateProfit(marketPrices){
    let rateUnit = Math.pow(1000,parseInt($('#calcHashUnit').data('mul')));
    let hashRate = parseFloat($('#calcHashRate').val()) * rateUnit;
    let coin = lastStats.config.coin
    try {
        if ($(`#calcHashAmount${coin}`).length == 0) {
            let template = $(`#calcHashResultTemplate`).html()
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:coin})
            $(`#calcHashHolder`).append(rendered)
        }
        let profit = (hashRate * 86400 / lastStats.network.difficulty) * lastStats.lastblock.reward;
        if (profit) {
            updateText(`calcHashAmount${coin}1`, getReadableCoin(lastStats, profit));
            updateText(`calcHashAmount${coin}2`, market_GetCurrencyPriceText(lastStats, profit, marketPrices));
            //return;
        } else {
            updateText(`calcHashAmount${coin}1`, '');
            updateText(`calcHashAmount${coin}2`, '');
        }
    }
    catch (e){
        updateText(`calcHashAmount${coin}1`, '');
        updateText(`calcHashAmount${coin}2`, '');
    }



    Object.keys(mergedStats).forEach(key => {
        try {
            if ($(`#calcHashAmount${key}`).length == 0) {
                let template = $(`#calcHashResultTemplate`).html()
                Mustache.parse(template)
                let rendered = Mustache.render(template, {coin:key})
                $(`#calcHashHolder`).append(rendered)
            }

            let profit = (hashRate * 86400 / mergedStats[key].network.difficulty) * mergedStats[key].lastblock.reward;
            if (profit) {
                updateText(`calcHashAmount${key}1`, getReadableCoin(mergedStats[key], profit));
                updateText(`calcHashAmount${key}2`, market_GetCurrencyPriceText(mergedStats[key], profit, marketPrices));
                return;
            } else {
                updateText(`calcHashAmount${key}1`, '');
                updateText(`calcHashAmount${key}2`, '');
            }
        }
        catch(e)
        {
            updateText(`calcHashAmount${key}1`, '');
            updateText(`calcHashAmount${key}2`, '');
        }
    })
}


// Get price in specified currency
function market_GetCurrencyPriceText(stats, coinsRaw, marketPrices) {
    if (!priceCurrency || !marketPrices[stats.config.coin] || !marketPrices[stats.config.coin][priceCurrency]) return ;
    let priceInCurrency = (Math.trunc(getReadableCoin(stats, coinsRaw, 2, true) * marketPrices[stats.config.coin][priceCurrency] * 100) / 100);
    return  priceInCurrency + ' ' + priceCurrency;
}

function market_InitTemplate(ranOnce, chartsInitialized, loadedData, marketPrices, intervalChartsUpdate, currencyPairs, xhrMarketGets) {
    priceSource = lastStats.config.priceSource || 'cryptonator';
    priceCurrency = lastStats.config.priceCurrency || 'USD';

    let coin = lastStats.config.coin
    if ($(`#blocksTabs li:contains(${coin})`).length == 0) {
        chartsInitialized[coin] = false
        loadedData[coin] = false
        marketPrices[coin] = {}
        let template = $('#siblingTabTemplate').html();
        Mustache.parse(template)
        let rendered = Mustache.render(template, {coin:lastStats.config.coin, symbol:`(${lastStats.config.symbol})`, active:'active'});
        $('#blocksTabs').append(rendered)
        
        let template1 = $('#siblingMarketTemplate').html()
        Mustache.parse(template1)
        let rendered1 = Mustache.render(template1, {coin:coin, active:'active'})
        $(`#tab-content`).append(rendered1)

      
        let template2 = $('#siblingCalculatorTemplate').html()
        Mustache.parse(template2)
        let rendered2 = Mustache.render(template2, {coin:coin})
        $(`#calculator`).append(rendered2)

        updateText(`priceChartCurrency${lastStats.config.coin}`, priceCurrency);
        updateText(`profitChartProfit${lastStats.config.coin}`, priceCurrency);

        if (lastStats.charts && !chartsInitialized[coin]) {
            intervalChartsUpdate[coin] = setInterval(market_CreateCharts(lastStats), 60*1000);
            market_CreateCharts(lastStats);
            chartsInitialized[coin] = true;
        }

    }

   market_LoadMarketData(api, lastStats, loadedData, currencyPairs, xhrMarketGets, marketPrices);


   Object.keys(mergedStats).forEach(key => {
        if ($(`#blocksTabs li:contains(${key})`).length === 0) {
            chartsInitialized[key] = false;
            loadedData[key] = false
            marketPrices[key] = {}
            let template1 = $('#siblingMarketTemplate').html()
            Mustache.parse(template1)
            let rendered1 = Mustache.render(template1, {coin:key})
            $('#tab-content').append(rendered1)

            let template = $('#siblingTabTemplate').html();
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:key, symbol:`(${mergedStats[key].config.symbol})`});
            $('#blocksTabs').append(rendered)

        }

        updateText(`priceChartCurrency${mergedStats[key].config.coin}`, priceCurrency);
        updateText(`profitChartProfit${mergedStats[key].config.coin}`, priceCurrency);

        market_LoadMarketData(mergedApis[key].api, mergedStats[key], loadedData, currencyPairs, xhrMarketGets, marketPrices);

        if (mergedStats[key].charts && !chartsInitialized[key]) {
            intervalChartsUpdate[key] = setInterval(market_CreateCharts(mergedStats[key]), 60*1000);
            market_CreateCharts(mergedStats[key]);
            chartsInitialized[key] = true;
        }

    })

    market_CalcEstimateProfit(marketPrices);

sortElementList($(`#blocksTabs`), $(`#blocksTabs>li`), mergedStats)

   if (!ranOnce) 
        ranOnce = RunOnce()
}

/*
***************************************************************
workerstats methods
***************************************************************
*/

function workerstats_Setup(stats, api, addressTimeout, xhrAddressPoll, xhrGetPayments ) {

    // Enable time ago on last submitted share
    $(`#yourLastShare${stats.config.coin}`).timeago();
    
    $(`#lookUp${stats.config.coin}`).click(function(){
        var address = $(`#yourStatsInput${stats.config.coin}`).val().trim();

        if (getCurrentAddress(stats.config.coin) != address) {
            docCookies.setItem(`mining_address_${stats.config.coin}`, address, Infinity);

            var urlWalletAddress = location.search.split('walletMerged=')[1] || 0;
            if (urlWalletAddress){
                window.location.href = "/#worker_stats";
                return ;
            }
            else {
                docCookies.setItem(`mining_address_${stats.config.coin}`, address, Infinity);
                loadLiveStats(true, mergedStats);
            }
        }

        $(`#addressError${stats.config.coin}, .yourStats${stats.config.coin}, .yourWorkers${stats.config.coin}, .userChart${stats.config.coin}`).hide();
        $(`#workersReport_rows_${stats.config.coin}`).empty();
        $(`#paymentsReport_rows_${stats.config.coin}`).empty();

        $(`#lookUp${stats.config.coin} > span:first-child`).hide();
        $(`#lookUp${stats.config.coin} > span:last-child`).show();


        if (addressTimeout[stats.config.coin]) clearTimeout(addressTimeout[stats.config.coin]);


        if (xhrAddressPoll[stats.config.coin])
            xhrAddressPoll[stats.config.coin].abort();

        $(`#lookUp${stats.config.coin} > span:last-child`).hide();
        $(`#lookUp${stats.config.coin} > span:first-child`).show();

        if (!address){
            $(`#yourStatsInput${stats.config.coin}`).focus();
            return;
        }

        workerstats_FetchAddressStats(false, stats, api, xhrAddressPoll);

    });

    var address = getCurrentAddress(stats.config.coin);
    if (address){
        $(`#yourStatsInput${stats.config.coin}`).val(address);
        $(`#lookUp${stats.config.coin}`).click();
    }
    else {
        $(`#lookUp${stats.config.coin} > span:last-child`).hide();
        $(`#lookUp${stats.config.coin} > span:first-child`).show();
        $(`#addressError${stats.config.coin}, .yourStats${stats.config.coin}, .yourWorkers${stats.config.coin}, .userChart${stats.config.coin}`).hide(); 
    }
    
    $(`#yourStatsInput${stats.config.coin}`).keyup(function(e){
        if(e.keyCode === 13)
            $(`#lookUp${stats.config.coin}`).click();
    });


    // Handle sort on workers table
    //$(`#workersReport${stats.config.coin} th.sort`).on('click', sortTable);
    $(`.workerStats th.sort`).on('click', sortTable);

    // Load more payments button
    $(`#loadMorePayments${stats.config.coin}`).click(function(xhrGetPayments){
        if (xhrGetPayments[stats.config.coin]) 
            xhrGetPayments[stats.config.coin].abort();

        xhrGetPayments[stats.config.coin] = $.ajax({
            url: `${api}/get_payments`,
            data: {
                time: $(`#paymentsReport_rows_${stats.config.coin}`).children().last().data('time'),
                address: address
            },
            dataType: 'json',
            cache: 'false',
            success: function(data){
                workerstats_RenderPayments(data, stats);
            }
        });
    });
}

/**
 * Miner statistics
 **/


// Load current miner statistics

function workerstats_FetchAddressStats(longpoll, stats, api, xhrAddressPoll){
    let address = getCurrentAddress(stats.config.coin)
    xhrAddressPoll[stats.config.coin] = $.ajax({
        url: `${api}/stats_address`,
        data: {
            address: address,
            longpoll: longpoll
        },
        dataType: 'json',
        cache: 'false',
        success: function(data){
            if (!data.stats){
                $(`.yourStats${stats.config.coin}, .yourWorkers${stats.config.coin}, .userChart${stats.config.coin}`).hide();
                $(`#addressError${stats.config.coin}`).text(data.error).show();
                docCookies.setItem(`mining_address_${stats.config.coin}`, '', Infinity);
                loadLiveStats(true);
                return;
            }
            $(`#addressError${stats.config.coin}`).hide();


            if (data.stats.lastShare) {
                $(`#yourLastShare${stats.config.coin}`).timeago('update', new Date(parseInt(data.stats.lastShare) * 1000).toISOString());
            } // AQUÍ
            else {
                updateText(`yourLastShare${stats.config.coin}`, 'Never');
            }


            updateText(`yourHashrateHolder${stats.config.coin}`, (getReadableHashRateString(data.stats.hashrate) || '0 H') + '/sec');
            if ('hashrate_1h' in data.stats) {
                $(`#minerAvgHR${stats.config.coin}`).show();
                updateText(`yourHR1h${stats.config.coin}`, (getReadableHashRateString(data.stats.hashrate_1h) || '0 H') + '/s');
                updateText(`yourHR6h${stats.config.coin}`, (getReadableHashRateString(data.stats.hashrate_6h) || '0 H') + '/s');
                updateText(`yourHR24h${stats.config.coin}`, (getReadableHashRateString(data.stats.hashrate_24h) || '0 H') + '/s');
            } else {
                $(`#minerAvgHR${stats.config.coin}`).hide();
            }

            let totalCoins = data.stats.paid;
            let last24hCoins = 0;
            let last7dCoins = 0;

            for (let i = 0; i < data.payments.length; i += 2) {
                let payment = workerstats_ParsePayment(data.payments[i + 1], data.payments[i]);
                let paymentDate = new Date(parseInt(payment.time) * 1000);
                let daysDiff = moment().diff(moment(paymentDate), 'days');

                if (daysDiff < 1) {
                    last24hCoins = last24hCoins + parseInt(payment.amount);
                }

                if (daysDiff < 7) {
                    last7dCoins = last7dCoins + parseInt(payment.amount);
                }
            }


            // $.getJSON(`https://api.coingecko.com/api/v3/coins/${stats.config.coin.toLowerCase()}?sparkline=true`, function() {})
            //     .done(data => {
            //         let paidTotalUSD = getReadableCoin(stats, totalCoins, 2, true) * data.market_data.current_price.usd;
            //         let paid24hUSD = getReadableCoin(stats, last24hCoins, 2, true) * data.market_data.current_price.usd;
            //         let paid7dUSD = getReadableCoin(stats, last7dCoins, 2, true) * data.market_data.current_price.usd;

            //         updateText(`yourPaid${stats.config.coin}`, `${getReadableCoin(stats, totalCoins)} - $${paidTotalUSD.toFixed(2)}`);
            //         updateText(`paid24h${stats.config.coin}`, `${getReadableCoin(stats, last24hCoins)} - $${paid24hUSD.toFixed(2)}`);
            //         updateText(`paid7d${stats.config.coin}`, `${getReadableCoin(stats, last7dCoins)} - $${paid7dUSD.toFixed(2)}`);
            //     })
            //     .fail(() => {
                    updateText(`yourPaid${stats.config.coin}`, getReadableCoin(stats, totalCoins));
                    updateText(`paid24h${stats.config.coin}`, getReadableCoin(stats, last24hCoins));
                    updateText(`paid7d${stats.config.coin}`, getReadableCoin(stats, last7dCoins));
            //     })




            updateText(`yourHashes${stats.config.coin}`, (data.stats.hashes || 0).toString());
            //updateText(`yourPaid${stats.config.coin}`, getReadableCoin(stats, data.stats.paid));
            updateText(`yourPendingBalance${stats.config.coin}`, getReadableCoin(stats, data.stats.balance));

            let userRoundHashes = parseInt(data.stats.roundHashes || 0);
            let poolRoundHashes = parseInt(stats.pool.roundHashes || 0);
            let userRoundScore = parseFloat(data.stats.roundScore || 0);
            let poolRoundScore = parseFloat(stats.pool.roundScore || 0);
            let lastReward = parseFloat(stats.lastblock.reward || 0);


            let poolFee = stats.config.fee;
            if (Object.keys((stats.config.donation)).length) {
                let totalDonation = 0;
                let ldon = stats.config.donation;
                for(let i in ldon) {
                    totalDonation += ldon[i];
                }
                poolFee += totalDonation;
            }
            let transferFee = stats.config.transferFee;

            let share_pct = userRoundHashes * 100 / poolRoundHashes;
            let score_pct = userRoundScore * 100 / poolRoundScore;
            updateText(`yourRoundShareProportion${stats.config.coin}`, isNaN(share_pct) ? 0.0 : Math.round(share_pct * 1000) / 1000);
            updateText(`yourRoundScoreProportion${stats.config.coin}`, isNaN(score_pct) ? 0.0 : Math.round(score_pct * 1000) / 1000);
            if (!lastStats.config.slushMiningEnabled) {
                $(`#slush_round_info${stats.config.coin}`).hide();
            }

            let payoutEstimatePct = parseFloat(userRoundHashes * 100 / poolRoundHashes)
            let payoutEstimate = Math.round(lastReward * (payoutEstimatePct / 100));
                if (transferFee) payoutEstimate = payoutEstimate - transferFee;
            if (payoutEstimate < 0) 
                payoutEstimate = 0;
            updateText(`yourPayoutEstimate${stats.config.coin}`, getReadableCoin(stats, payoutEstimate));


            workerstats_RenderPayments(data.payments, stats);

            if (data.workers && data.workers.length > 0) {
                workerstats_RenderWorkers(data.workers, stats);
                $(`.yourWorkers${stats.config.coin}`).show();
            }

            $(`.yourStats${stats.config.coin}`).show();
            workerstats_CreateCharts(data, stats);

        },
        error: function(e){
            if (e.statusText === 'abort') return;
            $(`#addressError${stats.config.coin}`).text('Connection error').show();

            if (addressTimeout[stats.config.coin]) 
                clearTimeout(addressTimeout[stats.config.coin]);

            addressTimeout[stats.config.coin] = setTimeout(function(){
                workerstats_FetchAddressStats(false, stats, mergedApis[stats.config.coin].api);
            }, 2000);
        }
    });
}

/**
 * Charts
 **/

// Create charts
function workerstats_CreateCharts(data, stats) {
    if (data.hasOwnProperty("charts")) {
        var graphData = {
            hashrate: workerstats_GetGraphData(stats, data.charts.hashrate),
            payments: workerstats_GetGraphData(stats, data.charts.payments, true)
        };

        for(var graphType in graphData) {
            if(graphData[graphType].values.length > 1) {
                var settings = jQuery.extend({}, graphSettings);
                settings.tooltipValueLookups = {names: graphData[graphType].names};
                var $chart = $(`[data-chart=user_${graphType}_${stats.config.coin}]`).show().find('.chart');
                $chart.sparkline(graphData[graphType].values, settings);
            }
        }
    }
}

// Get chart data
function workerstats_GetGraphData(stats, rawData, fixValueToCoins) {
    var graphData = {
        names: [],
        values: []
    };

    if(rawData) {
        for (var i = 0, xy; xy = rawData[i]; i++) {
            graphData.names.push(new Date(xy[0]*1000).toLocaleString());
            graphData.values.push(fixValueToCoins ? getReadableCoin(stats, xy[1], null, true) : xy[1]);
        }
    }

    return graphData;
}

/**
 * Workers report
 **/

// Get worker row id
function workerstats_GetWorkerRowId(workerName){
    var id = btoa(workerName);
    id = id.replace(/=/, '');
    return id;
}

// Get worker row element
function workerstats_GetWorkerRowElement(worker, jsonString, stats){
    var row = document.createElement('tr');
    row.setAttribute('data-json', jsonString);
    row.setAttribute('data-name', worker.name);
    row.setAttribute('id', 'workerRow' + stats.config.coin + '_' + workerstats_GetWorkerRowId(worker.name));

    row.innerHTML = workerstats_GetWorkerCells(worker);

    return row;
}

// Get worker cells
function workerstats_GetWorkerCells(worker){
    let hashrate = worker.hashrate ? worker.hashrate : 0;
    let  hashrate1h = worker.hashrate_1h || 0;
    let  hashrate6h = worker.hashrate_6h || 0;
    let  hashrate24h = worker.hashrate_24h || 0;
    let lastShare = worker.lastShare ? worker.lastShare : 0;
    let hashes = (worker.hashes || 0).toString();
    let status = (hashrate <= 0) ? 'error' : 'ok';

    return '<td class="col1" data-sort="' + status + '"><i class="fa fa-' + (status == 'ok' ? 'check status-ok' : 'times status-error') + '"></i></td>' +
           '<td class="col2" data-sort="' + (worker.name != 'undefined' ? worker.name : '') + '">' + (worker.name != 'undefined' ? worker.name : '<em>Undefined</em>') + '</td>' +
           '<td class="col3" data-sort="' + hashrate + '">' + getReadableHashRateString(hashrate) + '/s</td>' +
           '<td class="col4 avghr" data-sort="' + hashrate1h + '">' + getReadableHashRateString(hashrate1h) + '/s</td>' +
           '<td class="col5 avghr" data-sort="' + hashrate6h + '">' + getReadableHashRateString(hashrate6h) + '/s</td>' +
           '<td class="col6 avghr" data-sort="' + hashrate24h + '">' + getReadableHashRateString(hashrate24h) + '/s</td>' +
           '<td class="col4" data-sort="' + lastShare + '">' + (lastShare ? $.timeago(new Date(parseInt(lastShare) * 1000).toISOString()) : 'Never') + '</td>' +
           '<td class="col5" data-sort="' + hashes + '">' + hashes + '</td>';
}

// Sort workers
function workerstats_SortWorkers(a, b){
    var aName = a.name.toLowerCase();
    var bName = b.name.toLowerCase();
    return ((aName < bName) ? -1 : ((aName > bName) ? 1 : 0));
}

// Render workers list
function workerstats_RenderWorkers(workersData, stats){
    workersData = workersData.sort(workerstats_SortWorkers);

    var $workersRows = $(`#workersReport_rows_${stats.config.coin}`);

    for (var i = 0; i < workersData.length; i++){
        var existingRow = document.getElementById(`workerRow${stats.config.coin}_${workerstats_GetWorkerRowId(workersData[i].name)}`);
        if (!existingRow){
            $workersRows.empty();
            break;
        }
    }

    let  have_avg_hr = false;

    for (var i = 0; i < workersData.length; i++){
        var worker = workersData[i];
        if (Date.now()/1000 - parseInt(worker.lastShare) > 2 * 86400) continue;
        if (!have_avg_hr && 'hashrate_1h' in worker) have_avg_hr = true;
        var workerJson = JSON.stringify(worker);
        var existingRow = document.getElementById(`workerRow${stats.config.coin}_${workerstats_GetWorkerRowId(worker.name)}`);
        if (existingRow && existingRow.getAttribute('data-json') !== workerJson){
            $(existingRow).replaceWith(workerstats_GetWorkerRowElement(worker, workerJson, stats));
        }
        else if (!existingRow){
            var workerElement = workerstats_GetWorkerRowElement(worker, workerJson, stats);
            $workersRows.append(workerElement);
        }
    }
    if (!have_avg_hr) $(`#workersReport${stats.config.coin} .avghr`).hide();
    else $(`#workersReport${stats.config.coin} .avghr`).show();
}

/**
 * Payments report
 **/

// Parse payment data
function workerstats_ParsePayment(time, serializedPayment){
    var parts = serializedPayment.split(':');
    return {
        time: parseInt(time),
        hash: parts[0],
        amount: parts[1],
        fee: parts[2],
        mixin: parts[3],
        recipients: parts[4]
    };
}

// Get payment row element
function workerstats_GetPaymentRowElement(payment, jsonString, stats){
    var row = document.createElement('tr');
    row.setAttribute('data-json', jsonString);
    row.setAttribute('data-time', payment.time);
    row.setAttribute('id', 'paymentRow' + stats.config.coin + payment.time);

    row.innerHTML = workerstats_GetPaymentCells(payment, stats);

    return row;
}

// Get payment cells
function workerstats_GetPaymentCells(payment, stats){
    return '<td class="col1">' + formatDate(payment.time) + '</td>' +
           '<td class="col2">' + formatPaymentLink(payment.hash, stats) + '</td>' +
           '<td class="col3">' + getReadableCoin(stats, payment.amount) + '</td>' +
           '<td class="col4">' + payment.mixin + '</td>';
}

// Get summary row element
function workerstats_GetSummaryRowElement(summary, jsonString, stats){
    var row = document.createElement('tr');
    row.setAttribute('data-json', jsonString);
    row.setAttribute('data-date', summary.date);
    row.setAttribute('id', 'summaryRow' + stats.config.coin + summary.date);
    row.setAttribute('class', 'summary');

    row.innerHTML = workerstats_GetSummaryCells(summary, stats);

    return row;
}

// Get summary cells
function workerstats_GetSummaryCells(summary, stats){
    var text = getTranslation('paymentSummaryMulti') ? getTranslation('paymentSummaryMulti') : 'On %DATE% you have received %AMOUNT% in %COUNT% payments';
    if (summary.count <= 1) text = getTranslation('paymentSummarySingle') ? getTranslation('paymentSummarySingle') : 'On %DATE% you have received %AMOUNT%';
    text = text.replace(/%DATE%/g, summary.date);
    text = text.replace(/%COUNT%/g, summary.count);
    text = text.replace(/%AMOUNT%/g, getReadableCoin(stats, summary.amount));
    return '<td colspan="4">' + text + '</td>';
}

// Render payments
function workerstats_RenderPayments(paymentsResults, stats){
    var $paymentsRows = $(`#paymentsReport_rows_${stats.config.coin}`);
    var lastPaymentDate = null;
    var summaryData = { date: null, time: null, count: 0, amount: 0 };
    for (var i = 0; i < paymentsResults.length; i += 2){
        var payment = workerstats_ParsePayment(paymentsResults[i + 1], paymentsResults[i]);
        var paymentJson = JSON.stringify(payment);
        var paymentElement = workerstats_GetPaymentRowElement(payment, paymentJson, stats);

        var paymentDate = new Date(parseInt(payment.time) * 1000).toLocaleDateString();
        if (!lastPaymentDate || lastPaymentDate && paymentDate != lastPaymentDate) {
            summaryData = { date: paymentDate, time: payment.time, count: 0, amount: 0 };
        }

        var existingRow = document.getElementById(`paymentRow${stats.config.coin}${payment.time}`);
        if (existingRow && existingRow.getAttribute('data-json') !== paymentJson){
            $(existingRow).replaceWith(workerstats_GetPaymentRowElement(payment, paymentJson, stats));
        }
        else if (!existingRow){
            var inserted = false;
            var rows = $paymentsRows.children().get();
            for (var f = 0; f < rows.length; f++) {
                var pTime = parseInt(rows[f].getAttribute('data-time'));
                if (pTime && pTime < payment.time){
                    inserted = true;
                    $(rows[f]).before(paymentElement);
                    break;
                }
            }
            if (!inserted) {
                $paymentsRows.append(paymentElement);
            }
        }

        summaryData.count ++;
        summaryData.amount += parseInt(payment.amount);

        var summaryJson = JSON.stringify(summaryData);
        var summaryElement = workerstats_GetSummaryRowElement(summaryData, summaryJson, stats);

        var existingSummary = document.getElementById(`summaryRow${stats.config.coin}${summaryData.date}`);
        if (existingSummary && existingSummary.getAttribute('data-json') !== summaryJson){
            $(existingSummary).replaceWith(summaryElement);
        }
        else if (!existingSummary){
            var inserted = false;
            var rows = $paymentsRows.children().get();
            for (var f = 0; f < rows.length; f++) {
                var pTime = parseInt(rows[f].getAttribute('data-time'));
                if (pTime && pTime === summaryData.time){
                    inserted = true;
                    $(rows[f]).before(summaryElement);
                    break;
                }
            }
            if (!inserted) {
                $paymentsRows.append(summaryElement);
            }
        }
        lastPaymentDate = paymentDate;
    }
}

function workerstats_InitTemplate(ranOnce, addressTimeout, xhrAddressPoll, xhrGetPayments ) {
    let coin = lastStats.config.coin
    if ($(`#blocksTabs li:contains(${coin})`).length === 0) {
      let template = $('#siblingTabTemplate').html();
      Mustache.parse(template)
      let rendered = Mustache.render(template, {coin:lastStats.config.coin, symbol:`(${lastStats.config.symbol})`, active: 'active'});
      $('#blocksTabs').append(rendered)

      template = $('#siblingTemplate').html()
      Mustache.parse(template)
      rendered = Mustache.render(template, {coin:coin, active: 'active'})
      $('#tab-content').append(rendered)
      workerstats_Setup(lastStats, api, addressTimeout, xhrAddressPoll, xhrGetPayments)       
    }

    Object.keys(mergedStats).forEach(key => {
        if ($(`#blocksTabs li:contains(${key})`).length === 0) {
            coin = key
            let template = $('#siblingTabTemplate').html();
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:mergedStats[key].config.coin, symbol:`(${mergedStats[key].config.symbol})`});
            $('#blocksTabs').append(rendered)

            template = $('#siblingTemplate').html()
            Mustache.parse(template)
            rendered = Mustache.render(template, {coin:coin})
            $('#tab-content').append(rendered)
            workerstats_Setup(mergedStats[key], mergedApis[key].api, addressTimeout, xhrAddressPoll, xhrGetPayments)
        }
    })

    sortElementList($(`#blocksTabs`), $(`#blocksTabs>li`), mergedStats)

    if (!ranOnce) 
        ranOnce = RunOnce()    
}


/*
***************************************************************
workerstats methods
***************************************************************
*/

let home_GraphSettings = {
    type: 'line',
    width: '100%',
    height: '140',
    lineColor: '#03a9f4',
    fillColor: 'rgba(3, 169, 244, .4)',
    spotColor: null,
    minSpotColor: null,
    maxSpotColor: null,
    highlightLineColor: '#236d26',
    spotRadius: 3,
    chartRangeMin: 0,
    drawNormalOnTop: false,
    tooltipFormat: '<b>{{y}}</b> &ndash; {{offset:names}}'
};

function home_CreateCharts(data) {
    if (data.hasOwnProperty("charts")) {
        var graphData = {
            hashrate: home_GetGraphData(data.charts.hashrate),
            diff: home_GetGraphData(data.charts.difficulty),
            miners: home_GetGraphData(data.charts.miners),
            workers: home_GetGraphData(data.charts.workers)
        };

        for(var graphType in graphData) {
            if(graphData[graphType].values.length > 1) {
                var settings = jQuery.extend({}, home_GraphSettings);
                settings.tooltipValueLookups = {names: graphData[graphType].names};
                var $chart = $('[data-chart=' + graphType + '] .chart');
                $chart.closest('.poolChart').show();
                $chart.sparkline(graphData[graphType].values, settings);
            }
        }
    }
}

// Get chart data
function home_GetGraphData(rawData, fixValueToCoins) {
    var graphData = {
        names: [],
        values: []
    };
    if(rawData) {
        for (var i = 0, xy; xy = rawData[i]; i++) {
            graphData.names.push(new Date(xy[0]*1000).toLocaleString());
            graphData.values.push(fixValueToCoins ? getReadableCoin(lastStats, xy[1], null, true) : xy[1]);
        }
    }

    return graphData;
}

function home_GenerateNetworkStats(key, symbol) {
    if ($(`#networkStats${key}`).length == 0) {
        let template = $('#siblingTemplate').html()
        if (template) {
            Mustache.parse(template)
            let rendered = Mustache.render(template, {coin:key, symbol: symbol})
            $(`#networkStats`).append(rendered)
        }
    }
}

function sortElementList(container, siblings,  stats) {
    let sorted = (a,b) => {
        return ((a.id.toLowerCase() < b.id.toLowerCase()) ? -1 : ((a.id.toLowerCase() > b.id.toLowerCase()) ? 1 : 0))
    }
    if (stats && siblings.length -1 === Object.keys(stats).length) {
        siblings.sort(sorted).appendTo(container)
    }
}


function home_InitTemplate(parentStats, siblingStats) {
    $('#networkLastBlockFound').timeago('update', new Date(parentStats.lastblock.timestamp * 1000).toISOString());

    let coin = parentStats.config.coin
    let minerInfo = []
    let efforts = []

    if ($(`#networkStats${coin}`).length == 0) {
        minerInfo.push({blocks: parentStats.pool.totalBlocks.toString(), 
                        blocksSolo: parentStats.pool.totalBlocksSolo.toString(),
                        coin: coin, 
                        symbol: parentStats.config.symbol, 
                        miners: parentStats.pool.miners.toString(),
                        minersSolo: parentStats.pool.minersSolo.toString()})
        
        efforts.push({coin: coin, effort: `${(parentStats.pool.roundHashes / parentStats.network.difficulty * 100).toFixed(1)}%`,symbol: parentStats.config.symbol})
        
        let template = $('#siblingTemplate').html()
        Mustache.parse(template)
        let rendered = Mustache.render(template, {coin: coin, symbol: parentStats.config.symbol})
        $(`#networkStats`).append(rendered)
    }

    let lastBlockFound = null
    if (parentStats.pool.lastBlockFound) {
        lastBlockFound = parseInt(parentStats.pool.lastBlockFound);
    }


    updateText(`networkHashrate${coin}`, getReadableHashRateString(parentStats.network.difficulty / parentStats.config.coinDifficultyTarget) + '/sec');
    updateText(`networkDifficulty${coin}`, formatNumber(parentStats.network.difficulty.toString(), ' '));
    updateText(`blockchainHeight${coin}`, formatNumber(parentStats.network.height.toString(), ' '));
    updateText(`networkLastReward${coin}`, getReadableCoin(parentStats, parentStats.lastblock.reward));



    Object.keys(siblingStats).forEach(key => {
        home_GenerateNetworkStats(key, siblingStats[key].config.symbol)
        
        minerInfo.push({blocks: siblingStats[key].pool.totalBlocks.toString(), 
                        blocksSolo: siblingStats[key].pool.totalBlocksSolo.toString(),
                        coin: key,
                        symbol: siblingStats[key].config.symbol, 
                        miners: siblingStats[key].pool.miners.toString(),
                        minersSolo: siblingStats[key].pool.minersSolo.toString()})
        
        efforts.push({coin: key, effort: `${(siblingStats[key].pool.roundHashes / siblingStats[key].network.difficulty * 100).toFixed(1)}%`, symbol: siblingStats[key].config.symbol});     

        if (siblingStats[key].pool.lastBlockFound) {
            let lastChildBlockFound = parseInt(siblingStats[key].pool.lastBlockFound)
            if (lastChildBlockFound > lastBlockFound)
                lastBlockFound = lastChildBlockFound
        }

        updateText(`networkHashrate${key}`, getReadableHashRateString(siblingStats[key].network.difficulty / siblingStats[key].config.coinDifficultyTarget) + '/sec');
        updateText(`networkDifficulty${key}`, formatNumber(siblingStats[key].network.difficulty.toString(), ' '));
        updateText(`blockchainHeight${key}`, formatNumber(siblingStats[key].network.height.toString(), ' '));
        updateText(`networkLastReward${key}`, getReadableCoin(siblingStats[key], siblingStats[key].lastblock.reward));
        updateText(`poolMiners${key}`, `${siblingStats[key].pool.miners}/${siblingStats[key].pool.minersSolo}`);
        updateText(`blocksTotal${key}`, `${siblingStats[key].pool.totalBlocks}/${siblingStats[key].pool.totalBlocksSolo}`);
        updateText(`currentEffort${key}`, (siblingStats[key].pool.roundHashes / siblingStats[key].network.difficulty * 100).toFixed(1) + '%');
    })

    sortElementList($(`#networkStats`), $(`#networkStats>div`), siblingStats)
    
    if ($(`#poolDetails > div`).length == 0) {
        let template = $('#poolDetailTemplate').html()
        Mustache.parse(template)
        let rendered = Mustache.render(template, {coin:parentStats.config.coin, symbol: parentStats.config.symbol, blocks: minerInfo})
        $(`#poolDetails`).append(rendered)
    }

    if ($(`#mainPoolStats > div`).length == 0) {
        let template = $('#mainPoolTemplate').html()
        Mustache.parse(template)
        let rendered = Mustache.render(template, {coin:parentStats.config.coin, blocks: minerInfo, efforts: efforts})
        $(`#mainPoolStats`).append(rendered)
    }
    

    if (lastBlockFound) {
        $('#poolLastBlockFound').timeago('update', new Date(lastBlockFound).toISOString());
    }
    else {
        $('#poolLastBlockFound').removeAttr('title').data('ts', '').update('Never');
    }

    let lastHash = updateText('lastHash', parentStats.lastblock.hash)
    if (lastHash)
        lastHash.setAttribute('href', getBlockchainUrl(parentStats.lastblock.hash, parentStats));


    updateText('poolHashrate', `PROP: ${getReadableHashRateString(parentStats.pool.hashrate)}/sec`);
    updateText('poolHashrateSolo', `SOLO: ${getReadableHashRateString(parentStats.pool.hashrateSolo)}/sec`);


    var hashPowerSolo = parentStats.pool.hashrateSolo / (parentStats.network.difficulty / parentStats.config.coinDifficultyTarget) * 100;
    updateText ('hashPowerSolo', hashPowerSolo.toFixed(2) + '%');

    var hashPower = parentStats.pool.hashrate / (parentStats.network.difficulty / parentStats.config.coinDifficultyTarget) * 100;
    updateText('hashPower', hashPower.toFixed(2) + '%');


    updateText(`poolMiners${coin}`, `${parentStats.pool.miners}/${parentStats.pool.minersSolo}`);
    updateText('blocksTotal', `${parentStats.pool.totalBlocks}/${parentStats.pool.totalBlocksSolo}`);


    var totalFee = parentStats.config.fee;
    if (Object.keys(parentStats.config.donation).length) {
        var totalDonation = 0;
        for(var i in parentStats.config.donation) {
            totalDonation += parentStats.config.donation[i];
        }
        totalFee += totalDonation;
    }

    updateText('poolFee', (totalFee > 0 && totalFee != 100 ? floatToString(totalFee) : (totalFee == 100 ? '100' : '0')) + '%');

    updateText('paymentsInterval', getReadableTime(parentStats.config.paymentsInterval));
    updateText('paymentsMinimum', getReadableCoin(parentStats, parentStats.config.minPaymentThreshold));

    updateText('blockSolvedTime', getReadableTime(parentStats.network.difficulty / parentStats.pool.hashrate));

    updateText(`currentEffort${coin}`, (parentStats.pool.roundHashes / parentStats.network.difficulty * 100).toFixed(1) + '%');
}
