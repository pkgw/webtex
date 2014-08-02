// Various TeX data types

'use strict';

var Value = (function Value_closure () {
    function Value () {}
    var proto = Value.prototype;

    proto.toString = function Value_toString () {
	/* Returns the developer-friendly stringification of this object.
	 * Should not get back to the TeX engine. */
	return '[Value without toString?]';
    };

    proto.to_texstr = function Value_to_texstr () {
	/* This function returns the stringification of the value as
	 * implemented by TeX's \the primitive. */
	throw new TexInternalError ('not implemented Value.to_texstr');
    };

    proto.clone = function Value_clone () {
	/* Returns a new, identical copy of this value. */
	throw new TexInternalError ('not implemented Value.clone');
    };

    proto.equals = function Value_equals () {
	/* Returns whether this object has the same value as another. So far
	 * only used to compare fonts in GivenFontCommand.samecmd, so this may
	 * be very overly generic. */
	throw new TexInternalError ('not implemented Value.equals');
    };

    proto.is_nonzero = function Value_is_nonzero () {
	/* Returns whether this object is different than the default value for
	 * its class. */
	throw new TexInternalError ('not implemented Value.is_nonzero');
    };

    proto.as_int = function Value_as_int () {
	/* Returns a TexInt that this value is equivalent to, or null if such
	 * a conversion is not allowed. */
	throw new TexInternalError ('not implemented Value.as_int');
    };

    proto.as_scaled = function Value_as_scaled () {
	/* Returns a Scaled that this value is equivalent to, or null if such
	 * a conversion is not allowed. Note that Scaleds are not exposed to
	 * TeX programs; they are always wrapped by Dimens. Currently this is
	 * only used in Engine.scan_dimen and may be superfluous. */
	throw new TexInternalError ('not implemented Value.as_scaled');
    };

    proto.as_dimen = function Value_as_dimen () {
	/* Returns a Dimen that this value is equivalent to, or null if such a
	 * conversion is not allowed. This is used in Engine.scan_dimen. */
	throw new TexInternalError ('not implemented Value.as_dimen');
    };

    proto.as_glue = function Value_as_glue () {
	/* Returns a Glue that this value is equivalent to, or null if such a
	 * conversion is not allowed. This is used in Engine.scan_glue. */
	throw new TexInternalError ('not implemented Value.as_glue');
    };

    proto.as_serializable = function Value_as_serializable () {
	/* Returns a unique JSON-compatible representation. */
	throw new TexInternalError ('not implemented Value.as_serializable');
    };

    proto.advance = function Value_advance (other) {
	/* Implement \advance for this value -- that is, addition. Returns a
	 * new advanced value. */
	throw new TexInternalError ('not implemented Value.advance');
    };

    proto.intproduct = function Value_intproduct (other) {
	/* Implement \multiply for this value, which is integer
	 * multiplication. `other` should be passed through TexInt.xcheck().
	 * Returns a new multiplied value.*/
	throw new TexInternalError ('not implemented Value.intproduct');
    };

    proto.intdivide = function Value_intdivide (other) {
	/* Implement \divide for this value, which is integer division.
	 * `other` should be passed through TexInt.xcheck(). Returns a new
	 * divided value.*/
	throw new TexInternalError ('not implemented Value.intdivide');
    };

    // Static functions.

    Value.coerce = function Value_coerce (valtype, value) {
	if (valtype == T_INT)
	    return new TexInt (TexInt.xcheck (value));

	if (valtype == T_DIMEN) {
	    if (!(value instanceof Dimen))
		throw new TexInternalError ('cannot coerce to dimen: ' + value);
	    return value;
	}

	if (valtype == T_GLUE || valtype == T_MUGLUE) {
	    if (!(value instanceof Glue))
		throw new TexInternalError ('cannot coerce to (mu)glue: ' + value);
	    return value;
	}

	if (valtype == T_TOKLIST) {
	    if (!(value instanceof Toklist))
		throw new TexInternalError ('cannot coerce to toklist: ' + value);
	    return value;
	}

	if (valtype == T_BOX) {
	    if (!(value instanceof Box))
		throw new TexInternalError ('cannot coerce to box: ' + value);
	    return value;
	}

	if (valtype == T_FONT) {
	    if (!(value instanceof Font))
		throw new TexInternalError ('cannot coerce to font: ' + value);
	    return value;
	}

	throw new TexInternalError ('unrecognized valtype ' + valtype);
    };

    return Value;
}) ();


