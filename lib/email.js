/**
 * Cryptonote Node.JS Pool
 * https://github.com/dvandal/cryptonote-nodejs-pool
 *
 * Email system
 * Supports: sendmail, smtp, mailgun
 *
 * Author: Daniel Vandal
 **/

// Load required modules
let nodemailer = require('nodemailer');
let mailgun = require('mailgun.js');

// Initialize log system
let logSystem = 'email';
require('./exceptionWriter.js')(logSystem);

/**
 * Sends out an email
 **/
exports.sendEmail = function (email, subject, content) {
	// Return error if no destination email address
	if (!email) {
		log('warn', logSystem, 'Unable to send e-mail: no destination email.');
		return;
	}

	// Check email system configuration
	if (!config.email) {
		log('error', logSystem, 'Email system not configured!');
		return;
	}

	// Do nothing if email system is disabled
	if (!config.email.enabled) return;

	// Set content data
	let messageData = {
		from: config.email.fromAddress,
		to: email,
		subject: subject,
		text: content
	};

	// Get email transport
	let transportMode = config.email.transport;
	let transportCfg = config.email[transportMode] ? config.email[transportMode] : {};

	if (transportMode === "mailgun") {
		let mg = mailgun.client({
			username: 'api',
			key: transportCfg.key
		});
		mg.messages.create(transportCfg.domain, messageData)
			.then(() => {
				log('info', logSystem, 'E-mail sent to %s: %s', [messageData.to, messageData.subject]);
			})
			.catch(error => {
				log('error', logSystem, 'Unable to send e-mail to %s: %s', [messageData.to, JSON.stringify(error)]);
			});
	} else {
		transportCfg['transport'] = transportMode;
		let transporter = nodemailer.createTransport(transportCfg);
		transporter.sendMail(messageData, function (error) {
			if (error) {
				log('error', logSystem, 'Unable to send e-mail to %s: %s', [messageData.to, error.toString()]);
			} else {
				log('info', logSystem, 'E-mail sent to %s: %s', [email, subject]);
			}
		});
	}
};
