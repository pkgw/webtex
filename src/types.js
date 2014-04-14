// Various TeX data types

'use strict';

var TexInt = WEBTEX.TexInt = (function TexInt_closure () {
    var INT_MAX = 2147483647; // 2**31 - 1

    // These objects are immutable.
    function TexInt (value) {
	if (value instanceof TexInt) {
	    this.value = value;
	} else if (typeof value != 'number') {
	    throw new TexInternalException ('non-numeric TexInt value ' + value);
	} else if (value % 1 != 0) {
	    throw new TexInternalException ('non-integer TexInt value ' + value);
	} else {
	    this.value = value | 0;
	}

	if (Math.abs (this.value) > INT_MAX)
	    throw new TexRuntimeException ('out-of-range TexInt value ' + value);
    }

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
	    throw new TexInternalException ('non-numeric tex-int value ' + value);
	if (value % 1 != 0)
	    throw new TexInternalException ('non-integer tex-int value ' + value);

	value = value | 0; // magic coercion to trustworthy int representation.

	if (Math.abs (value) > INT_MAX)
	    throw new TexRuntimeException ('out-of-range tex-int value ' + value);

	return value;
    };

    TexInt.prototype.toString = function TexInt_toString () {
	return '<' + this.value + '|i>';
    };

    TexInt.prototype.clone = function TexInt_clone () {
	return new TexInt (this.value);
    };

    TexInt.prototype.intproduct = function TexInt_intproduct (k) {
	k = TexInt.xcheck (k);
	return new TexInt (this.value * k);
    };

    TexInt.prototype.advance = function TexInt_advance (other) {
	return new TexInt (this.value + other.value);
    };

    TexInt.prototype.asint = function TexInt_asint () {
	return this.value;
    };

    TexInt.prototype.rangecheck = function TexInt_rangecheck (engine, min, max) {
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
	throw new TexRuntimeException ('over/underflow in mult+add');
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
	    nonfrac = t[0] + div (frac, SC_UNITY);
	    frac = mod (frac, SC_UNITY);
	    return Scaled.new_from_parts (nonfrac, frac);
	};

    Scaled.prototype.times_n_plus_y = function Scaled_times_n_plus_y (n, y) {
	// OO interpretation of nx_plus_y.
	// n: tex-int
	// y: Scaled
	// returns: Scaled(n*this+y)

	n = TexInt.xcheck (n);
	if (!(y instanceof Scaled))
	    throw new TexInternalException ('nx+y called with non-Scaled y: ' + y);
	return mult_and_add (n, this, y, SC_MAX - 1);
    };

    Scaled.prototype.times_n_over_d = function Scaled_times_n_over_d (n, d) {
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
	    throw new TexRuntimeException ('over/underflow in xn_over_d');

	var w = SC_HALF * div (u, d) + div (v, d);

	if (positive)
	    return [new Scaled (w), new Scaled (v % d)];
	return [new Scaled (-w), new Scaled (-(v % d))];
    };

    Scaled.prototype.over_n = function Scaled_over_n (n) {
	// OO version of x_over_n.
	// n: tex-int
	// returns: [Scaled(x/n), Scaled(remainder)]
	//   where the remainder is relevant if the low-significance digits
	//   of (this/n) must be rounded off.

	n = TexInt.xcheck (n);
	if (n.value == 0)
	    throw new TexRuntimeException ('really, dividing by 0?');

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

    Scaled.prototype.times_parts = function Scaled_times_parts (nonfrac, frac) {
	nonfrac = TexInt.xcheck (nonfrac);
	frac = TexInt.xcheck (frac);
	var res = this.times_n_over_d (frac, SC_UNITY)[0];
	return this.times_n_plus_y (nonfrac, res);
    };

    // Higher-level stuff.

    Scaled.prototype.toString = function Scaled_toString () {
	return '<~' + this.asfloat ().toFixed (6) + '|s>';
    };

    Scaled.prototype.clone = function Scaled_clone () {
	return new Scaled (this.value);
    };

    Scaled.prototype.intproduct = function Scaled_intproduct (k) {
	k = TexInt.xcheck (k);
	return this.times_parts (k, 0);
    };

    Scaled.prototype.advance = function Scaled_advance (other) {
	return new Scaled (this.value + other.value);
    };

    Scaled.prototype.asfloat = function Scaled_asfloat () {
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

    Dimen.new_product = function Dimen_new_product (k, x) {
	// k: tex-int
	// x: Scaled
	k = TexInt.xcheck (k);
	if (!(x instanceof Scaled))
	    throw new TexInternalException ('expected Scaled value, got ' + x);

	var d = new Dimen ();
	d.sp = x.times_n_plus_y (k, 0);
	if (Math.abs (d.sp.value) > MAX_SCALED)
	    throw new TexRuntimeException ('dimension out of range: ' + x);
    };

    Dimen.prototype.clone = function Dimen_clone () {
	var d = new Dimen ();
	d.sp = this.sp.clone ();
	return d;
    };

    Dimen.prototype.advance = function Dimen_advance (other) {
	var d = new Dimen ();
	d.sp = d.sp.advance (other);
	return d;
    };

    Dimen.prototype.asint = function Dimen_asint () {
	return this.sp.value;
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

    Glue.prototype.clone = function Glue_clone () {
	var g = new Glue ();
	g.width = this.width.clone ();
	g.stretch = this.stretch.clone ();
	g.stretch_order = this.stretch_order;
	g.shrink = this.shrink.clone ();
	g.shrink_order = this.shrink_order;
	return g;
    };

    Glue.prototype.advance = function Glue_advance (other) {
	var g = this.clone ();
	g.width = this.width.advance (other.width);
	g.stretch = this.stretch.advance (other.stretch);
	g.shrink = this.shrink.advance (other.shrink);
	return g;
    };

    return Glue;
}) ();


var Box = (function Box_closure () {
    function Box () {
	this.width = new Dimen ();
	this.height = new Dimen ();
	this.depth = new Dimen ();
	this.tlist = [];
    }

    return Box;
}) ();


var Rule = (function Rule_closure () {
    function Rule () {
	Box.call (this);
    }

    inherit (Rule, Box);

    return Rule;
}) ();


var Font = (function Font_closure () {
    function Font (ident, scale) {
	this.ident = ident;
	this.scale = scale;
	this.dimens = {};
	this.hyphenchar = null;
	this.skewchar = null;
    }

    return Font;
}) ();


// Our "value" system

var Value = (function Value_closure () {
    function Value () {}

    Value.prototype.tostr = function Value_tostr (engine, value) {
	return '' + value;
    };

    return Value;
}) ();


var RegisterValue = (function RegisterValue_closure () {
    function RegisterValue (reg) {
	if (reg < 0 || reg > 255)
	    throw new TexInternalException ('illegal register ' + reg);
	Value.call (this);
	this.reg = reg;
    }

    inherit (RegisterValue, Value);

    return RegisterValue;
}) ();


var ParamValue = (function ParamValue_closure () {
    function ParamValue (name) {
	Value.call (this);
	this.name = name;
    }

    inherit (ParamValue, Value);

    return ParamValue;
}) ();


var ConstantValue = (function ConstantValue_closure () {
    function ConstantValue (value) {
	Value.call (this);
	this.value = value;
    }

    inherit (ConstantValue, Value);

    ConstantValue.prototype.get = function ConstantValue_get (engine) {
	return this.value;
    };

    ConstantValue.prototype.set = function ConstantValue_set (engine, value) {
	throw new TexRuntimeException ('cannot set a constant Value')
    };

    return ConstantValue;
}) ();


function _make_int_value (type) {
    type.prototype.scan = function IntValue_scan (engine) {
	return engine.scan_int ();
    };

    return type; // convenience.
}

function _make_dimen_value (type) {
    type.prototype.scan = function DimenValue_scan (engine) {
	return engine.scan_dimen ();
    };

    type.prototype.tostr = function DimenValue_tostr (engine, value) {
	return value.asfloat ().toFixed (3) + 'pt';
    };

    return type;
}

function _make_glue_value (type) {
    type.prototype.scan = function GlueValue_scan (engine) {
	return engine.scan_glue ();
    };

    return type;
}

function _make_muglue_value (type) {
    type.prototype.scan = function MuGlueValue_scan (engine) {
	return engine.scan_glue ({mumode: true});
    };

    return type;
}

function _make_toks_value (type) {
    type.prototype.scan = function ToksValue_scan (engine) {
	engine.scan_one_optional_space ();

	var tok = engine.next_tok ();
	if (tok === null)
	    throw new TexSyntaxException ('EOF in middle of toklist assignment');

	// TODO: \tokpar=<toklist register or toklist param>
	if (!tok.iscat (C_BGROUP))
	    throw new TexSyntaxException ('expected { in toklist assignment');

	return engine.scan_tok_group (false);
    };

    type.prototype.tostr = function ToksValue_tostr (engine, value) {
	return value.join ('|');
    };

    return type;
}

function _make_font_value (type) {
    return type; // TODO
}


var ConstantIntValue = (function ConstantIntValue_closure () {
    function ConstantIntValue (value) { ConstantValue.call (this, value); }
    inherit (ConstantIntValue, ConstantValue);
    return _make_int_value (ConstantIntValue);
}) ();

var ConstantDimenValue = (function ConstantDimenValue_closure () {
    function ConstantDimenValue (value) { ConstantValue.call (this, value); }
    inherit (ConstantDimenValue, ConstantValue);
    return _make_dimen_value (ConstantDimenValue);
}) ();

var ConstantFontValue = (function ConstantFontValue_closure () {
    function ConstantFontValue (value) { ConstantValue.call (this, value); }
    inherit (ConstantFontValue, ConstantValue);
    return _make_font_value (ConstantFontValue);
}) ();


var IntRegValue = (function IntRegValue_closure () {
    function IntRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (IntRegValue, RegisterValue);

    IntRegValue.prototype.get = function IntRegValue_get (engine) {
	return engine.countreg (this.reg);
    };

    IntRegValue.prototype.set = function IntRegValue_set (engine, value) {
	engine.set_countreg (this.reg, value);
    };

    return _make_int_value (IntRegValue);
}) ();

var DimenRegValue = (function DimenRegValue_closure () {
    function DimenRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (DimenRegValue, RegisterValue);

    DimenRegValue.prototype.get = function DimenRegValue_get (engine) {
	return engine.dimenreg (this.reg);
    };

    DimenRegValue.prototype.set = function DimenRegValue_set (engine, value) {
	engine.set_dimenreg (this.reg, value);
    };

    return _make_dimen_value (DimenRegValue);
}) ();

var GlueRegValue = (function GlueRegValue_closure () {
    function GlueRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (GlueRegValue, RegisterValue);

    GlueRegValue.prototype.get = function GlueRegValue_get (engine) {
	return engine.gluereg (this.reg);
    };

    GlueRegValue.prototype.set = function GlueRegValue_set (engine, value) {
	engine.set_gluereg (this.reg, value);
    };

    return _make_glue_value (GlueRegValue);
}) ();

var MuGlueRegValue = (function MuGlueRegValue_closure () {
    function MuGlueRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (MuGlueRegValue, RegisterValue);

    MuGlueRegValue.prototype.get = function MuGlueRegValue_get (engine) {
	return engine.mugluereg (this.reg);
    };

    MuGlueRegValue.prototype.set = function MuGlueRegValue_set (engine, value) {
	engine.set_mugluereg (this.reg, value);
    };

    return _make_muglue_value (MuGlueRegValue);
}) ();

var ToksRegValue = (function ToksRegValue_closure () {
    function ToksRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (ToksRegValue, RegisterValue);

    ToksRegValue.prototype.get = function ToksRegValue_get (engine) {
	return engine.toksreg (this.reg);
    };

    ToksRegValue.prototype.set = function ToksRegValue_set (engine, value) {
	engine.set_toksreg (this.reg, value);
    };

    return _make_toks_value (ToksRegValue);
}) ();


var IntParamValue = (function IntParamValue_closure () {
    function IntParamValue (name) { ParamValue.call (this, name); }
    inherit (IntParamValue, ParamValue);

    IntParamValue.prototype.get = function IntParamValue_get (engine) {
	return engine.countpar (this.name);
    };

    IntParamValue.prototype.set = function IntParamValue_set (engine, value) {
	engine.set_countpar (this.name, value);
    };

    return _make_int_value (IntParamValue);
}) ();

var DimenParamValue = (function DimenParamValue_closure () {
    function DimenParamValue (name) { ParamValue.call (this, name); }
    inherit (DimenParamValue, ParamValue);

    DimenParamValue.prototype.get = function DimenParamValue_get (engine) {
	return engine.dimenpar (this.name);
    };

    DimenParamValue.prototype.set = function DimenParamValue_set (engine, value) {
	engine.set_dimenpar (this.name, value);
    };

    return _make_dimen_value (DimenParamValue);
}) ();

var GlueParamValue = (function GlueParamValue_closure () {
    function GlueParamValue (name) { ParamValue.call (this, name); }
    inherit (GlueParamValue, ParamValue);

    GlueParamValue.prototype.get = function GlueParamValue_get (engine) {
	return engine.gluepar (this.name);
    };

    GlueParamValue.prototype.set = function GlueParamValue_set (engine, value) {
	engine.set_gluepar (this.name, value);
    };

    return _make_glue_value (GlueParamValue);
}) ();

var MuGlueParamValue = (function MuGlueParamValue_closure () {
    function MuGlueParamValue (name) { ParamValue.call (this, name); }
    inherit (MuGlueParamValue, ParamValue);

    MuGlueParamValue.prototype.get = function MuGlueParamValue_get (engine) {
	return engine.mugluepar (this.name);
    };

    MuGlueParamValue.prototype.set = function MuGlueParamValue_set (engine, value) {
	engine.set_mugluepar (this.name, value);
    };

    return _make_muglue_value (MuGlueParamValue);
}) ();

var ToksParamValue = (function ToksParamValue_closure () {
    function ToksParamValue (name) { ParamValue.call (this, name); }
    inherit (ToksParamValue, ParamValue);

    ToksParamValue.prototype.get = function ToksParamValue_get (engine) {
	return engine.tokspar (this.name);
    };

    ToksParamValue.prototype.set = function ToksParamValue_set (engine, value) {
	engine.set_tokspar (this.name, value);
    };

    return _make_toks_value (ToksParamValue);
}) ();
