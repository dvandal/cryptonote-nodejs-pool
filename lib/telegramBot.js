/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Telegram bot
 *
 * Author: Daniel Vandal
 **/

// Load required modules
process.env.NTBA_FIX_319 = 1;
let TelegramBot = require('node-telegram-bot-api');

let timeAgo = require('time-ago');

let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
let notifications = require('./notifications.js');
let utils = require('./utils.js');

// Initialize log system
let logSystem = 'telegramBot';
require('./exceptionWriter.js')(logSystem);

/**
 * Check telegram configuration
 **/

// Check bot settings
if (!config.telegram) {
	log('error', logSystem, 'Telegram is not enabled');
} else if (!config.telegram.enabled) {
	log('error', logSystem, 'Telegram is not enabled');
} else if (!config.telegram.token) {
	log('error', logSystem, 'No telegram token found in configuration');
}

// Bot commands
let botCommands = {
	stats: "/stats",
	report: "/report",
	notify: "/notify",
	blocks: "/blocks"
}

if (config.telegram.botCommands) {
	Object.assign(botCommands, config.telegram.botCommands);
}

// Telegram channel
let channel = config.telegram.channel.replace(/@/g, '') || '';

// Periodical channel statistics
let periodicalStats = (channel && config.telegram.channelStats && config.telegram.channelStats.enabled)
let statsInterval = (config.telegram.channelStats && config.telegram.channelStats.interval > 0) ? parseInt(config.telegram.channelStats.interval) : 0;

/**
 * Initialize new telegram bot
 **/

log('info', logSystem, 'Started');

let token = config.telegram.token;
let bot = new TelegramBot(token, {
	polling: true
});

/**
 * Periodical pool statistics
 **/

if (periodicalStats && statsInterval > 0 && channel) {
	log('info', logSystem, 'Sending pool statistics to telegram channel @%s each %d minutes', [channel, statsInterval]);
	setInterval(function () {
		sendPoolStats('@' + channel);
	}, (statsInterval * 60) * 1000);
}

/**
 * Handle "/start" or "/help"
 **/

bot.onText(new RegExp('^/(start|help)$', 'i'), (telegramMsg) => {
	if (telegramMsg.from.id != telegramMsg.chat.id) return;

	log('info', logSystem, 'Commands list request from @%s (%s)', [telegramMsg.from.username, telegramMsg.from.id]);

	let message = 'Hi @' + telegramMsg.from.username + ',\n\n' +
		'Here are the commands you can use:\n\n' +
		'Pool statistics: ' + botCommands['stats'] + '\n' +
		'Blocks notifications: ' + botCommands['blocks'] + '\n' +
		'Miner statistics: ' + botCommands['report'] + ' _address_\n' +
		'Miner notifications: ' + botCommands['notify'] + ' _address_\n\n' +
		'Thank you!';

	bot.sendMessage(telegramMsg.from.id, message, {
		parse_mode: 'Markdown'
	});
});

/**
 * Pool Statistics
 **/

bot.onText(new RegExp('^' + botCommands['stats'] + '$', 'i'), (telegramMsg) => {
	log('info', logSystem, 'Pool statistics request from @%s (%s)', [telegramMsg.from.username, telegramMsg.from.id]);
	sendPoolStats(telegramMsg.chat.id);
});

function sendPoolStats (chatId) {
	apiInterfaces.pool('/stats', function (error, stats) {
		if (error || !stats) {
			log('error', logSystem, 'Unable to get API data for stats: ' + error);
			return bot.sendMessage(id, 'Unable to get pool statistics. Please retry.');
		}

		let poolHost = config.poolHost || "Pool";
		let poolHashrate = utils.getReadableHashRate(stats.pool.hashrate);
		let poolMiners = stats.pool.miners || 0;
		let poolWorkers = stats.pool.workers || 0;
		let poolBlocks = stats.pool.totalBlocks || 0;
		let poolLastBlock = (stats.pool.lastBlockFound) ? timeAgo.ago(new Date(parseInt(stats.pool.lastBlockFound))) : 'Never';

		let networkHashrate = utils.getReadableHashRate(stats.network.difficulty / stats.config.coinDifficultyTarget);
		let networkDiff = stats.network.difficulty || 'N/A';
		let networkHeight = stats.network.height || 'N/A';
		let networkLastReward = utils.getReadableCoins(stats.lastblock.reward);
		let networkLastBlock = (stats.lastblock.timestamp) ? timeAgo.ago(new Date(parseInt(stats.lastblock.timestamp * 1000))) : 'Never';

		let currentEffort = stats.pool.roundHashes ? (stats.pool.roundHashes / stats.network.difficulty * 100)
			.toFixed(1) + '%' : '0%';

		let response = '';
		response += '*' + poolHost + '*\n';
		response += 'Hashrate: ' + poolHashrate + '\n';
		response += 'Connected Miners: ' + poolMiners + '\n';
		response += 'Active Workers: ' + poolWorkers + '\n';
		response += 'Blocks Found: ' + poolBlocks + '\n';
		response += 'Last Block: ' + poolLastBlock + '\n';
		response += 'Current Effort: ' + currentEffort + '\n';
		response += '\n';
		response += '*Network*\n';
		response += 'Hashrate: ' + networkHashrate + '\n';
		response += 'Difficulty: ' + networkDiff + '\n';
		response += 'Block Height: ' + networkHeight + '\n';
		response += 'Block Found: ' + networkLastBlock + '\n';
		response += 'Last Reward: ' + networkLastReward;

		return bot.sendMessage(chatId, response, {
			parse_mode: 'Markdown'
		});
	});
}

