var regexp = require("./regexp.js");

function main() {
    var opts = require('tav').set({
	re: {
	    note: "The regular expression to visualize (required)",
	    value: ''
	}, 
	type: {
	    note: "The type of graph required (nfa|dfa) (default: dfa)",
	    value: 'dfa'
	},
	attrs: {
	    note: "Attributes to pass to the graph definition function",
	    value: ''
	}
    }, "Regular expression visualizer");

    opts.re = opts.re.trim();
    if (!opts.re) {
	console.error("You must specify a regular expression using --re=...");
	return 1;
    }

    if (['dfa', 'nfa'].indexOf(opts.type) == -1) {
	console.error("You must specify a valid graph output type using --type=(dfa|nfa)");
	return 1;
    }

    var attrs = { };
    opts.attrs.split(/,/).forEach(function(attr) {
	attr = attr.trim();
	if (attr.length == 0) return;
	var parts = attr.split(/=/);
	if (parts[0].length == 0 || parts[1].length == 0) return;
	attrs[parts[0]] = parts[1];
    });

    if (opts.type == 'dfa') {
	var REdfa = new regexp.RegExpDFA(opts.re);
	// TODO: Handle errors
	console.log(REdfa.toDot(attrs));
    } else {
	var REnfa = new regexp.RegExpNFA(opts.re);
	// TODO: Handle errors
	console.log(REnfa.toDot(attrs));
    }
    return 0;
}

process.exit(main());
