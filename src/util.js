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
    };

    function nx_plus_y (n, x, y) {
	// n: TexInt; x, y, retval: scaled
	return mult_and_add (n, x, y, SC_MAX - 1);
    };

    WEBTEX.nx_plus_y = nx_plus_y;
}) ();