/**
 * Miner Statistics
 **/

bot.onText(new RegExp('^' + botCommands['report'] + '$', 'i'), (telegramMsg) => {
	if (telegramMsg.from.id != telegramMsg.chat.id) return;

	let apiRequest = '/get_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=default';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (response.address) {
			sendMinerStats(telegramMsg, response.address);
		} else {
			let message = 'To display miner report you need to specify the miner address on first request';
			bot.sendMessage(telegramMsg.from.id, message, {
				parse_mode: 'Markdown'
			});
		}
	});
});

bot.onText(new RegExp('^' + botCommands['report'] + ' (.*)$', 'i'), (telegramMsg, match) => {
	if (telegramMsg.from.id != telegramMsg.chat.id) return;

	let address = (match && match[1]) ? match[1].trim() : '';
	if (!address || address == '') {
		return bot.sendMessage(telegramMsg.from.id, 'No address specified!');
	}

	sendMinerStats(telegramMsg, address);
});

function sendMinerStats (telegramMsg, address) {
	log('info', logSystem, 'Miner report request from @%s (%s) for address: %s', [telegramMsg.from.username, telegramMsg.from.id, address]);
	apiInterfaces.pool('/stats_address?address=' + address, function (error, data) {
		if (error || !data) {
			log('error', logSystem, 'Unable to get API data for miner stats: ' + error);
			return bot.sendMessage(telegramMsg.from.id, 'Unable to get miner statistics. Please retry.');
		}
		if (!data.stats) {
			return bot.sendMessage(telegramMsg.from.id, 'No miner statistics found for that address. Please check the address and try again.');
		}

		let minerHashrate = utils.getReadableHashRate(data.stats.hashrate);
		let minerBalance = utils.getReadableCoins(data.stats.balance);
		let minerPaid = utils.getReadableCoins(data.stats.paid);
		let minerLastShare = timeAgo.ago(new Date(parseInt(data.stats.lastShare * 1000)));

		let response = '*Report for ' + address.substring(0, 7) + '...' + address.substring(address.length - 7) + '*\n';
		response += 'Hashrate: ' + minerHashrate + '\n';
		response += 'Last share: ' + minerLastShare + '\n';
		response += 'Balance: ' + minerBalance + '\n';
		response += 'Paid: ' + minerPaid + '\n';
		if (data.workers && data.workers.length > 0) {
			let f = true;
			for (let i in data.workers) {
				if (!data.workers[i] || !data.workers[i].hashrate || data.workers[i].hashrate === 0) continue;
				if (f) {
					response += '\n';
					response += '*Active Workers*\n';
				}
				let workerName = data.workers[i].name;
				let workerHashrate = utils.getReadableHashRate(data.workers[i].hashrate);
				response += workerName + ': ' + workerHashrate + '\n';
				f = false;
			}
		}
		bot.sendMessage(telegramMsg.from.id, response, {
			parse_mode: 'Markdown'
		});

		let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=default&address=' + address;
		apiInterfaces.pool(apiRequest, function (error, response) {});
	});
}

/**
 * Miner notifications
 **/

bot.onText(new RegExp('^' + botCommands['notify'] + '$', 'i'), (telegramMsg) => {
	if (telegramMsg.from.id != telegramMsg.chat.id) return;

	let apiRequest = '/get_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=default';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (response.address) {
			toggleMinerNotifications(telegramMsg, response.address);
		} else {
			let message = 'To enable or disable notifications you need to specify the miner address on first request';
			bot.sendMessage(telegramMsg.from.id, message, {
				parse_mode: 'Markdown'
			});
		}
	});
});

