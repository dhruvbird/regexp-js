/* -*- indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*- */
var util = require('util');
var _ = require('underscore');

var epsilon = 'ɛ';
// Create a new NFA node with ID (nodeId)
function NFANode() {
    this.transitions = { };
}

NFANode.prototype = {
    on: function(toNode, input) {
        input = input || epsilon;
        if (!this.transitions.hasOwnProperty(input)) {
            this.transitions[input] = [ ];
        }
        this.transitions[input].push(toNode);
        return this;
    }
};

function RegExpParser(expression) {
    this.expression = expression;
    this.root = null;
    this.index = 0;
    this.expLen = this.expression.length;
}

function UnionNode(node1, node2) {
    this.node1 = node1;
    this.node2 = node2;
}
UnionNode.prototype = {
    toNFA: function() {
        var lhs = new NFANode();
        var rhs = new NFANode();
        var n1pair = this.node1.toNFA();
        var n2pair = this.node2.toNFA();
        // Add epsilon transitions from lhs -> [node1, node2]
        lhs.on(n1pair[0]).on(n2pair[0]);
        // Add epsilon transitions from [node1, node2] -> rhs
        n1pair[1].on(rhs);
        n2pair[1].on(rhs);
        return [lhs, rhs];
    }
};




function EmptyNode() { }
EmptyNode.prototype = {
    toNFA: function() {
        var lhs = new NFANode();
        var rhs = new NFANode();
        return [lhs, rhs];
    }
};

function SequenceNode(node1, node2) {
    this.node1 = node1;
    this.node2 = node2;
}
SequenceNode.prototype = {
    toNFA: function() {
        var lhs = this.node1.toNFA();
        var rhs = this.node2.toNFA();
        // Add an epsilon transition
        lhs[1].on(rhs[0]);
        return [lhs[0], rhs[1]];
    }
};


function ApplyOpsNode(sym, ops) {
    this.sym = sym;
    this.ops = ops;
}
ApplyOpsNode.prototype = {
    toNFA: function() {
        return this.ops.toNFA(this.sym.toNFA());
    }
};

function OpNode(op) {
    this.op = op;
}
OpNode.prototype = {
    toNFA: function(symNodePair) {
        var sopsNode = new SequentialOpsNode(this);
        return sopsNode.toNFA(symNodePair);
    }
};

function SequentialOpsNode(op, ops) {
    this.op = op;
    this.ops = ops;
}
SequentialOpsNode.prototype = {
    toNFA: function(symNodePair) {
        var nodePair = [new NFANode(), new NFANode()];
        switch (this.op.op) {
        case '*':
            // Add a self epsilon transition
            symNodePair[0].on(symNodePair[1]);
            nodePair[1].on(nodePair[0]);
            nodePair[0].on(symNodePair[0]);
            symNodePair[1].on(nodePair[1]);
            break;
        case '+':
            nodePair[1].on(nodePair[0]);
            nodePair[0].on(symNodePair[0]);
            symNodePair[1].on(nodePair[1]);
            break;
        case '?':
            symNodePair[0].on(symNodePair[1]);
            nodePair[0].on(symNodePair[0]);
            symNodePair[1].on(nodePair[1]);
            break;
        default:
            throw new Error(util.format("Invalid operation '%s'", this.op.op));
            break;
        }
        if (this.ops) {
            console.log("This: ", this);
            return this.ops.toNFA(nodePair);
        }
        return nodePair;        
    }
};

function NFANodeFromCharList(charList) {
    // Handle an empty list
    if (charList.length == 0) {
	    return new EmptyNode().toNFA();
    }
    var node = new SingleChar(charList[0]);
    for (var i = 1; i < charList.length; ++i) {
        var node2 = new SingleChar(charList[i]);
        node = new UnionNode(node, node2);
    }
    return node.toNFA();
}

function CharListNode(one, many) {
    this.one = one;
    this.many = many;
    this.type = 'charlist';
}
CharListNode.prototype = {
    getCharList: function() {
        var ret = [ ];
        ret = ret.concat(this.one.getCharList());
        ret = ret.concat(this.many.getCharList());
        return ret;
    },
    toNFA: function() {
        return NFANodeFromCharList(this.getCharList());
    }
};

