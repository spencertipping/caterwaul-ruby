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
//   caterwaul.ruby('# hi there\nfoo').comments[0][0].position     // -> {line: 0, column: 2}



// Generated by SDoc 
