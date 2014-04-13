var EquivTable = (function EquivTable_closure () {
    function EquivTable (parent) {
	this.toplevel = parent.toplevel;
	this._parent = parent;
	init_generic_eqtb (this);
    }

    fill_generic_eqtb_accessors (EquivTable.prototype);

    return EquivTable;
})();


var TopEquivTable = (function TopEquivTable_closure () {
    function TopEquivTable () {
	this.toplevel = this;
	this._parent = null;

	init_top_eqtb (this);

	var i = 0;
	var t = this._catcodes = {};
	for (i = 0; i < 256; i++)
	    t[i] = C_OTHER;
	t[O_NULL] = C_IGNORE;
	t[O_BACKSPACE] = C_INVALID;
	t[O_RETURN] = C_EOL;
	t[O_SPACE] = C_SPACE;
	t[O_PERCENT] = C_COMMENT;
	t[O_BACKSLASH] = C_ESCAPE;
	for (var i = O_UC_A; i < O_UC_A + 26; i++)
	    t[i] = C_LETTER;
	for (var i = O_LC_A; i < O_LC_A + 26; i++)
	    t[i] = C_LETTER;

	t = this._mathcodes = {};
	for (var i = 0; i < 256; i++)
	    t[i] = i;
	for (var i = O_UC_A; i < O_UC_A + 26; i++)
	    t[i] = i + 0x7100;
	for (var i = O_LC_A; i < O_LC_A + 26; i++)
	    t[i] = i + 0x7100;
	for (var i = O_ZERO; i < O_ZERO + 10; i++)
	    t[i] = i + 0x7000;

	t = this._uccodes = {};
	for (var i = 0; i < 26; i++) {
	    t[O_UC_A + i] = O_UC_A + i;
	    t[O_LC_A + i] = O_UC_A + i;
	}

	t = this._lccodes = {};
	for (var i = 0; i < 26; i++) {
	    t[O_UC_A + i] = O_LC_A + i;
	    t[O_LC_A + i] = O_LC_A + i;
	}

	t = this._sfcodes = {};
	for (var i = 0; i < 256; i++)
	    t[i] = 1000;
	for (var i = O_UC_A; i < O_UC_A + 26; i++)
	    t[i] = 999;

	t = this._delcodes = {};
	for (var i = 0; i < 256; i++)
	    t[i] = -1;
	t[O_PERIOD] = 0;

	t = this._glueregs = {};
	for (var i = 0; i < 256; i++)
	    t[i] = new Glue ();

	t = this._tokregs = {};
	for (var i = 0; i < 256; i++)
	    t[i] = [];

	t = this._boxregs = {};
	for (var i = 0; i < 256; i++)
	    t[i] = new Box ();
    }

    inherit (TopEquivTable, EquivTable);

    fill_top_eqtb_accessors (TopEquivTable.prototype);

    return TopEquivTable;
})();


