## What is the complexity of matching a string against a regular expression?

It depends... on what method of matching you use and what operations
one wishes to perform while matching a string against a regexp. See
[Regular Expression matching in the wild: Match](http://swtch.com/~rsc/regexp/regexp3.html#step4) for the
possible questions one might ask of a regular expression matcher. I'll
list them out here for brevity.

1. <b>Does the regexp match the whole string?</b>

    This question can be answered by constructing a DFA from the
    regexp and simulating the input on the resulting DFA.

2. <b>Does the regexp match a substring of the string?</b>

    This question can be answered by prefixing the original regular
    expression with <b>.*</b> and constructing a DFA from the regexp
    and simulating the input on the resulting DFA.

3. <b>Does the regexp match a substring of the string? If so, where?</b>

    This question can be answered by prefixing the original regular
    expression with <b>.*</b> and constructing a DFA from the regexp
    and simulating the input on the resulting DFA. Then, we construct
    the reverse DFA and match the reverse DFA with the reversed input,
    starting from the point where the match terminated, and trace
    where the reverse DFA matches the reversed string.

4. <b>Does this regexp match this string? If so, where? Where are the submatches?</b>

    This question can only be answered by constructing an NFA from the
    regexp and simulating the input on the resulting NFA.

### What are the costs of constructing an NFA and a DFA from a regular expression?

1. Constructing an NFA from a regular expression using [Thompson's
   construction](https://en.wikipedia.org/wiki/Thompson's_construction_algorithm)
   costs ```O(m)```, where ```m``` is the length of the regular
   expression.

2. Constructing a DFA from a regular expression involves first
   constructing an NFA from the regular expression and then converting
   the NFA to a DFA. Converting an NFA to a DFA costs
   O(2<sup>m</sup>S), where ```m``` is the length of the regular
   expression, and ```S``` is the number of symbols in the input
   alphabet.

### What are the costs of matching input against an NFA and a DFA?

1. Matching an NFA with ```m``` states against a string of length
   ```n``` costs O(mn). See [Implementation: Simulating the
   NFA](http://swtch.com/~rsc/regexp/regexp1.html) for details on how
   to simulate an NFA on an input string. The extra space requirement
   is O(m).

2. Matching an DFA with ```m``` states against a string of length
   ```n``` costs O(n). The extra space requirement is O(1).

3. Matching an NFA with ```m``` states and ```c``` capture groups
   against a string of length ```n``` costs O(mn log c). The ```log
   c``` factor comes from the fact that capture sets need to be
   updated and copied from one node to the next in the queue of
   nodes. This copy can be performed using a [functional data
   structure](https://en.wikipedia.org/wiki/Persistent_data_structure)
   using [path copying with an extra
   pointer](http://rtm.science.unitn.it/reactive-search/thebook/node36.html),
   which allows us to support this case using O(m) extra memory, which
   is the same as matching using an NFA without supporting sub-match
   captures.

### Capturing sub-matches

To capture sub-matches, we need to create pseudo nodes in the NFA that
update the capture set and tag the corresponding sub-match group as
having started/ended when that state is hit (typically when an open
parenthesis and a close parenthesis in the regular expression is
seen).

We start off with an empty list (balanced binary tree search tree
keyed by capture group number) that represents the capture set for the
initial node in the NFA. Every time we want to update the capture set,
we need to insert/update the corresponding node in the binary tree,
which costs O(log c) per operation, but the space requirement per
operation is amortized O(1) since we use a persistent data structre
with [path copying and an extra
pointer](http://rtm.science.unitn.it/reactive-search/thebook/node36.html)
for this operation.

If we don't update the capture set, we can just copy the root node of
the binary tree that holds the capture set, and the cost of doing so
is O(1). However, in the worst case, we could copy capture sets for
every node added to the queue. Every node can represent only at most
one open or close parenthesis, so we update at most one sub-match
capture group per node added to the queue.

### Useful Links

1. [Regular Expression Matching Can Be Simple And Fast](http://swtch.com/~rsc/regexp/regexp1.html) and [an insightful comment set](http://lambda-the-ultimate.org/node/2064)
2. [Regular Expression Matching: the Virtual Machine Approach](http://swtch.com/~rsc/regexp/regexp1.html)
3. [Regular Expression Matching in the Wild](http://swtch.com/~rsc/regexp/regexp1.html)
4. [Regular Expression Matching with a Trigram Index OR How Google Code Search Worked](http://swtch.com/~rsc/regexp/regexp1.html)
5. [Implementation of Algorithms for State Minimisation and Conversion of Regular Expressions to and from Finite Automata](http://regex-automaton.com/introduction.php)
6. [Compiler construction toolkit: Regexp to NFA](http://hackingoff.com/compilers/regular-expression-to-nfa-dfa)
7. [Regular Expressions/Implementations: Wikibooks](https://en.wikibooks.org/wiki/Regular_Expressions/Implementation)
8. [Path Copying with an Extra Pointer to implement balanced search trees using O(1) extra memory per operation](http://rtm.science.unitn.it/reactive-search/thebook/node36.html)
