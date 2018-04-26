var fs = require('fs');

var configFile = (function(){
    for (var i = 0; i < process.argv.length; i++){
        if (process.argv[i].indexOf('-config=') === 0)
            return process.argv[i].split('=')[1];
    }
    return 'config.json';
})();


try {
    global.config = JSON.parse(fs.readFileSync(configFile));
    //Enable db to be selected
    if(!global.config.redis.db){
		global.config.redis.db = 0;	
	}
    
}catch(e){
    console.error('Failed to read config file ' + configFile + '\n\n' + e);
    return;
}

var donationAddresses = {
    devDonation: {
	   BTC: '3Kp1tkDfEshZDPfizTfVVJB86VmXmUMRqA',
        XTL: 'Se2ef2vWfM5je9M9p9RXnb3YG1Bxm7eLJb4np1TdJmbTfo5VAo43g2EFikEG7wenV2BihjyWmoDL1efXafFfDJoE2GcxJtvH7',
    }
};

global.donations = {};

for(var configOption in donationAddresses) {
    var percent = config.blockUnlocker[configOption];
    var wallet = donationAddresses[configOption][config.symbol];
    if(percent && wallet) {
        global.donations[wallet] = percent;
    }
}

global.version = "v1.2.7.3";