var Engine = (function Engine_closure () {
    var TS_BEGINNING = 0, TS_MIDDLE = 1, TS_SKIPPING = 2;
    var AF_GLOBAL = 1 << 0;

    function Engine (jobname, initial_ordsrc) {
	this.jobname = jobname;

	this.ordsrc = initial_ordsrc;
	this.tokenizer_state = TS_BEGINNING;
	this.pushed_tokens = [];

	this.eqtb = new TopEquivTable ();
	this.mode_stack = [M_VERT];
	this.build_stack = [[]];
	this.group_exit_stack = [];
	this.boxop_stack = [];

	this.assign_flags = 0;
	this.after_assign_token = null;
	// ...

	this.commands = {};
	fill_cseq_commands (this);
    }

    var proto = Engine.prototype;
    fill_engine_eqtb_wrappers (proto, AF_GLOBAL);

    // Infrastructure.

    proto.debug = function Engine_debug (text) {
	log ('{' + text + '}');
    };

    proto.warn = function Engine_warn (text) {
	log ('!! ' + text);
    };

    // Driving everything

    proto.step = function Engine_step () {
	var tok = this.next_x_tok ();
	if (tok == null)
	    return false; // no more tokens

	var cmd = tok.tocmd (this);
	var result = cmd.invoke (this);

	if (cmd.assign_flag_mode == AFM_INVALID && this.assign_flags)
	    this.warn ('assignment flags applied to inapplicable command ' + cmd);
	else if (cmd.assign_flag_mode != AFM_CONTINUE)
	    this.assign_flags = 0;

	if (result != null)
	    this.mode_accum (result);

	return true;
    };

    // Tokenization. I'd like to separate this out into its own class,
    // but there are just too many interactions between this subsystem and
    // the rest of the engine.

    proto.push = function Engine_push (tok) {
	this.pushed_tokens.push (tok);
    };

    proto.next_tok = function Engine_next_tok () {
	if (this.pushed_tokens.length)
	    return this.pushed_tokens.pop ();

	var catcodes = this.eqtb._catcodes;
	var o = this.ordsrc.next (catcodes);

	if (o === null) {
	    this.ordsrc = this.ordsrc.parent;
	    if (this.ordsrc === null)
		return null;
	    return this.next_tok ();
	}

	var cc = catcodes[o];

	if (cc == C_ESCAPE) {
	    if (this.ordsrc.iseol ())
		return Token.new_cseq ('');

	    o = this.ordsrc.next (catcodes);
	    cc = catcodes[o];
	    var csname = String.fromCharCode (o);

	    if (cc != C_LETTER) {
		if (cc == C_SPACE)
		    this.tokenizer_state = TS_SKIPPING;
		else
		    this.tokenizer_state = TS_MIDDLE;
		return Token.new_cseq (csname);
	    }

	    while (1) {
		o = this.ordsrc.next (catcodes);
		if (o === null)
		    break;

		cc = catcodes[o];
		if (cc != C_LETTER) {
		    this.ordsrc.push_ord (o);
		    break;
		}

		csname += String.fromCharCode (o);
	    }

	    this.tokenizer_state = TS_SKIPPING;
	    return Token.new_cseq (csname);
	}

	if (cc_ischar[cc]) {
	    this.tokenizer_state = TS_MIDDLE;
	    return Token.new_char (cc, o);
	}

	if (cc == C_EOL) {
	    this.ordsrc.discard_line ();
	    var prev_ts = this.tokenizer_state;
	    this.tokenizer_state = TS_BEGINNING;

	    if (prev_ts == TS_BEGINNING)
		return Token.new_cseq ('par');
	    if (prev_ts == TS_MIDDLE)
		return Token.new_char (C_SPACE, O_SPACE);
	    // TS_SKIPPING:
	    return this.next_tok ();
	}

	if (cc == C_IGNORE)
	    return this.next_tok ();

	if (cc == C_SPACE) {
	    if (this.tokenizer_state == TS_MIDDLE) {
		this.tokenizer_state = TS_SKIPPING;
		return Token.new_char (C_SPACE, O_SPACE);
	    }
	    return this.next_tok ();
	}

	if (cc == C_COMMENT) {
	    this.ordsrc.discard_line ();
	    this.tokenizer_state = TS_SKIPPING;
	    return this.next_tok ();
	}

	if (cc == C_INVALID) {
	    this.warn ('read invalid character ' + escchr (o));
	    return this.next_tok ();
	}

	// TODO: endinput
	throw new TexInternalException ('not reached');
    };

    proto.next_x_tok = function Engine_next_x_tok () {
	while (1) {
	    var tok = this.next_tok ();
	    if (tok === null)
		return null;

	    var cmd = tok.tocmd (this);
	    if (!cmd.expandable)
		return tok;

	    if (cmd.samecmd (this.commands['noexpand'])) {
		tok = this.next_tok ();
		this.debug ('noexpand: ' + tok);
		return tok;
	    }

	    // The core source of recursion:
	    cmd.invoke (this);
	}
    };

    // "Scanning" -- this is slightly higher-level than tokenization, and
    // can usually end up kicking off recursive parsing and evaluation.

    proto.scan_one_optional_space = function Engine_scan_one_optional_space () {
	var tok = this.next_tok ();
	if (tok == null || tok.iscat (C_SPACE))
	    return;
	this.push (tok);
    };

    proto.chomp_spaces = function Engine_chomp_spaces () {
	// T:TP sec. 406.
	while (1) {
	    var tok = this.next_x_tok ();
	    if (!tok.iscmd (this, '<space>'))
		return tok;
	}
    };

    proto.scan_left_brace = function Engine_scan_left_brace () {
	while (1) {
	    var tok = this.next_x_tok ();
	    if (tok == null)
		throw new TexSyntaxException ('EOF while expecting left brace');

	    if (tok.iscat (C_SPACE))
		continue;
	    if (tok.iscmd (this, 'relax'))
		continue;
	    if (tok.iscat (C_BGROUP))
		return;

	    throw new TexSyntaxException ('expected left brace but found ' + tok);
	}
    };

    proto.scan_optional_equals = function Engine_scan_optional_equals () {
	while (1) {
	    var tok = this.next_x_tok ();

	    if (tok == null)
		return false; // didn't find an equals
	    if (tok.iscat (C_SPACE))
		continue;
	    if (tok.ischar (C_OTHER, O_EQUALS))
		return true;

	    // Found a non-space, non-equals.
	    this.push (tok);
	    return false;
	}
    };

    proto.scan_keyword = function Engine_scan_keyword (keyword) {
	var toupper = O_UC_A - O_LC_A, n = keyword.length;
	var i = 0, scanned = [];

	while (i < n) {
	    tok = this.next_x_tok ();
	    if (tok == null)
		break;

	    scanned.push (tok);

	    if (i == 0 && tok.iscat (C_SPACE))
		continue; // my best interpretation of scan_keyword ...
	    else if (!tok.ischar ())
		break;

	    var o = keyword.charCodeAt (i);
	    if (tok.ord != o && tok.ord != o + toupper)
		break;
	    i += 1;
	}

	if (i == n)
	    return true; // got it

	// optional keyword not found; push back scanned tokens

	while (scanned.length)
	    this.push (scanned.pop ());

	return false;
    };

    proto._scan_signs = function Engine__scan_signs () {
	var negfactor = 1;

	while (1) {
	    var tok = this.next_x_tok ();
	    if (tok == null)
		throw new TexSyntaxException ('EOF scanning a signed quantity');

	    if (tok.iscat (C_SPACE)) {
	    } else if (tok.isotherchar (O_PLUS)) {
	    } else if (tok.isotherchar (O_MINUS)) {
		negfactor = -negfactor;
	    } else {
		return [negfactor, tok];
	    }
	}
    };

    proto.scan_int = function Engine_scan_int () {
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1];

	if (tok.isotherchar (O_BACKTICK)) {
	    tok = this.next_tok ();

	    if (tok.ischar ())
		// FIXME: possible align_state futzing
		return new TexInt (negfactor * tok.ord);

	    var csname = tok.name;
	    if (csname.length == 1)
		return new TexInt (negfactor * csname.charCodeAt (0));

	    throw new TexSyntaxException ('unhandled alpha number token ' + tok);
	}

	var v = tok.tocmd (this).asvalue (this);
	if (v != null)
	    return new TexInt (negfactor * v.get (this).asint ());

	// Looks like we have a literal integer

	var val = 0, sawany = false;

	if (tok.isotherchar (O_SQUOTE)) {
	    // Octal.
	    tok = this.next_x_tok ();
	    while (tok != null) {
		var v = tok.maybe_octal_value ();
		if (v < 0) {
		    this.push (tok);
		    break;
		}
		sawany = true;
		val = val * 8 + v;
		tok = this.next_x_tok ();
	    }
	} else if (tok.isotherchar (O_DQUOTE)) {
	    // Hexadecimal
	    tok = this.next_x_tok ();
	    while (tok != null) {
		var v = tok.maybe_hex_value ();
		if (v < 0) {
		    this.push (tok);
		    break;
		}
		sawany = true;
		val = val * 16 + v;
		tok = this.next_x_tok ();
	    }
	} else {
	    // Decimal
	    while (tok != null) {
		var v = tok.maybe_decimal_value ();
		if (v < 0) {
		    this.push (tok);
		    break;
		}
		sawany = true;
		val = val * 10 + v;
		tok = this.next_x_tok ();
	    }
	}

	if (!sawany)
	    throw new TexSyntaxException ('expected to see integer expression but ' +
				      'got the token ' + tok);

	if (val > 0x7FFFFFFF) {
	    this.warn ('found integer ' + val + ' greater than 2^32-1; ' +
		       'replace with that value');
	    val = 0x7FFFFFFF;
	}

	this.scan_one_optional_space ();
	return new TexInt (negfactor * val);
    };

    proto.scan_char_code = function Engine_scan_char_code () {
	// note: returns JS integer, not TexInt.
	return this.scan_int ().rangecheck (this, 0, 255).value;
    };

    proto.scan_register_num = function Engine_scan_register () {
	// note: returns JS integer, not TexInt.
	var v = this.scan_int ().value;
	if (v < 0 || v > 255)
	    throw new TexRuntimeException ('illegal register number ' + v);
	return v;
    };

    proto.scan_int_4bit = function Engine_scan_int_4bit () {
	// note: returns JS integer, not TexInt.
	return this.scan_int ().rangecheck (this, 0, 15).value;
    };

    proto.scan_dimen = function Engine_scan_dimen (mumode, infmode) {
	/* `infmode` says whether infinities are allowed. If true, the
	 * return value is [scaled, infinity_order] rather than just the
	 * scaled dimension. */
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1], inf_order = 0;

	// FIXME: we have to react differently based on whether the
	// value is an integer or a dimen.
	var v = tok.tocmd (this).asvalue (this);
	if (v != null) {
	    if (mumode)
		throw new TexRuntimeException ('not implemented');
	    else
		return Dimen.new_product (negfactor, v);
	}

	var frac = 0, radix = 10, nonfrac = 0;

	if (tok.isotherchar (O_PERIOD) || tok.isotherchar (O_COMMA)) {
	    /* nothing */
	} else {
	    this.push (tok);
	    nonfrac = this.scan_int ().value;
	    if (nonfrac < 0) {
		negfactor = -negfactor;
		nonfrac = -nonfrac;
	    }
	    tok = this.next_x_tok ();
	}

	if (!tok.isotherchar (O_PERIOD) && !tok.isotherchar (O_COMMA))
	    this.push (tok)
	else {
	    // We have a fractional part to deal with.
	    var digits = [];
	    while (true) {
		tok = this.next_tok ();
		var v = tok.maybe_decimal_value ();
		if (v < 0) {
		    if (!tok.iscat (C_SPACE))
			this.push (tok);
		    break;
		}
		digits.push (v);
	    }
	    frac = WEBTEX.round_decimals (digits);
	}

	if (this.scan_keyword ('true'))
	    throw new TexRuntimeException ('not implemented true-dimens');

	tok = this.chomp_spaces ();
	val = tok.tocmd (this).asvalue (this);
	var result = null;

	if (val != null) {
	    var v = val.get (this);
	    result = v.frac_product (nonfrac, frac);
	} else {
	    this.push (tok);

	    if (infmode && this.scan_keyword ('fil')) {
		inf_order = 1;
		while (this.scan_keyword ('l')) {
		    inf_order += 1;
		    if (inf_order > 3)
			throw new TexSyntaxException ('illegal infinity value ' +
						      '"fillll" or higher');
		}
		result = Scaled.new_from_parts (nonfrac, frac);
	    } else if (mumode) {
		if (this.scan_keyword ('mu'))
		    result = Scaled.new_from_parts (nonfrac, frac);
		else
		    throw new TexRuntimeException ('this quantity must have ' +
						   'dimensions of "mu"');
	    } else if (this.scan_keyword ('em')) {
		this.warn ('faking font em-width');
		v = Scaled.new_from_parts (18, 0);
		result = v.times_parts (nonfrac, frac);
	    } else if (this.scan_keyword ('ex')) {
		this.warn ('faking font ex-width');
		v = Scaled.new_from_parts (12, 0);
		result = v.times_parts (nonfrac, frac);
	    } else if (this.scan_keyword ('sp')) {
		result = new Scaled (nonfrac);
	    } else if (this.scan_keyword ('pt')) {
		result = Scaled.new_from_parts (nonfrac, frac);
	    } else {
		var num, denom;

		// Copied from T:TP sec. 458.
                if (this.scan_keyword ('in')) {
                    num = 7227;
		    denom = 100;
                } else if (this.scan_keyword ('pc')) {
                    num = 12;
		    denom = 1;
                } else if (this.scan_keyword ('cm')) {
                    num = 7227;
		    denom = 254;
                } else if (this.scan_keyword ('mm')) {
                    num = 7227;
		    denom = 2540;
                } else if (this.scan_keyword ('bp')) {
                    num = 7227;
		    denom = 7200;
                } else if (this.scan_keyword ('dd')) {
                    num = 1238;
		    denom = 1157;
                } else if (this.scan_keyword ('cc')) {
                    num = 14856;
		    denom = 1157;
                } else {
                    throw new TexSyntaxException ('expected a dimen unit but ' +
					      'didn\'t find it; next is ' + tok);
		}

		result = Scaled.new_parts_product (num, denom, nonfrac, frac);
	    }
	}

	// TODO this isn't always done.
	this.scan_one_optional_space ();

	result = Dimen.new_product (negfactor, result);
	if (infmode)
	    return [result, inf_order];
	return result;
    };

    proto.scan_glue = function Engine_scan_glue (mumode) {
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1];

	var v = tok.tocmd (this).asvalue (this);
	if (v != null)
	    // TODO: more care with type compatibility
	    return v.get (this).intproduct (negfactor);

	var g = new Glue ();
	this.push (tok);
	g.width = this.scan_dimen (mumode, false).intproduct (negfactor);

	if (this.scan_keyword ('plus')) {
	    t = this.scan_dimen (mumode, true);
	    g.stretch = t[0];
	    g.stretch_order = t[1];
	}

	if (this.scan_keyword ('minus')) {
	    t = this.scan_dimen (mumode, true);
	    g.shrink = t[0];
	    g.shrink_order = t[1];
	}

	return g;
    };

    proto.scan_r_token = function Engine_scan_r_token () {
	var tok = null;

	while (true) {
	    tok = this.next_tok ();
	    if (tok == null)
		throw new TexRuntimeException ('EOF when expected cseq name');
	    if (!tok.iscat (C_SPACE))
		break;
	}

	if (!tok.iscslike ())
	    throw new TexRuntimeException ('expected control seq or active char;' +
				       'got ' + tok);

	if (tok.is_frozen_cs ())
	    throw new TexRuntimeException ('cannot redefined control seq ' + tok);

	return tok;
    };

    proto.scan_tok_group = function Engine_scan_tok_group (expand) {
	/* Assumes that a BGROUP has just been read in. Generates a list of
	 * tokens, possibly with expansion, until an EGROUP is encountered,
	 * accounting for nested groups of course. */

	var depth = 1, toks = [], getter = null;

	if (expand)
	    getter = this.next_x_tok;
	else
	    getter = this.next_tok;

	while (true) {
	    var tok;
	    if (expand)
		tok = this.next_x_tok ();
	    else
		tok = this.next_tok ();

	    if (tok == null)
		throw new TexSyntaxException ('EOF in middle of a group');

	    if (tok.iscat (C_BGROUP))
		depth += 1;
	    else if (tok.iscat (C_EGROUP)) {
		depth -= 1;
		if (depth == 0)
		    break;
	    }

	    toks.push (tok);
	}

	return toks;
    };

    proto.scan_file_name = function Engine_scan_file_name () {
	var name = '';
	var tok = this.chomp_spaces ();

	while (1) {
	    if (tok == null)
		break;

	    if (!tok.ischar ()) {
		this.push (tok);
		break;
	    }

	    if (tok.iscat (C_SPACE))
		break;

	    name += String.fromCharCode (tok.ord);
	    tok = this.next_x_tok ();
	}

	return name;
    };

    // Miscellaneous

    proto.maybe_insert_after_assign_token =
	function Engine_maybe_insert_after_assign_token () {
	    if (this.after_assign_token !== null) {
		this.push (this.after_assign_token);
		this.after_assign_token = null;
	    }
	};

    return Engine;
})();

WEBTEX.Engine = Engine;
