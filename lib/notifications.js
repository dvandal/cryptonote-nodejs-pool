/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Notifications system
 * Supports: email, telegram
 *
 * Author: Daniel Vandal
 **/

// Load required modules
let fs = require('fs');

let emailSystem = require('./email.js');
let telegram = require('./telegram.js');
let utils = require('./utils.js');

// Initialize log system
let logSystem = 'notifications';
require('./exceptionWriter.js')(logSystem);

// Load notification settings
let notificationSettings = {
	emailTemplate: "email/template.txt",
	emailSubject: {
		emailAdded: "Your email was registered",
		workerConnected: "Worker %WORKER_NAME% connected",
		workerTimeout: "Worker %WORKER_NAME% stopped hashing",
		workerBanned: "Worker %WORKER_NAME% banned",
		blockFound: "Block %HEIGHT% found !",
		blockUnlocked: "Block %HEIGHT% unlocked !",
		blockOrphaned: "Block %HEIGHT% orphaned !",
		payment: "We sent you a payment !"
	},
	emailMessage: {
		emailAdded: "Your email has been registered to receive pool notifications.",
		workerConnected: "Your worker %WORKER_NAME% is now connected.",
		workerTimeout: "Your worker %WORKER_NAME% has stopped submitting hashes on %LAST_HASH%.",
		workerBanned: "Your worker %WORKER_NAME% has been banned.",
		blockFound: "Block found at height %HEIGHT% by miner %MINER% on %TIME%. Waiting maturity.",
		blockUnlocked: "Block mined at %HEIGHT% with %REWARD% and %EFFORT% effort on %TIME%.",
		blockOrphaned: "Block orphaned at height %HEIGHT% :(",
		payment: "A payment of %AMOUNT% has been sent to %ADDRESS% wallet."
	},
	telegramMessage: {
		workerConnected: "Your worker _%WORKER_NAME%_ is now connected.",
		workerTimeout: "Your worker _%WORKER_NAME%_ has stopped submitting hashes on _%LAST_HASH%_.",
		workerBanned: "Your worker _%WORKER_NAME%_ has been banned.",
		blockFound: "*Block found at height _%HEIGHT%_ by miner _%MINER%_. Waiting maturity.*",
		blockUnlocked: "*Block mined at _%HEIGHT%_ with _%REWARD%_ and _%EFFORT%_ effort on _%TIME%_.*",
		blockOrphaned: "*Block orphaned at height _%HEIGHT%_ :(*",
		payment: "A payment of _%AMOUNT%_ has been sent."
	}
};

if (config.notifications) {
	Object.assign(notificationSettings, config.notifications);
}

// Test notification message
notificationSettings.emailSubject['test'] = "Test notification";
notificationSettings.emailMessage['test'] = "This is a test notification from the pool.";
notificationSettings.telegramMessage['test'] = "This is a test notification from the pool.";

/**
 * Send global notification
 **/
exports.sendToAll = function (id, variables) {
	// Send telegram to channel
	sendToTelegramChannel(id, variables);

	// Send blocks notifications to telegram
	if (id === "blockFound" || id === "blockUnlocked" || id === "blockOrphaned") {
		sendBlockTelegram(id, variables);
	}

	// Send to all pool email addresses
	sendToAllEmails(id, variables);
}

/**
 * Send miner notification
 **/
exports.sendToMiner = function (miner, id, variables) {
	// Send telegram
	sendToMinerTelegram(miner, id, variables);

	// Send email
	sendToMinerEmail(miner, id, variables);
}

/**
 * Send telegram channel notification
 **/
function sendToTelegramChannel (id, variables) {
	// Set custom variables
	variables = setCustomVariables(variables);

	// Send notification
	if (config.telegram && config.telegram.enabled) {
		let message = getTelegramMessage(id, variables);
		if (!message || message === '') {
			log('info', logSystem, 'Notification disabled for %s: empty telegram message.', [id]);
			return;
		}

		let channel = config.telegram.channel.replace(/@/g, '') || '';
		if (!channel) {
			log('error', logSystem, 'No telegram channel specified in configuration!');
			return;
		}

		let chatId = '@' + channel;
		telegram.sendMessage(chatId, message);
	}
}
exports.sendToTelegramChannel = sendToTelegramChannel;

/**
 * Send telegram to miner in private message
 **/
function sendToMinerTelegram (miner, id, variables) {
	// Set custom variables
	variables = setCustomVariables(variables);

	// Send telegram
	if (config.telegram && config.telegram.enabled) {
		let message = getTelegramMessage(id, variables);
		if (!message || message === '') {
			log('info', logSystem, 'Notification disabled for %s: empty telegram message.', [id]);
			return;
		}

		redisClient.hget(config.coin + ':telegram', miner, function (error, chatId) {
			if (error || !chatId) return;
			telegram.sendMessage(chatId, message);
		});
	}
}
exports.sendToMinerTelegram = sendToMinerTelegram;