var TexInt = WEBTEX.TexInt = (function TexInt_closure () {
    var INT_MAX = 2147483647; // 2**31 - 1

    // These objects are immutable.
    function TexInt (value) {
	if (value instanceof TexInt) {
	    this.value = value;
	} else if (typeof value != 'number') {
	    throw new TexInternalError ('non-numeric TexInt value ' + value);
	} else if (value % 1 != 0) {
	    throw new TexInternalError ('non-integer TexInt value ' + value);
	} else {
	    this.value = value | 0;
	}

	if (Math.abs (this.value) > INT_MAX)
	    throw new TexRuntimeError ('out-of-range TexInt value ' + value);
    }

    inherit (TexInt, Value);
    var proto = TexInt.prototype;

    TexInt.xcheck = function TexInt_xcheck (value) {
	/* This function checks that its input could be a valid TeX integer,
	 * though it's agnostic as to whether it's a TexInt instance or a
	 * JS-native number. It returns that input as a JS integer; I call
	 * these checked values "tex-int"s. This simplifies a lot of math with
	 * Scaleds where it'd be irritating to keep on converting JS ints to
	 * TexInts for temporary manipulations. */

	if (value instanceof TexInt)
	    return value.value;

	if (typeof value != 'number')
	    throw new TexInternalError ('non-numeric tex-int value ' + value);
	if (value % 1 != 0)
	    throw new TexInternalError ('non-integer tex-int value ' + value);

	value = value | 0; // magic coercion to trustworthy int representation.

	if (Math.abs (value) > INT_MAX)
	    throw new TexRuntimeError ('out-of-range tex-int value ' + value);

	return value;
    };

    proto.toString = function TexInt_toString () {
	return '<' + this.value + '|i>';
    };

    proto.to_texstr = function TexInt_to_texstr () {
	return '' + this.value;
    };

    proto.clone = function TexInt_clone () {
	return new TexInt (this.value);
    };

    proto.is_nonzero = function TexInt_is_nonzero () {
	return (this.value != 0);
    };

    proto.as_int = function TexInt_as_int () {
	return this; // NOTE: ok since TexInts are immutable
    };

    proto.as_scaled = function TexInt_as_scaled () {
	return null;
    };

    proto.as_dimen = function TexInt_as_dimen () {
	return null;
    };

    proto.as_glue = function TexInt_as_glue () {
	return null;
    };

    proto.as_serializable = function TexInt_as_serializable () {
	return this.value;
    };

    TexInt.deserialize = function TexInt_deserialize (data) {
	return new TexInt (parseInt (data, 10));
    };

    proto.advance = function TexInt_advance (other) {
	return new TexInt (this.value + other.value);
    };

    proto.intproduct = function TexInt_intproduct (k) {
	k = TexInt.xcheck (k);
	return new TexInt (this.value * k);
    };

    proto.intdivide = function TexInt_intdivide (k) {
	k = TexInt.xcheck (k);
	return new TexInt (this.value / k >> 0);
    };

    proto.rangecheck = function TexInt_rangecheck (engine, min, max) {
	if (this.value >= min && this.value <= max)
	    return this;

	engine.warn ('expected integer in [' + min + ', ' + max + ']; got ' +
		     this.value + '; using 0');
	return TexInt (0);
    };

    return TexInt;
}) ();


