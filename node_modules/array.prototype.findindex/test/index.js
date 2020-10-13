var expect = require('chai').expect;
var arrayFindIndex = require('../');

var runTests = function (findIndex) {
	var list = [5, 10, 15, 20];

	describe('Array#findIndex', function () {
		it('should have a length of 1', function () {
			expect(findIndex.length).to.equal(1);
		});

		it('should find item key by predicate', function () {
			var result = findIndex.call(list, function (item) { return item === 15; });
			expect(result).to.equal(2);
		});

		it('should return -1 when nothing matched', function () {
			var result = findIndex.call(list, function (item) { return item === 'a'; });
			expect(result).to.equal(-1);
		});

		it('should throw TypeError when function was not passed', function () {
			expect(function () { list.findIndex(); }).to['throw'](TypeError);
		});

		it('should receive all three parameters', function () {
			var i = findIndex.call(list, function (value, index, arr) {
				expect(list[index]).to.equal(value);
				expect(list).to.eql(arr);
				return false;
			});
			expect(i).to.equal(-1);
		});

		it('should work with the context argument', function () {
			var context = {};
			findIndex.call([1], function () { expect(this).to.equal(context); }, context);
		});

		it('should work with an array-like object', function () {
			var obj = { 0: 1, 1: 2, 2: 3, length: 3 };
			var foundIndex = findIndex.call(obj, function (item) { return item === 2; });
			expect(foundIndex).to.equal(1);
		});

		it('should work with an array-like object with negative length', function () {
			var obj = { 0: 1, 1: 2, 2: 3, length: -3 };
			var foundIndex = findIndex.call(obj, function () {
				throw new Error('should not reach here');
			});
			expect(foundIndex).to.equal(-1);
		});

		it('should work with a sparse array', function () {
			var obj = [1, , undefined]; // eslint-disable-line no-sparse-arrays
			expect(1 in obj).to.equal(false);
			var seen = [];
			var foundIndex = findIndex.call(obj, function (item, idx) {
				seen.push([idx, item]);
				return item === undefined && idx === 2;
			});
			expect(foundIndex).to.equal(2);
			expect(seen).to.eql([[0, 1], [1, undefined], [2, undefined]]);
		});

		it('should work with a sparse array-like object', function () {
			var obj = { 0: 1, 2: undefined, length: 3.2 };
			var seen = [];
			var foundIndex = findIndex.call(obj, function (item, idx) {
				seen.push([idx, item]);
				return false;
			});
			expect(foundIndex).to.equal(-1);
			expect(seen).to.eql([[0, 1], [1, undefined], [2, undefined]]);
		});
	});
};

describe('polyfill', function () {
	describe('clean Object.prototype', function () {
		runTests(arrayFindIndex.implementation);
	});

	describe('polluted Object.prototype', function () {
		Object.prototype[1] = 42; // eslint-disable-line no-extend-native
		runTests(arrayFindIndex.implementation);
		delete Object.prototype[1];
	});
});

describe('shim', function () {
	arrayFindIndex.shim();
	var implementation = Array.prototype.findIndex;

	describe('clean Object.prototype', function () {
		runTests(implementation);
	});

	describe('polluted Object.prototype', function () {
		Object.prototype[1] = 42; // eslint-disable-line no-extend-native
		runTests(implementation);
		delete Object.prototype[1];
	});
});

describe('single function', function () {
	var findIndexAsFunction = function (func) { // eslint-disable-line no-unused-vars
		var args = Array.prototype.slice.call(arguments);
		args.unshift(this);
		return arrayFindIndex.apply(undefined, args);
	};

	describe('clean Object.prototype', function () {
		runTests(findIndexAsFunction);
	});

	describe('polluted Object.prototype', function () {
		Object.prototype[1] = 42; // eslint-disable-line no-extend-native
		runTests(findIndexAsFunction);
		delete Object.prototype[1];
	});
});
