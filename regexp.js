/* -*- indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*- */
var util = require('util');
var _ = require('underscore');
var assert = require('assert').ok;

var MIN_CHAR=String.fromCharCode(0);
var MAX_CHAR=String.fromCharCode(65535);
var FLAG_UNIFIED = 1;
var FLAG_CAPTURE_ALL = 1;

var epsilonPrintable = "\u03F5";
var epsilon = 'eps';
// Create a new NFA node. Ids are assigned to nodes later
function NFANode() {
    // Each element of this.transitions is an object of the form:
    // { cmpKey: ub+lb, key: { lb: .., ub: .. }, nodes: [ .. ] }
    this.transitions = [ ];
    this.epsilonTransitions = [ ];
    // Always copy the capture set when we move from one thread to
    // another.
    this.captures = [ ];
    // Optional attributes:
    this.id = -2;
    this.isFinal = false;
    this.groupNum = -2;
    this.startIndex = -2;
    this.endIndex = -2;
}

NFANode.prototype = {
    on: function(toNode, input) {
        var isEpsilonTransition = !input || input == epsilon;
        if (isEpsilonTransition) {
            this.epsilonTransitions.push(toNode);
            return this;
        }
        // console.log("Got Transition on:", input);
        if (typeof(input) === "string") {
            var tmp = { lb: input, ub: input };
            input = tmp;
        }
        // console.log(input);
        var cmpKey = input.lb + input.ub;
        // Assume that we don't have multiple transitions on the same
        // input. That should be performed using epsilon transitions.
        this.transitions.push({ cmpKey: cmpKey,
                                key: input,
                                nodes: [ toNode ]
                              });
        return this;
    },
    getTransitionsOn: function(input) {
        if (input == epsilon) {
            return this.epsilonTransitions;
        }
        var i;
        var ret = [ ];
        for (i = 0; i < this.transitions.length; ++i) {
            var tr = this.transitions[i];
            if (input >= tr.key.lb && input <= tr.key.ub) {
                if (ret.length === 0) {
                    ret = tr.nodes;
                } else {
                    ret = ret.concat(tr.nodes);
                }
            }
        }
        return ret;
    },
    hasTransitionOn: function(input) {
        return this.getTransitionsOn(input).length > 0;
    },
    numTransitionSymbols: function() {
        // The number of distinct characters (code-points) on which
        // there is a transition from this node, outwards.
        var numSyms = 0;
        var i;
        for (i = 0; i < this.transitions.length; ++i) {
            var tr = this.transitions[i];
            numSyms += (tr.ub.charCodeAt(0) - tr.lb.charCodeAt(0) + 1);
        }
        return numSyms;
    },
    getTransitionSymbols: function() {
        // Return all transition symbols except for epsilon.
        //
        // Note: This can be a fairly expensive function, so always
        // use the cheaper numTransitionSymbols() before calling this
        // function instead of calling this function and checking the
        // length of the returned array.
        var syms = [ ];
        var i, j;
        for (i = 0; i < this.transitions.length; ++i) {
            var tr = this.transitions[i];
            for (j = tr.lb; j <= tr.ub; ++j) {
                syms.push(j);
            }
        }
        return syms;
    },
    getAllTransitionNodes: function() {
        // Returns all nodes that can be reached from the current node
        // with a single hop.
        var nodes = [ ];
        var i;
        for (i = 0; i < this.transitions.length; ++i) {
            var tr = this.transitions[i];
            nodes = nodes.concat(tr.nodes);
        }
        nodes = nodes.concat(this.epsilonTransitions);
        return nodes;
    },
    getAllTransitions: function() {
        var tr = [ ];
        tr = tr.concat(this.transitions);
        tr.push({ keyCmp: epsilonPrintable + epsilonPrintable,
                  key: { lb: epsilonPrintable, ub: epsilonPrintable },
                  nodes: this.epsilonTransitions
                });
        return tr;
    },
    isCaptureStart: function() {
        return this.startIndex != -2;
    },
    isCaptureEnd: function() {
        return this.endIndex != -2;
    },
    clone: function(captures) {
        var nn = new NFANode();
        var node = this;
        nn.transitions = node.transitions;
        nn.epsilonTransitions = node.epsilonTransitions;
        nn.id = node.id;
        nn.isFinal = node.isFinal;
        nn.groupNum = node.groupNum;
        nn.startIndex = node.startIndex;
        nn.endIndex = node.endIndex;
        // The capture set is deep copied.
        nn.captures = captures.slice(0);
        return nn;
    }
};

