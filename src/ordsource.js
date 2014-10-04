'use strict';

var OrdSource = (function OrdSource_closure () {
    var map = Array.prototype.map;
    var lc_hex_ords = (function () {
	var o = [], i = 0;
	for (i = 0; i < 10; i++)
	    o.push (O_ZERO + i);
	for (i = 0; i < 6; i++)
	    o.push (O_LC_A + i);
	return o;
    }) ();

    function OrdSource (linebuffer, args) {
	this.linebuffer = linebuffer;
	this.pushed = [];
	this.curords = null;
	this.curindex = null;
	this.debug_input_lines = args.debug_input_lines || false;
    }

    var proto = OrdSource.prototype = {};

    proto._ensure_line = function OrdSource__ensure_line (endlinechar) {
	// Returns true if more characters are available.
	if (this.linebuffer === null)
	    return EOF;
	if (this.curords !== null)
	    return true;

	var l = this.linebuffer.get ();
	if (l === NeedMoreData)
	    return NeedMoreData;

	if (l === EOF) {
	    if (this.debug_input_lines)
		console.log ('<<! EOF');
	    this.linebuffer = null;
	    return EOF;
	}

	l = l.replace (/ *$/, ''); // note: just spaces, not any whitespace

	this.curords = map.call (l, function (x) { return x.charCodeAt (0); });
	if (endlinechar >= 0 && endlinechar <= 255)
	    this.curords.push (endlinechar);
	this.curindex = 0;

	if (this.debug_input_lines)
	    console.log ('<< ' + l);
	return true;
    };

    proto.push_ord = function OrdSource_push_ord (o) {
	if (o < 0 || o > 255)
	    throw new TexRuntimeError ('out of bounds ordinal: ' + o);
	this.pushed.push (o);
    };

    proto._peek3 = function OrdSource__peek3 () {
	// TODO, maybe: implement corner cases with pushed characters. Unsure
	// if they're ever needed.

	if (this.linebuffer === null)
	    return [EOF, EOF, EOF];

	if (this.pushed.length)
	    throw new TexRuntimeError ('peek3 corner case');

	if (this.curindex + 3 <= this.curords.length)
	    // Easy case.
	    return this.curords.slice (this.curindex, this.curindex + 3);

	if (this.curindex + 2 <= this.curords.length)
	    // Insane corner case. If \endlinechar is -1 and the line ends
	    // with a ^^X code, the lack of the EOL character means that we
	    // won't have 3 full characters available. I think that we're not
	    // getting the semantics fully right for the same reason that we
	    // can't process ^^X escapes across newlines, but whatever.
	    return this.curords.slice (this.curindex, this.curindex + 2).concat ([-1]);

	// Assume we're not doing a ^^X escape across a newline. These
	// values won't propagate out of next().
	return [-1, -1, -1];
    };

    proto._next_lowlevel = function OrdSource__next_lowlevel (endlinechar) {
	if (this.pushed.length)
	    return this.pushed.pop ();

	var rv = this._ensure_line (endlinechar);
	if (rv === NeedMoreData || rv === EOF)
	    return rv;

	var o = this.curords[this.curindex];
	this.curindex++;
	if (this.curindex >= this.curords.length)
	    this.curords = this.curindex = null;
	return o;
    };

    proto.next = function OrdSource_next (catcodes, endlinechar) {
	var o = this._next_lowlevel (endlinechar);
	if (o === NeedMoreData || o === EOF)
	    return o;

	var cc = catcodes[o];
	if (cc != C_SUPER)
	    return o;

	var n = this._peek3 ();

	if (n[0] == o &&
	    lc_hex_ords.indexOf (n[1]) >= 0 &&
	    lc_hex_ords.indexOf (n[2]) >= 0) {
	    this._next_lowlevel (endlinechar);
	    this._next_lowlevel (endlinechar);
	    this._next_lowlevel (endlinechar);
	    return lc_hex_ords.indexOf (n[1]) * 16 + lc_hex_ords.indexOf (n[2]);
	}

	if (n[0] == o && n[1] < 128) {
	    if (n[1] > 63)
		n[1] -= 64;
	    else
		n[1] += 64;

	    this._next_lowlevel (endlinechar);
	    this._next_lowlevel (endlinechar);
	    return n[1];
	}

	return o;
    };

    proto.iseol = function OrdSource_iseol () {
	if (this.linebuffer === null)
	    throw new TexRuntimeError ('unexpected iseol context');
	if (this.curindex == null)
	    throw new TexInternalError ('iseol() should only be called in ' +
					'middle of a line');
	return (this.curindex == this.curords.length - 1);
    };

    proto.discard_line = function OrdSource_discard_line () {
	if (this.linebuffer === null)
	    throw new TexRuntimeError ('unexpected discard_line context');

	this.curords = this.curindex = null;
    };

    return OrdSource;
})();
