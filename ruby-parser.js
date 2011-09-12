// Caterwaul Ruby parser | Spencer Tipping
// Licensed under the terms of the MIT source code license

// Introduction.
// This file adds a ruby() method to the global caterwaul object. The ruby() method takes an object that responds to toString() and parses it according the grammar defined in Ruby 1.9.2's
// parse.y. The parse tree is returned as a Caterwaul parse tree, and you can use the normal wildcard syntax to match against it.

// This parser is written differently from the Caterwaul Javascript parser in a couple of ways. First, it's written in combinatory style instead of being an operator-precedence parser. This makes
// it slower but easier to maintain. The other difference is that this parser annotates each node with its original position within the source code, and it records comments. This allows nearly
// complete reconstruction of the original source from the parse tree. These additional attributes are stored on syntax nodes:

// | caterwaul.ruby('def foo; end').comments()     // -> []
//   caterwaul.ruby('def foo; end').position()     // -> {line: 0, column: 0}
//   caterwaul.ruby('def foo; end').data           // -> 'def'

// Comment nodes are stored in the usual kind of form; that is, they're unary nodes whose operator is the type of comment that was used. For example:

// | caterwaul.ruby('# hi there\nfoo').comments()[0].data          // -> '# hi there'
//   caterwaul.ruby('# hi there\nfoo').comments()[0].comments()    // -> []
//   caterwaul.ruby('# hi there\nfoo').comments()[0].position()    // -> {line: 0, column: 0}
//   caterwaul.ruby('# hi there\nfoo').position()                  // -> {line: 1, column: 0}
//   caterwaul.ruby('# hi there\nfoo').data                        // -> 'foo'

