var re = require('./regexp.js');

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

exports.testPathologicalRE = function(test) {
    var exp = "c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccc";
    var str = "cccccccccccccccccccc";
    runTest.apply(test, [ exp, str, [ 19 ]]);
};