bot.onText(new RegExp('^' + botCommands['notify'] + ' (.*)$', 'i'), (telegramMsg, match) => {
	if (telegramMsg.from.id != telegramMsg.chat.id) return;

	let address = (match && match[1]) ? match[1].trim() : '';
	if (!address || address == '') {
		return bot.sendMessage(telegramMsg.from.id, 'No address specified!');
	}

	toggleMinerNotifications(telegramMsg, address);
});

function toggleMinerNotifications (telegramMsg, address) {
	let apiRequest = '/get_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=miner&address=' + address;
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (response.chatId && response.chatId == telegramMsg.from.id) {
			disableMinerNotifications(telegramMsg, address);
		} else {
			enableMinerNotifications(telegramMsg, address);
		}
	});
}

function enableMinerNotifications (telegramMsg, address) {
	log('info', logSystem, 'Enable miner notifications to @%s (%s) for address: %s', [telegramMsg.from.username, telegramMsg.from.id, address]);
	let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=miner&address=' + address + '&action=enable';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (error) {
			log('error', logSystem, 'Unable to enable telegram notifications: ' + error);
			return bot.sendMessage(telegramMsg.from.id, 'An error occurred. Please retry.');
		}
		if (response.status != 'done') {
			return bot.sendMessage(telegramMsg.from.id, response.status);
		}

		bot.sendMessage(telegramMsg.from.id, 'Miner notifications enabled for ' + address.substring(0, 7) + '...' + address.substring(address.length - 7));

		let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=default&address=' + address;
		apiInterfaces.pool(apiRequest, function (error, response) {});
	});
}

function disableMinerNotifications (telegramMsg, address) {
	log('info', logSystem, 'Disable miner notifications to @%s (%s) for address: %s', [telegramMsg.from.username, telegramMsg.from.id, address]);
	let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=miner&address=' + address + '&action=disable';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (error) {
			log('error', logSystem, 'Unable to disable telegram notifications: ' + error);
			return bot.sendMessage(telegramMsg.from.id, 'An error occurred. Please retry.');
		}
		if (response.status != 'done') {
			return bot.sendMessage(telegramMsg.from.id, response.status);
		}

		bot.sendMessage(telegramMsg.from.id, 'Miner notifications disabled for ' + address.substring(0, 7) + '...' + address.substring(address.length - 7));

		let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=default&address=' + address;
		apiInterfaces.pool(apiRequest, function (error, response) {});
	});
}

/**
 * Blocks notifications
 **/

bot.onText(new RegExp('^' + botCommands['blocks'] + '$', 'i'), (telegramMsg) => {
	if (telegramMsg.from.id != telegramMsg.chat.id) return;
	toggleBlocksNotifications(telegramMsg);
});

function toggleBlocksNotifications (telegramMsg) {
	let apiRequest = '/get_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=blocks';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (error) {
			return bot.sendMessage(telegramMsg.from.id, 'An error occurred. Please retry.');
		}
		if (response.enabled) {
			disableBlocksNotifications(telegramMsg);
		} else {
			enableBlocksNotifications(telegramMsg);
		}
	});
}

function enableBlocksNotifications (telegramMsg) {
	log('info', logSystem, 'Enable blocks notifications to @%s (%s)', [telegramMsg.from.username, telegramMsg.from.id]);
	let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=blocks&action=enable';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (error) {
			log('error', logSystem, 'Unable to enable telegram notifications: ' + error);
			return bot.sendMessage(telegramMsg.from.id, 'An error occurred. Please retry.');
		}
		if (response.status != 'done') {
			return bot.sendMessage(telegramMsg.from.id, response.status);
		}
		return bot.sendMessage(telegramMsg.from.id, 'Blocks notifications enabled');
	});
}

function disableBlocksNotifications (telegramMsg) {
	log('info', logSystem, 'Disable blocks notifications to @%s (%s)', [telegramMsg.from.username, telegramMsg.from.id]);
	let apiRequest = '/set_telegram_notifications?chatId=' + telegramMsg.from.id + '&type=blocks&action=disable';
	apiInterfaces.pool(apiRequest, function (error, response) {
		if (error) {
			log('error', logSystem, 'Unable to disable telegram notifications: ' + error);
			return bot.sendMessage(telegramMsg.from.id, 'An error occurred. Please retry.');
		}
		if (response.status != 'done') {
			return bot.sendMessage(telegramMsg.from.id, response.status);
		}
		return bot.sendMessage(telegramMsg.from.id, 'Blocks notifications disabled');
	});
}
