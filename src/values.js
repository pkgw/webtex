// The core TeX Value implementations.

var TexInt = (function TexInt_closure () {
    // These objects are immutable.
    function TexInt (value) {
	if (value instanceof TexInt)
	    this.value_I = value.value_I;
	else
	    this.value_I = nlib.check__N_I (value);
    }

    inherit (TexInt, Value);
    var proto = TexInt.prototype;

    proto.toString = function TexInt_toString () {
	return '<' + this.value_I + '|i>';
    };

    proto.to_texstr = function TexInt_to_texstr () {
	return '' + this.value_I;
    };

    proto.clone = function TexInt_clone () {
	return new TexInt (this.value_I);
    };

    proto.is_nonzero = function TexInt_is_nonzero () {
	return (this.value_I != 0);
    };

    proto.as_int__I = function TexInt_as_int__I () {
	return this.value_I;
    };

    proto.as_scaled__S = function TexInt_as_scaled__S () {
	// typeof NaN is 'number' and typeof null is 'object', so undefined
	// seems better just in case.
	return undefined;
    };

    proto.as_glue = function TexInt_as_glue () {
	return null;
    };

    proto.as_serializable = function TexInt_as_serializable () {
	return this.value_I;
    };

    TexInt.deserialize = function TexInt_deserialize (data) {
	return new TexInt (nlib.parse__O_I (data));
    };

    proto.advance = function TexInt_advance (other) {
	return new TexInt (this.value_I + other.value_I);
    };

    proto.product__I_O = function TexInt_product__I_O (k_I) {
	return new TexInt (this.value_I * k_I);
    };

    proto.divide__I_O = function TexInt_divide__I_O (k_I) {
	return new TexInt (this.value_I / k_I >> 0);
    };

    return TexInt;
}) ();


var Dimen = (function Dimen_closure () {
    var MAX_SCALED = 0x40000000; // 2**30 = 1073741824 = '10000000000

    // These objects are mutable.
    function Dimen () {
	this.sp_S = nlib.Zero_S;
    }

    inherit (Dimen, Value);
    var proto = Dimen.prototype;

    Dimen.new_product__IS_O = function Dimen_new_product__IS_O (k_I, x_S) {
	var d = new Dimen ();
	d.sp_S = nlib.nx_plus_y__ISS_S (k_I, x_S, nlib.Zero_S);
	return d;
    };

    proto.toString = function Dimen_toString () {
	return nlib.unscale__S_N (this.sp_S).toFixed (3) + 'pt';
    };

    proto.to_texstr = function Dimen_to_texstr () {
	return nlib.to_texstr__S_O (this.sp_S);
    };

    proto.clone = function Dimen_clone () {
	var d = new Dimen ();
	d.sp_S = this.sp_S;
	return d;
    };

    proto.is_nonzero = function Dimen_is_nonzero () {
	return this.sp_S != 0;
    };

    proto.set_to = function Dimen_set_to (val) {
	if (val instanceof Dimen)
	    this.sp_S = val.sp_S;
	else if (typeof val === 'number')
	    this.sp_S = val;
	else
	    throw new TexInternalError ('expected int or Dimen value, got %o', val);
	return this;
    };

    proto.as_int__I = function Dimen_as_int__I () {
	return this.sp_S; // Yes, this is correct.
    };

    proto.as_scaled__S = function Dimen_as_scaled__S () {
	return this.sp_S;
    };

    proto.as_glue = function Dimen_as_glue () {
	return null;
    };

    proto.as_serializable = function Dimen_as_serializable () {
	return this.sp_S;
    };

    Dimen.deserialize = function Dimen_deserialize (data) {
	var d = new Dimen ();
	d.sp_S = nlib.parse__O_S (data);
	return d;
    };

    proto.advance = function Dimen_advance (other) {
	var d = new Dimen ();
	d.sp_S += other.as_scaled__S ();
	return d;
    };

    proto.product__I_O = function Dimen_product__I_O (k) {
	k = nlib.maybe_unbox__O_I (k);
	var d = new Dimen ();
	d.sp_S = nlib.nx_plus_y__ISS_S (k, d.sp_S, nlib.Zero_S);
	return d;
    };

    proto.divide__I_O = function Dimen_divide__I_O (k) {
	k = nlib.maybe_unbox__O_I (k);
	var d = this.clone ();
	d.sp_S = nlib.x_over_n__SI_SS (d.sp_S, k)[0];
	return d;
    };

    return Dimen;
}) ();


