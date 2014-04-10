'use strict;'

var OrdSource = WEBTEX.OrdSource = (function OrdSource_closure () {
    function OrdSource (linesource) {
	this.linesource = linesource;
	this.pushed = [];
	this.curords = undefined;
	this.curindex = undefined;
    }

    proto = OrdSource.prototype = {};

    proto._ensure_line = function OrdSource__ensure_line () {
	// Returns True if more characters are available.
	if (typeof this.linesource === 'undefined')
	    return false;
	if (typeof this.curords !== 'undefined')
	    return true;

	var l = this.linesource.get ();
	if (typeof l === 'undefined') {
	    console.log ('<<! EOF');
	    return false;
	}

	l = l.replace (/ *$/, ''); // note: just spaces, not any whitespace

	var map = Array.prototype.map;
	this.curords = map.call (l, function (x) { return x.charCodeAt (0); });
	this.curords.push (O_RETURN);
	this.curindex = 0;
	console.log ('<< ' + l);
	return true;
    };

    proto.push_ord = function OrdSource_push_ord (o) {
	if (o < 0 || o > 255)
	    throw new TexRuntimeException ('out of bounds ordinal: ' + o);
	this.pushed.push (o);
    };

    proto._peek3 = function OrdSource__peek3 () {
	// TODO, maybe: implement corner cases with pushed characters. Unsure
	// if they're ever needed.

	if (typeof this.linesource === 'undefined')
	    return [undefined, undefined, undefined];

	if (this.pushed.length)
	    throw new TexRuntimeException ('peek3 corner case');

	if (!this._ensure_line ())
	    return [undefined, undefined, undefined];

	if (this.curindex + 3 <= this.curords.length)
	    // Easy case.
	    return this.curords.slice (this.curindex, this.curindex + 3);

	// Assume we're not doing a ^^X escape across a newline. These
	// values won't propagate out of next().
	return [-1, -1, -1]
    };

    proto._next_lowlevel = function OrdSource__next_lowlevel () {
	if (typeof this.linesource === 'undefined')
	    return undefined;

	if (this.pushed.length)
	    return this.pushed.pop ();

	if (!this._ensure_line ())
	    return undefined;

	var o = this.curords[this.curindex];
	this.curindex++;
	if (this.curindex >= this.curords.length)
	    this.curords = this.curindex = undefined;
	return o;
    };

    var lc_hex_ords = (function () {
	var o = [], i = 0;
	for (i = 0; i < 10; i++)
	    o.push (O_ZERO + i);
	for (i = 0; i < 6; i++)
	    o.push (O_LC_A + i);
	return o;
    })();

    proto.next = function OrdSource_next (catcodes) {
	var o = this._next_lowlevel ();
	if (typeof o === 'undefined')
	    return undefined;

	cc = catcodes[o];
	if (cc != C_SUPER)
	    return o;

	var n = this._peek3 ();

	if (n[0] == o &&
	    lc_hex_ords.indexOf (n[1]) >= 0 &&
	    lc_hex_ords.indexOf (n[2]) >= 0) {
	    this._next_lowlevel ();
	    this._next_lowlevel ();
	    this._next_lowlevel ();
	    return lc_hex_ords.indexOf (n[1]) * 16 + lc_hex_ords.indexOf (n[2]);
	}

	if (n[0] == o && n[1] < 128) {
	    if (n[1] > 63)
		n[1] -= 64;
	    else
		n[1] += 64;

	    this._next_lowlevel ();
	    this._next_lowlevel ();
	    return n[1];
	}

	return o;
    };

    proto.iseol = function OrdSource_iseol () {
	if (typeof this.linesource === 'undefined')
	    throw new TexRuntimeError ('unexpected iseol context');

	if (!this._ensure_line ())
	    return false;

	return (this.curindex == self.curords.length - 1);
    };

    proto.discard_line = function OrdSource_discard_line () {
	if (typeof this.linesource === 'undefined')
	    throw new TexRuntimeError ('unexpected discard_line context');

	this.curords = this.curindex = undefined;
    };

    return OrdSource;
})();
