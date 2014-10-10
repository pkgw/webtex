'use strict;'

var commands = {};


// Text layout.

commands.par = function cmd_par (engine) {
    var m = engine.mode ();

    if (m == M_VERT || m == M_IVERT) {
	// T:TP 1070
	engine.Ntrace ('par: vertical -> reset params');
	engine.set_parameter (T_INT, 'looseness', 0);
	engine.set_parameter (T_DIMEN, 'hangindent', new Dimen ());
	engine.set_parameter (T_INT, 'hangafter', 1);
	// TODO: clear \parshape info, which nests in the EqTb.
    } else if (m == M_RHORZ) {
	engine.Ntrace ('par: rhorz -> noop');
    } else if (m == M_HORZ) {
	// TeXBook p. 286:
	engine.Ntrace ('par: horz -> endgraf');
	engine.end_graf ();
    } else {
	throw new TexRuntimeError ('illegal use of \\par in math mode');
    }
};


commands.indent = function cmd_indent (engine) {
    engine.begin_graf (true);
};

commands.noindent = function cmd_noindent (engine) {
    engine.begin_graf (false);
};


commands._space_ = function cmd__space_ (engine) {
    // A control-space command appends glue to the current list, using the
    // same amount that a <space token> inserts when the space factor is 1000.
    engine.Ntrace ('" " (explicit space) fake dimen');

    var ss = engine.get_parameter (T_GLUE, 'spaceskip');
    if (ss.is_nonzero ()) {
	engine.accum (new BoxGlue (ss));
	return;
    }

    // TODO: real font glue dimensions. T:TP 1041,1042.
    var g = new Glue ();
    g.width.set_to (Scaled.new_from_parts (12, 0));
    engine.accum (new BoxGlue (g));
};


commands._fslash_ = function cmd__fslash_ (engine) {
    // Italic correction. T:TP 1111, 1112, 1113.

    switch (engine.mode ()) {
    case M_VERT: case M_IVERT:
	throw new TexRuntimeError ('cannot use \\/ in vertical mode');
    case M_MATH: M_DMATH:
	engine.Ntrace ('italic correction: math');
	engine.push (new Kern (new Dimen ()));
	break;
    case M_HORZ: M_RHORZ:
	// XXX: ignoring ligatures
	engine.Ntrace ('italic correction: text');
	var last = engine.get_last_listable ();
	if (last instanceof Character) {
	    var k = new Kern (Dimen.new_scaled (last.font.italic_correction (last.ord)))
	    // XXX: kern.subtype = Explicit.
	    engine.accum (k);
	}
	break;
    }
};


commands._char = function cmd__char (engine) {
    var ord = engine.scan_char_code ();
    engine.Ntrace ('char %C', ord);
    engine.push (Token.new_cmd (new GivenCharCommand (ord)));
};

commands.mathchar = function cmd_mathchar (engine) {
    var ord = engine.scan_int_15bit ();
    engine.Ntrace ('mathchar %x', ord);
    engine.push (Token.new_cmd (new GivenMathcharCommand (ord)));
};

// Language infrastructure

commands.relax = function cmd_relax (engine) {
    engine.Ntrace ('relax');
};


commands.expandafter = function cmd_expandafter (engine) {
    // Note that we can't use next_x_tok () here since we can end up
    // double-expanding what comes next in \expandafter A \expandafter B ...

    var tok1 = engine.next_tok_throw ();
    var tok2 = engine.next_tok_throw ();

    engine.Ntrace ('*expandafter %o|%o ...', tok1, tok2);

    var cmd2 = tok2.to_cmd (engine);
    if (cmd2.expandable)
	cmd2.invoke (engine);
    else
	engine.push_back (tok2);

    engine.push_back (tok1);
};


commands.noexpand = function cmd_noexpand (engine) {
    throw new TexInternalError ('\\noexpand shouldn\'t get evaluated');
};


commands.ignorespaces = function cmd_ignorespaces (engine) {
    engine.push_back (engine.chomp_spaces ());
};

commands.endcsname = function cmd_endcsname (engine) {
    throw new TexRuntimeError ('stray \\endcsname');
};


commands.csname = function cmd_csname (engine) {
    var csname = '';

    while (true) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxError ('EOF in \\csname');
	if (tok.is_cmd (engine, 'endcsname'))
	    break;
	if (!tok.is_char ())
	    throw new TexRuntimeError ('only character tokens should occur ' +
				       'between \\csname and \\endcsname');

	csname += String.fromCharCode (tok.ord);
    }

    var tok = Token.new_cseq (csname);
    engine.Ntrace ('* \\csname...\\endcsname -> %o', tok);
    engine.push (tok);

    var cmd = engine.get_cseq (csname);
    if (cmd == null || cmd.name == 'undefined')
	tok.assign_cmd (engine, engine.commands['relax']);
};


commands.global = function cmd_global (engine) {
    engine.Ntrace ('global');
    engine.set_global_assign_mode ();
};


commands.outer = function cmd_outer (engine) {
    engine.Ntrace ('outer'); // I think it's OK to make this a noop.
};


commands._long = function cmd_long (engine) {
    engine.Ntrace ('long'); // I think it's OK to make this a noop.
};


commands._let = function cmd_let (engine) {
    var cstok = engine.scan_r_token ();

    // Note that we don't use scan_optional_equals here since it
    // expands things.

    while (true) {
	var tok = engine.next_tok_throw ();
	if (tok.is_space (engine))
	    continue
	if (tok.is_other_char (O_EQUALS)) {
	    var equiv = engine.next_tok_throw ();
	    if (equiv.is_space (engine))
		equiv = engine.next_tok_throw ();
	    break;
	}
	var equiv = tok;
	break;
    }

    engine.Ntrace ('let %o = %o', cstok, equiv);
    cstok.assign_cmd (engine, equiv.to_cmd (engine));
};


commands.futurelet = function cmd_futurelet (engine) {
    var cstok = engine.scan_r_token ();
    var thenexpand = engine.next_tok_throw ();
    var equiv = engine.next_tok_throw ();
    engine.Ntrace ('futurelet %o = %o; %o', cstok, equiv, thenexpand);
    cstok.assign_cmd (engine, equiv.to_cmd (engine));
    engine.push_toks ([thenexpand, equiv]);
};


commands.string = function cmd_string (engine) {
    var tok = engine.next_tok_throw ();
    engine.Ntrace ('* \\string %o', tok);

    if (tok.is_char ()) {
	engine.push_string (String.fromCharCode (tok.ord));
	return;
    }

    if (tok.is_cslike ()) { // active chars were handled above
	var expn = tok.name, esc = engine.escapechar ();
	if (esc >= 0 && esc < 256)
	    expn = String.fromCharCode (esc) + expn;
    } else
	throw new TexRuntimeError ('don\'t know how to \\string-ize %o', tok);

    engine.push_string (expn);
};


commands.number = function cmd_number (engine) {
    var val = engine.scan_int ().value;
    engine.Ntrace ('* number %o', val);
    engine.push_string ('' + val);
};


commands.afterassignment = function cmd_afterassignment (engine) {
    var tok = engine.next_tok_throw ();
    engine.set_after_assign_token (tok);
    engine.Ntrace ('afterassignment <- %o', tok);
};


commands.aftergroup = function cmd_aftergroup (engine) {
    var tok = engine.next_tok_throw ();
    engine.Ntrace ('aftergroup <- %o', tok);
    engine.handle_aftergroup (tok);
};


// Register access and manipulation: \count, \advance, etc.

commands.count = new VariableRegisterCommand ('count', T_INT);
commands.dimen = new VariableRegisterCommand ('dimen', T_DIMEN);
commands.skip = new VariableRegisterCommand ('skip', T_GLUE);
commands.muskip = new VariableRegisterCommand ('muskip', T_MUGLUE);
commands.toks = new VariableRegisterCommand ('toks', T_TOKLIST);

