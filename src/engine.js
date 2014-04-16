var EquivTable = (function EquivTable_closure () {
    function EquivTable (parent) {
	this.toplevel = parent.toplevel;
	this.parent = parent;
	init_generic_eqtb (this);
    }

    fill_generic_eqtb_accessors (EquivTable.prototype);

    return EquivTable;
})();


var TopEquivTable = (function TopEquivTable_closure () {
    function TopEquivTable () {
	this.toplevel = this;
	this.parent = null;

	init_top_eqtb (this);

	for (var i = 0; i < 256; i++) {
	    this._catcodes[i] = C_OTHER;
	    this._mathcodes[i] = i;
	    this._sfcodes[i] = 1000;
	    this._delcodes[i] = -1;
	    this._glueregs[i] = new Glue ();
	    this._tokregs[i] = [];
	    this._boxregs[i] = new Box ();
	}

	for (var i = 0; i < 26; i++) {
	    this._catcodes[O_LC_A + i] = C_LETTER;
	    this._catcodes[O_UC_A + i] = C_LETTER;
	    this._mathcodes[O_LC_A + i] = O_LC_A + i + 0x7100;
	    this._mathcodes[O_UC_A + i] = O_UC_A + i + 0x7100;
	    this._uccodes[O_UC_A + i] = O_UC_A + i;
	    this._uccodes[O_LC_A + i] = O_UC_A + i;
	    this._lccodes[O_UC_A + i] = O_LC_A + i;
	    this._lccodes[O_LC_A + i] = O_LC_A + i;
	    this._sfcodes[O_UC_A + i] = 999;
	}

	for (var i = O_ZERO; i < O_ZERO + 10; i++)
	    this._mathcodes[i] = i + 0x7000;

	this._catcodes[O_NULL] = C_IGNORE;
	this._catcodes[O_BACKSPACE] = C_INVALID;
	this._catcodes[O_RETURN] = C_EOL;
	this._catcodes[O_SPACE] = C_SPACE;
	this._catcodes[O_PERCENT] = C_COMMENT;
	this._catcodes[O_BACKSLASH] = C_ESCAPE;

	this._delcodes[O_PERIOD] = 0;
    }

    inherit (TopEquivTable, EquivTable);

    fill_top_eqtb_accessors (TopEquivTable.prototype);

    return TopEquivTable;
})();


