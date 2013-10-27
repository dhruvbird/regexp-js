var re = require('./regexp.js');
var _ = require('underscore');

function runTest(expression, str, matches) {
    var nfaGenerator = new re.RegExpNFA(expression);
    var nfa = nfaGenerator.toNFA();
    var m = re.search(str, nfa);
    this.deepEqual(m, matches,
		   'Expected: ' + String(matches) + ', Got: ' + String(m));
    this.done();
}

exports.testLongExpression = function(test) {
    var str = "aabcbcbcaaabcb";
    runTest.apply(test, [ "x[0-3]*|(a|(bc))*",
			  str, [ -1, 0, 1, 3, 5, 7, 8, 9, 10, 12 ] ]);
};

exports.testEmpty = function(test) {
    runTest.apply(test, [ "a*", "", [ -1 ]]);
};

exports.testCharRange = function(test) {
    var str = "101234";
    runTest.apply(test, [ "[0-3]+", str, [ 0, 1, 2, 3, 4 ]]);
};

exports.testEmptyOrNonEmpty = function(test) {
    var str = "abcqbcbcxx";
    runTest.apply(test, [ ".*x|(a|(bc))*", str, [ -1, 0, 2, 8, 9 ]]);
};

exports.testAlternationKleen = function(test) {
    var str = "abc";
    runTest.apply(test, [ "(a|(bc))*", str, [ -1, 0, 2 ]]);
};

exports.testPrefixRE = function(test) {
    var str = "c";
    runTest.apply(test, [ "c?c", str, [ 0 ]]);
};

exports.testPathologicalRE20_20 = function(test) {
    var exp = "c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccc";
    var str = "cccccccccccccccccccc";
    runTest.apply(test, [ exp, str, [ 19 ]]);
};

exports.testPathologicalRE24_24 = function(test) {
    var exp = "c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccccccc";
    var str = "cccccccccccccccccccccccc";
    runTest.apply(test, [ exp, str, [ 23 ]]);
};

exports.testPathologicalRE24_23 = function(test) {
    var exp = "c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccccccc";
    var str = "ccccccccccccccccccccccc";
    runTest.apply(test, [ exp, str, [ ]]);
};

exports.testURL = function(test) {
    var exp = "https?://[^/]+(/(.*))?"
    var str = "https://ddg.gg/search/?q=regular%20expressions";
    runTest.apply(test, [ exp, str, _.range(8, 46)]);
};
