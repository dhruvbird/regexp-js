var b = require('b');
var re = require('./regexp.js');
var util = require('util');
var sprintf = require('sprintf').sprintf;
var _ = require('underscore');

/* Data for some benchmarks taken from:
 * http://tusker.org/regex/regex_benchmark.html and
 * http://tusker.org/regex/20100713.html
 *
 * TODO: Also incorporate benchmarks from:
 * http://lh3lh3.users.sourceforge.net/reb.shtml
 *
 */

var REs = ["(([^:]+)://)?([^:/]+)(:([0-9]+))?(/.*)",
	   ".*(([^:]+)://)?([^:/]+)(:([0-9]+))?(/.*)",
	   ".*usd [+-]?[0-9]+.[0-9][0-9]",
	   "banana|orange|apple|pear|guava|peach"
	  ];
var texts = [ "http://www.linux.com/",
	      "http://www.thelinuxshow.com/main.php3true",
	      "usd 1234.00",
	      "he said she said he said no",
	      "same same same",
	      "{1: this is some more text - and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more this is some more text and some more and some more and even more at the end -}",
	      "some text before the real match... usd 1234.00",
	      "I love you, girl, now thats the truth\nI need you\nDont be cruel, dont be cruel\nGive me just a little help and to show how much I care\nI bring you apples, peaches, bananas and pears\n\nRun to me\nGirl dont wait to long\nAnd youll see\nI wont do you wrong\nPromise me no matter what\nForever youll be there\nIll bring you apples, peaches, bananas and pears\n\nIve said all I can today, girl\nThats the way I am\nTake it for what its worth,\nThrow the rest into the sun\n\nGive me you\nGirl, thats all I ask\nPlease be true\nAll I wants a love to last\nIll give it all back to you\nAnd just to prove Im fair\nI bring you apples, peaches, bananas and pears\n\nWhoa!\n\nI love you, girl, now thats the truth\nI need you\nDont be cruel, dont be cruel\nGive me just a little help\nAnd to show how much I care\nI bring you apples, peaches, bananas and pears\nApples, peaches, bananas and pears\n"
	    ];

function repeat(s, n) {
    var ret = "";
    for (var i = 0; i < n; ++i) {
	ret += s;
    }
    return ret;
}

function Reporter() {
    this.results = [ ];
};

Reporter.prototype = {
    report: function(name, result, iterations) {
	this.results.push({
	    name: name,
	    result: result,
	    iterations: 0
	});
    },
    finalize: function() {
	// console.log("finalize");
	var r = { };
	var keys = [ "Test Name" ];
	var widths = [ keys[0].length ];
	var totals = { };
	this.results.forEach(function(result) {
	    var j = JSON.parse(result.name);
	    var key = j.key;
	    r[j.name] = r[j.name] || { };
	    r[j.name][key] = result;
	    totals[key] = totals[key] || 0;
	    keys.push(key);
	    keys = _.uniq(keys);
	    result.iterations = j.iterations;
	    if (result.iterations > 0 && result.iterations != 100) {
		result.result = result.result / result.iterations * 100;
	    }
	    totals[key] += result.result;
	    // console.log(sprintf("totals[%s]: %.2f", key, totals[key]));
	    var kIdx = keys.indexOf(key);
	    var cWidth = widths[kIdx] || key.length;
	    result.kIdx = kIdx;
	    cWidth = Math.max(cWidth, sprintf("%.2fms", totals[key] / 1e6).length);
	    widths[kIdx] = cWidth;
	    widths[0] = Math.max(widths[0], j.name.length);
	});
	var sepString = "+-" + repeat("-", widths[0]) + "--";
	var fmtString = "| %-" + widths[0] + "s |";
	var i;
	for (i = 1; i < keys.length; ++i) {
	    sepString += ("-" + repeat("-", widths[i]) + "-+");
	    fmtString += (" %" + widths[i] + "s |");
	}
	console.log("Reporting time per 100 iterations");
	console.log(sepString);
	var args = [ fmtString ].concat(keys);
	// console.log(args);
	console.log(sprintf.apply(null, args));
	console.log(sepString);
	Object.keys(r).forEach(function(name) {
	    args = [ fmtString, name ];
	    var res = r[name];
	    for (i = 1; i < keys.length; ++i) {
		var time = Math.round(res[keys[i]].result) / 1e6;
		// console.log("time:", time);
		args[i + 1] = sprintf("%.2fms", time);
	    }
	    // console.log(args);
	    console.log(sprintf.apply(null, args));
	});
	console.log(sepString);
	args = [ fmtString, "Total" ];
	for (i = 1; i < keys.length; ++i) {
	    args[i + 1] = sprintf("%.2fms", totals[keys[i]] / 1e6);
	}
	// console.log(totals);
	console.log(sprintf.apply(null, args));
	console.log(sepString);
    }
};
var reporter = new Reporter();

function regexpjsRunner(reporter, iters) {
    REs.forEach(function(RE, REIdx) {
	var REnfa = new re.RegExpNFA(RE);
	var nfa = REnfa.toNFA();
	texts.forEach(function(text, textIdx) {
	    var niters = 100;
	    if (iters && iters[REIdx] && iters[REIdx][textIdx] != undefined) {
		niters = iters[REIdx][textIdx];
	    }
	    // console.log("RE:", RE, "text:", text);
	    var bmName = JSON.stringify({ name: sprintf("RE: '%s'; text #%d", RE, textIdx + 1),
					  key: "regexp-js",
					  iterations: niters
					});
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
	var re = new RegExp(RE, "g");
	texts.forEach(function(text, textIdx) {
	    var niters = 100;
	    if (iters && iters[REIdx] && iters[REIdx][textIdx] != undefined) {
		niters = iters[REIdx][textIdx];
	    }
	    // console.log("RE:", RE, "text:", text);
	    // console.log("niters:", niters);
	    var bmName = JSON.stringify({ name: sprintf("RE: '%s'; text #%d", RE, textIdx + 1),
					  key: "native",
					  iterations: niters
					});
	    b(bmName)
		.reporter(reporter)
		.run(1, function(runId) {
		    for (var i = 0; i < niters; ++i) {
			// text.match(re);
			re.lastIndex = 0;
			while (re.exec(text) != null);
		    }
		});
	});
    });
}

// reporter = 'cli';
regexpjsRunner(reporter);
nativeRunner(reporter, [, [,,,,,1], [,,,,,1] ]);

// nativeRunner(reporter, [, [,,,,,0], [,,,,,0] ]);
reporter.finalize();
