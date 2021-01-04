// Array.prototype.findIndex - MIT License (c) 2013 Paul Miller <http://paulmillr.com>
// For all details and docs: <https://github.com/paulmillr/Array.prototype.findIndex>

'use strict';

var IsCallable = require('es-abstract/2019/IsCallable');
var ToLength = require('es-abstract/2019/ToLength');
var ToObject = require('es-abstract/2019/ToObject');

module.exports = function findIndex(predicate) {
	var list = ToObject(this);
	var length = ToLength(list.length);
	if (!IsCallable(predicate)) {
		throw new TypeError('Array#findIndex: predicate must be a function');
	}

	if (length === 0) {
		return -1;
	}

	var thisArg;
	if (arguments.length > 0) {
		thisArg = arguments[1];
	}

	for (var i = 0, value; i < length; i++) {
		value = list[i];
		// inlined for performance: if (Call(predicate, thisArg, [value, i, list])) return i;
		if (predicate.apply(thisArg, [value, i, list])) {
			return i;
		}
	}

	return -1;
};