var Scaled = WEBTEX.Scaled = (function Scaled_closure () {
    var SC_HALF  = 0x8000,     // 2**15 = 32768      = '100000
        SC_UNITY = 0x10000,    // 2**16 = 65536      = '200000
        SC_TWO   = 0x20000,    // 2**17 = 131072     = '400000
        SC_MAX   = 0x40000000, // 2**30 = 1073741824 = '10000000000
        UNSCALE  = Math.pow (2, -16),
        INT_MAX = 2147483647; // 2**31 - 1 ; XXX redundant with above.

    // These objects are immutable.
    function Scaled (value) {
	if (value instanceof Scaled)
	    this.value = value.value;
	else
	    this.value = TexInt.xcheck (value);
    }

    inherit (Scaled, Value);
    var proto = Scaled.prototype;

    // Math library.

    function div (a, b) {
	return a / b >> 0;
    }

    function mult_and_add (n, x, y, maxanswer) {
	// n: tex-int
	// x, y, retval: Scaled
	// maxanswer: js int

	if (n < 0) {
	    var xv = -x.value;
	    n = -n;
	} else {
	    var xv = x.value;
	}

	if (n == 0)
	    return y;

	var yv = y.value;

	if (xv <= div (maxanswer - yv, n) && -xv <= div (maxanswer + yv, n))
	    return new Scaled (n * xv + yv);
	throw new TexRuntimeError ('over/underflow in mult+add');
    }

    Scaled.new_from_parts = function Scaled_new_from_parts (nonfrac, frac) {
	nonfrac = TexInt.xcheck (nonfrac);
	frac = TexInt.xcheck (frac);
	return new Scaled (nonfrac * SC_UNITY + frac);
    };

    Scaled.new_parts_product =
	function Scaled_new_parts_product (num, denom, nonfrac, frac) {
	    // equivalent to `new_from_parts (nonfrac, frac) * (num/denom)` with
	    // better precision than you'd get naively.
	    num = TexInt.xcheck (num);
	    denom = TexInt.xcheck (denom);
	    nonfrac = TexInt.xcheck (nonfrac);
	    frac = TexInt.xcheck (frac);

	    var s = new Scaled (nonfrac);
	    var t = s.times_n_over_d (num, denom); // -> [result, remainder]
	    frac = div ((num * frac + SC_UNITY * t[1]), denom);
	    nonfrac = t[0].value + div (frac, SC_UNITY);
	    frac = frac % SC_UNITY;
	    return Scaled.new_from_parts (nonfrac, frac);
	};

    Scaled.new_from_decimals =
	function Scaled_new_from_decimals (digarray) {
	    var a = 0;
	    while (digarray.length)
		a = div (a + digarray.pop () * SC_TWO, 10);
	    return div (a + 1, 2);
	};

    proto.times_n_plus_y = function Scaled_times_n_plus_y (n, y) {
	// OO interpretation of nx_plus_y.
	// n: tex-int
	// y: Scaled
	// returns: Scaled(n*this+y)

	n = TexInt.xcheck (n);
	if (!(y instanceof Scaled))
	    throw new TexInternalError ('nx+y called with non-Scaled y: ' + y);
	return mult_and_add (n, this, y, SC_MAX - 1);
    };

    proto.times_n_over_d = function Scaled_times_n_over_d (n, d) {
	// OO interpretation of xn_over_d.
	// n: tex-int
	// d: tex-int
	// returns: [Scaled(result), Scaled(remainder)]
	//   where the remainder is relevant if the low-significance digits
	//   of (this*n/d) must be rounded off.

	n = TexInt.xcheck (n);
	d = TexInt.xcheck (d);

	var positive = (this.value >= 0);
	if (positive)
	    var xv = this.value
	else
	    var xv = -this.value;

	var t = (xv % SC_HALF) * n;
	var u = div (xv, SC_HALF) * n + div (t, SC_HALF);
	var v = (u % d) * SC_HALF + (t % SC_HALF);

	if (div (u, d) > SC_HALF)
	    throw new TexRuntimeError ('over/underflow in xn_over_d');

	var w = SC_HALF * div (u, d) + div (v, d);

	if (positive)
	    return [new Scaled (w), new Scaled (v % d)];
	return [new Scaled (-w), new Scaled (-(v % d))];
    };

    proto.over_n = function Scaled_over_n (n) {
	// OO version of x_over_n.
	// n: tex-int
	// returns: [Scaled(x/n), Scaled(remainder)]
	//   where the remainder is relevant if the low-significance digits
	//   of (this/n) must be rounded off.

	n = TexInt.xcheck (n);
	if (n.value == 0)
	    throw new TexRuntimeError ('really, dividing by 0?');

	var negative = false;

	if (n < 0) {
	    var xv = -this.value;
	    n = -n;
	    negative = true;
	} else {
	    var xv = this.value;
	}

	if (xv >= 0) {
	    var rv = div (xv, n), rem = xv % n;
	} else {
	    var rv = -div (-xv, n), rem = -((-xv) % n);
	}

	if (negative)
	    rem = -rem;

	return [new Scaled (rv), new Scaled (rem)];
    };

    proto.times_parts = function Scaled_times_parts (nonfrac, frac) {
	nonfrac = TexInt.xcheck (nonfrac);
	frac = TexInt.xcheck (frac);
	var res = this.times_n_over_d (frac, SC_UNITY)[0];
	return this.times_n_plus_y (nonfrac, res);
    };

    // Higher-level stuff.

    proto.toString = function Scaled_toString () {
	return '<~' + this.asfloat ().toFixed (6) + '|s>';
    };

    proto.clone = function Scaled_clone () {
	return new Scaled (this.value);
    };

    proto.is_nonzero = function Scaled_is_nonzero () {
	return (this.value != 0);
    };

    proto.as_int = function Scaled_as_int () {
	return new TexInt (this.value);
    };

    proto.as_scaled = function Scaled_as_scaled () {
	return this; // NOTE: ok since Scaleds are immutable.
    };

    proto.as_dimen = function Scaled_as_dimen () {
	return null;
    };

    proto.as_glue = function Scaled_as_glue () {
	return null;
    };

    proto.as_serializable = function Scaled_as_serializable () {
	return this.value;
    };

    Scaled.deserialize = function Scaled_deserialize (data) {
	return new Scaled (parseInt (data, 10));
    };

    proto.advance = function Scaled_advance (other) {
	return new Scaled (this.value + other.value);
    };

    proto.intproduct = function Scaled_intproduct (k) {
	k = TexInt.xcheck (k);
	return this.times_parts (k, 0);
    };

    proto.intdivide = function Scaled_intdivide (k) {
	k = TexInt.xcheck (k);
	return this.clone ().over_n (k);
    };

    proto.asfloat = function Scaled_asfloat () {
	return this.value * UNSCALE;
    };

    return Scaled;
}) ();


