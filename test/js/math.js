var assert = require ('assert');
var wt = require (process.argv[2]).WEBTEX;

one = new wt.TexInt (1);
two = new wt.TexInt (2);

r = wt.nx_plus_y (two, two, one);
assert.equal (r.value, 5, 'math test 1');
