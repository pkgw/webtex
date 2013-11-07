'use strict';

// Short utility routines

(function Math_closure () {
    var SC_HALF  = 0x8000,     // 2**15 = 32768      = '100000
        SC_UNITY = 0x10000,    // 2**16 = 65536      = '200000
        SC_TWO   = 0x20000,    // 2**17 = 131072     = '400000
        SC_MAX   = 0x40000000, // 2**30 = 1073741824 = '10000000000
        UNSCALE  = Math.pow (2, -16);

    function div (a, b) {
	return a / b >> 0;
    }

    function mult_and_add (n, x, y, maxanswer) {
	// n: TexInt; x, y, retval: Scaled *or* TexInt; maxanswer: js int;

	if (n.value < 0) {
	    var xv = -x.value;
	    var nv = -n.value;
	} else {
	    var xv = x.value;
	    var nv = n.value;
	}

	if (nv == 0)
	    return y;

	var yv = y.value;

	if (xv <= div (maxanswer - yv, nv) && -xv <= div (maxanswer + yv, nv))
	    return new Scaled (nv * xv + yv);

	throw new TexRuntimeException ('over/underflow in multi+add');
    }

    function nx_plus_y (n, x, y) {
	// n: TexInt; x, y, retval: scaled
	return mult_and_add (n, x, y, SC_MAX - 1);
    }

    function xn_over_d (x, n, d) {
	// x, retvals: Scaled; n, d: TexInt
	// computes x * (n / d); n,

	var positive = (x.value >= 0);
	if (!positive)
	    var xv = -x.value;
	else
	    var xv = x.value

	var dv = d.value
	var t = (xv % SC_HALF) * n.value;
	var u = div (xv, SC_HALF) * n.value + div (t, SC_HALF);
	var v = (u % dv) * SC_HALF + (t % SC_HALF);

	if (div (u, dv) > SC_HALF)
	    throw new TexRuntimeException ('over/underflow in xn_over_d');

	var w = SC_HALF * div (u, dv) + div (v, dv);

	if (positive)
	    return [new Scaled (w), new Scaled (v % dv)];
	return [new Scaled (-w), new Scaled (-(v % dv))];
    }

    function x_over_n (x, n) {
	// x, retvals: Scaled; n: TexInt;

	if (n.value == 0)
	    throw new TexRuntimeException ('really, dividing by 0?');

	var negative = false;

	if (n.value < 0) {
	    var xv = -x.value, nv = -n.value;
	    negative = true;
	} else {
	    var xv = x.value, nv = n.value;
	}

	if (xv >= 0) {
	    var rv = div (xv, nv), rem = xv % nv;
	} else {
	    var rv = -div (-xv, nv), rem = -((-xv) % nv);
	}

	if (negative)
	    rem = -rem;

	return [new Scaled (rv), new Scaled (rem)];
    }

    WEBTEX.nx_plus_y = nx_plus_y;
    WEBTEX.xn_over_d = xn_over_d;
    WEBTEX.x_over_n = x_over_n;
}) ();


function ord (chr) {
    return chr.charCodeAt (0);
}

var _printable = '0123456789abcdefghijklmnopqrstuvwxyz' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\\\'()*+,-./:;<=>?@[\\]^_`{|}~ ';

function escchr (ord) {
    if (ord == O_NULL)
	return '\\0';
    if (ord == O_ALARM)
	return '\\a';
    if (ord == O_BACKSPACE)
	return '\\b';
    if (ord == O_TAB)
	return '\\t';
    if (ord == O_NEWLINE)
	return '\\n';
    if (ord == O_VTAB)
	return '\\v';
    if (ord == O_FORMFEED)
	return '\\f';
    if (ord == O_RETURN)
	return '\\r';
    if (ord == O_BACKSLASH)
	return '\\\\';

    var asstr = String.fromCharCode (ord);

    if (_printable.indexOf (asstr) >= 0)
	return asstr;

    return '\\x' + ('00' + ord.toString (16)).substr (-2);
}

WEBTEX.escchr = escchr;

function texchr (ord) {
    if (ord < 32)
	return '^^' + String.fromCharCode (ord + 64);
    if (ord < 127)
	return String.fromCharCode (ord);
    if (ord == 127)
	return '^^?';
    return '^^' + ord.toString (16);
}

WEBTEX.texchr = texchr;