var Glue = (function Glue_closure () {
    function Glue () {
	this.amount_S = nlib.Zero_S;
	this.stretch_S = nlib.Zero_S;
	this.stretch_order = 0;
	this.shrink_S = nlib.Zero_S;
	this.shrink_order = 0;
    }

    inherit (Glue, Value);
    var proto = Glue.prototype;

    proto.toString = function Glue_toString () {
	return format ('<Glue %S plus %S|%d minus %S|%d>', this.amount_S,
		       this.stretch_S, this.stretch_order, this.shrink_S,
		       this.shrink_order);
    };

    proto.to_texstr = function Glue_to_texstr () {
	var t = nlib.to_texstr__S_O (this.amount_S);

	if (this.stretch_S != 0) {
	    t += format (' plus %S', this.stretch_S);

	    if (this.stretch_order > 0) {
		t = t.slice (0, -2); // strip trailing 'pt'
		t += 'fil';
		if (this.stretch_order > 1)
		    t += 'l';
		if (this.stretch_order > 2)
		    t += 'l';
	    }
	}

	if (this.shrink_S != 0) {
	    t += format (' minus %S', this.shrink_S);

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
	g.amount_S = this.amount_S;
	g.stretch_S = this.stretch_S;
	g.stretch_order = this.stretch_order;
	g.shrink_S = this.shrink_S;
	g.shrink_order = this.shrink_order;
	return g;
    };

    proto.is_nonzero = function Glue_is_nonzero () {
	return (this.amount_S != 0 ||
		this.stretch_S != 0 ||
		this.stretch_order != 0 ||
		this.shrink_S != 0 ||
		this.shrink_order != 0);
    };

    proto.as_int__I = function Glue_as_int__I () {
	return this.amount_S; // Yes, this is correct.
    };

    proto.as_scaled__S = function Glue_as_scaled__S () {
	return this.amount_S;
    };

    proto.as_glue = function Glue_as_glue () {
	return this.clone ();
    };

    proto.as_serializable = function Glue_as_serializable () {
	return [this.amount_S,
		this.stretch_S,
		this.stretch_order,
		this.shrink_S,
		this.shrink_order];
    };

    Glue.deserialize = function Glue_deserialize (data) {
	var g = new Glue ();
	g.amount_S = nlib.parse__O_S (data[0]);
	g.stretch_S = nlib.parse__O_S (data[1]);
	g.stretch_order = nlib.parse__O_I (data[2]);
	g.shrink_S = nlib.parse__O_S (data[3]);
	g.shrink_order = nlib.parse__O_I (data[4]);
	return g;
    };

    proto.advance = function Glue_advance (other) {
	var g = this.clone ();
	g.amount_S += other.amount_S;
	g.stretch_S += other.stretch_S;
	g.shrink_S += other.shrink_S;
	return g;
    };

    proto.product__I_O = function Glue_product__I_O (k) {
	k = nlib.maybe_unbox__O_I (k);
	var g = this.clone ();
	g.amount_S = nlib.nx_plus_y__ISS_S (k, g.amount_S, nlib.Zero_S);
	g.stretch_S = nlib.nx_plus_y__ISS_S (k, g.stretch_S, nlib.Zero_S);
	g.shrink_S = nlib.nx_plus_y__ISS_S (k, g.shrink_S, nlib.Zero_S);
	return g;
    };

    proto.divide__I_O = function Glue_divide__I_O (k) {
	k = nlib.maybe_unbox__O_I (k);
	var g = this.clone ();
	g.amount_S = nlib.x_over_n__SI_SS (g.amount_S, k)[0];
	g.stretch_S = nlib.x_over_n__SI_SS (g.stretch_S, k)[0];
	g.shrink_S = nlib.x_over_n__SI_SS (g.shrink_S, k)[0];
	return g;
    };

    return Glue;
}) ();


var Toklist = (function Toklist_closure () {
    function Toklist (toks) {
	if (toks == null)
	    this.toks = [];
	else if (toks instanceof Array) {
	    this.toks = toks.slice ();
	    for (var i = 0; i < toks.length; i++)
		if (!(toks[i] instanceof Token))
		    throw new TexInternalError ('non-token in toklist: %o', toks[i]);
	} else
	    throw new TexInternalError ('unexpected Toklist() argument: %o', toks);
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

    proto.textext = function Toklist_textext (engine, ismacro) {
	/* TeX representation of a toklist for \message, \write, etc. */
	return this.toks.map (function (t) {
	    return t.textext (engine, ismacro);
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
		throw new TexRuntimeError ('malformed serialized toklist: %s', text);

	    o = ord (text[i]);

	    if (o == O_HASH) {
		// Macro parameter token.
		i++;
		if (i >= n)
		    throw new TexRuntimeError ('malformed serialized toklist: %s', text);

		o = ord (text[i]);
		list.push (Token.new_param (o - O_ZERO));
		continue;
	    }

	    if ((o >= O_ZERO && o < O_ZERO + 10) ||
		(o >= O_LC_A && o < O_LC_A + 6) ||
		(o >= O_UC_A && o < O_UC_A + 6)) {
		// Escaped character.
		if (i + 2 >= n)
		    throw new TexRuntimeError ('malformed serialized toklist: %s', text);
		o = parseInt (text.substr (i, 2), 16);
		var cc = cc_idchar_unmap[text[i+2]];
		list.push (Token.new_char (cc, o));
		i += 2;
		continue; // catcode id char will be eaten by the for loop increment.
	    }

	    if (o != O_LEFT_BRACKET)
		throw new TexRuntimeError ('malformed serialized toklist: %s', text);

	    // We must be a cseq.
	    i++;
	    if (i >= n)
		throw new TexRuntimeError ('malformed serialized toklist: %s', text);

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
		    throw new TexRuntimeError ('malformed serialized toklist: %s', text);
		o = parseInt (text.substr (i + 1, 2), 16);
		name += String.fromCharCode (o);
		i += 3;
	    }

	    if (i >= n)
		// We ran off the end of the string!
		throw new TexRuntimeError ('malformed serialized toklist: %s', text);

	    // Finished the cseq successfully. For loop will eat the ].
	    list.push (Token.new_cseq (name));
	}

	return new Toklist (list);
    };

    return Toklist;
}) ();
