// Store last pool statistics
var lastStats;

// Get current miner address
function getCurrentAddress() {
    var urlWalletAddress = location.search.split('wallet=')[1] || 0;
    var address = urlWalletAddress || docCookies.getItem('mining_address');
    return address;
}

// Pulse live update
function pulseLiveUpdate(){
    var stats_update = document.getElementById('statsUpdated');
    stats_update.style.transition = 'opacity 100ms ease-out';
    stats_update.style.opacity = 1;
    setTimeout(function(){
        stats_update.style.transition = 'opacity 7000ms linear';
        stats_update.style.opacity = 0;
    }, 500);
}

// Update live informations
function updateLiveStats(data) {
    pulseLiveUpdate();   
    lastStats = data;
    if (lastStats && lastStats.pool && lastStats.pool.totalMinersPaid.toString() == '-1'){
        lastStats.pool.totalMinersPaid = 0;
    }
    updateIndex();
    if (currentPage) currentPage.update();
}

// Update global informations
function updateIndex(){
    updateText('coinSymbol', lastStats.config.symbol);
    updateText('g_networkHashrate', getReadableHashRateString(lastStats.network.difficulty / lastStats.config.coinDifficultyTarget) + '/sec');
    updateText('g_poolHashrate', getReadableHashRateString(lastStats.pool.hashrate) + '/sec');    
    if (lastStats.miner && lastStats.miner.hashrate){
         updateText('g_userHashrate', getReadableHashRateString(lastStats.miner.hashrate) + '/sec');
    }
    else{
        updateText('g_userHashrate', 'N/A');
    }    
    updateText('poolVersion', lastStats.config.version);
}

// Load live statistics
function loadLiveStats(reload) {
    var apiURL = api + '/stats';
    
    var address = getCurrentAddress();
    if (address) { apiURL = apiURL + '?address=' + encodeURIComponent(address); }

    if (xhrLiveStats) xhrLiveStats.abort();
    
    $.get(apiURL, function(data){        
        updateLiveStats(data);
        if (!reload) routePage(fetchLiveStats);
    });
}

// Fetch live statistics
var xhrLiveStats;
function fetchLiveStats() {
    var apiURL = api + '/live_stats';

    var address = getCurrentAddress();
    if (address) { apiURL = apiURL + '?address=' + encodeURIComponent(address); }
    
    xhrLiveStats = $.ajax({
        url: apiURL,
        dataType: 'json',
        cache: 'false'
    }).done(function(data){
        updateLiveStats(data);
    }).always(function(){
        fetchLiveStats();
    });
}

// Initialize
$(function(){
    
    // Add support informations to menu    
    if (typeof telegram !== 'undefined' && telegram) {
        $('#menu-content').append('<li><a target="_new" href="'+telegram+'"><i class="fa fa-telegram"></i> <span tkey="telegram">Telegram group</span></a></li>');
    }
    if (typeof discord !== 'undefined' && discord) {
        $('#menu-content').append('<li><a target="_new" href="'+discord+'"><i class="fab fa-discord"></i> <span tkey="discord">Discord</span></a></li>');
    }
    if (typeof email !== 'undefined' && email) {
        $('#menu-content').append('<li><a target="_new" href="mailto:'+email+'"><i class="fa fa-envelope"></i> <span tkey="contactUs">Contact Us</span></a></li>');
    }
    if (typeof langs !== 'undefined' && langs) {
        $('#menu-content').append('<div id="mLangSelector"></div>');
	renderLangSelector();
    }
	
    // Load live statistics for the first time
    loadLiveStats();
});
