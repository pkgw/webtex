// TeX-internal math support. There are certain limitations on integer math,
// and then there are fixed-point "scaled" values.
//
// JavaScript's lack of any kind of reasonable type system is REALLY fucking
// annoying. Things are an *utter* pain in the ass if scaled values aren't
// just represented as JS numbers, but then we have essentially no safeguards
// against accidental mixing and matching of scaled values and regular ints.
// Of course, in JS `1 + {}` is "1[object Object]", so the problems are a lot
// deeper than the lack of a newtype kind of system.
//
// After various experiments I feel that the best system is a naming convention.
//
// - variables holding numerical have names suffixed with a typecode
// - functions involving numerical values have names suffixed with typecodes
//   specifying their arguments and return value(s).
//
// That way, all valid math should pretty much involve a bunch of names ending
// with matching typecodes. If there's some kind of tricky operation that
// breaks this rule, a wrapper function should be created so that it can be
// preserved.
//
// Type codes are:
//   I - a TeX-compatible integer value
//   S - a "scaled" value
//   N - a JS number (may be a float, may be out of TeX's int range)
//   O - some non-numeric JS value
//
// The naming convention is not used for integer values that aren't used for
// math, such as register numbers, character ordinals, etc.
//
// We define a "nlib" object that holds a library of useful routines relating
// to all this numerical stuff.

var nlib = (function nlib_closure () {
    var SC_HALF  = 0x8000,     // 2**15 = 32768      = '100000
        SC_UNITY = 0x10000,    // 2**16 = 65536      = '200000
        SC_TWO   = 0x20000,    // 2**17 = 131072     = '400000
        SC_MAX   = 0x40000000, // 2**30 = 1073741824 = '10000000000
        UNSCALE  = Math.pow (2, -16),
        INT_MAX = 2147483647; // 2**31 - 1

    var nlib = {};

    function checkint__N_I (value) {
	if (typeof value != 'number')
	    throw new TexInternalError ('non-numeric tex-int value %o', value);
	if (value % 1 != 0)
	    throw new TexInternalError ('non-integer tex-int value %o', value);

	value = +value; // magic coercion to trustworthy int representation.

	if (Math.abs (value) > INT_MAX)
	    throw new TexRuntimeError ('out-of-range tex-int value %d', value);

	return value; // type safety ok: magic promotion to TeX-compatible int.
    }
    nlib.checkint__N_I = checkint__N_I;


    function scale__I_S (value_I) {
	return value_I * SC_UNITY;
    }
    nlib.scale__I_S = scale__I_S;

    function unscale__S_N (value_S) {
	return value_S * UNSCALE;
    }
    nlib.unscale__S_N = unscale__S_N;

    function from_parts__II_S (nonfrac_I, frac_I) {
	return nonfrac_I * SC_UNITY + frac_I; // type safety: this is correct.
    }
    nlib.from_parts__II_S = from_parts__II_S;


    function div (a, b) {
	// This function is used in a variety of contexts so it is special in
	// that it doesn't get type annotations even though it's a numerical
	// function.
	return a / b >> 0;
    }


    function mult_and_add__ISSS_S (n_I, x_S, y_S, maxanswer_S) {
	if (n_I < 0) {
	    x_S = -x_S;
	    n_I = -n_I;
	}

	if (n_I == 0)
	    return y_S;

	if (x_S <= div (maxanswer_S - y_S, n_I) && -x_S <= div (maxanswer_S + y_S, n_I))
	    return n_I * x_S + y_S;
	throw new TexRuntimeError ('over/underflow in mult+add');
    }

    function nx_plus_y__ISS_S (n_I, x_S, y_S) {
	return mult_and_add__ISSS_S (n_I, x_S, y_S, SC_MAX - 1);
    }


    function xn_over_d__ISI_SS (n_I, x_S, d_I) {
	// returns: [result_S, remainder_S]
	//   where the remainder is relevant if the low-significance digits
	//   of (x*n/d) must be rounded off.

	var positive = (x_S >= 0);
	if (!positive)
	    x_S = -x_S;

	var t = (x_S % SC_HALF) * n_I;
	var u = div (x_S, SC_HALF) * n_I + div (t, SC_HALF);
	var v = (u % d_I) * SC_HALF + (t % SC_HALF);

	if (div (u, d_I) > SC_HALF)
	    throw new TexRuntimeError ('over/underflow in xn_over_d');

	var w = SC_HALF * div (u, d_I) + div (v, d_I);

	if (positive)
	    return [w, v % d_I];
	return [-w, -(v % d_I)];
    }


    function x_over_n__SI_SS (x_S, n_I) {
	// returns: [x/n, remainder]
	//   where the remainder is relevant if the low-significance digits
	//   of (this/n) must be rounded off.

	if (n_I == 0)
	    throw new TexRuntimeError ('really, dividing by 0?');

	var negative = false;

	if (n_I < 0) {
	    x_S = -x_S;
	    n_I = -n_I;
	    negative = true;
	}

	var rv_S, rem_S;

	if (x_S >= 0) {
	    rv_S = div (x_S, n_I);
	    rem_S = x_S % n_I;
	} else {
	    rv_S = -div (-x_S, n_I);
	    rem_S = -((-x_S) % n_I);
	}

	if (negative)
	    rem = -rem;

	return [rv_S, rem_S];
    }


    function from_parts_product__IIII_S (num_I, denom_I, nonfrac_I, frac_I) {
	// equivalent to `from_parts__II_S (nonfrac_I, frac_I) *
	// (num_I/denom_I)` with better precision than you'd get naively.

	var tmp_SS = xn_over_d__ISI_SS (num_I, scale__I_S (nonfrac_I), denom_I);
	var result_S = tmp_SS[0], remainder_S = tmp_SS[1];
	frac_I = div (num_I * frac_I + SC_UNITY * remainder_S, denom_I);
	nonfrac_I = result_S + div (frac_I, SC_UNITY);
	frac_I = frac_I % SC_UNITY;
	return from_parts__II_S (nonfrac_I, frac_I);
    }
    nlib.from_parts_product__IIII_S = from_parts_product__IIII_S;


    function from_decimals__O_S (digarray) {
	var a = 0;

	while (digarray.length)
	    a = div (a + digarray.pop () * SC_TWO, 10);

	return div (a + 1, 2);
    }


    function times_parts__SII_S (x_S, nonfrac_I, frac_I) {
	var scfrac_S = xn_over_d__ISI_SS (frac_I, x_S, SC_UNITY)[0];
	return nx_plus_y__ISS_S (nonfrac_I, x_S, scfrac_S);
    }



    return nlib;
}) ();