commands.advance = function cmd_advance (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.to_cmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var delta = engine.scan_valtype (val.valtype);
    engine.Ntrace ('advance %o = %o + %o', cmd, cur, delta);
    val.set (engine, cur.advance (delta));
};


commands.divide = function cmd_divide (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.to_cmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var denom = engine.scan_int ();
    engine.Ntrace ('divide %o = %o / %o', cmd, cur, denom);
    val.set (engine, cur.intdivide (denom));
};


commands.multiply = function cmd_multiply (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.to_cmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var factor = engine.scan_int ();
    engine.Ntrace ('multiply %o = %o * %o', cmd, cur, factor);
    val.set (engine, cur.intproduct (factor));
};


function define_register (name, valtype, engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var reg = engine.scan_register_num ();
    engine.Ntrace ('%sdef %o -> {\\%s%d}', name, cstok, name, reg);
    cstok.assign_cmd (engine, new GivenRegisterCommand (valtype, name, reg));
};


commands.countdef = function cmd_countdef (engine) {
    define_register ('count', T_INT, engine);
};

commands.dimendef = function cmd_dimendef (engine) {
    define_register ('dimen', T_DIMEN, engine);
};

commands.skipdef = function cmd_skipdef (engine) {
    define_register ('skip', T_GLUE, engine);
};

commands.muskipdef = function cmd_muskipdef (engine) {
    define_register ('muskip', T_MUGLUE, engine);
};

commands.toksdef = function cmd_toksdef (engine) {
    define_register ('toks', T_TOKLIST, engine);
};


// Setting categories: \catcode, \mathcode, etc.

var CharCodeCommand = (function CharCodeCommand_closure () {
    function CharCodeCommand (codetype, name) {
	Command.call (this);
	this.codetype = codetype;
	this.name = name;
    }

    inherit (CharCodeCommand, Command);
    var proto = CharCodeCommand.prototype;

    proto.invoke = function CharCodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var code = engine.scan_int ().value;

	if (code < 0 || code > ct_maxvals[this.codetype])
	    throw new TexRuntimeException ('illegal value %d for %s', code,
					   ct_names[this.codetype]);

	engine.Ntrace ('%s %C=%x -> %x', ct_names[this.codetype], ord, ord, code);
	engine.set_code (this.codetype, ord, code);
    };

    proto.get_valtype = function CharCodeCommand_get_valtype () {
	return T_INT;
    };

    proto.as_valref = function CharCodeCommand_as_valref (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantValref (T_INT, engine.get_code (this.codetype, ord));
    };

    return CharCodeCommand;
})();

commands.catcode = new CharCodeCommand (CT_CATEGORY, 'catcode');
commands.mathcode = new CharCodeCommand (CT_MATH, 'mathcode');
commands.sfcode = new CharCodeCommand (CT_SPACEFAC, 'sfcode');
commands.lccode = new CharCodeCommand (CT_LOWERCASE, 'lccode');
commands.uccode = new CharCodeCommand (CT_UPPERCASE, 'uccode');
commands.delcode = new CharCodeCommand (CT_DELIM, 'delcode');


// \chardef, \mathchardef, etc.

commands.chardef = function cmd_chardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.Ntrace ('chardef %o -> {inschar %C=%x}', cstok, ord, ord);
    cstok.assign_cmd (engine, new GivenCharCommand (ord));
};


commands.mathchardef = function cmd_mathchardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var val = engine.scan_int ().value;
    if (val < 0 || val > 0x8000)
	throw new TexRuntimeError ('need mathcode in [0,0x8000] but got %d', val);
    engine.Ntrace ('mathchardef %o -> {insmathchar %x}', cstok, val);
    cstok.assign_cmd (engine, new GivenMathcharCommand (val));
};


// Macros.

function _cmd_def (engine, cname, expand_replacement) {
    var cstok = engine.scan_r_token ();

    var tmpl_toks = [], repl_toks = [], last_was_param = false,
        end_with_lbrace = false, next_pnum = 1;

    while (true) {
	var tok = engine.next_tok_throw ();

	if (last_was_param) {
	    if (tok.is_cat (C_BGROUP)) {
		tmpl_toks.push (tok);
		end_with_lbrace = true;
		engine.align_state--; // TTP 394 ... I think??
		break;
	    }

	    if (tok.is_other_char (O_ZERO + next_pnum)) {
		if (next_pnum > 9)
		    throw new TexRuntimeError ('macros may only have 9 parameters');

		tmpl_toks.push (Token.new_param (next_pnum));
		next_pnum += 1;
		last_was_param = false;
		continue;
	    }

	    throw new TexSyntaxError ('unexpected token %o following ' +
				      'parameter token', tok);
	}

	if (tok.is_cat (C_PARAM)) {
	    last_was_param = true;
	    continue;
	}

	if (tok.is_cat (C_BGROUP))
	    break;

	tmpl_toks.push (tok);
	last_was_param = false;
    }

    // We've just read in the param template and the left brace of
    // the replacement. Now read that in.

    var depth = 1;
    last_was_param = false;

    while (true) {
	var tok = engine.next_tok_throw ();

	if (expand_replacement) {
	    // We can't just use next_x_tok because \the{toklist} is
	    // not supposed to be sub-expanded (TeXBook p. 216). Yargh.
	    if (tok.is_cmd (engine, 'noexpand')) {
		tok = engine.next_tok_throw ();
	    } else if (tok.is_expandable (engine)) {
		if (tok.is_cmd (engine, 'the')) {
		    var next = engine.next_tok_throw ();
		    var ncmd = next.to_cmd (engine);

		    if (ncmd.get_valtype () == T_TOKLIST) {
			var nv = ncmd.as_valref (engine);
			repl_toks = repl_toks.concat (nv.get (engine).toks);
			continue;
		    } else {
			engine.push_back (next);
		    }
		}

		tok.to_cmd (engine).invoke (engine);
		continue;
	    }
	}

	if (last_was_param) {
	    if (tok.is_cat (C_PARAM)) {
		repl_toks.push (tok);
		last_was_param = false;
		continue;
	    }

	    if (tok.is_cat (C_OTHER) && tok.ord > O_ZERO &&
		tok.ord < O_ZERO + next_pnum) {
		repl_toks.push (Token.new_param (tok.ord - O_ZERO));
		last_was_param = false;
		continue;
	    }

	    throw new TexSyntaxError ('unexpected token %o following ' +
				      'parameter token', tok);
	}

	if (tok.is_cat (C_PARAM)) {
	    last_was_param = true;
	    continue;
	}

	if (tok.is_cat (C_BGROUP))
	    depth += 1;
	else if (tok.is_cat (C_EGROUP)) {
	    depth -= 1;
	    if (depth == 0)
		break;
	}

	repl_toks.push (tok);
	last_was_param = false;
    }

    if (end_with_lbrace)
	repl_toks.push (tmpl_toks[tmpl_toks.length - 1]);

    engine.Ntrace ('%s %o: %T -> %T', cname, cstok, tmpl_toks, repl_toks);
    cstok.assign_cmd (engine, new MacroCommand (cstok, tmpl_toks, repl_toks));
}


commands.def = function cmd_def (engine) {
    return _cmd_def (engine, 'def', false);
};

commands.gdef = function cmd_gdef (engine) {
    engine.set_global_assign_mode ();
    return _cmd_def (engine, 'gdef', false);
};

commands.edef = function cmd_edef (engine) {
    return _cmd_def (engine, 'edef', true);
};

commands.xdef = function cmd_xdef (engine) {
    engine.set_global_assign_mode ();
    return _cmd_def (engine, 'xdef', true);
};


// Grouping

commands.begingroup = function cmd_begingroup (engine) {
    engine.handle_begingroup ();
};

commands.endgroup = function cmd_endgroup (engine) {
    engine.handle_endgroup ();
};


// Conditionals

