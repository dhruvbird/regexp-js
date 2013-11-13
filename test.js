var re = require('./regexp.js');
var _ = require('underscore');
var util = require('util');

function matchesFromCapture(captures) {
    var matches = [];
    var i;
    // console.log("captures.length:", captures.length);
    for (i = 0; i < captures.length; ++i) {
	// FIXME:
	// console.log("captures[" + i + "]:", captures[i]);
	matches.push(captures[i][0].end);
    }
    return matches;
}

function testMatches(expression, str, matches) {
    var nfaGenerator = new re.RegExpNFA(expression);
    var nfa = nfaGenerator.toNFA();
    var captures = re.search(str, nfa, re.FLAG_CAPTURE_ALL);
    var foundMatches = matchesFromCapture(captures);
    this.deepEqual(matches, foundMatches,
		   util.format('Expected: %s, Got: %s',
			       String(matches),
			       String(foundMatches)
			      )
		  );
    this.done();
}

function testMatch(expression, str, expectedCaptures) {
    var nfaGenerator = new re.RegExpNFA(expression);
    var nfa = nfaGenerator.toNFA();
    var flags = 0;
    var captures = re.search(str, nfa, flags);
    Object.keys(expectedCaptures).forEach(function(idx) {
	this.deepEqual(expectedCaptures[idx], captures[0][idx],
		       util.format('Expected: %s, Got: %s',
				   JSON.stringify(expectedCaptures[idx]),
				   JSON.stringify(captures[0][idx])
				  )
		      );
    }.bind(this));
    this.done();
}

exports.testLongExpression = function(test) {
    var str = "aabcbcbcaaabcb";
    testMatches.apply(test, [ "^x[0-3]*|(a|(bc))*",
			      str,
			      [ -1, 0, 1, 3, 5, 7, 8, 9, 10, 12 ]
			    ]
		     );
};

exports.testEmpty = function(test) {
    testMatches.apply(test, [ "a*", "", [ -1 ]]);
};

exports.testCharRange = function(test) {
    var str = "101234";
    testMatches.apply(test, [ "^[0-3]+", str, [ 0, 1, 2, 3, 4 ]]);
};

exports.testEmptyOrNonEmpty = function(test) {
    var str = "abcqbcbcxx";
    testMatches.apply(test, [ "^.*x|(a|(bc))*", str, [ -1, 0, 2, 8, 9 ]]);
};

exports.testAlternationKleen = function(test) {
    var str = "abc";
    testMatches.apply(test, [ "^(a|(bc))*", str, [ -1, 0, 2 ]]);
};

exports.testPrefixRE = function(test) {
    var str = "c";
    testMatches.apply(test, [ "^c?c", str, [ 0 ]]);
};

exports.testPathologicalRE20_20 = function(test) {
    var exp = "^c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccc";
    var str = "cccccccccccccccccccc";
    testMatches.apply(test, [ exp, str, [ 19 ]]);
};

exports.testPathologicalRE24_24 = function(test) {
    var exp = "^c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccccccc";
    var str = "cccccccccccccccccccccccc";
    testMatches.apply(test, [ exp, str, [ 23 ]]);
};

exports.testPathologicalRE24_23 = function(test) {
    var exp = "^c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?c?cccccccccccccccccccccccc";
    var str = "ccccccccccccccccccccccc";
    testMatches.apply(test, [ exp, str, [ ]]);
};

exports.testURL = function(test) {
    var exp = "^https?://[^/]+(/(.*))?"
    var str = "https://ddg.gg/search/?q=regular%20expressions";
    testMatches.apply(test, [ exp, str, _.range(8, 46)]);
};

exports.testURLMatch = function(test) {
    var exp = "^https?://([^/]+)(/(.*))?"
    var str = "https://ddg.gg/search/?q=regular%20expressions";
    var captures = [ { start: -1, end: str.length-1 },
		     { start: 7, end: 13 },
		     { start: 13, end: str.length-1 }
		   ];
    testMatch.apply(test, [ exp, str, captures ]);
};