var Dimen = (function Dimen_closure () {
    var MAX_SCALED = 0x40000000; // 2**30 = 1073741824 = '10000000000

    // These objects are mutable.
    function Dimen () {
	this.sp = new Scaled (0);
    }

    inherit (Dimen, Value);
    var proto = Dimen.prototype;

    Dimen.new_product = function Dimen_new_product (k, x) {
	// k: tex-int
	// x: Scaled
	k = TexInt.xcheck (k);
	if (!(x instanceof Scaled))
	    throw new TexInternalError ('expected Scaled value, got ' + x);

	var d = new Dimen ();
	d.sp = x.times_n_plus_y (k, new Scaled (0));
	if (Math.abs (d.sp.value) > MAX_SCALED)
	    throw new TexRuntimeError ('dimension out of range: ' + d);
	return d;
    };

    proto.toString = function Dimen_toString () {
	return this.sp.asfloat ().toFixed (3) + 'pt';
    };

    proto.to_texstr = function Dimen_to_texstr () {
	// Tex always shows at least 1 decimal place, and more if needed.
	var text = this.sp.asfloat ().toFixed (7);

	while (text[text.length - 1] == '0') {
	    if (text[text.length - 2] == '.')
		break;
	    text = text.slice (0, -1);
	}

	return text + 'pt';
    };

    proto.clone = function Dimen_clone () {
	var d = new Dimen ();
	d.sp = this.sp.clone ();
	return d;
    };

    proto.is_nonzero = function Dimen_is_nonzero () {
	return this.sp.is_nonzero ();
    };

    proto.as_int = function Dimen_as_int () {
	return this.sp.as_int ();
    };

    proto.as_scaled = function Dimen_as_scaled () {
	return this.sp; // NOTE: ok since Scaleds are immutable.
    };

    proto.as_dimen = function Dimen_as_dimen () {
	return this.clone ();
    };

    proto.as_glue = function Dimen_as_glue () {
	return null;
    };

    proto.as_serializable = function Dimen_as_serializable () {
	return this.sp.as_serializable ();
    };

    Dimen.deserialize = function Dimen_deserialize (data) {
	var d = new Dimen ();
	d.sp = Scaled.deserialize (data);
	return d;
    };

    proto.advance = function Dimen_advance (other) {
	var d = new Dimen ();
	d.sp = d.sp.advance (other.as_scaled ());
	return d;
    };

    proto.intproduct = function Dimen_intproduct (k) {
	k = TexInt.xcheck (k);
	var d = new Dimen ();
	d.sp = this.sp.intproduct (k);
	return d;
    };

    proto.intdivide = function Dimen_intdivide (k) {
	k = TexInt.xcheck (k);
	var d = this.clone ();
	d.sp = this.sp.intdivide (k);
	return d;
    };

    return Dimen;
}) ();