caterwaul.js_all()(function ($) {

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

  $.ruby.syntax = ctor /-$.syntax_subclass/ methods

  -where [ctor(xs = arguments) = xs[0] instanceof this.constructor ?
                                   this -se [it.data = x.data, it.length = 0, it.metadata_from(x), x *![it.push(x)] -seq, where [x = xs[0]]] :
                                   this -se [it.data = xs[0],  it.length = 0, it._comments = [], it._position = null, Array.prototype.slice.call(xs, 1) *![this.push(x)] -seq],

          methods              = capture [comments()                = this._comments,
                                          comment(c)                = this -se- it._comments.push(c),
                                          position(p)               = arguments.length ? this -se [it._position = p] : this._position,

                                          position_map(m)           = this.position(m[this.position()]).each("_.position_map(m)".qf),

                                          replicate(xs = arguments) = new this.constructor(xs[0]).metadata_from(this) -se [Array.prototype.slice.call(xs, 1) *![it.push(x)] -seq],

                                          metadata_from(n)          = this -se [it._comments = n._comments, it._position = n._position],
                                          rotate_left()             = this[1].replicate(this[1].data, this.replicate(this.data, this[0], this[1][0]), this[1][1])]],

// Positional mapping.
// Positions are mapped ahead of time and are indexed by the original offset within the input string. This means that for n characters, n positions are computed (so a linear-space overhead, which
// in practice won't be too bad). Newline characters are indexed in a counterintuitive way; their column offset is considered to be -1, and they appear on the 'next' line. I did it this way
// becaues nobody particularly cares where a newline is, and it simplified the indexer.

// As with all Caterwaul parsers, this one calls .toString() on its input to make sure that the input is, in fact, a string.

  $.ruby.parse(s) = tree.value().position_map(input /!position_map)
                    -where [input           = s.toString(),
                            tree            = [new $.parser.linear_string_state(input)] /!$.ruby.parser -re- it[0],
                            position_map(s) = n[s.length] *s.charCodeAt *[{line: l += x === 10, column: c = x === 10 ? -1 : c + 1}] -seq -where [l = 0, c = -1]],

// Combinatory Ruby parser.
// Using parser combinators to process Ruby is nontrivial. One of the hardest things to deal with is the lex-level handling of things like line and block comments. Because we want to retain these
// comments and annotate them as being 'attached' to various original source nodes, we need to handle them using the parser rather than with a preprocessor or a lexer. This means that each
// terminal node must be able to consume any toplevel lexing elements.

// This is philosophically interesting because toplevel lexing elements are often orthogonal to core code elements. For instance, the expression 'foo #bar\n bif' contains a comment that happens
// to be near 'foo', but the comment ends up playing the role of metadata on the parsed expression rather than being a part of the expression explicitly. (And the only reason we're capturing
// comments in the first place is so that they can be reconstructed in the output.)

  $.ruby.parser = statements
  -where [node = $.ruby.syntax,

// Filters.
// These aren't parsers per se. Rather, they're transformations of parsers that help deal with code-orthogonal elements. Here's a list of filters along with their purposes:

// | 1. lex_insensitive(parser)            <- Indicates that whitespace and comments are not significant to the parser, and parses any whitespace and comments before the parser. Any comments that
//                                            are found are then added to the parsed element using .comment().
//   2. record_position(parser)            <- Parses the element normally, but stores the current string offset onto the element. This will later be resolved using the position table. All
//                                            elements store their positions; this is just here to factor logic.

// Generally speaking, these three filters are all combined together to form what is called a 'general element'. This is just some syntactic element that is comment and whitespace-insensitive
// (most Ruby elements fall into this category). There are some exceptions, however. One of these is argument unpacking, which involves a syntactic ambiguity based on the presence or absence of
// whitespace before the * operator. For example:

// | f * g  f* g  f*g                      <- local variable f '*' value g
//   f *g  f(*g)  f(* g)  f( * g)          <- method f applied to argument list g

// So punctuation elements alone aren't sufficient to differentiate between semantic cases. Another example involves regular expressions:

// | f /foo/m  f /foo /m                   <- method f invoked on a regular expression
//   f/foo/m  f / foo/m                    <- method f invoked on nothing, divided by local foo then divided by local m
//   f/foo/  f /foo                        <- line continuation (invalid parse input on its own)

// Here, the decision about whether something is a regular expression happens early on and is heuristically decided by looking for whitespace irregularity. (It has to be this way; there isn't a
// viable strategy for deciding later due to the syntactic difference between regexp interpretation and expression interpretation.)

// Early decisions within PEGs offer some use here. We can decide a situation early on by detecting special cases first, then failing over to general cases. These special cases are parsed at the
// lexing level by using whitespace-sensitive parsing stages and re-entering normal stages inside groups.

  // Significance of newlines.
//   Some locations within a program are newline-insensitive; that is, a newline won't cause a statement break. One example of this is when the line ends with a binary operator, or when an
//   expression-level group has been opened but not closed. For example:

  // | foo + \n bar
//     foo(bar\n, bif)

  // Other situations are ambiguous; for instance:

  // | foo \n bar                          <- could be a function call, but the two-statement interpretation is preferred
//     foo \n + bar                        <- could be a binary addition, but will be interpreted as two statements (one of which casts an expression into void context)

  // All of the factors influencing multiline parsing are decided on the first line; nothing on the second line will have an impact. This means that multiline semantics are encoded into
//   expressions; a binary operator expression, for instance, would work like this:

  // | no_newlines(_expression) no_newlines(_operator) maybe_newlines(_expression)

  // The binary expression, then, would have to fail in order to accommodate newlines before either the first expression or the operator, which is appropriate.

          // Filters
          co(parser)         = line_comment /!many /!optional /-bfc/ parser /-map/ "_[1].comment(_[0])".qf,                     // <- optional line comment before parser
          wo(parser)         = whitespace /!optional /-bfs/ parser,                                                             // <- optional whitespace before parser
          si(parser)         = wo(co(parser)),                                                                                  // <- space-insensitive
          positional(parser) = parser /-map_state/ "_.value().position(_.position()) -re- _".qf,
          r                  = linear_regexp,
          s                  = linear_string,

          // Forward definitions
          expression(states) = expression(states),
          group(states)      = group(states),

          // Terminals
          terminal(parser)   = parser /-map/ "new node(_)".qf,
          rt(regexp)         = regexp /!r /!terminal /!positional,

          whitespace         = r(/\s+/),
          line_comment       = rt(/#.*[\n\r]{1,2}/),
          identifier         = rt(/\w+[?!]?/),
          global             = rt(/\$\w+[?!]?/),
          instance_variable  = rt(/@\w+[?!]?/),
          symbol             = r(/:/) /-bfs/ (identifier /global /-alt/ instance_variable) /-map/ "':#{_}'".qf /!terminal,
          number             = rt(/\d+\.\d+(?:[Ee][-+]?\d{1,3})?|\d+|0x[0-9a-fA-F]+|0[0-7]+/),
          regexp             = rt(/\/(?:[^\\\/]|\\.)*\//),                                                                      // <- FIXME add flags

          literal            = global /symbol /number /-alt/ regexp,                                                            // <- FIXME add strings
          leaf               = identifier /group /instance_variable /-alt/ literal /!si,

          // Expressions
          precedence_of      = (ops1 + ops2) *[[x, precedence += x === '#']] %[x[0] !== '#'] -object -seq
                               -where [precedence = 1,
                                       ops1       = ". # u! u~ u+ # ** # u- # * / % # + - # << >> # & # | ^ # > >= < <= # <=> == === != =~ !~ # && # || # .. ... # ? #".qw,
                                       ops2       = "rescue # = += -= *= /= %= **= <<= >>= &= ^= |= &&= ||= # defined? # not # and or # if unless while until".qw],

          is(x, in_set)      = in_set.hasOwnProperty(x),
          set_of(xs)         = xs *[[x, true]] -object -seq,
          right_associative  = "u! u~ u+ ** u- ? = += -= *= /= %= **= <<= >>= &= ^= |= &&= ||= not".qw /!set_of,

          one_of(xs)         = alt.apply(null, xs),

          unary_operator     = "~ ! + - not defined?".qw *linear_string /seq /!one_of /-map/ "new node(_)".qf /!si,
          binary_operator    = (ops1 + ops2) *linear_string             /seq /!one_of /-map/ "new node(_)".qf /!si
                               -where [ops1 = ". ** * / % + - << >> & | ^ < <= > >= <=> == === != =~ !~ && || .. ... rescue = += -= *= /= %= **= <<= >>= &= ^= |= &&= ||=".qw,
                                       ops2 = "and or if unless while until".qw],

          fix_precedence(n)  = +precedence_of[n[1].data] + ! is(n.data, right_associative) > precedence_of[n.data] ? n.rotate_left() : n,
          zip_unary(xs)      = xs[0].push(xs[1]),
          zip_binary(xs)     = xs[1].push(xs[0]).push(xs[2]),

          group              = si(s('(')) /expression /-bfc/ si(s(')')) /-map/ "new node('(', _[1])".qf,

          binary             = leaf /binary_operator /-bfc/ expression /-map/ zip_binary /-map/ fix_precedence,
          unary              = unary_operator /-bfc/ expression /-map/ zip_unary,
          expression         = binary /unary /-alt/ leaf /!si],

  using [caterwaul.parser]})(caterwaul);

// Generated by SDoc 