/**
 * Send block notification telegram to miner in private message
 **/
function sendBlockTelegram (id, variables) {
	// Set custom variables
	variables = setCustomVariables(variables);

	// Send telegram
	if (config.telegram && config.telegram.enabled) {
		let message = getTelegramMessage(id, variables);
		if (!message || message === '') {
			log('info', logSystem, 'Notification disabled for %s: empty telegram message.', [id]);
			return;
		}

		redisClient.hgetall(config.coin + ':telegram:blocks', function (error, data) {
			if (error || !data) return;
			for (let chatId in data) {
				if (!chatId) continue;
				telegram.sendMessage(chatId, message);
			}
		});
	}
}
exports.sendBlockTelegram = sendBlockTelegram;

/**
 * Send email notification to all pool email addresses
 **/
function sendToAllEmails (id, variables) {
	// Set custom variables
	variables = setCustomVariables(variables);

	// Send email
	if (config.email && config.email.enabled) {
		let subject = getEmailSubject(id, variables);
		let content = getEmailContent(id, variables);
		if (!content || content === '') {
			log('info', logSystem, 'Notification disabled for %s: empty email content.', [id]);
			return;
		}

		redisClient.hgetall(config.coin + ':notifications', function (error, data) {
			if (error || !data) return;
			for (let address in data) {
				let email = data[address];
				emailSystem.sendEmail(email, subject, content);
			}
		});
	}
}
exports.sendToAllEmails = sendToAllEmails;

/**
 * Send email notification to miner email address
 **/
function sendToMinerEmail (miner, id, variables) {
	// Set custom variables
	variables = setCustomVariables(variables);

	// Send email
	if (config.email && config.email.enabled) {
		let subject = getEmailSubject(id, variables);
		let content = getEmailContent(id, variables);
		if (!content || content === '') {
			log('info', logSystem, 'Notification disabled for %s: empty email content.', [id]);
			return;
		}

		redisClient.hget(config.coin + ':notifications', miner, function (error, email) {
			if (error || !email) return;
			emailSystem.sendEmail(email, subject, content);
		});
	}
}
exports.sendToMinerEmail = sendToMinerEmail;

/**
 * Send email notification to a specific email address
 **/
function sendToEmail (email, id, variables) {
	// Set custom variables
	variables = setCustomVariables(variables);

	// Send notification
	if (config.email && config.email.enabled) {
		let subject = getEmailSubject(id, variables);
		let content = getEmailContent(id, variables);
		if (!content || content === '') {
			log('info', logSystem, 'Notification disabled for %s: empty email content.', [id]);
			return;
		}

		emailSystem.sendEmail(email, subject, content);
	}
}
exports.sendToEmail = sendToEmail;

/**
 * Email functions
 **/

// Get email subject
function getEmailSubject (id, variables) {
	let subject = replaceVariables(notificationSettings.emailSubject[id], variables) || '';
	return subject;
}

// Get email content
function getEmailContent (id, variables) {
	let message = notificationSettings.emailMessage[id] || '';
	if (!message || message === '') return '';

	let content = message;
	if (notificationSettings.emailTemplate) {
		if (!fs.existsSync(notificationSettings.emailTemplate)) {
			log('warn', logSystem, 'Email template file not found: %s', [notificationSettings.emailTemplate]);
		}
		content = fs.readFileSync(notificationSettings.emailTemplate, 'utf8');
		content = content.replace(/%MESSAGE%/g, message);
	}
	content = replaceVariables(content, variables);
	return content;
}

/**
 * Telegram functions
 **/

// Get telegram message
function getTelegramMessage (id, variables) {
	let telegramVars = {};
	if (telegramVars) {
		for (let varName in variables) {
			let value = variables[varName].toString();
			value = value.replace(/\*/g, '.');
			value = value.replace(/_/g, ' ');
			telegramVars[varName] = value;
		}
	}
	let message = replaceVariables(notificationSettings.telegramMessage[id], telegramVars) || '';
	return message;
}

/**
 * Handle variables in texts
 **/

// Set custom variables
function setCustomVariables (variables) {
	if (!variables) variables = {};
	variables['TIME'] = utils.dateFormat(Date.now(), 'yyyy-mm-dd HH:MM:ss Z');
	variables['POOL_HOST'] = config.poolHost || '';
	return variables;
}

// Replace variables in a string
function replaceVariables (string, variables) {
	if (!string) return '';
	if (variables) {
		for (let varName in variables) {
			string = string.replace(new RegExp('%' + varName + '%', 'g'), variables[varName]);
		}
		string = string.replace(/  /g, ' ');
	}
	return string;
}