function CharRangeNode(lhs, rhs) {
    this.lhs = lhs.ch;
    this.rhs = rhs.ch;
    this.type = 'charrange';
}
CharRangeNode.prototype = {
    getCharList: function() {
        var ret = [ ];
        var i;
        if (this.lhs.toLowerCase() === this.lhs && this.rhs.toLowerCase() === this.rhs) {
            if (this.lhs > this.rhs) {
                throw new Error(util.format("CharRangeNode: %s not <= %s", this.lhs, this.rhs));
            }
            for (i = this.lhs.charCodeAt(0); i <= this.rhs.charCodeAt(0); ++i) {
                ret.push(String.fromCharCode(i));
            }
        } else if (this.lhs.toUpperCase() === this.lhs && this.rhs.toUpperCase() === this.rhs) {
            if (this.lhs > this.rhs) {
                throw new Error(util.format("CharRangeNode: %s not <= %s", this.lhs, this.rhs));
            }
            for (i = this.lhs.charCodeAt(0); i <= this.rhs.charCodeAt(0); ++i) {
                ret.push(String.fromCharCode(i));
            }
        }
        return ret;
    },
    toNFA: function() {
        return NFANodeFromCharList(this.getCharList());
    }
}

function SingleChar(ch) {
    this.ch = ch;
}
SingleChar.prototype = {
    getCharList: function() {
	    if (this.ch == '.') {
            return _.difference(allChars, [ '.' ]);
	    }
        return [this.ch];
    },
    toNFA: function() {
	    var charList = this.getCharList();
	    if (charList.length == 1) {
            var lhs = new NFANode();
            var rhs = new NFANode();
            lhs.on(rhs, this.ch);
            return [lhs, rhs];
	    } else {
	        return NFANodeFromCharList(charList);
	    }
    }
};

var allChars = [ ];
var wsChars = [ '\n', ' ', '\t', '\0' ];
do {
    for (var i = 0; i < 256; ++i) {
        allChars.push(String.fromCharCode(i));
    }
} while (false);


function EscapedChar(ch) {
    this.ch = ch;
}
EscapedChar.prototype = {
    getCharList: function() {
        var ret = [];
        switch (this.ch) {
        case 's':
            ret = wsChars;
            break;
        case 'S':
            ret = _.difference(allChars, wsChars);
            break;
        default:
            ret = [ this.ch ];
            break;
        }
        return ret;
    },
    toNFA: function() {
        var charList = this.getCharList();
        return NFANodeFromCharList(charList);
    }
};

function NegationNode(node) {
    this.node = node;
}
NegationNode.prototype = {
    toNFA: function() {
        var charList = _.difference(allChars, this.node.getCharList());
        return NFANodeFromCharList(charList);
    }
};

