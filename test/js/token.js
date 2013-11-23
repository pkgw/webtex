var assert = require ('assert');
var wt = require (process.argv[2]).WEBTEX;

t = wt.Token.new_cseq ('foo');
assert.equal (t.is_frozen_cs (), false, 'frozen 1');
