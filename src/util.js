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

    WEBTEX.nx_plus_y = nx_plus_y;
    WEBTEX.xn_over_d = xn_over_d;
}) ();