commands._if = function cmd_if (engine) {
    engine.start_parsing_if_condition ();
    var t1 = engine.next_x_tok (), t2 = engine.next_x_tok ();
    engine.done_parsing_if_condition ();

    // The comparison rules here are a bit funky.

    function key (tok) {
	if (tok.is_char ())
	    return tok.catcode * 1000 + tok.ord;
	if (tok.is_cslike ()) { // active chars will be caught by above
	    var cmd = tok.to_cmd (engine);
	    if (cmd instanceof GivenCharCommand)
		throw new TexInternalError ('not implemented');
	    return 16 * 1000 + 256;
	}
	throw new TexRuntimeError ('illegal comparison subject %o', tok);
    }

    var result = (key (t1) == key (t2));
    engine.Ntrace ('if %o ~ %o => %b', t1, t2, result);
    engine.handle_if (result);
};


commands.ifcat = function cmd_ifcat (engine) {
    engine.start_parsing_if_condition ();
    var t1 = engine.next_x_tok (), t2 = engine.next_x_tok ();
    engine.done_parsing_if_condition ();

    // The comparison rules here are a bit funky.

    function key (tok) {
	if (tok.is_char ())
	    return tok.catcode;
	if (tok.is_cslike ()) { // active chars will be caught by above
	    var cmd = tok.to_cmd (engine);
	    if (cmd instanceof GivenCharCommand)
		throw new TexInternalError ('not implemented');
	    return 16;
	}
	throw new TexRuntimeError ('illegal comparison subject %o', tok);
    }

    var result = (key (t1) == key (t2));
    engine.Ntrace ('ifcat %o ~ %o => %b', t1, t2, result);
    engine.handle_if (result);
};


commands.ifx = function cmd_ifx (engine) {
    var t1 = engine.next_tok_throw (), t2 = engine.next_tok_throw (), result;
    var cmd1 = t1.to_cmd (engine), cmd2 = t2.to_cmd (engine);
    result = cmd1.same_cmd (cmd2);
    engine.Ntrace ('ifx %o ~ %o => %b', t1, t2, result);
    engine.handle_if (result);
};


commands.ifnum = function cmd_ifnum (engine) {
    engine.start_parsing_if_condition ();
    var val1 = engine.scan_int ().value;

    while (true) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxError ('EOF inside \\ifnum');
	if (!tok.is_space (engine))
	    break;
    }

    // It's a little futzy to not check the validity of tok before
    // reading val2.
    var val2 = engine.scan_int ().value, result;
    engine.done_parsing_if_condition ();

    if (tok.is_other_char (O_LESS))
	result = (val1 < val2);
    else if (tok.is_other_char (O_GREATER))
	result = (val1 > val2);
    else if (tok.is_other_char (O_EQUALS))
	result = (val1 == val2);
    else
	throw new TexSyntaxError ('expected <,=,> in \\ifnum but got %o', tok);

    engine.Ntrace ('ifnum %d %o %d => %b', val1, tok, val2, result);
    engine.handle_if (result);
};


commands.ifodd = function cmd_ifodd (engine) {
    engine.start_parsing_if_condition ();
    var val = engine.scan_int ().value;
    engine.done_parsing_if_condition ();
    var result = (val % 2 == 1);
    engine.Ntrace ('ifodd %d => %b', val, result);
    engine.handle_if (result);
};


commands.ifdim = function cmd_ifdim (engine) {
    engine.start_parsing_if_condition ();
    var val1 = engine.scan_dimen ();

    while (1) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxError ('EOF inside \\ifdim');
	if (!tok.is_space (engine))
	    break;
    }

    var val2 = engine.scan_dimen (), result;
    engine.done_parsing_if_condition ();

    if (tok.is_other_char (O_LESS))
	result = (val1.sp.value < val2.sp.value);
    else if (tok.is_other_char (O_GREATER))
	result = (val1.sp.value > val2.sp.value);
    else if (tok.is_other_char (O_EQUALS))
	result = (val1.sp.value == val2.sp.value);
    else
	throw new TexSyntaxError ('expected <,=,> in \\ifdim but got %o', tok);

    engine.Ntrace ('ifdim %o %o %o => %b', val1, tok, val2, result);
    engine.handle_if (result);
};


commands.iffalse = function cmd_iffalse (engine) {
    engine.Ntrace ('iffalse');
    engine.handle_if (false);
};


commands.iftrue = function cmd_iftrue (engine) {
    engine.Ntrace ('iftrue');
    engine.handle_if (true);
};


commands.ifcase = function cmd_ifcase (engine) {
    engine.start_parsing_if_condition ();
    var val = engine.scan_int ().value;
    engine.done_parsing_if_condition ();
    engine.Ntrace ('ifcase %d', val);
    engine.handle_if_case (val);
};


function _cmd_if_boxtype (engine, wanttype) {
    engine.start_parsing_if_condition ();
    var reg = engine.scan_char_code ();
    engine.done_parsing_if_condition ();
    var btype = engine.get_register (T_BOX, reg).btype;
    var result = (btype == wanttype);
    engine.Ntrace ('if%s %s => %b', bt_names[wanttype], bt_names[btype], result);
    engine.handle_if (result);
};

commands.ifvoid = function cmd_ifvoid (engine) {
    _cmd_if_boxtype (engine, BT_VOID);
};

commands.ifhbox = function cmd_ifhbox (engine) {
    _cmd_if_boxtype (engine, BT_HBOX);
};

commands.ifvbox = function cmd_ifvbox (engine) {
    _cmd_if_boxtype (engine, BT_VBOX);
};


commands._else = function cmd_else (engine) {
    engine.Ntrace ('else [non-eaten]');
    engine.handle_else ();
};


commands.or = function cmd_or (engine) {
    engine.Ntrace ('or [non-eaten]');
    engine.handle_or ();
};


commands.fi = function cmd_fi (engine) {
    engine.Ntrace ('fi [non-eaten]');
    engine.handle_fi ();
};


commands.ifhmode = function cmd_ifhmode (engine) {
    engine.Ntrace ('ifhmode');
    engine.handle_if (engine.mode () == M_HORZ || engine.mode () == M_RHORZ);
};


commands.ifvmode = function cmd_ifvmode (engine) {
    engine.Ntrace ('ifvmode');
    engine.handle_if (engine.mode () == M_VERT || engine.mode () == M_IVERT);
};


commands.ifmmode = function cmd_ifmmode (engine) {
    engine.Ntrace ('ifmmode');
    engine.handle_if (engine.mode () == M_MATH || engine.mode () == M_DMATH);
};


// Boxes

