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

  $.ruby.parse(s) = tree.value().position_map(input /!position_map)
                    -where [input           = s.toString(),
                            tree            = [new $.parser.linear_string_state(input)] /!$.ruby.parser -re- it[0],
                            position_map(s) = n[s.length] *s.charCodeAt *[{line: l += x === 10, column: c = x === 10 ? -1 : c + 1}] -seq -where [l = 0, c = -1]],

  $.ruby.parser = toplevel
                  -where [toplevel(states)   = expression(states),
                          node               = $.ruby.syntax,

                          // Filters
                          co(parser)         = line_comment /!many /!optional /-bfc/ parser /-map/ "_[1].comment(_[0])".qf,                     // <- optional line comment before parser
                          wo(parser)         = whitespace /!optional /-bfs/ parser,                                                             // <- optional whitespace before parser
                          si(parser)         = wo(co(parser)),                                                                                  // <- space-insensitive
                          positional(parser) = parser /-map_state/ "_.value().position(_.position()) -re- _".qf,
                          r                  = linear_regexp,

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
                          leaf               = identifier /instance_variable /-alt/ literal /!si,

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

                          expression(states) = expression(states),

                          binary             = leaf /binary_operator /-bfc/ expression /-map/ zip_binary /-map/ fix_precedence,
                          unary              = unary_operator /-bfc/ expression /-map/ zip_unary,
                          expression         = binary /unary /-alt/ leaf /!si],

  using [caterwaul.parser]})(caterwaul);

// Generated by SDoc 
