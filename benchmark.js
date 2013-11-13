var b = require('b');
var re = require('./regexp.js');
var util = require('util');
var sprintf = require('sprintf').sprintf;

/* Data for benchmarks taken from:
 * http://tusker.org/regex/regex_benchmark.html and
 * http://tusker.org/regex/20100713.html
 *
 * TODO: Also incorporate benchmarks from:
 * http://lh3lh3.users.sourceforge.net/reb.shtml
 *
 */

var REs = ["(([^:]+)://)?([^:/]+)(:([0-9]+))?(/.*)",
	   ".*(([^:]+)://)?([^:/]+)(:([0-9]+))?(/.*)",
	   ".*usd [+-]?[0-9]+.[0-9][0-9]"
	  ];
var texts = [ "http://www.linux.com/",
	      "http://www.thelinuxshow.com/main.php3true",
	      "usd 1234.00",
	      "he said she said he said no",
	      "same same same",
	      "{1: this is some more text - and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more at the end -}"
	    ];

function Reporter() {
    this.results = [ ];
};

Reporter.prototype = {
    report: function(name, result, iterations) {
	this.results.push({
	    name: name,
	    result: result,
	    iterations: iterations
	});
    },
    finalize: function() {
    }
};
var reporter = new Reporter();

function regexpjsRunner(reporter, iters) {
    REs.forEach(function(RE, REIdx) {
	var REnfa = new re.RegExpNFA(RE);
	var nfa = REnfa.toNFA();
	texts.forEach(function(text, textIdx) {
	    var niters = 100;
	    if (iters && iters[REIdx] && iters[REIdx][textIdx]) {
		niters = iters[REIdx][textIdx];
	    }
	    // console.log("RE:", RE, "text:", text);
	    var bmName = JSON.stringify({ name: sprintf("RE: '%s' on text# %d", RE, textIdx + 1),
					  key: "regexp-js" }
				       );
	    b(bmName)
		.reporter(reporter)
		.run(1, function(runId) {
		    for (var i = 0; i < niters; ++i) {
			re.search(text, nfa);
		    }
		});
	});
    });
}

function nativeRunner(reporter, iters) {
    REs.forEach(function(RE, REIdx) {
	var re = new RegExp(RE);
	texts.forEach(function(text, textIdx) {
	    var niters = 100;
	    if (iters[REIdx] && iters[REIdx][textIdx]) {
		niters = iters[REIdx][textIdx];
	    }
	    // console.log("RE:", RE, "text:", text);
	    var bmName = JSON.stringify({ name: sprintf("RE: '%s' on text# %d", RE, textIdx + 1),
					  key: "native" }
				       );
	    b(bmName)
		.reporter(reporter)
		.run(1, function(runId) {
		    for (var i = 0; i < niters; ++i) {
			text.match(re);
		    }
		});
	});
    });
}

reporter = 'cli';
regexpjsRunner(reporter);
nativeRunner(reporter, [, [,,,,,1], ]);

// reporter.finalize();