RegExpParser.prototype = {
    peek: function() {
	    return this.expression[this.index];
    },
    hasMore: function() {
	    return this.index < this.expLen;
    },
    nextIs: function(ch) {
	    return this.hasMore() && this.peek() == ch;
    },
    get: function() {
	    return this.expression[this.index++];
    },
    parse: function() {
	    this.index = 0;
	    return this.regexp();
    },
    regexp: function() {
	    var index = this.index;
	    var node = this.regexpNoUnion();
	    if (!node) {
	        this.index = index;
	        return null;
	    }
	    if (this.hasMore()) {
	        if (this.nextIs('|')) {
		        this.get();
		        var node2 = this.regexp();
		        if (!node2) {
		            this.index = index;
		            return null;
		        }
		        return new UnionNode(node, node2);
	        } else {
		        // Maybe bracketed subexpression.
		        return node;
	        }
	    } else {
	        return node;
	    }
    },
    regexpNoUnion: function() {
	    var index = this.index;
	    var node = this.regexpNoConcat();
	    if (!node) {
	        if (!this.hasMore() || this.nextIs('|')) {
		        return new EmptyNode();
	        }
	        this.index = index;
	        return null;
	    }

	    if (this.hasMore()) {
	        index = this.index;
	        var node2 = this.regexpNoUnion();
	        if (!node2 || node2 instanceof EmptyNode) {
		        return node;
	        }
	        return new SequenceNode(node, node2);
	    } else {
	        return node;
	    }
    },
    regexpNoConcat: function() {
	    var index = this.index;
	    var node = this.regexpBasic();
	    if (!node) {
	        this.index = index;
	        return null;
	    }

	    var node2 = this.regexpOp();
	    if (!node2) {
	        // Getting no ops is perfectly okay. We assume it to be a
	        // single application of 'node'
	        return node;
	    }
	    return new ApplyOpsNode(node, node2);
    },
    regexpOp: function() {
	    if (this.hasMore()) {
	        var nextToken = this.peek();
	        var node = null;
	        switch (nextToken) {
	        case '*':
		        this.get();
		        node = new OpNode('*');
		        break;
	        case '+':
		        this.get();
		        node = new OpNode('+');
		        break;
	        case '?':
		        this.get();
		        node = new OpNode('?');
		        break;
	        }
	        if (!node) {
		        return null;
	        }
	        var node2 = this.regexpOp();
	        if (!node2) {
		        return node;
	        }
	        return new SequentialOpsNode(node, node2);
	    } else {
	        return null;
	    }
    },
    regexpBasic: function() {
	    var index = this.index;
	    var nextToken = this.peek();
	    var node = null;
	    switch (nextToken) {
	    case '[':
	        this.get();
	        node = this.charClass();
	        if (!this.nextIs(']')) {
		        // Parse error
		        // return new Error("Expcted ']', got '" + this.peek() + "'");
		        this.index = index;
		        return null;
	        }
	        this.get();
	        break;
	    case '(':
	        this.get();
	        node = this.regexp();
	        if (!this.nextIs(')')) {
		        // Parse error
		        // return new Error("Expected ')', got '" + this.peek() + "'");
		        this.index = index;
		        return null;
	        }
	        this.get();
	        break;
	    default:
	        node = this.singleEscapedChar();
	        if (!node) {
		        node = this.singleChar();
	        }
	        if (!node) {
		        // return new Error("Could not parse rule regexpBasic");
		        this.index = index;
		        return null;
	        }
	    }
	    // node could be an instance of 'Error'
	    return node;
    },
    charClass: function() {
	    var index = this.index;
	    var node = null;
	    var negated = false;
	    if (this.nextIs('^')) {
	        this.get();
	        negated = true;
	    }
	    node = this.charRangesOrSingles();
	    if (!node) {
	        this.index = index;
	        return null;
	    }
	    if (negated) {
	        node = new NegationNode(node);
	    }
	    return node;
    },
    charRangesOrSingles: function() {
	    var index = this.index;
	    var node = this.charRange();
	    if (!node) {
	        node = this.singleEscapedChar();
	    }
	    if (!node) {
	        node = this.singleChar();
	    }
	    if (!node) {
	        this.index = index;
	        return null;
	    }
	    var node2 = this.charRangesOrSingles();
	    if (node2) {
	        return new CharListNode(node, node2);
	    }
	    return node;
    },
    charRange: function() {
	    var index = this.index;
	    var char1 = this.singleChar();
	    if (!char1) {
	        return null;
	    }
	    if (!this.nextIs('-')) {
	        this.index = index;
	        return null;
	    }
	    this.get();
	    var char2 = this.singleChar();
	    if (!char2) {
	        this.index = index;
	        return null;
	    }
	    return new CharRangeNode(char1, char2);
    },
    singleChar: function() {
	    var nextToken = this.peek();
	    var disallowedTokens = "\\()[]|^$";
	    if (disallowedTokens.indexOf(nextToken) != -1) {
	        return null;
	    } else {
	        return new SingleChar(this.get());
	    }
    },
    singleEscapedChar: function() {
	    var index = this.index;
	    var nextToken = this.peek();
	    if (nextToken != '\\') {
	        return null;
	    }
	    this.get();
	    if (!this.hasMore()) {
	        this.index = index;
	        return null;
	    }
	    return new EscapedChar(this.get());
    }
};

function RegExpNFA(expression) {
    this.parser = new RegExpParser(expression);
    this.nfa = null;
}

function processNode(node, nodeNum) {
    if (node.id) {
	    return nodeNum;
    }
    node.id = nodeNum++;
    var keys = Object.keys(node.transitions);
    keys.forEach(function(key) {
	    var nodes = node.transitions[key];
	    nodes.forEach(function(n) {
	        nodeNum = processNode(n, nodeNum);
	    });
    });
    return nodeNum;
}