commands.hbox = (function HboxCommand_closure () {
    function HboxCommand () { Command.call (this); }
    inherit (HboxCommand, Command);
    var proto = HboxCommand.prototype;
    proto.name = 'hbox';
    proto.boxlike = true;

    proto.invoke = function HboxCommand_invoke (engine) {
	engine.Ntrace ('hbox (for accumulation)');
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function HboxCommand_start_box (engine) {
	engine.handle_hbox ();
    };

    return HboxCommand;
})();


commands.vbox = (function VboxCommand_closure () {
    function VboxCommand () { Command.call (this); }
    inherit (VboxCommand, Command);
    var proto = VboxCommand.prototype;
    proto.name = 'vbox';
    proto.boxlike = true;

    proto.invoke = function VboxCommand_invoke (engine) {
	engine.Ntrace ('vbox (for accumulation)');
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function VboxCommand_start_box (engine) {
	engine.handle_vbox (false);
    };

    return VboxCommand;
})();


commands.vtop = (function VtopCommand_closure () {
    function VtopCommand () { Command.call (this); }
    inherit (VtopCommand, Command);
    var proto = VtopCommand.prototype;
    proto.name = 'vtop';
    proto.boxlike = true;

    proto.invoke = function VtopCommand_invoke (engine) {
	engine.Ntrace ('vtop (for accumulation)');
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function VtopCommand_start_box (engine) {
	engine.handle_vbox (true);
    };

    return VtopCommand;
})();


commands.copy = (function CopyCommand_closure () {
    function CopyCommand () { Command.call (this); }
    inherit (CopyCommand, Command);
    var proto = CopyCommand.prototype;
    proto.name = 'copy';
    proto.boxlike = true;

    proto.invoke = function CopyCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function CopyCommand_start_box (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOX, reg);
	engine.Ntrace ('copy box %d', reg);
	engine.handle_finished_box (box.clone ());
    };

    return CopyCommand;
})();


commands.box = (function BoxCommand_closure () {
    function BoxCommand () { Command.call (this); }
    inherit (BoxCommand, Command);
    var proto = BoxCommand.prototype;
    proto.name = 'box';
    proto.boxlike = true;

    proto.invoke = function BoxCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function BoxCommand_start_box (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOX, reg);
	engine.Ntrace ('fetch box %d', reg);
	engine.set_register (T_BOX, reg, new VoidBox ());
	engine.handle_finished_box (box);
    };

    return BoxCommand;
})();


commands.vsplit = (function VsplitCommand_closure () {
    function VsplitCommand () { Command.call (this); }
    inherit (VsplitCommand, Command);
    var proto = VsplitCommand.prototype;
    proto.name = 'vsplit';
    proto.boxlike = true;

    proto.invoke = function VsplitCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function VsplitCommand_start_box (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOX, reg);

	if (!engine.scan_keyword ('to'))
	    throw new TexRuntimeError ('expected keyword "to"');

	var depth = engine.scan_dimen (false, false);
	engine.Ntrace ('vsplit box %d to %o [fake impl]', reg, depth);

	// TODO: use splitmaxdepth, splittopskip, etc. See TeXBook p. 124, T:TP~977.

	if (box.btype == BT_VOID) {
	    engine.handle_finished_box (new VoidBox ());
	    return;
	}

	if (box.btype == BT_HBOX)
	    throw new TexRuntimeError ('cannot \\vsplit an hbox');

	engine.set_register (T_BOX, reg, new VoidBox ());
	engine.handle_finished_box (box);
    };

    return VsplitCommand;
})();


commands.lastbox = (function LastboxCommand_closure () {
    function LastboxCommand () { Command.call (this); }
    inherit (LastboxCommand, Command);
    var proto = LastboxCommand.prototype;
    proto.name = 'lastbox';
    proto.boxlike = true;

    proto.invoke = function LastboxCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function LastboxCommand_start_box (engine) {
	var m = engine.mode ();
	if (m == M_VERT)
	    throw new TexRuntimeError ('cannot use \\lastbox in vertical mode');
	if (m == M_MATH || m == M_DMATH) {
	    engine.handle_finished_box (new VoidBox ());
	    return;
	}

	var last = engine.get_last_listable ();
	if (last == null || last.ltype != LT_BOX || last.btype == BT_VOID) {
	    engine.handle_finished_box (new VoidBox ());
	    return;
	}

	engine.pop_last_listable ();
	engine.handle_finished_box (last);
    };

    return LastboxCommand;
})();


commands.wd = (function WdCommand_closure () {
    function WdCommand () { Command.call (this); }
    inherit (WdCommand, Command);
    var proto = WdCommand.prototype;
    proto.name = 'wd';

    proto.invoke = function WdCommand_invoke (engine) {
	// NOTE: you can't e.g. do \advance\wd0 so implementing as a settable
	// Valref is not so important.
	var reg = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var width = engine.scan_dimen ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.Ntrace ('\\wd%d = %o -- noop on void box', reg, width);
	} else {
	    engine.Ntrace ('\\wd%d = %o', reg, width);
	    box.width = width;
	}
    };

    proto.get_valtype = function WdCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function WdCommand_as_valref (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOX, reg);
	return new ConstantValref (T_DIMEN, box.width);
    };

    return WdCommand;
})();


commands.ht = (function HtCommand_closure () {
    function HtCommand () { Command.call (this); }
    inherit (HtCommand, Command);
    var proto = HtCommand.prototype;
    proto.name = 'ht';

    proto.invoke = function HtCommand_invoke (engine) {
	// NOTE: you can't e.g. do \advance\ht0 so implementing as a settable
	// Valref is not so important.
	var reg = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var height = engine.scan_dimen ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.Ntrace ('\\ht%d = %o -- noop on void box', reg, height);
	} else {
	    engine.Ntrace ('\\ht%d = %o', reg, height);
	    box.height = height;
	}
    };

    proto.get_valtype = function HtCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function HtCommand_as_valref (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOX, reg);
	return new ConstantValref (T_DIMEN, box.height);
    };

    return HtCommand;
})();


commands.dp = (function DpCommand_closure () {
    function DpCommand () { Command.call (this); }
    inherit (DpCommand, Command);
    var proto = DpCommand.prototype;
    proto.name = 'dp';

    proto.invoke = function DpCommand_invoke (engine) {
	// NOTE: you can't e.g. do \advance\dp0 so implementing as a settable
	// Valref is not so important.
	var reg = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var depth = engine.scan_dimen ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.Ntrace ('\\dp%d = %o -- noop on void box', reg, depth);
	} else {
	    engine.Ntrace ('\\dp%d = %o', reg, depth);
	    box.depth = depth;
	}
    };

    proto.get_valtype = function DpCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function DpCommand_as_valref (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOX, reg);
	return new ConstantValref (T_DIMEN, box.depth);
    };

    return DpCommand;
})();


commands.setbox = function cmd_setbox (engine) {
    var reg = engine.scan_char_code ();
    engine.scan_optional_equals ();
    engine.Ntrace ('setbox: queue #%d = ...', reg);
    engine.handle_setbox (reg);
};


commands.hrule = function cmd_hrule (engine) {
    if (engine.mode() != M_VERT && engine.mode() != M_IVERT)
	throw new TexRuntimeError ('can only create \\hrule in vertical mode');

    var rule = new Rule ();
    rule.height.sp.value = 26214; // default rule = 0.4pt; T:TP sec 463
    rule.depth.sp.value = 0;

    while (true) {
	if (engine.scan_keyword ('width'))
	    rule.width = engine.scan_dimen ();
	else if (engine.scan_keyword ('height'))
	    rule.height = engine.scan_dimen ();
	else if (engine.scan_keyword ('depth'))
	    rule.depth = engine.scan_dimen ();
	else
	    break;
    }

    engine.Ntrace ('hrule %o', rule);
    engine.accum (rule);
};


commands.vrule = function cmd_vrule (engine) {
    if (engine.mode() != M_HORZ && engine.mode() != M_RHORZ)
	throw new TexRuntimeError ('can only create \\vrule in horizontal mode');

    var rule = new Rule ();
    rule.width.sp.value = 26214; // default rule = 0.4pt; T:TP sec 463

    while (true) {
	if (engine.scan_keyword ('width'))
	    rule.width = engine.scan_dimen ();
	else if (engine.scan_keyword ('height'))
	    rule.height = engine.scan_dimen ();
	else if (engine.scan_keyword ('depth'))
	    rule.depth = engine.scan_dimen ();
	else
	    break;
    }

    engine.Ntrace ('vrule %o', rule);
    engine.accum (rule);
};


commands.unhbox = function cmd_unhbox (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var reg = engine.scan_char_code ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID) {
	engine.Ntrace ('unhbox %d (but void)', reg);
	return;
    }

    if (box.btype != BT_HBOX)
	throw new TexRuntimeError ('trying to unhbox a non-hbox');

    engine.Ntrace ('unhbox %d (non-void)', reg);
    engine.set_register (T_BOX, reg, new VoidBox ());
    engine.accum_list (box.list);
};


commands.unvbox = function cmd_unvbox (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var reg = engine.scan_char_code ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID) {
	engine.Ntrace ('unvbox %d (but void)', reg);
	return;
    }

    if (box.btype != BT_VBOX)
	throw new TexRuntimeError ('trying to unvbox a non-vbox');

    engine.Ntrace ('unvbox %d (non-void)', reg);
    engine.set_register (T_BOX, reg, new VoidBox ());
    engine.accum_list (box.list);
};