var Engine = (function Engine_closure () {
    var TS_BEGINNING = 0, TS_MIDDLE = 1, TS_SKIPPING = 2;
    var AF_GLOBAL = 1 << 0;
    var CS_FI = 0, CS_ELSE_FI = 1, CS_OR_ELSE_FI = 2;
    var BO_SETBOX = 0;

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

	this.conditional_stack = [];

	this.infiles = [];
	for (var i = 0; i < 16; i++)
	    this.infiles[i] = null;

	this.commands = {};
	fill_cseq_commands (this);
	engine_init_parameters (this);
	engine_init_param_cseqs (this);

	// T:TP sec 240; has to go after $init_parameters
	this.set_intpar ('mag', 1000);
	this.set_intpar ('tolerance', 1000);
	this.set_intpar ('hangafter', 1);
	this.set_intpar ('maxdeadcycles', 25);
	this.set_intpar ('escapechar', O_BACKSLASH);
	this.set_intpar ('endlinechar', O_RETURN);

	var d = new Date ();
	this.set_intpar ('year', d.getYear ());
	this.set_intpar ('month', d.getMonth ());
	this.set_intpar ('day', d.getDay ());
	this.set_intpar ('time', d.getHours () * 60 + d.getMinutes ());

	var nf = new Font ('nullfont', -1000);
	this.set_font ('<null>', nf);
	this.set_font ('<current>', nf);
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

    // Mode and grouping stuff.

    proto.nest_eqtb = function Engine_nest_eqtb () {
	this.eqtb = new EquivTable (this.eqtb);
    };

    proto.unnest_eqtb = function Engine_unnest_eqtb () {
	this.eqtb = this.eqtb.parent;
	if (this.eqtb == null)
	    throw new TexInternalException ('unnested eqtb too far');
    };

    proto.mode = function Engine_mode () {
	return this.mode_stack[this.mode_stack.length - 1];
    };

    proto.enter_mode = function Engine_enter_mode (mode) {
	this.debug ('<enter ' + mode_abbrev[mode] + ' mode>');
	this.mode_stack.push (mode);
	this.build_stack.push ([]);
    };

    proto.leave_mode = function Engine_leave_mode () {
	var oldmode = this.mode_stack.pop ();
	var tlist = this.build_stack.pop ();
	this.debug ('<leave ' + mode_abbrev[oldmode] + ' mode: ' +
		    tlist.length + ' items>');
	return tlist;
    };

    proto.ensure_horizontal = function Engine_ensure_horizontal () {
	if (this.mode () == M_VERT)
	    this.enter_mode (M_HORZ);
	else if (this.mode () == M_IVERT)
	    this.enter_mode (M_RHORZ);
    };

    proto.mode_accum = function Engine_mode_accum (item) {
	this.build_stack[this.build_stack.length - 1].push (item);
    };

    proto.handle_bgroup = function Engine_handle_bgroup () {
	this.debug ('< --> simple>');
	this.nest_eqtb ();
	this.group_exit_stack.push (this.unnest_eqtb.bind (this));
    };

    proto.handle_egroup = function Engine_handle_egroup () {
	if (!this.group_exit_stack.length)
	    throw new TexRuntimeError ('ending a group that wasn\'t started');
	return (this.group_exit_stack.pop ()) (this);
    };

    proto.handle_begingroup = function Engine_handle_begingroup () {
	this.debug ('< --> semi-simple>');
	this.nest_eqtb ();

	function end_semisimple (eng) {
	    throw new TexRuntimeError ('expected \\endgroup but got something ' +
				       'else');
	}
	end_semisimple.is_semisimple = true;

	this.group_exit_stack.push (end_semisimple);
    };

    proto.handle_endgroup = function Engine_handle_endgroup () {
	if (!this.group_exit_stack.length)
	    throw new TexRuntimeException ('stray \\endgroup');

	ender = this.group_exit_stack.pop ();
	if (ender.is_semisimple === true)
	    throw new TexRuntimeException ('got \\endgroup when should have ' +
					   'gotten other group-ender');

	this.debug ('< <-- semi-simple>');
	this.unnest_eqtb ();
    };

    // Tokenization. I'd like to separate this out into its own class,
    // but there are just too many interactions between this subsystem and
    // the rest of the engine.

    proto.push = function Engine_push (tok) {
	this.pushed_tokens.push (tok);
    };

    proto.push_string = function Engine_push_string (text) {
	for (var i = text.length - 1; i >= 0; i--) {
	    if (text[i])
		this.push (Token.new_char (C_SPACE, O_SPACE));
	    else
		this.push (Token.new_char (C_OTHER, text.charCodeAt (i)));
	}
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
	    if (tok.isotherchar (O_EQUALS))
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
	    var tok = this.next_x_tok ();
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

	var v = tok.tocmd (this).as_int (this);
	if (v != null)
	    return v.intproduct (negfactor);

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
	/* `infmode` says whether infinities are allowed. If true, the return
	 * value is [dimen, infinity_order] rather than just the dimension. */
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1], inf_order = 0, val = null,
	    frac = 0, nonfrac = null;

	var v = tok.tocmd (this).asvalue (this);
	if (v != null) {
	    v = v.get (this);

	    if (mumode)
		throw new TexRuntimeException ('not implemented');
	    else {
		var u = v.as_dimen ();
		if (u != null)
		    // We got a full-on dimen value; return it
		    return Dimen.new_product (negfactor, u.as_scaled ());
		// We got an int.
		nonfrac = v.as_int ();
	    }
	}

	if (nonfrac == null) {
	    // We need to scan a literal number.
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
		frac = Scaled.new_from_decimals (digits);
	    }
	}

	if (nonfrac < 0) {
	    negfactor = -negfactor;
	    nonfrac = -nonfrac;
	}

	if (this.scan_keyword ('true'))
	    throw new TexRuntimeException ('not implemented true-dimens');

	tok = this.chomp_spaces ();
	var val = tok.tocmd (this).as_scaled (this);
	var result = null;

	if (val != null) {
	    result = val.times_parts (nonfrac, frac);
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

	var v = tok.tocmd (this).as_glue (this);
	if (v != null)
	    return v.intproduct (negfactor);

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


    proto.scan_streamnum = function Engine_scan_streamnum () {
	var snum = this.scan_int ().value;
	if (snum < 0 || snum > 15)
	    return 16; // NOTE: our little convention
	return snum;
    };


    // Conditionals

    proto.handle_if = function Engine_handle_if (result) {
	/* Assumes that an \if has just been read in and the result of the
         * test is `result`. We now prepare to handle the outcome. We'll have
         * to evaluate one branch and skip the other, taking care to pay
         * attention to nesting in the latter. We'll also have to swallow
         * \else and \fi tokens as appropriate. */

	if (result) {
	    /* All we need to do now is mark that we're an expecting an \else
             * or \fi, and that the else-block should be skipped if
             * encountered. */
	    this.conditional_stack.push (CS_ELSE_FI);
	    return;
	}

	if (this._if_skip_until (CS_ELSE_FI) == 'else') {
	    /* Encountered the else-block. We evaluate this part, and expect
             * to eat a \fi. */
	    this.conditional_stack.push (CS_FI);
	    return;
	}

	/* The \if was false and there's no else. We've skipped and just eaten
         * the \fi. Nothing else to do. */
    }


    proto.handle_if_case = function Engine_handle_if_case (value) {
	/* \ifcase<num> has just been read in and evaluated to `value`. We
         * want to evaluate the value'th case, or an \else, or nothing. */
	var ntoskip = value;

	while (ntoskip > 0) {
	    var found = this._if_skip_until (CS_OR_ELSE_FI);
	    if (found == 'fi')
		// Nothing left and no \else. Nothing to do.
		return;

	    if (found == 'else') {
		// We hit the else without finding our target case. We
		// want to evaluate it and then eat a \fi.
		this.conditional_stack.push (CS_FI);
		return;
	    }

	    // Hit an \or. Another case down the tubes.
	    ntoskip -= 1;
	}

	// If we're here, we must have hit our desired case! We'll have to
	// skip the rest of the cases later.
	this.conditional_stack.push (CS_OR_ELSE_FI);
    };


    proto._if_skip_until = function Engine__if_skip_until (mode) {
	var depth = 0;

	while (true) {
	    var tok = this.next_tok ();
	    if (tok == null)
		throw new TexSyntaxException ('EOF inside \\if');

	    if (tok.iscmd (this, 'else')) {
		if (depth == 0) {
		    if (mode == CS_FI)
			throw new TexSyntaxException ('unexpected \\else');
		    this.debug ('... skipped conditional ... ' + tok);
		    return 'else';
		}
	    } else if (tok.iscmd (this, 'fi')) {
		if (depth > 0)
		    depth -= 1;
		else {
		    this.debug ('... skipped conditional ... ' + tok);
		    return 'fi';
		}
	    } else if (tok.iscmd (this, 'or')) {
		if (depth == 0) {
		    if (mode != CS_OR_ELSE_FI)
			throw new TexSyntaxException ('unexpected \\or');
		    this.debug ('... skipped conditional ... ' + tok);
		    return 'or';
		}
	    } else if (tok.isconditional (this)) {
		depth += 1;
	    }
	}

	throw new TexInternalException ('not reached');
    };


    proto.handle_or = function Engine_handle_or () {
	// We should only get here if we executed an \ifcase case and we need
	// to eat up alternate branches until the end.

	if (!this.conditional_stack.length)
	    throw new TexSyntaxException ('stray \\or');

	var mode = this.conditional_stack.pop (), skipmode = CS_OR_ELSE_FI;
	if (mode != CS_OR_ELSE_FI)
	    throw new TexSyntaxException ('unexpected \\or');

	while (true) {
	    var found = this._if_skip_until (skipmode)
	    if (found == 'fi')
		break;
	    if (found == 'else')
		skipmode = CS_FI;
	}
    };


    proto.handle_else = function Engine_handle_else () {
	if (!this.conditional_stack.length)
	    throw new TexSyntaxException ('stray \\else');

	var mode = this.conditional_stack.pop ();
	if (mode == CS_FI)
	    throw new TexSyntaxException ('unexpected (duplicate?) \\else');

	this._if_skip_until (CS_FI);
    };

    proto.handle_fi = function Engine_handle_fi () {
	if (!this.conditional_stack.length)
	    throw new TexSyntaxException ('stray \\fi');

	// Don't care about mode, and nothing more to do.
	this.conditional_stack.pop ();
    };


    // Box construction

    proto.scan_box = function Engine_scan_box () {
	var tok = null;

	while (true) {
	    tok = this.next_x_tok ();
	    if (tok == null)
		throw new TexSyntaxException ('EOF while scanning box');
	    if (!tok.iscat (C_SPACE) && !tok.iscmd (this, 'relax'))
		break;
	}

	// TODO: deal with leader_flag and hrule stuff; should accept:
	// \box, \copy, \lastbox, \vsplit, \hbox, \vbox, \vtop

	if (!tok.tocmd (this).boxlike)
	    throw new TexRuntimeException ('expected boxlike command but got ' + tok);
	this.push (tok);
    };


    proto.handle_setbox = function Engine_handle_setbox (reg) {
        // We just scanned "\setbox NN =". We'll now expect a box-construction
        // expression. The TeX design is such that rather than trying to read
        // in the whole box at once, we instead remember that we were doing a
        // setbox operation.

        function set_the_box (engine, box) {
            this.debug ('... finish setbox: #' + reg + ' = ' + box);
            engine.set_boxreg (reg, box)
	}

        this.boxop_stack.push ([set_the_box, true]);
        this.scan_box (); // check that we're being followed by a box.
    };

    proto.handle_hbox = function Engine_handle_hbox () {
	var is_exact, spec;

	if (this.scan_keyword ('to')) {
	    is_exact = true;
	    spec = this.scan_dimen ();
	} else if (this.scan_keyword ('spread')) {
	    is_exact = false;
	    spec = this.scan_dimen ();
	} else {
	    is_exact = false;
	    spec = new Dimen ();
	}

	function finish_box (engine) {
	    if (!this.boxop_stack.length)
		throw new TexRuntimeException ('what to do with bare box?');

	    this.debug ('<--- hbox');
	    this.unnest_eqtb ();
	    var box = new Box ();
	    box.tlist = this.leave_mode ();
	    var t = this.boxop_stack.pop ();
	    var boxop = t[0], isassignment = t[1];
	};

	this.scan_left_brace ();

	if (this.boxop_stack && this.boxop_stack.length)
	    // This is an assignment expression.
	    this.maybe_insert_after_assign_token ();

	this.debug ('--> hbox');
	this.enter_mode (M_RHORZ);
	this.nest_eqtb ();
	this.group_exit_stack.push (finish_box.bind (this));
    };


    // Miscellaneous

    proto.set_global_assign_mode = function Engine_set_global_assign_mode () {
	this.assign_flags |= AF_GLOBAL;
    };

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