function numberNodes(nfa, nodeNum) {
    var keys;
    nodeNum = processNode(nfa[0], nodeNum);
    nodeNum = processNode(nfa[1], nodeNum);
    return nodeNum;
}

RegExpNFA.prototype = {
    toNFA: function() {
	    var parsed = this.parser.parse();
        this.nfa = parsed.toNFA();
	    numberNodes(this.nfa, 1);
	    this.nfa[1].isFinal = true;
        return this.nfa;
    },
    resetIndexes: function(node) {
        var q = [ node ];
        var top;
        while (q.length != 0) {
            top = q.shift();
	        top.index = -2;
            // Process child nodes
	        var keys = Object.keys(top.transitions);
	        keys.forEach(function(key) {
		        var nodes = top.transitions[key];
		        nodes.forEach(function(n) {
                    if (!n.hasOwnProperty('index') || n.index != -2) {
                        n.index = -2;
                        q.push(n);
                    }
		        }.bind(this));
	        }.bind(this));
	    } // while (q.length != 0)
    },
    toDot: function() {
	    var nfa = this.toNFA();
	    this.resetIndexes(nfa[0]);
	    var q = [ nfa[0] ];
	    var dot = [ 'digraph NFA {' ];
	    while (q.length != 0) {
	        var top = q.shift();
	        top.index = 1;
	        if (top.isFinal) {
		        dot.push(util.format('  %s[style=bold]', top.id));
	        }
	        var keys = Object.keys(top.transitions);
	        keys.forEach(function(key) {
		        var nodes = top.transitions[key];
		        nodes.forEach(function(n) {
		            dot.push(util.format('  %s -> %s[label=" %s"]',
					                     top.id, n.id, key));
		            if (n.index == -2) {
			            n.index = 1;
			            q.push(n);
		            }
		        });
	        });
	    } // while (q.length != 0)
	    dot.push('}');
	    return dot.join('\n');
    }
};

/**
 * Add 'node' to the queue and expands all transitions originating
 * from 'node' on epsilon (no input). Adds all the expanded nodes to
 * queue 'q'. 'addedNodes' is a map that indicates whether the node
 * 'node' has already been added to the queue 'q'. This function
 * recursively expands all epsilon transitions till it can not expand
 * any more or all nodes have been added.
 *
 */
function addNode(node, q, addedNodes) {
    if (addedNodes[node.id]) {
        return;
    }
    addedNodes[node.id] = node;
    q.push(node)
    if (!node.transitions.hasOwnProperty(epsilon)) {
        return;
    }
    node.transitions[epsilon].forEach(function(n) {
        addNode(n, q, addedNodes);
    });
}

function addMatches(matches, addedNodes, i) {
    addedNodes.forEach(function(node) {
        if (node.isFinal) {
            matches.push(i);
        }
    });
}

/**
 * Searches string 'str' using automation 'nfa' using Thompson's O(nm)
 * searching algorithm by maintaining 2 queues.
 *
 */
function searchNFA(str, nfa, matches) {
    var top;
    var q1 = [ ], q2 = [ ];
    var q = q1;
    var i = -1;
    var j;
    var addedNodes = [ ];

    addNode(nfa, q, addedNodes);
    addMatches(matches, addedNodes, i);

    for (i = 0; i < str.length; ++i) {
        addedNodes = [ ];
        var otherq = (q == q1 ? q2 : q1);
        for (j = 0; j < q.length; ++j) {
            if (q[j].transitions.hasOwnProperty(str[i])) {
                q[j].transitions[str[i]].forEach(function(n) {
                    addNode(n, otherq, addedNodes);
                });
            }
        }
        addMatches(matches, addedNodes, i);
        q.splice(0);
        q = otherq;
    }
}

function search(str, reNFA) {
    var matches = [];
    RegExpNFA.prototype.resetIndexes(reNFA[0]);
    reNFA[0].index = -1;
    searchNFA(str, reNFA[0], matches);
    return matches;
}

exports.RegExpParser = RegExpParser;
exports.RegExpNFA = RegExpNFA;
exports.search = search;