commands.unhcopy = function cmd_unhcopy (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var reg = engine.scan_char_code ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID)
	return;

    if (box.btype != BT_HBOX)
	throw new TexRuntimeError ('trying to unhcopy a non-hbox');

    engine.Ntrace ('unhcopy %d', reg);
    engine.accum_list (box.list.slice ());
};


commands.unvcopy = function cmd_unvcopy (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var reg = engine.scan_char_code ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID)
	return;

    if (box.btype != BT_VBOX)
	throw new TexRuntimeError ('trying to unvcopy a non-vbox');

    engine.Ntrace ('unvcopy %d', reg);
    engine.accum_list (box.list.slice ());
};


commands.hfil = function cmd_hfil (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (1, 0));
    g.stretch_order = 1;
    engine.Ntrace ('hfil');
    engine.accum (new BoxGlue (g));
};

commands.hfill = function cmd_hfill (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (1, 0));
    g.stretch_order = 2;
    engine.Ntrace ('hfill');
    engine.accum (new BoxGlue (g));
};

commands.hss = function cmd_hss (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (1, 0));
    g.stretch_order = 1;
    g.shrink.set_to (Scaled.new_from_parts (1, 0));
    g.shrink_order = 1;
    engine.Ntrace ('hss');
    engine.accum (new BoxGlue (g));
};

commands.hfilneg = function cmd_hfilneg (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (-1, 0));
    g.stretch_order = 1;
    engine.Ntrace ('hfilneg');
    engine.accum (new BoxGlue (g));
};

commands.hskip = function cmd_hskip (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = engine.scan_glue (false);
    engine.Ntrace ('hskip of %o', g);
    engine.accum (new BoxGlue (g));
};


commands.vfil = function cmd_vfil (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (1, 0));
    g.stretch_order = 1;
    engine.Ntrace ('vfil');
    engine.accum (new BoxGlue (g));
};


commands.vfill = function cmd_vfill (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (1, 0));
    g.stretch_order = 2;
    engine.Ntrace ('vfill');
    engine.accum (new BoxGlue (g));
};


commands.vss = function cmd_vss (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (1, 0));
    g.stretch_order = 1;
    g.shrink.set_to (Scaled.new_from_parts (1, 0));
    g.shrink_order = 1;
    engine.Ntrace ('vss');
    engine.accum (new BoxGlue (g));
};

commands.vfilneg = function cmd_vfilneg (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch.set_to (Scaled.new_from_parts (-1, 0));
    g.stretch_order = 1;
    engine.Ntrace ('vfilneg');
    engine.accum (new BoxGlue (g));
};

commands.vskip = function cmd_vskip (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = engine.scan_glue (false);
    engine.Ntrace ('vskip of %o', g);
    engine.accum (new BoxGlue (g));
};


commands.mark = function cmd_mark (engine) {
    engine.scan_left_brace ();
    var tlist = engine.scan_tok_group (true);
    var mark = new Mark (tlist.toks);
    engine.Ntrace ('mark %T', tlist);
    engine.accum (mark);
};


commands.special = function cmd_special (engine) {
    engine.scan_left_brace ();
    var tlist = engine.scan_tok_group (true);
    var special = new Special (tlist.toks);
    engine.Ntrace ('special %T', tlist);
    engine.accum (special);
};


commands.penalty = function cmd_penalty (engine) {
    var amount = engine.scan_int ();
    var penalty = new Penalty (amount);
    engine.Ntrace ('penalty %o', amount);
    engine.accum (penalty);
};


function _cmd_box_shift (engine, desc, negate) {
    var amount = engine.scan_dimen ();
    engine.Ntrace ('%s next box by %o ...', desc, amount);

    function shift_the_box (engine, box) {
	engine.Ntrace ('... finish %s', desc);
	if (negate)
	    amount = amount.intproduct (-1);
	box.shift_amount = box.shift_amount.advance (amount);
	engine.accum (box);
    }

    engine.scan_box (shift_the_box, false);
};

commands.lower = function cmd_lower (engine) {
    // Sign conventions: T:TP 185.
    _cmd_box_shift (engine, 'lower', false);
};

commands.raise = function cmd_raise (engine) {
    _cmd_box_shift (engine, 'raise', true);
};

commands.moveright = function cmd_moveright (engine) {
    _cmd_box_shift (engine, 'moveright', false);
};

commands.moveleft = function cmd_moveleft (engine) {
    _cmd_box_shift (engine, 'moveleft', true);
};



commands.kern = function cmd_kern (engine) {
    var amount = engine.scan_dimen ();
    engine.Ntrace ('kern %o', amount);
    engine.accum (new Kern (amount));
};


commands.unpenalty = function cmd_unpenalty (engine) {
    engine.Ntrace ('unpenalty');
    engine.handle_un_listify (LT_PENALTY);
};

commands.unkern = function cmd_unkern (engine) {
    engine.Ntrace ('unkern');
    engine.handle_un_listify (LT_KERN);
};

commands.unskip = function cmd_unskip (engine) {
    engine.Ntrace ('unskip');
    engine.handle_un_listify (LT_GLUE);
};


commands.shipout = function cmd_shipout (engine) {
    function ship_it_good (engine, box) {
	// Note: any box type (void, hbox, vbox) is OK to ship out.
	engine.set_register (T_BOX, 255, new VoidBox ());
	engine.ship_it (box);
    };

    engine.Ntrace ('shipout');
    engine.scan_box (ship_it_good, false);
};


commands.insert = function cmd_insert (engine) {
    var num = engine.scan_char_code ();
    if (num == 255)
	throw new TexRuntimeError ('\\insert255 is forbidden');

    // T:TP 1099: "begin_insert_or_adjust"
    engine.Ntrace ('insert %d', num);
    engine.scan_left_brace ();

    // T:TP 1070: "normal_paragraph"
    engine.set_parameter (T_INT, 'looseness', 0);
    engine.set_parameter (T_DIMEN, 'hangindent', new Dimen ());
    engine.set_parameter (T_INT, 'hangafter', 1);
    // TODO: clear \parshape info, which nests in the EqTb.

    engine.nest_eqtb ();
    engine.enter_mode (M_IVERT);
    engine.enter_group ('insert', function (eng) {
	var list = engine.leave_mode ();
	engine.unnest_eqtb ();
	// T:TP 1100 should go here.
	engine.warn ('ignoring finished insert #' + num);
    });
};

// "Special registers" with single global values:
//
// ints: \prevgraf, \deadcycles, \insertpenalties, \spacefactor.
//
// dimens: \pagetotal, \pagegoal, \pagestretch, \pagefilstretch,
// \pagefillstretch, \pagefilllstretch, \pageshrink, \pagedepth, \prevdepth.
//
// Other internal values; listed as a superset of the specials in TeXBook.
// distinction unclear:
//
// ints: \parshape \inputlineno \badness \lastpenalty
// dimens: \lastkern

commands.prevgraf = new SpecialValueCommand (T_INT, 'prevgraf');
commands.deadcycles = new SpecialValueCommand (T_INT, 'deadcycles');
commands.insertpenalties = new SpecialValueCommand (T_INT, 'insertpenalties');
commands.spacefactor = new SpecialValueCommand (T_INT, 'spacefactor');
commands.prevdepth = new SpecialValueCommand (T_DIMEN, 'prevdepth'); // XXX: only valid in vertical mode
commands.pagegoal = new SpecialValueCommand (T_DIMEN, 'pagegoal');
commands.pagetotal = new SpecialValueCommand (T_DIMEN, 'pagetotal');
commands.pagestretch = new SpecialValueCommand (T_DIMEN, 'pagestretch');
commands.pagefilstretch = new SpecialValueCommand (T_DIMEN, 'pagefilstretch');
commands.pagefillstretch = new SpecialValueCommand (T_DIMEN, 'pagefillstretch');
commands.pagefilllstretch = new SpecialValueCommand (T_DIMEN, 'pagefilllstretch');
commands.pageshrink = new SpecialValueCommand (T_DIMEN, 'pageshrink');
commands.pagedepth = new SpecialValueCommand (T_DIMEN, 'pagedepth');


