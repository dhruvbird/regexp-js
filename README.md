regexp-js
=========

Regular Expression Parsing and evaluation in javascript (for fun and education)

## Roadmap

* Working recursive descent regular expression (RE) parser
* Convert RE into an abstract syntax tree (AST)
* Convert AST to NFA
* Print NFA using GraphViz to verify correctness and visualize
* Match a string against the RE using the NFA
* Convert NFA to DFA
* Print DFA using GraphViz to verify correctness and visualize
* Match a string against the RE using the DFA

There are unit tests to verify correct operation of the matching algorithms.
Unit tests to verify correctness of the generated NFA don't yet exist.

## Installing

```bash
git clone git@github.com:dhruvbird/regexp-js.git
cd regexp-js
npm install .
sudo apt-get install graphviz # To run visualize.js
```

## Exercises

1. Add support for character escapes ```\w \W \0 \d and \D``` as mentioned on [this page](http://www.javascriptkit.com/javatutors/redev2.shtml). Requires you to make minor changes to:
  * The parsing code (function ```singleEscapedChar```)
  * The AST generation code (function ```EscapedChar```)
  * No changes to the NFA/DFA generation or the matching code
2. Add support for quantifiers ```{n}, {n,} and {n,m}``` as mentioned on [this page](http://www.javascriptkit.com/javatutors/redev2.shtml). Requires you to make some changes to:
  * The grammar (CFG)
  * The parsing rules (and hence the parsing code in the function ```regexpOp```)
  * The AST generation code (function ```OpsNode``` and ```SequentialOpsNode```)
  * All the \*Node functions to add support for a ```clone``` method since supporting a sequence of ```{n,m}``` matches would have to supported by replicating the NFA for the sequence that is being repeated.
  * No changes to the NFA/DFA generation or the matching code
3. Add support for capturing subexpression (but no backreferences) so that users can refer to the 1st, 2nd, etc... captured parenthesized subexpression. Requires you to make changes to:
  * The parsing code (function ```regexpBasic```) to add support for creating a new node for a parenthesized subexpression
  * Create a new subexpression node type so that the real expression can be embedded within it
  * The NFA generation code to add dummy nodes that indicate the start and end of a subexpression and link the 2 so that we know when a subexpression begins and ends when we encounter these nodes while simulating the NFA
  * Apart from the above we might need to make changes to other helper functions to record and pass around state and probably change the search/matching functions to record wrapped NFA nodes in the queue rather than real NFA nodes (since we want to store other metadata along with a 
node in the queue)
4. Limit the time spent converting an NFA to a DFA. If we spend a lot of time converting an NFA to a DFA, the cost of doing so might outweight the cost of matching using the NFA in the first place. Re-engineer the ```toDFA``` function to accept a parameter ```maxOperations``` that denotes the maximum number of *operations* that the NFA -> DFA converter is allowed to perform before bailing out.
5. Add support for matching input streams (versus input strings). This means that you should be able to match the input when you feed in parts of it at a time. For example, consider the following (hypothetical) API:

```javascript
var re = new regexp.RegExpStreaming("(a|b)*b");
var data = file.read(64); // Read 64 bytes from 'file'
var m = [ ];
while (data) {
  m = re.feedSearch(data);
  if (m.length > 0) {
    console.log("Found matches at indexes:", String(m), "in input");
  }
  data = file.read(64);
}
```
This can be accomplished entirely by making changes to the string searching/matching code by always saving the state that the NFA/DFA is currently in and continuing the match from where we left off last.
  * In case of the NFA matcher, we need to keep track of all the states in the queue when we processed the last character of input.
  * In case of the DFA matcher, we need only track the last that that our FSA was in when we matched the last character of input.

This is an [example of a streaming regexp matching library](https://github.com/agentzh/sregex) written in C.