var Glue = (function Glue_closure () {
    function Glue () {
	this.width = new Dimen ();
	this.stretch = new Dimen ();
	this.stretch_order = 0;
	this.shrink = new Dimen ();
	this.shrink_order = 0;
    }

    inherit (Glue, Value);
    var proto = Glue.prototype;

    proto.toString = function Glue_toString () {
	return '<Glue ' + this.width + ' st=' + this.stretch + '|' +
	    this.stretch_order + ' sh=' + this.shrink + '|' +
	    this.shrink_order + '>';
    };

    proto.to_texstr = function Glue_to_texstr () {
	var t = this.width.to_texstr ();

	if (this.stretch.is_nonzero ()) {
	    t += ' plus ';
	    t += this.stretch.to_texstr ();
	    if (this.stretch_order > 0) {
		t = t.slice (0, -2); // strip trailing 'pt'
		t += 'fil';
		if (this.stretch_order > 1)
		    t += 'l';
		if (this.stretch_order > 2)
		    t += 'l';
	    }
	}

	if (this.shrink.is_nonzero ()) {
	    t += ' minus ';
	    t += this.shrink.to_texstr ();
	    if (this.shrink_order > 0) {
		t = t.slice (0, -2); // strip trailing 'pt'
		t += 'fil';
		if (this.shrink_order > 1)
		    t += 'l';
		if (this.shrink_order > 2)
		    t += 'l';
	    }
	}

	return t;
    };

    proto.clone = function Glue_clone () {
	var g = new Glue ();
	g.width = this.width.clone ();
	g.stretch = this.stretch.clone ();
	g.stretch_order = this.stretch_order;
	g.shrink = this.shrink.clone ();
	g.shrink_order = this.shrink_order;
	return g;
    };

    proto.is_nonzero = function Glue_is_nonzero () {
	return (this.width.is_nonzero () ||
		this.stretch.is_nonzero () ||
		this.stretch_order != 0 ||
		this.shrink.is_nonzero () ||
		this.shrink_order != 0);
    };

    proto.as_int = function Glue_as_int () {
	return this.width.as_int ();
    };

    proto.as_scaled = function Glue_as_scaled () {
	return this.width.as_scaled ();
    };

    proto.as_dimen = function Glue_as_dimen () {
	return this.width.clone ();
    };

    proto.as_glue = function Glue_as_glue () {
	return this.clone ();
    };

    proto.as_serializable = function Glue_as_serializable () {
	return [this.width.as_serializable (),
		this.stretch.as_serializable (),
		this.stretch_order,
		this.shrink.as_serializable (),
		this.shrink_order];
    };

    Glue.deserialize = function Glue_deserialize (data) {
	var g = new Glue ();
	g.width = Dimen.deserialize (data[0]);
	g.stretch = Dimen.deserialize (data[1]);
	g.stretch_order = parseInt (data[2], 10);
	g.shrink = Dimen.deserialize (data[3]);
	g.shrink_order = parseInt (data[4], 10);
	return g;
    };

    proto.advance = function Glue_advance (other) {
	var g = this.clone ();
	g.width = this.width.advance (other.width);
	g.stretch = this.stretch.advance (other.stretch);
	g.shrink = this.shrink.advance (other.shrink);
	return g;
    };

    proto.intproduct = function Glue_intproduct (k) {
	k = TexInt.xcheck (k);
	var g = this.clone ();
	g.width = this.width.intproduct (k);
	g.stretch = this.stretch.intproduct (k);
	g.shrink = this.shrink.intproduct (k);
	return g;
    };

    proto.intdivide = function Glue_intdivide (k) {
	k = TexInt.xcheck (k);
	var g = this.clone ();
	g.width = this.width.intdivide (k);
	g.stretch = this.stretch.intdivide (k);
	g.shrink = this.shrink.intdivide (k);
	return g;
    };

    return Glue;
}) ();