commands.inputlineno = (function InputlinenoCommand_closure () {
    // This is needed for LaTeX's version detection.
    function InputlinenoCommand () { Command.call (this); }
    inherit (InputlinenoCommand, Command);
    var proto = InputlinenoCommand.prototype;
    proto.name = 'inputlineno';

    proto.invoke = function InputlinenoCommand_invoke (engine) {
	throw new TexRuntimeError ('not implemented');
    };

    proto.get_valtype = function InputlinenoCommand_get_valtype () {
	return T_INT;
    };

    proto.as_valref = function InputlinenoCommand_as_valref (engine) {
	// LaTeX considers this "undefined"
	return new ConstantValref (T_INT, -1);
    };

    return InputlinenoCommand;
})();


commands.lastpenalty = (function LastpenaltyCommand_closure () {
    // I believe that our implementation isn't quite right, since TeX seems to
    // only update \lastpenalty during page builder runs (T:TP 991, 994).
    // We'll see if that gets us into trouble.

    function LastpenaltyCommand () { Command.call (this); }
    inherit (LastpenaltyCommand, Command);
    var proto = LastpenaltyCommand.prototype;
    proto.name = 'lastpenalty';

    proto.invoke = function LastpenaltyCommand_invoke (engine) {
	throw new TexRuntimeError ('bare \\lastpenalty not allowed');
    };

    proto.as_valref = function LastpenaltyCommand_as_valref (engine) {
	var val = 0;
	var item = engine.get_last_listable ();
	if (item != null && item.ltype == LT_PENALTY)
	    val = item.amount;
	return new ConstantValref (T_INT, val);
    };

    return LastpenaltyCommand;
})();


commands.lastskip = (function LastskipCommand_closure () {
    // See comment in \lastpenalty about correctness of this implementation.
    function LastskipCommand () { Command.call (this); }
    inherit (LastskipCommand, Command);
    var proto = LastskipCommand.prototype;
    proto.name = 'lastskip';

    proto.invoke = function LastskipCommand_invoke (engine) {
	throw new TexRuntimeError ('bare \\lastskip not allowed');
    };

    proto.as_valref = function LastskipCommand_as_valref (engine) {
	var val = new Glue ();
	var item = engine.get_last_listable ();
	if (item != null && item.ltype == LT_GLUE)
	    val = item.amount.clone ();
	return new ConstantValref (T_GLUE, val);
    };

    return LastskipCommand;
})();


commands.lastkern = (function LastkernCommand_closure () {
    // See comment in \lastpenalty about correctness of this implementation.
    function LastkernCommand () { Command.call (this); }
    inherit (LastkernCommand, Command);
    var proto = LastkernCommand.prototype;
    proto.name = 'lastkern';

    proto._get = function LastkernCommand__get (engine) {
    };

    proto.invoke = function LastkernCommand_invoke (engine) {
	throw new TexRuntimeError ('bare \\lastkern not allowed');
    };

    proto.as_valref = function LastkernCommand_as_valref (engine) {
	var val = new Dimen ();
	var item = engine.get_last_listable ();
	if (item != null && item.ltype == LT_KERN)
	    val = item.amount.clone ();
	return new ConstantValref (T_DIMEN, val);
    };

    return LastkernCommand;
})();


// Mark insertion

commands.botmark = function cmd_botmark (engine) {
    engine.Ntrace ('botmark [bad noop]');
};

commands.firstmark = function cmd_firstmark (engine) {
    engine.Ntrace ('firstmark [bad noop]');
};

commands.splitbotmark = function cmd_splitbotmark (engine) {
    engine.Ntrace ('splitbotmark [bad noop]');
};

commands.splitfirstmark = function cmd_splitfirstmark (engine) {
    engine.Ntrace ('splitfirstmark [bad noop]');
};

commands.topmark = function cmd_topmark (engine) {
    engine.Ntrace ('topmark [bad noop]');
};


// Font stuff

commands.font = (function FontCommand_closure () {
    function FontCommand () { Command.call (this); }
    inherit (FontCommand, Command);
    var proto = FontCommand.prototype;
    proto.name = 'font';

    proto.invoke = function FontCommand_invoke (engine) {
	var cstok = engine.scan_r_token ();
	engine.scan_optional_equals ();
	var fn = engine.scan_file_name ();
	var s = -1000;

	if (engine.scan_keyword ('at')) {
	    s = engine.scan_dimen ()
	    if (s.sp.value <= 0) // FIXME: || s > SC_MAX
		throw new TexRuntimeError ('illegal font size %o', s);
	    s = s.sp.value;
	} else if (engine.scan_keyword ('scaled')) {
	    s = -engine.scan_int ().value;
	    if (s >= 0 || s < -32768)
		throw new TexRuntimeError ('illegal font magnification factor %d', -s);
	}

	var font = new Font (engine, fn, s);
	var cmd = new GivenFontCommand (font);
	engine.Ntrace ('font %o = %o', cstok, font);
	cstok.assign_cmd (engine, cmd);
    };

    proto.get_valtype = function FontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function FontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, engine.get_misc ('cur_font'));
    };

    return FontCommand;
})();


commands.nullfont = (function NullFontCommand_closure () {
    // XXX: redundant with GivenFontCommand in several ways.
    function NullFontCommand () { Command.call (this); }
    inherit (NullFontCommand, Command);
    var proto = NullFontCommand.prototype;
    proto.name = 'nullfont';

    proto.invoke = function NullFontCommand_invoke (engine) {
	engine.Ntrace ('activate null font');
	engine.set_misc ('cur_font', engine.get_font ('<null>'));
    };

    proto.get_valtype = function NullFontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function NullFontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, engine.get_font ('<null>'));
    };

    proto.texmeaning = function NullFontCommand_texmeaning (engine) {
	return 'select font nullfont';
    };

    return NullFontCommand;
})();


commands.fontdimen = (function FontDimenCommand_closure () {
    // XXX: redundant with GivenFontCommand in several ways.
    function FontDimenCommand () { Command.call (this); }
    inherit (FontDimenCommand, Command);
    var proto = FontDimenCommand.prototype;
    proto.name = 'fontdimen';

    proto.invoke = function FontDimenCommand_invoke (engine) {
	var num = engine.scan_int ().value;
	var tok = engine.next_tok_throw ();
	var val = tok.to_cmd (engine).as_valref (engine);

	if (val.valtype != T_FONT)
	    throw new TexRuntimeError ('expected \\fontdimen to be followed ' +
				       'by a font; got %o', tok);

	var font = val.get (engine);
	engine.scan_optional_equals ();
	var val = engine.scan_dimen ();
	engine.Ntrace ('fontdimen %o %d = %o', font, num, val);
	font.set_dimen (num, val);
	engine.maybe_insert_after_assign_token ();
    };

    proto.get_valtype = function FontDimenCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function FontDimenCommand_as_valref (engine) {
	var num = engine.scan_int ().value;
	var tok = engine.next_tok_throw ();
	var font = tok.to_cmd (engine).as_valref (engine);

	if (font.valtype != T_FONT)
	    throw new TexRuntimeError ('expected \\fontdimen to be followed ' +
				       'by a font; got %o', tok);

	var val = font.get (engine).get_dimen (num);
	engine.Ntrace ('got: %o', val);
	// FIXME: should be settable.
	return new ConstantValref (T_DIMEN, val);
    };

    return FontDimenCommand;
})();


commands.skewchar = function cmd_skewchar (engine) {
    var tok = engine.next_tok_throw ();
    var val = tok.to_cmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\skewchar to be followed by a font; ' +
				   'got %o', tok);

    var font = val.get (engine);
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.Ntrace ('skewchar %o = %C', font, ord);
    font.skewchar = ord;
    engine.maybe_insert_after_assign_token ();
};


