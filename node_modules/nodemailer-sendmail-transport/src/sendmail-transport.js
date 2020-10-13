'use strict';

var spawn = require('child_process').spawn;
var packageData = require('../package.json');
var Transform = require('stream').Transform || require('readable-stream').Transform;
var util = require('util');

// expose to the world
module.exports = function(options) {
    return new SendmailTransport(options);
};

/**
 * <p>Generates a Transport object for Amazon Sendmail with aws-sdk</p>
 *
 * <p>Possible options can be the following:</p>
 *
 * <ul>
 *     <li><b>accessKeyId</b> - AWS access key (optional)</li>
 *     <li><b>secretAccessKey</b> - AWS secret (optional)</li>
 *     <li><b>region</b> - optional region (defaults to <code>'us-east-1'</code>)
 * </ul>
 *
 * @constructor
 * @param {Object} optional config parameter for the AWS Sendmail service
 */
function SendmailTransport(options) {
    options = options || {};

    // use a reference to spawn for mocking purposes
    this._spawn = spawn;

    this.options = options;

    this.name = 'Sendmail';
    this.version = packageData.version;

    this.path = 'sendmail';
    this.args = false;

    if (typeof options === 'string') {
        this.path = options;
    } else if (typeof options === 'object') {
        if (options.path) {
            this.path = options.path;
        }
        if (Array.isArray(options.args)) {
            this.args = options.args;
        }
    }
}

/**
 * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run when the sending is completed
 */
SendmailTransport.prototype.send = function(mail, callback) {
    // Sendmail strips this header line by itself
    mail.message.keepBcc = true;

    var envelope = mail.data.envelope || mail.message.getEnvelope(),
        args,
        sendmail,
        cbCounter = 2,
        didCb,
        marker = 'SendmailTransport.sendMail',
        transform;

    if (this.args) {
        // force -i to keep single dots
        args = ['-i'].concat(this.args);
    } else {
        args = ['-i'].concat(envelope.from ? ['-f', envelope.from] : []).concat(envelope.to);
    }

    try {
        sendmail = this._spawn(this.path, args);
    } catch (e) {
        e[marker] = 'spawn exception';
        sendmailResult(e);
    }

    if (sendmail) {
        sendmail.on('error', sendmailError);
        sendmail.once('exit', sendmailExit);
        sendmail.once('close', endEvent);
        sendmail.stdin.on('error', sendmailStdinError);

        transform = new NewlineTransform();
        mail.message.createReadStream().pipe(transform).pipe(sendmail.stdin);
    }

    function sendmailError(e) {
        e[marker] = 'sendmailError';
        sendmailResult(e);
    }

    function sendmailStdinError(e) {
        e[marker] = 'sendmailStdinError';
        sendmailResult(e);
    }

    function sendmailExit(code) {
        if (!code) {
            endEvent();
        } else {
            sendmailResult(new Error('Sendmail exited with ' + code));
        }
    }

    function endEvent() {
        if (!--cbCounter) {
            sendmailResult();
        }
    }

    function sendmailResult(e) {
        if (didCb) {
            // ignore any additional responses
            return;
        }
        didCb = true;
        if (typeof callback === 'function') {
            if (e) {
                callback(e);
            } else {
                callback(null, {
                    envelope: mail.data.envelope || mail.message.getEnvelope(),
                    messageId: (mail.message.getHeader('message-id') || '').replace(/[<>\s]/g, '')
                });
            }
        }
    }
};

// Transforming stream that replaces SMTP-style \r\n line endings to
// Sendmail-style \n line endings.
function NewlineTransform(options) {
    Transform.call(this, options);
}
util.inherits(NewlineTransform, Transform);

NewlineTransform.prototype._transform = function(chunk, encoding, done) {
    this.push(chunk.toString().replace(/\r/g, ''));
    done();
};