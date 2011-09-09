// Caterwaul Ruby parser | Spencer Tipping
// Licensed under the terms of the MIT source code license

// Introduction.
// This file adds a ruby() method to the global caterwaul object. The ruby() method takes an object that responds to toString() and parses it according the grammar defined in Ruby 1.9.2's
// parse.y. The parse tree is returned as a Caterwaul parse tree, and you can use the normal wildcard syntax to match against it.

// This parser is written differently from the Caterwaul Javascript parser in a couple of ways. First, it's written in combinatory style instead of being an operator-precedence parser. This makes
// it slower but easier to maintain. The other difference is that this parser annotates each node with its original position within the source code, and it records comments. This allows nearly
// complete reconstruction of the original source from the parse tree. These additional attributes are stored on syntax nodes:

// | caterwaul.ruby('def foo; end').comments       // -> []
//   caterwaul.ruby('def foo; end').position       // -> {line: 0, column: 0}
//   caterwaul.ruby('def foo; end').data           // -> 'def'

// Comment nodes are stored in the usual kind of form; that is, they're unary nodes whose operator is the type of comment that was used. For example:

// | caterwaul.ruby('# hi there\nfoo').comments[0].data            // -> '#'
//   caterwaul.ruby('# hi there\nfoo').comments[0][0].data         // -> 'hi there'
//   caterwaul.ruby('# hi there\nfoo').comments[0].comments        // -> null
//   caterwaul.ruby('# hi there\nfoo').comments[0].position        // -> {line: 0, column: 0}
//   caterwaul.ruby('# hi there\nfoo').comments[0][0].position     // -> {line: 0, column: 2}
//   caterwaul.ruby('# hi there\nfoo').position                    // -> {line: 1, column: 0}
//   caterwaul.ruby('# hi there\nfoo').data                        // -> 'foo'

// Implementation.
// Most syntax forms are parsed in a straightforward way, though some are more involved. Invocation nodes are probably the most different from the way they're represented in Javascript. Both the
// receiver and the optional block are children of the () node; the layout is [receiver, method_name, arguments, block]. Implicit receivers are denoted with an 'implied self' node.

// Do-blocks and braces are distinct despite being semantically equivalent. The reason has to do with precedence folding, which is implemented during the parse but after combinatory lexing. The
// code should also be visually reconstructible back into its original form.

// Like Javascript syntax trees, keywords and such are represented as data with no other metadata to distinguish them. This can be a little tricky because certain keywords can be used as method
// names; however, the ambiguity can be resolved by checking for the presence or absence of children. Leaf nodes are always identifiers or nullary keywords, whereas nontrivial nodes are always
// operators of some sort. This parser preserves Caterwaul's convention of denoting invocation-like things with matching braces, and container types such as hashes and arrays with just opening
// braces. So, for instance, 'x {foo}' uses a '{}' node because it's an executable block, whereas '{foo => bar}' uses a '{' node because it's a data container.

// This parser is designed using Ruby's parse.y, though none of parse.y is included verbatim here (not sure what this means for licensing...). The parsing structure is also somewhat different;
// like Caterwaul's parser, this one is looser about parsing things than Ruby's grammar since we can conveniently assume that the input is well-formed. In particular, here are the forms it knows
// how to parse:

// | def _x._y _params \n _stuff end                       ("def" ("." _x _y) _params _stuff)
//   def _x _params \n _stuff end                          ("def" _x _params _stuff)
//   def _x._y(_params) _stuff end                         ("def" ("." _x _y) _params _stuff)
//   def _x(_params) _stuff end                            ("def" _x _params _stuff)
//   class _name _stuff end                                ("class" _name () _stuff)
//   class _name < _parent _stuff end                      ("class" _name _parent _stuff)
//   class << _x _stuff end                                ("class" ("<<" _x) _stuff)
//   module _name _stuff end                               ("module" _name _stuff)
//   alias _v1 _v2                                         ("alias" _v1 _v2)

// | _e1 _modifier _e2                                     ("_modifier" _e1 _e2)                                   _modifier <- [if unless while until rescue]
//   _e1 _op _e2                                           ("_op" _e1 _e2)                                         _op <- [+ - * / ...]
//   _e1 _e2, _e3, ..., _en                                ("()" _e1 ("," _e2 _e3 ... _en) (""))
//   _e1 _e2, _e3, ..., _en do _params _stuff end          ("()" _e1 ("," _e2 _e3 ... _en) ("do" _params _stuff))
//   _e1(_e2, _e3, ..., _en) do _params _stuff end         ("()" _e1 ("," _e2 _e3 ... _en) ("do" _params _stuff))
//   _e1(_e2, _e3, ..., _en) { _params _stuff }            ("()" _e1 ("," _e2 _e3 ... _en) ("{}" _params _stuff))
//   _e do _params _stuff end                              ("()" _e (",") ("do" _params _stuff))
//   _e { _params _stuff }                                 ("()" _e (",") ("{}" _params _stuff))
//   {_k1 => _v1, _k2 => _v2, ...}                         ("{" ("," ("=>" _k1 _v1) ("=>" _k2 _v2) ...))
//   {_k1: _v1, _k2: _v2, ...}                             ("{" ("," (":" _k1 _v1) (":" _k2 _v2) ...))

caterwaul.js_all()(function ($) {
  
  })($);

// Generated by SDoc 
