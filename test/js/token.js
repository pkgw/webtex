var assert = require ('assert');
var console = require ('console');
var webtex = require (process.argv[2]);

t = webtex.Token.new_cseq ('foo');
assert.equal (t.is_frozen_cs (), false, 'frozen 1');
