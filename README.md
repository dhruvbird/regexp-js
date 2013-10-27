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

## Exercises

1. Add support for character escapes ```\w \W \0 \d and \D``` as mentioned on [this page](http://www.javascriptkit.com/javatutors/redev2.shtml). Requires you to make minor changes to:
..* The parsing code (function ```singleEscapedChar```)
..* The AST generation code (function ```EscapedChar```)
..* No changes to the NFA/DFA generation or the matching code
2. Add support for quantifiers ```{n}, {n,} and {n,m}``` as mentioned on [this page](http://www.javascriptkit.com/javatutors/redev2.shtml). Requires you to make some changes to:
..* The grammar (CFG)
..* The parsing rules (and hence the parsing code in the function ```regexpOp```)
..* The AST generation code (function ```OpsNode``` and ```SequentialOpsNode```)
..* All the \*Node functions to add support for a ```clone``` method since supporting a sequence of ```{n,m}``` matches would have to supported by replicating the NFA for the sequence that is being repeated.
..* No changes to the NFA/DFA generation or the matching code