var Box = (function Box_closure () {
    function Box (type) {
	this.type = type;
	this.width = new Dimen ();
	this.height = new Dimen ();
	this.depth = new Dimen ();
	this.list = [];
    }

    inherit (Box, Value);
    var proto = Box.prototype;

    proto.toString = function Box_toString () {
	return '<Box ' + bt_names[this.type] + ' w=' + this.width +
	    ' h=' + this.height + ' d=' + this.depth + ' #toks=' +
	    this.list.length + '>';
    };

    proto.is_nonzero = function Box_is_nonzero () {
	// The way TeX handles things, an all-zero non-void box is best
	// considered nonzero.
	return this.type != BT_VOID;
    };

    proto.as_serializable = function Box_as_serializable () {
	if (this.list.length)
	    throw new TexInternalException ('can\'t serialize box lists yet');
	return [this.type,
		this.width.as_serializable (),
		this.height.as_serializable (),
		this.depth.as_serializable ()];
    };

    Box.deserialize = function Box_deserialize (data) {
	var b = new Box (BT_VOID);
	b.type = parseInt (data[0], 10);
	b.width = Dimen.deserialize (data[1]);
	b.height = Dimen.deserialize (data[2]);
	b.depth = Dimen.deserialize (data[3]);
	b.list = []; // XXX temp?
	return b;
    };

    return Box;
}) ();