commands.hyphenchar = function cmd_hyphenchar (engine) {
    var tok = engine.next_tok_throw ();
    var val = tok.to_cmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\hyphenchar to be followed by a font; ' +
				   'got %o', tok);

    var font = val.get (engine);
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.Ntrace ('hyphenchar %o = %C', font, ord);
    font.hyphenchar = ord;
    engine.maybe_insert_after_assign_token ();
};


commands.textfont = new FontFamilyCommand (MS_TEXT, 'text');
commands.scriptfont = new FontFamilyCommand (MS_SCRIPT, 'script');
commands.scriptscriptfont = new FontFamilyCommand (MS_SCRIPTSCRIPT, 'scriptscript');


// Math commands

commands.displaystyle = new MathStyleCommand ('displaystyle', MS_DISPLAY);
commands.textstyle = new MathStyleCommand ('textstyle', MS_TEXT);
commands.scriptstyle = new MathStyleCommand ('scriptstyle', MS_SCRIPT);
commands.scriptscriptstyle = new MathStyleCommand ('scriptscriptstyle', MS_SCRIPTSCRIPT);

commands.mathord = new MathComponentCommand ('mathord', MT_ORD);
commands.mathop = new MathComponentCommand ('mathop', MT_OP);
commands.mathbin = new MathComponentCommand ('mathbin', MT_BIN);
commands.mathrel = new MathComponentCommand ('mathrel', MT_REL);
commands.mathopen = new MathComponentCommand ('mathopen', MT_OPEN);
commands.mathclose = new MathComponentCommand ('mathclose', MT_CLOSE);
commands.mathpunct = new MathComponentCommand ('mathpunct', MT_PUNCT);
commands.mathinner = new MathComponentCommand ('mathinner', MT_INNER);
commands.underline = new MathComponentCommand ('underline', MT_UNDER);
commands.overline = new MathComponentCommand ('overline', MT_OVER);

commands.radical = function cmd_radical (engine) {
    // T:TP 1162-1163
    engine.Ntrace ('radical');

    if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	throw new TexRuntimeError ('\\radical may only be used in math mode');

    var n = new RadicalNode ();
    engine.accum (n);

    n.left_delim = mathlib.scan_delimiter (engine, true);
    mathlib.scan_math (engine, function (eng, subitem) {
	engine.Ntrace ('... radical got: %o', subitem);
	n.nuc = subitem;
    });
};

commands.mathchoice = function cmd_mathchoice (engine) {
    // T:TP 1171-1174
    engine.Ntrace ('mathchoice');

    if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	throw new TexRuntimeError ('\\mathchoice may only be used in math mode');

    var mc = new StyleChoiceNode ();
    engine.accum (mc);
    mc._cur = 0;

    function finish_one (eng) {
	var list = engine.leave_mode ();
	engine.unnest_eqtb ();
	// XXX? this is fin_mlist() [TTP 1184]; we're skipping 'incompleat_node' futzing

	if (mc._cur == 0)
	    mc.in_display = list;
	else if (mc._cur == 1)
	    mc.in_text = list;
	else if (mc._cur == 2)
	    mc.in_script = list;
	else if (mc._cur == 3)
	    mc.in_scriptscript = list;

	mc._cur += 1;
	if (mc._cur < 4)
	    scan_one ();
	else
	    engine.Ntrace ('... finished mathchoice: %o', mc);
    }

    function scan_one () {
	// XXX? this is push_math() [TTP 1136]; we're skipping 'incompleat_node' futzing
	engine.nest_eqtb ();
	engine.enter_mode (M_MATH);
	engine.enter_group ('mathchoice', finish_one);
	engine.scan_left_brace ();
    }

    scan_one ();
};


function _cmd_limit_switch (engine, desc, value) {
    // T:TP 1158, 1159
    engine.Ntrace (desc);
    var last = engine.get_last_listable ();

    if (last == null ||
	!(last instanceof AtomNode) ||
	last.ltype != MT_OP)
	throw new TexRuntimeError ('\\%s must follow an operator', desc);

    last.limtype = value;
};

commands.nolimits = function cmd_nolimits (engine) {
    _cmd_limit_switch (engine, 'nolimits', LIMTYPE_NOLIMITS);
};

commands.limits = function cmd_limits (engine) {
    _cmd_limit_switch (engine, 'limits', LIMTYPE_LIMITS);
};


commands.mkern = function cmd_mkern (engine) {
    throw new TexInternalError ('must implement math_kern correctly in math.js');
};


commands.vcenter = function cmd_vcenter (engine) {
    engine.Ntrace ('vcenter');

    if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	throw new TexRuntimeError ('\\vcenter may only be used in math mode');

    // XXX this is scan_spec (TTP:645), which is duplicated in
    // Engine._handle_box and Engine.init_align.

    var is_exact, spec;

    if (engine.scan_keyword ('to')) {
	is_exact = true;
	spec = engine.scan_dimen ();
    } else if (engine.scan_keyword ('spread')) {
	is_exact = false;
	spec = engine.scan_dimen ();
    } else {
	is_exact = false;
	spec = new Dimen ();
    }

    engine.scan_left_brace ();

    // T:TP 1070 -- XXX this is normal_paragraph
    engine.set_parameter (T_INT, 'looseness', 0);
    engine.set_parameter (T_DIMEN, 'hangindent', new Dimen ());
    engine.set_parameter (T_INT, 'hangafter', 1);
    // TODO: clear \parshape info, which nests in the EqTb.

    engine.nest_eqtb ();
    engine.enter_mode (M_IVERT);
    engine.enter_group ('vcenter', function (eng) {
	engine.end_graf ();
	var box = new VBox ();
	box.list = engine.leave_mode ();
	engine.unnest_eqtb ();
	box.set_glue (engine, is_exact, spec);

	var atom = new AtomNode (MT_VCENTER);
	atom.nuc = box;
	engine.accum (atom);
    });

    // XXX: prev_depth = ignore_depth;
    engine.maybe_push_toklist ('everyvbox');
};


// Alignments

commands.cr = function cmd_cr (engine) {
    throw new TexRuntimeError ('\\cr may only be used inside alignments');
};

commands.crcr = function cmd_crcr (engine) {
    throw new TexRuntimeError ('\\crcr may only be used inside alignments');
};

commands.omit = function cmd_omit (engine) {
    throw new TexRuntimeError ('\\omit may only be used inside alignments');
};

commands.span = function cmd_span (engine) {
    throw new TexRuntimeError ('\\span may only be used inside alignments');
};

commands.noalign = function cmd_noalign (engine) {
    throw new TexRuntimeError ('\\noalign may only be used inside alignments');
};

commands._endv_ = (function EndvCommand_closure () {
    function EndvCommand () { Command.call (this); }
    inherit (EndvCommand, Command);
    var proto = EndvCommand.prototype;
    proto.name = '<endv>';

    proto.invoke = function EndvCommand_invoke (engine) {
	if (engine.mode () == M_MATH || engine.mode () == M_DMATH)
	    throw new TexRuntimeError ('\\endv may not be used in math mode');

	engine.handle_endv ();
    };

    return EndvCommand;
})();

commands.halign = function cmd_halign (engine) {
    engine.Ntrace ('halign');
    engine.init_align (false);
};

commands.valign = function cmd_valign (engine) {
    engine.Ntrace ('valign');
    engine.init_align (true);
};

// Hyphenation

commands.patterns = function cmd_patterns (engine) {
    engine.scan_left_brace ();
    engine.scan_tok_group (false);
    engine.Ntrace ('patterns [noop/ignored]');
};


commands.hyphenation = function cmd_hyphenation (engine) {
    engine.scan_left_brace ();
    engine.scan_tok_group (false);
    engine.Ntrace ('hyphenation [noop/ignored]');
};


// Miscellaneous text manipulation