function NFACaptureNode(groupNum, startIndex, endIndex) {
    assert(groupNum == 0 || startIndex != endIndex);
    assert(startIndex == -2 || endIndex == -2);
    var captureNode = new NFANode();
    captureNode.groupNum = groupNum;
    captureNode.startIndex = startIndex;
    captureNode.endIndex = endIndex;
    return captureNode;
}

function DFANode(id) {
    // Each element of this.transitions is a DFANode
    this.transitions = { };
    this.id = id;
}

DFANode.prototype = {
    on: function(toNode, input) {
        if (!toNode || !input) {
            throw new Error("Usage: on(node, input)");
        }
        if (this.transitions.hasOwnProperty(input)) {
            throw new Error(
                util.format("You already have a transition on input '%s'",
                            input));
        }
        this.transitions[input] = toNode;
        return this;
    }
};

function RegExpParser(expression) {
    this.expression = expression;
    this.root = null;
    this.index = 0;
    this.expLen = this.expression.length;
    this.error = '';
    this.groupNum = 1;
}

function ParenthesizedNode(groupNum, startIndex, endIndex, node) {
    this.groupNum = groupNum;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.node = node;
}
ParenthesizedNode.prototype = {
    toNFA: function() {
        var lhs = new NFANode();
        var rhs = new NFANode();
        var parenOpen = new NFACaptureNode(this.groupNum, this.startIndex, -2);
        var parenClose = new NFACaptureNode(this.groupNum, -2, this.endIndex);
        var npair = this.node.toNFA();

        lhs.on(parenOpen);
        parenOpen.on(npair[0]);

        npair[1].on(parenClose);
        parenClose.on(rhs);
        return [ lhs, rhs ];
    }
};

function AnchoredNode(node, leftAnchored, rightAnchored) {
    this.node = node;
    this.leftAnchored = leftAnchored;
    this.rightAnchored = rightAnchored;
}
AnchoredNode.prototype = {
    toNFA: function() {
        var node = new ParenthesizedNode(0, -1, 1024, this.node);
        // console.log("Generated group 0");
        if (!this.leftAnchored) {
            var opNode = new OpNode('*');
            var symNode = new SingleChar('.');
            var acceptAny = new ApplyOpsNode(symNode, opNode);
            node = new SequenceNode(acceptAny, node);
        }
        return node.toNFA();
    }
};

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
            nodePair[0].on(nodePair[1]);
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