var Toklist = WEBTEX.Toklist = (function Toklist_closure () {
    function Toklist (toks) {
	if (toks == null)
	    this.toks = [];
	else if (toks instanceof Array) {
	    this.toks = toks.slice ();
	    for (var i = 0; i < toks.length; i++)
		if (!(toks[i] instanceof Token))
		    throw new TexInternalError ('non-token in toklist: ' + toks[i]);
	} else
	    throw new TexInternalError ('unexpected Toklist() argument: ' + toks);
    }

    inherit (Toklist, Value);
    var proto = Toklist.prototype;

    proto.toString = function Toklist_toString () {
	return this.as_serializable ();
    };

    proto.uitext = function Toklist_uitext () {
	/* User-friendly-ish representation of a toklist. */
	return this.toks.map (function (t) {
	    return t.uitext ();
	}).join ('');
    };

    proto.to_texstr = function Toklist_to_texstr () {
	throw new TexInternalError ('\\the of toklist should be handled specially');
    };

    proto.clone = function Toklist_clone () {
	var n = new Toklist ();
	n.toks = this.toks.slice ();
	return n;
    };

    proto.is_nonzero = function Toklist_is_nonzero () {
	return this.toks.length > 0;
    };

    proto.as_serializable = function Toklist_as_serializable () {
	return this.toks.map (function (t) {
	    return t.to_serialize_str ();
	}).join ('');
    };

    Toklist.deserialize = function Toklist_deserialize (text) {
	var list = [];
	var n = text.length;

	for (var i = 0; i < n; i++) {
	    var o = ord (text[i]);

	    if (o != O_PERCENT) {
		// Standard character.
		list.push (Token.new_char (ord_standard_catcodes[o], o));
		continue;
	    }

	    i++;
	    if (i >= n)
		throw new TexRuntimeError ('malformed serialized toklist: ' + text);

	    o = ord (text[i]);

	    if (o == O_HASH) {
		// Macro parameter token.
		i++;
		if (i >= n)
		    throw new TexRuntimeError ('malformed serialized toklist: ' + text);

		o = ord (text[i]);
		list.push (Token.new_param (o - O_ZERO));
		continue;
	    }

	    if ((o >= O_ZERO && o < O_ZERO + 10) ||
		(o >= O_LC_A && o < O_LC_A + 6) ||
		(o >= O_UC_A && o < O_UC_A + 6)) {
		// Escaped character.
		if (i + 2 >= n)
		    throw new TexRuntimeError ('malformed serialized toklist: ' + text);
		o = parseInt (text.substr (i, 2), 16);
		var cc = cc_idchar_unmap[text[i+2]];
		list.push (Token.new_char (cc, o));
		i += 2;
		continue; // catcode id char will be eaten by the for loop increment.
	    }

	    if (o != O_LEFT_BRACKET)
		throw new TexRuntimeError ('malformed serialized toklist: ' + text);

	    // We must be a cseq.
	    i++;
	    if (i >= n)
		throw new TexRuntimeError ('malformed serialized toklist: ' + text);

	    var name = '';

	    while (i < n) {
		o = ord (text[i]);

		if (o == O_RIGHT_BRACKET)
		    break;

		if (o != O_PERCENT) {
		    name += text[i];
		    i++;
		    continue;
		}

		// We must be an escaped character. No catcodes here.
		if (i + 2 >= n) // recall that we need at least the close bracket.
		    throw new TexRuntimeError ('malformed serialized toklist: ' + text);
		o = parseInt (text.substr (i + 1, 2), 16);
		name += String.fromCharCode (o);
		i += 3;
	    }

	    if (i >= n)
		// We ran off the end of the string!
		throw new TexRuntimeError ('malformed serialized toklist: ' + text);

	    // Finished the cseq successfully. For loop will eat the ].
	    list.push (Token.new_cseq (name));
	}

	return new Toklist (list);
    };

    return Toklist;
}) ();


var Font = (function Font_closure () {
    function Font (ident, scale) {
	this.ident = ident;
	this.scale = scale;
	this.dimens = {};
	this.hyphenchar = null;
	this.skewchar = null;
    }

    inherit (Font, Value);
    var proto = Font.prototype;

    proto.toString = function Font_toString () {
	return '<Font ' + this.ident + '@' + this.scale + '>';
    };

    proto.equals = function Font_equals (other) {
	if (other == null)
	    return false;
	if (!(other instanceof Font))
	    throw new TexInternalError ('comparing Font to ' + other);
	return (this.ident == other.ident) && (this.scale == other.scale);
    };

    proto.get_serialize_ident = function Font_get_serialize_ident (state, housekeeping) {
	if (this._serialize_ident == null) {
	    // Not sure about this, but Engine ctor creates nullfont by default.
	    if (this.ident == 'nullfont')
		this._serialize_ident = '<null>';
	    else {
		this._serialize_ident = state.fonts.length;
		state.fonts.push ([this.ident,
				   this.scale,
				   this.dimens,
				   this.hyphenchar,
				   this.skewchar]);
	    }
	}

	return this._serialize_ident;
    };

    Font.deserialize = function Font_deserialize (data) {
	var font = new Font (data[0], data[1]);
	font.dimens = data[2];
	font.hyphenchar = data[3];
	font.skewchar = data[4];
	return font;
    };

    return Font;
}) ();