function _change_case (engine, isupper) {
    if (isupper)
	var cmdname = 'uppercase', codetype = CT_UPPERCASE;
    else
	var cmdname = 'lowercase', codetype = CT_LOWERCASE;

    engine.scan_left_brace ();
    var oldtoks = engine.scan_tok_group (false).toks, newtoks = [];

    for (var i = 0; i < oldtoks.length; i++) {
	var tok = oldtoks[i];

	if (tok.is_char ()) {
	    var neword = engine.get_code (codetype, tok.ord);
	    if (neword == 0)
		neword = tok.ord;
	    newtoks.push (Token.new_char (tok.catcode, neword));
	} else
	    newtoks.push (tok);
    }

    engine.Ntrace ('%s %T -> %T', cmdname, oldtoks, newtoks);
    engine.push_toks (newtoks);
}


commands.uppercase = function cmd_uppercase (engine) {
    _change_case (engine, true);
};


commands.lowercase = function cmd_lowercase (engine) {
    _change_case (engine, false);
};


commands.the = function cmd_the (engine) {
    /* \the<namedparam>
     * \the<register N>
     * \the<codename org>
     * \the<"special register ~ named param?>
     * \the\fontdimen<paramnum><font>
     * \the\hyphenchar<font>
     * \the\skewchar<font>
     * \the\lastpenalty
     * \the\lastkern
     * \the\lastskip
     * \the<chardef cseq>
     * \the<font> -- non text: id of font
     * \the<tokens> -- non text: inserts the tokens
     */

    var tok = engine.next_x_tok_throw ();
    var val = tok.to_cmd (engine).as_valref (engine);
    if (val == null)
	throw new TexRuntimeError ('unable to get internal value (for ' +
				   '\\the) from %o', tok);

    if (val.valtype == T_TOKLIST) {
	var toks = val.get (engine);
	engine.Ntrace ('the (toks) %o -> %T', tok, toks);
	engine.push_toks (toks);
	return;
    }

    if (val.valtype == T_FONT) {
	var val = val.get (engine);
	engine.push (Token.new_cmd (new GivenFontCommand (val)));
	return;
    }

    var expn = val.get (engine).to_texstr ();
    engine.Ntrace ('the %o -> %s', tok, expn);
    engine.push_string (expn);
};


commands.meaning = function cmd_meaning (engine) {
    var tok = engine.next_tok_throw ();
    var expn = tok.to_cmd (engine).texmeaning (engine);
    engine.Ntrace ('meaning %o -> %s', tok, expn);
    engine.push_string (expn);
};


commands.jobname = function cmd_jobname (engine) {
    engine.Ntrace ('jobname -> %s', engine.jobname);
    engine.push_string (engine.jobname);
};


commands.romannumeral = function cmd_romannumeral (engine) {
    // T:TP 69. "Readers who like puzzles might enjoy trying to figure out how
    // this tricky code works; therefore no explanation will be given." Here's
    // another puzzle: "GFY, DEK."
    var table = ['m', 2, 'd', 5, 'c', 2, 1, 5, 'x', 2, 'v', 5, 'i'];
    var v = 1000;
    var n = engine.scan_int ().value;
    var n_orig = n;
    var k = 0, j = 0, u = 0;
    var result = '';

    while (true) {
	while (n >= v) {
	    result += table[j];
	    n -= v;
	}

	if (n <= 0)
	    break;

	k = j + 2;
	var u = v / table[k - 1] >> 0;
	if (table[k - 1] == 2) {
	    k += 2;
	    u = u / table[k - 1] >> 0;
	}

	if (n + u >= v) {
	    result += table[k];
	    n += u;
	} else {
	    j += 2;
	    v = v / table[j-1] >> 0;
	}
    }

    engine.Ntrace ('romannumeral %d -> %s', n_orig, result);
    engine.push_string (result);
};


// User interaction, I/O

commands.message = function cmd_message (engine) {
    engine.scan_left_brace ();
    var toks = engine.scan_tok_group (true);
    engine.Ntrace ('message %U', toks);
};


commands.errmessage = function cmd_errmessage (engine) {
    engine.scan_left_brace ();
    var toks = engine.scan_tok_group (true);
    engine.Ntrace ('errmessage %U', toks);
    throw new TexRuntimeError ('TeX-triggered error: %U', toks);
};


commands.immediate = function cmd_immediate (engine) {
    /* This causes a following \openout, \write, or \closeout to take effect
     * immediately, rather than waiting until page shipout. I suspect that I'll
     * need to distinguish these eventually, but for now, this is a noop. */
    engine.Ntrace ('immediate');
};


commands.write = function cmd_write (engine) {
    var streamnum = engine.scan_streamnum ();
    engine.scan_left_brace ();
    var toks = engine.scan_tok_group (true);
    var tt = toks.textext (engine, false);

    if (streamnum == 16) {
	// 16 -> the log
	engine.Ntrace ('write:%d(->log) %s', streamnum, tt);
	return;
    }

    // If the specified file hasn't been opened, TeX writes to the console.
    var outf = engine.outfile (streamnum);
    if (outf == null)
	engine.Ntrace ('write:%d(->console) %s', streamnum, tt);
    else {
	engine.Ntrace ('write:%d %s', streamnum, tt);
	outf.write_string (tt + '\n');
    }
};


commands.input = function cmd_input (engine) {
    var fn = engine.scan_file_name ();
    engine.Ntrace ('input %s', fn);
    engine.handle_input (fn);
};


commands.endinput = function cmd_endinput (engine) {
    engine.Ntrace ('endinput');
    engine.handle_endinput ();
};


commands.openout = function cmd_openout (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();

    engine.Ntrace ('openout %d = %s', snum, fn);
    var outf = engine.iostack.open_for_write (fn);
    if (outf == null)
	throw new TexRuntimeError ('failed to \\openout %s', fn);

    engine.set_outfile (snum, outf);
};


commands.closeout = function cmd_closeout (engine) {
    var snum = engine.scan_streamnum ();
    engine.Ntrace ('closeout %d [noop]', snum);
    engine.set_outfile (snum, null);
};


commands.openin = function cmd_openin (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();

    if (snum == 16)
	throw new TexRuntimeError ('attempted terminal input');

    engine.set_infile (snum, null);

    engine.Ntrace ('openin %d = %s', snum, fn);
    var lb = engine.iostack.try_open_linebuffer (fn);
    if (lb == null)
	// File existence is tested by \openin..\ifeof, so this should
	// be a warning only.
	engine.warn ('failed to \\openin ' + fn);

    engine.set_infile (snum, lb);
};


commands.closein = function cmd_closein (engine) {
    var snum = engine.scan_streamnum ();
    if (snum == 16)
	throw new TexRuntimeError ('attempted close of illegal stream');

    // I think this is all we need ...
    engine.set_infile (snum, null);
};


commands.ifeof = function cmd_ifeof (engine) {
    var snum = engine.scan_streamnum (), result;

    if (snum == 16)
	result = false;
    else
	result = (engine.infile (snum) == null);

    engine.Ntrace ('ifeof %d -> %b', snum, result);
    engine.handle_if (result);
};


// High-level miscellany

commands.end = function cmd_end (engine) {
    engine.Ntrace ('end');
    engine.handle_end ();
};

commands.dump = function cmd_dump (engine) {
    engine.Ntrace ('dump');
};

commands.batchmode = function cmd_batchmode (engine) {
    engine.Ntrace ('batchmode');
};

commands.errorstopmode = function cmd_errorstopmode (engine) {
    engine.Ntrace ('errorstopmode');
};

commands.nonstopmode = function cmd_nonstopmode (engine) {
    engine.Ntrace ('nonstopmode');
};

commands.scrollmode = function cmd_scrollmode (engine) {
    engine.Ntrace ('scrollmode');
};

commands.show = function cmd_show (engine) {
    var tok = engine.next_tok ();
    engine.Ntrace ('show: noop for %o', tok);
};

commands.showbox = function cmd_showbox (engine) {
    var reg = engine.scan_register_num ();
    var box = engine.get_register (T_BOX, reg);
    engine.Ntrace ('showbox %d = %U', reg, box);
};