function NFANodeFromCharList(charList, flags) {
    var lhs = new NFANode();
    var rhs = new NFANode();
    if (!(flags & FLAG_UNIFIED)) {
        charList = unifiedCharList(charList);
    }
    // console.log("Unified charlist:", charList);
    for (var i = 0; i < charList.length; ++i) {
        lhs.on(rhs, charList[i]);
    }
    return [ lhs, rhs ];
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

function unifiedCharList(charList) {
    var unified = [ ];
    var i;
    var inflections = [ ];
    var started = [ ];
    var TYPE_START = 1;
    var TYPE_END = 2;
    for (i = 0; i < charList.length; ++i) {
        charList.id = i;
        inflections.push({ ch: charList[i].lb, id: i, type: TYPE_START });
        inflections.push({ ch: charList[i].ub, id: i, type: TYPE_END   });
        started[i] = false;
    }
    inflections.sort(function(lhs, rhs) {
        if (lhs.ch == rhs.ch) {
            return lhs.type - rhs.type;
        }
        return lhs.ch - rhs.ch;
    });
    // console.log("inflections:", inflections);
    var stk = [ ];
    var point;
    for (i = 0; i < inflections.length; ++i) {
        point = inflections[i];
        if (!started[point.id]) {
            stk.push(point.ch);
            started[point.id] = true;
        } else {
            if (stk.length == 1) {
                unified.push({ lb: stk[0], ub: point.ch });
            }
            stk.pop();
        }
    }
    return unified;
}

function negateCharList(charList) {
    // First find all the inclusive ranges (since input ranges may
    // overlap), and then negate the inclusive range to get the
    // negated range.
    var negated = [ ];
    var i;
    var ch = MIN_CHAR;
    var unified = unifiedCharList(charList);
    for (i = 0; i < unified.length; ++i) {
        var nextCh = String.fromCharCode(unified[i].ub.charCodeAt(0) + 1)
        var endCh = String.fromCharCode(unified[i].lb.charCodeAt(0) - 1)
        if (unified[i].lb > ch) {
            negated.push({ lb: ch, ub: endCh });
        }
        ch = nextCh;
    }
    if (ch < MAX_CHAR) {
        negated.push({ lb: ch, ub: MAX_CHAR });
    }
    return negated;
}

function CharRangeNode(lhs, rhs) {
    this.lhs = lhs.ch;
    this.rhs = rhs.ch;
}
CharRangeNode.prototype = {
    getCharList: function() {
        var ret;
        if (this.lhs.toLowerCase() === this.lhs && this.rhs.toLowerCase() === this.rhs) {
            if (this.lhs > this.rhs) {
                throw new Error(util.format("CharRangeNode: %s not <= %s", this.lhs, this.rhs));
            }
            ret = { lb: this.lhs, ub: this.rhs };
        } else if (this.lhs.toUpperCase() === this.lhs && this.rhs.toUpperCase() === this.rhs) {
            if (this.lhs > this.rhs) {
                throw new Error(util.format("CharRangeNode: %s not <= %s", this.lhs, this.rhs));
            }
            ret = { lb: this.lhs, ub: this.rhs };
        } else {
            throw new Error("Character range must be in the same case (lower or upper)");
        }
        // console.log("Returning:", ret);
        return [ ret ];
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
            return negateCharList([ { lb: '\n', ub: '\n' } ]);
	    }
        return [ { lb: this.ch, ub: this.ch } ];
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

function charsToCharList(chars) {
    var ret = [ ];
    var i;
    for (i = 0; i < chars.length; ++i) {
        ret.push({ lb: chars[i], ub: chars[i] });
    }
    return ret;
}

function EscapedChar(ch) {
    this.ch = ch;
}
EscapedChar.prototype = {
    getCharList: function() {
        var ret = [];
        switch (this.ch) {
        case 's':
            ret = charsToCharList(wsChars);
            break;
        case 'S':
            ret = negateCharList(charsToCharList(wsChars));
            break;
        default:
            ret = [ { lb: this.ch, ub: this.ch } ];
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
        var charList = negateCharList(this.node.getCharList());
        return NFANodeFromCharList(charList, FLAG_UNIFIED);
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
        this.groupNum = 1;
        this.error = '';
        var parsed = this.regexpTopLevel();
	    return parsed;
    },
    regexpTopLevel: function() {
	    var index = this.index;
        var leftAnchored = false;
        var rightAnchored = true;
        if (this.nextIs('^')) {
            leftAnchored = true;
            this.get();
        }
        var node = this.regexp();
        if (this.nextIs('$')) {
            rightAnchored = true;
            this.get();
        }
        if (this.hasMore()) {
            this.error = util.format(
                "Premature end of input. Stray '%s' found at index '%d'",
                this.peek(),
                this.index
            );
            return null;
        }
        return new AnchoredNode(node, leftAnchored, rightAnchored);
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
		        // Maybe bracketed subexpression or end of RE with a $
		        // at the end??
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
                this.error = 'Expected [*+?], Got: [' + nextToken + ']';
		        return null;
	        }
	        var node2 = this.regexpOp();
	        if (!node2) {
		        return node;
	        }
	        return new SequentialOpsNode(node, node2);
	    } else {
            this.error = 'Expected [*+?], Got: { end of input }';
	        return null;
	    }
    },
    regexpBasic: function() {
	    var index = this.index;
	    var nextToken = this.peek();
	    var node = null;
        var parenStartIndex, parenEndIndex;
        var groupNum;
	    switch (nextToken) {
	    case '[':
	        this.get();
	        node = this.charClass();
	        if (!this.nextIs(']')) {
		        // Parse error
		        this.error = "Expcted ']', got '" + this.peek() + "'";
		        this.index = index;
		        return null;
	        }
	        this.get();
	        break;
	    case '(':
            parenStartIndex = this.index;
            groupNum = this.groupNum++;
	        this.get();
	        node = this.regexp();
            if (!node) break;
	        if (!this.nextIs(')')) {
		        // Parse error
		        this.error = "Expected ')', got '" + this.peek() + "'";
		        this.index = index;
		        return null;
	        }
            parenEndIndex = this.index;
            node = new ParenthesizedNode(groupNum,
                                         parenStartIndex,
                                         parenEndIndex,
                                         node);
	        this.get();
	        break;
	    default:
	        node = this.singleEscapedChar();
	        if (!node) {
		        node = this.singleChar();
	        }
	        if (!node) {
		        this.index = index;
		        return null;
	        }
	    }
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
            this.error = "Expected '\\', Got: '" + nextToken + "'";
	        return null;
	    }
	    this.get();
	    if (!this.hasMore()) {
            this.error = "Expected { escape character after \\ }, Got: { end of input }";
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
    if (node.id != -2) {
	    return nodeNum;
    }
    node.id = nodeNum++;
    var children = node.getAllTransitionNodes(); // Object.keys(node.transitions);
    children.forEach(function(n) {
	    nodeNum = processNode(n, nodeNum);
    });
    return nodeNum;
}

/**
 * Label (assigns numbers) [ids] to nodes in a finite automaton.
 *
 */
function labelNodes(nfa, nodeNum) {
    var keys;
    nodeNum = processNode(nfa[0], nodeNum);
    nodeNum = processNode(nfa[1], nodeNum);
    return nodeNum;
}

function resetIndexes(node) {
    var q = [ node ];
    var top;
    while (q.length != 0) {
        top = q.shift();
	    top.index = -2;
        // Process child nodes
        var children = top.getAllTransitionNodes();
        children.forEach(function(n) {
            if (!n.hasOwnProperty('index') || n.index != -2) {
                n.index = -2;
                q.push(n);
            }
        });
	} // while (q.length != 0)
}

RegExpNFA.prototype = {
    toNFA: function() {
	    var parsed = this.parser.parse();
        this.nfa = parsed.toNFA();
	    labelNodes(this.nfa, 1);
	    this.nfa[1].isFinal = true;
        return this.nfa;
    },
    toDot: function(attrs) {
	    var nfa = this.toNFA();
	    resetIndexes(nfa[0]);
	    var q = [ nfa[0] ];
	    var dot = [ 'digraph NFA {' ];
        var dotAttrs = [ ];
        for (var attr in attrs) {
            dotAttrs.push(util.format('%s=%s', attr, attrs[attr]));
        }
        if (dotAttrs.length > 0) {
            dot.push(util.format('  %s', dotAttrs.join(', ')));
        }
	    while (q.length != 0) {
	        var top = q.shift();
	        top.index = 1;
	        if (top.isFinal) {
		        dot.push(util.format('  %s[style=bold]', top.id));
	        }
            var transitions = top.getAllTransitions();
	        transitions.forEach(function(tr) {
                var keyRange = tr.key;
                var nodes = tr.nodes;

                var label = toPrettyKey(keyRange);
                if (top.isCaptureStart()) {
                    label = util.format("%s[%s (]", label, top.groupNum);
                } else if (top.isCaptureEnd()) {
                    label = util.format("%s[%s )]", label, top.groupNum);
                }
		        nodes.forEach(function(n) {
		            dot.push(util.format('  %s -> %s[label=" %s"]',
					                     top.id, n.id, label));
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
 * Holds information about a sub-match capture and indicates the range
 * of input that matched that capture.
 *
 * The actual index in the input is [start+1..end] if start != end. If
 * start == end, then the capture is an empty match.
 *
 */
function CaptureRange(start, end) {
    this.start = start;
    this.end = end;
}
CaptureRange.prototype = {
    clone: function() {
        return new CaptureRange(this.start, this.end);
    }
}
function leftmostLongest(cr1, cr2) {
    if (cr1.lb == cr2.lb) {
        if (cr2.ub > cr1.ub) {
            return 2;
        } else {
            return 1;
        }
    } else {
        if (cr1.lb < cr2.lb) {
            return 1;
        } else {
            return 2;
        }
    }
}

/**
 * Add 'node' to the queue and expands all epsilon transitions
 * originating from 'node'. It the applies recursively the same
 * operation on all the expanded nodes.
 *
 * 'addedNodes' is a map that indicates whether the node
 * 'node' has already been added to the queue 'q'.
 *
 * This function recursively expands all epsilon transitions till it
 * can not expand any more or all nodes have been added.
 *
 */
function addNode(node, q, addedNodes, strIndex) {
    if (addedNodes[node.id]) {
        return;
    }
    // console.log(util.format("addNode(%d): captures:", node.id, node.captures));
    addedNodes[node.id] = node;
    q.push(node)

    if (!node.hasTransitionOn(epsilon)) {
        return;
    }
    var tr = node.getTransitionsOn(epsilon);
    var i, n, nn;
    for (i = 0; i < tr.length; ++i) {
        n = tr[i];
        // console.log(util.format("Expanding node# %d", n.id));
        nn = n.clone(node.captures);
        if (node.isCaptureStart()) {
            // console.log("setting captures[", node.groupNum, "] to a valid object");
            nn.captures[node.groupNum] = new CaptureRange(strIndex, -1);
        } else if (node.isCaptureEnd()) {
            // console.log("node.groupNum:", node.groupNum, "node.id:", node.id);
            // console.log("nn.captures:", nn.captures);
            assert(nn.captures[node.groupNum].start <= strIndex);
            nn.captures[node.groupNum].end = strIndex;
        }
        addNode(nn, q, addedNodes, strIndex);
    }
}

function cloneCaptures(captures) {
    var newCaptures = [];
    for (j = 0; j < captures.length; ++j) {
        if (captures[j]) {
            newCaptures[j] = captures[j].clone();
        }
    }
    return newCaptures;
}

function addCaptures(captures, addedNodes, strIndex, flags) {
    var i, j, node;
    for (i = 0; i < addedNodes.length; ++i) {
        node = addedNodes[i];
        if (!(node && node.isFinal)) {
            continue;
        }
        // console.log("Len capTures:", node.captures.length);
        if (flags & FLAG_CAPTURE_ALL) {
            captures.push(cloneCaptures(node.captures));
        } else {
            if ((captures.length > 0 &&
                 (leftmostLongest(captures[0], node.captures[0]) == 2)) ||
                (captures.length === 0)) {
                // console.log("Before cloning. Captures:", node.captures);
                captures[0] = cloneCaptures(node.captures);
            }
        }
    }
}

/**
 * Searches string 'str' using automation 'nfa' using Thompson's
 * searching algorithm by maintaining 2 queues.
 *
 * Since we also support sub-match captures, the actual running time
 * is O(nmc), where:
 *
 * n -> length of the input string
 * m -> number of states in the NFA for the RE
 * c -> number of capture expressions in the RE
 *
 * The space requirement is O(nc).
 *
 */
function searchNFA(str, nfa, captures, flags) {
    var top;
    var q1 = [ ], q2 = [ ];
    var q = q1;
    var i = -1;
    var j;
    var k;
    var addedNodes = [ ];

    addNode(nfa.clone([]), q, addedNodes, -1);
    addCaptures(captures, addedNodes, i, flags);

    for (i = 0; i < str.length; ++i) {
        addedNodes = [ ];
        // console.log("Expanding for:", str[i], ", i:", i);
        // console.log("q.length:", q.length);
        var otherq = (q == q1 ? q2 : q1);
        for (j = 0; j < q.length; ++j) {
            var transitions = q[j].getTransitionsOn(str[i]);
            // console.log("id:", q[j].id, "transitions.length:", transitions.length);
            for (k = 0; k < transitions.length; ++k) {
                var n = transitions[k];
                addNode(n.clone(q[j].captures), otherq, addedNodes, i);
            }
        }
        addCaptures(captures, addedNodes, i, flags);
        q.splice(0);
        q = otherq;
    }
}

function search(str, FSA, flags) {
    flags = flags || 0;
    var captures = [];
    if (FSA.length == 0) {
        throw new Error("Expected a FSA, got an empty array");
    }
    if (FSA[0] instanceof NFANode) {
        // resetIndexes(FSA[0]);
        // FSA[0].index = -1;
        searchNFA(str, FSA[0], captures, flags);
        // console.log("CAP (length):", captures.length);
    } else if (FSA[0] instanceof DFANode) {
    } else {
        throw new Error(
            util.format("Expected NFANode or DFANode; Got: %s",
                        (FSA[0] ? FSA[0].constructor.name : "undefined")));
    }
    return captures;
}

function epsilonClosureRecursive(states, visIndex, ret) {
    states.forEach(function(state) {
        if (state.index == visIndex) {
            return;
        }
        state.index = visIndex;
        ret.push(state);
        if (state.hasTransitionOn(epsilon)) {
            epsilonClosureRecursive(state.getTransitionsOn(epsilon), visIndex, ret);
        }
    });
}

function epsilonClosure(states, visIndex) {
    var ret = [ ];
    epsilonClosureRecursive(states, visIndex, ret);
    return ret;
}

function moveTo(states, input) {
    if (!input) {
        throw new Error("You MUST specify an input on which to move");
    }
    var ret = [ ];
    states.forEach(function(state) {
        if (state.hasTransitionOn(input)) {
            ret.push.apply(ret, state.getTransitionsOn(input));
        }
    });
    return ret;
}

function num_cmp(lhs, rhs) {
    return lhs - rhs;
}

function getStateName(states) {
    return _.uniq(states.map(function(state) {
        return String(state.id);
    }).sort(), true).join(",");
}

function isDFAFinalState(dfaNode) {
    var isFinal = (dfaNode.nfaNodes.filter(function(nfaNode) {
        return nfaNode.isFinal;
    }).length > 0);
    return isFinal;
}

function toDFA(nfa) {
    // The ID of NFA -> DFA run. This is incremented every time we
    // want a fresh epsilon closure since we want previously
    // considered nodes to be considered again in a new closure, but
    // not in the same epsilon closure.
    var visIndex = 1;
    // Stores the set of DFA states that we have already computed and
    // processed all outgoing edges for.
    var DFAStates = { };

    var dfaNodeId = 1;
    var dfa = null;

	resetIndexes(nfa[0]);

    var q = [ ];
    var n = new DFANode(dfaNodeId++);
    var nn;
    dfa = n;
    n.nfaNodes = epsilonClosure([ nfa[0] ], visIndex++);
    n.isFinal = isDFAFinalState(n);
    q.push(n);

    DFAStates[getStateName(n.nfaNodes)] = n;

    while (q.length != 0) {
        n = q.shift();
        var transitionSymbols = _.chain(n.nfaNodes.map(function(nfaNode) {
            return nfaNode.getTransitionSymbols();
        })).flatten().uniq(false).value();
        transitionSymbols.forEach(function(symbol) {
            var newNodes = moveTo(n.nfaNodes, symbol);
            newNodes = epsilonClosure(newNodes, visIndex++);
            var stateName = getStateName(newNodes);
            if (!DFAStates[stateName]) {
                // Insert and add to queue since we haven't seen this node before.
                nn = new DFANode(dfaNodeId++);
                nn.nfaNodes = newNodes;
                nn.isFinal = isDFAFinalState(nn);
                DFAStates[stateName] = nn;
                q.push(nn);
            } else {
                nn = DFAStates[stateName];
            }
            n.on(nn, symbol);

        }); // transitionSymbols.forEach(function(symbol)

    } // while (q.length != 0)
    return dfa;
}

function RegExpDFA(expression) {
    this.REnfa = new RegExpNFA(expression);
    this.dfa = null;
}

function getCharRanges(charList) {
    charList.sort();
    if (charList.length == 0) {
        return [ ];
    }
    var ret = [];
    var begin = charList[0];
    var curr = begin;
    var i;
    for (i = 1; i < charList.length; ++i) {
        if (String(charList[i]).charCodeAt(0) == String(curr).charCodeAt(0) + 1) {
            curr = charList[i];
        } else {
            if (begin == curr) {
                ret.push(begin);
            } else {
                ret.push([begin, curr]);
            }
            begin = charList[i];
            curr = begin;
        }
    }
    if (begin == curr) {
        ret.push(begin);
    } else {
        ret.push([begin, curr]);
    }
    return ret;
}

function bucketByDestinationState(transitions) {
    var nodeIdToTransitions = { };
    Object.keys(transitions).forEach(function(symbol) {
        var n = transitions[symbol];
        if (!nodeIdToTransitions.hasOwnProperty(n.id)) {
            nodeIdToTransitions[n.id] = [ ];
        }
        nodeIdToTransitions[n.id].push(symbol);
    });
    return nodeIdToTransitions;
}

function toPrettyKey(key) {
    if (key.lb && key.ub) {
        return toPrettyKey([key.lb, key.ub]);
    } else if (key instanceof Array) {
        assert(key.length == 2);
        if (key[0] == key[1]) return toPrettyKey(key[0]);
        return util.format("[%s-%s]", toPrettyKey(key[0]), toPrettyKey(key[1]));
    } else {
        if (key != epsilonPrintable &&
            (String(key).charCodeAt(0) < 32 || String(key).charCodeAt(0) > 126)) {
            return util.format("CP(%d)", key.charCodeAt(0));
        } else {
            return key;
        }
    }
}

function getNodeIdToNodeMap(transitions) {
    var nodeIdToNode = { };
    Object.keys(transitions).forEach(function(symbol) {
        var n = transitions[symbol];
        nodeIdToNode[n.id] = n;
    });
    return nodeIdToNode;
}

RegExpDFA.prototype = {
    toDFA: function() {
	    var nfa = this.REnfa.toNFA();
        this.dfa = toDFA(nfa);
        return this.dfa;
    },
    toDot: function(attrs) {
	    var dfa = this.toDFA();
	    resetIndexes(dfa);
	    var q = [ dfa ];
	    var dot = [ 'digraph DFA {' ];
        var dotAttrs = [ ];
        for (var attr in attrs) {
            dotAttrs.push(util.format('%s=%s', attr, attrs[attr]));
        }
        if (dotAttrs.length > 0) {
            dot.push(util.format('  %s', dotAttrs.join(', ')));
        }
	    while (q.length != 0) {
            var top = q.shift();
	        top.index = 1;
	        if (top.isFinal) {
		        dot.push(util.format('  %s[style=bold]', top.id));
	        }
	        var keys = Object.keys(top.transitions);
            var transitions = top.transitions;
            if (keys.length > 0) {
                // Compute the complement set
                var buckets = bucketByDestinationState(top.transitions);
                var idToNodeMap = getNodeIdToNodeMap(top.transitions);
                var bKeys = Object.keys(buckets);
                // console.log("size of buckets:", Object.keys(buckets).length);
                keys = [ ];
                transitions = { };
                bKeys.forEach(function(nodeId) {
                    var ranges = getCharRanges(buckets[nodeId]);
                    // console.log("ranges.length:", ranges.length);
                    var destNode = idToNodeMap[nodeId];
                    var transitionsKey = ranges.map(function(range) {
                        // console.log("Range:", toPrettyKey(range));
                        return toPrettyKey(range);
                    }).join(",");
                    transitions[transitionsKey] = destNode;
                    keys.push(transitionsKey);
                });
            }
	        keys.forEach(function(key) {
		        var node = transitions[key];
		        dot.push(util.format('  %s -> %s[label=" %s"]',
					                 top.id, node.id, key));
		        if (node.index == -2) {
			        node.index = 1;
			        q.push(node);
		        }
	        });
	    } // while (q.length != 0)
	    dot.push('}');
	    return dot.join('\n');
    }
};


exports.RegExpParser = RegExpParser;
exports.RegExpNFA = RegExpNFA;
exports.RegExpDFA = RegExpDFA;
exports.search = search;
exports.FLAG_CAPTURE_ALL = FLAG_CAPTURE_ALL;

if (require.main === module) {
    // var exp = "(a|b)*b";
    // var exp = "banana|bandana|batman|ball";
    // var exp = "(c?c?c?)*ccc";
    // var exp = "c?c?c?ccc";
    // var exp = "([^c]?[^c]?[^c]?)*ccc";
    // var exp = "([0369]|[258][0369]*[147]|[147]([0369]|[147][0369]*[258])*[258]|[258][0369]*[258]([0369]|[147][0369]*[258])*[258]|[147]([0369]|[147][0369]*[258])*[147][0369]*[147]|[258][0369]*[258]([0369]|[147][0369]*[258])*[147][0369]*[147])*";
    // var REdfa = new RegExpDFA(exp);
    // var dfa = REdfa.toDFA();

    // console.log(REdfa.toDot());

    // var exp = "^((ab)*)";
    var exp = "^.*x|(a*)"
    var REnfa = new RegExpNFA(exp);
    var nfa = REnfa.toNFA();
    assert(!!nfa);

    console.log("nfa:", nfa);

    var mc = search("aax", nfa)
    console.log(mc);
    console.log(JSON.stringify(mc.captures, null, 4));

    // console.log(REnfa.toDot());
}
