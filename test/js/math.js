var assert = require ('assert');
var console = require ('console');
var webtex = require (process.argv[2]);

ti1 = new webtex.TexInt (1);
ti2 = new webtex.TexInt (2);
sc1 = webtex.Scaled.new_from_parts (1, 0);
sc2 = webtex.Scaled.new_from_parts (2, 0);

r = sc2.times_n_plus_y (ti2, sc1);
assert.equal (r.asfloat (), 5, 'math test 1');

qr = sc1.times_n_over_d (new webtex.TexInt (8420), new webtex.TexInt (4210));
assert.equal (qr[0].value, sc2.value, 'math test 2a');
assert.equal (qr[1].value, 0, 'math test 2b');

qr = sc1.over_n (new webtex.TexInt (2));
assert.equal (qr[0].value, 0x8000, 'math test 3a');
assert.equal (qr[1].value, 0, 'math test 3b');
