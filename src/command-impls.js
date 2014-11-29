'use strict;'

// Text layout.

register_command ('par', function cmd_par (engine) {
    var m = engine.mode ();

    if (m == M_VERT || m == M_IVERT) {
	// T:TP 1070
	engine.trace ('par: vertical -> reset params');
	engine.set_parameter (T_INT, 'looseness', 0);
	engine.set_parameter__OS ('hangindent', nlib.Zero_S);
	engine.set_parameter (T_INT, 'hangafter', 1);
	// TODO: clear \parshape info, which nests in the EqTb.
    } else if (m == M_RHORZ) {
	engine.trace ('par: rhorz -> noop');
    } else if (m == M_HORZ) {
	// TeXBook p. 286:
	engine.trace ('par: horz -> endgraf');
	engine.end_graf ();
    } else {
	throw new TexRuntimeError ('illegal use of \\par in math mode');
    }
});


register_command ('indent', function cmd_indent (engine) {
    engine.begin_graf (true);
});

register_command ('noindent', function cmd_noindent (engine) {
    engine.begin_graf (false);
});


register_command ('parshape', function cmd_parshape (engine) {
    // TTP 1248, "set_shape"
    engine.scan_optional_equals ();
    var n = engine.scan_int__I ();
    engine.trace ('parshape: scanning dimens for %d lines', n);

    for (var i = 0; i < n; i++) { // note: does right thing if n <= 0
	var indent_S = engine.scan_dimen__O_S (false);
	var width_S = engine.scan_dimen__O_S (false);
	engine.trace ('parshape: line %d: indent=%S width=%S', i + 1, indent_S, width_S);
    }

    engine.trace ('parshape: ignoring results');
});


register_command ('_space_', function cmd__space_ (engine) {
    // A control-space command appends glue to the current list, using the
    // same amount that a <space token> inserts when the space factor is 1000.
    engine.trace ('" " (explicit space) fake dimen');

    var ss = engine.get_parameter (T_GLUE, 'spaceskip');
    if (ss.is_nonzero ()) {
	engine.accum (new BoxGlue (ss));
	return;
    }

    // TODO: real font glue dimensions. T:TP 1041,1042.
    var g = new Glue ();
    g.amount_S = nlib.scale__I_S (12);
    engine.accum (new BoxGlue (g));
});


register_command ('/', function cmd__fslash_ (engine) {
    // Italic correction. T:TP 1111, 1112, 1113.

    switch (engine.mode ()) {
    case M_VERT: case M_IVERT:
	throw new TexRuntimeError ('cannot use \\/ in vertical mode');
    case M_MATH: M_DMATH:
	engine.trace ('italic correction: math');
	engine.push (new Kern (nlib.Zero_S));
	break;
    case M_HORZ: M_RHORZ:
	// XXX: ignoring ligatures
	engine.trace ('italic correction: text');
	var last = engine.get_last_listable ();
	if (last instanceof Character) {
	    var k = new Kern (last.font.italic_correction__O_S (last.ord));
	    // XXX: kern.subtype = Explicit.
	    engine.accum (k);
	}
	break;
    }
});


register_command ('char', function cmd__char (engine) {
    var ord = engine.scan_char_code__I ();
    engine.trace ('char %C', ord);
    engine.push (Token.new_cmd (new GivenCharCommand (ord)));
});

register_command ('mathchar', function cmd_mathchar (engine) {
    var ord = engine.scan_int_15bit__I ();
    engine.trace ('mathchar %x', ord);
    engine.push (Token.new_cmd (new GivenMathcharCommand (ord)));
});

// Language infrastructure

register_command ('relax', function cmd_relax (engine) {
    engine.trace ('relax');
});


register_command ('expandafter', function cmd_expandafter (engine) {
    // Note that we can't use next_x_tok () here since we can end up
    // double-expanding what comes next in \expandafter A \expandafter B ...

    var tok1 = engine.next_tok_throw ();
    var tok2 = engine.next_tok_throw ();

    engine.trace ('*expandafter %o|%o ...', tok1, tok2);

    var cmd2 = tok2.to_cmd (engine);
    if (cmd2.expandable)
	cmd2.invoke (engine);
    else
	engine.push_back (tok2);

    engine.push_back (tok1);
});


register_command ('noexpand', function cmd_noexpand (engine) {
    throw new TexInternalError ('\\noexpand shouldn\'t get evaluated');
});


register_command ('ignorespaces', function cmd_ignorespaces (engine) {
    engine.push_back (engine.chomp_spaces ());
});

register_command ('endcsname', function cmd_endcsname (engine) {
    throw new TexRuntimeError ('stray \\endcsname');
});


register_command ('csname', function cmd_csname (engine) {
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
    engine.trace ('* \\csname...\\endcsname -> %o', tok);
    engine.push (tok);

    var cmd = engine.get_cseq (csname);
    if (cmd == null || cmd.name == 'undefined')
	tok.assign_cmd (engine, engine.commands['relax']);
});


register_command ('global', function cmd_global (engine) {
    engine.trace ('global');
    engine.set_global_assign_mode ();
});


register_command ('outer', function cmd_outer (engine) {
    engine.trace ('outer'); // I think it's OK to make this a noop.
});


register_command ('long', function cmd_long (engine) {
    engine.trace ('long'); // I think it's OK to make this a noop.
});


register_command ('let', function cmd_let (engine) {
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

    engine.trace ('let %o = %o', cstok, equiv);
    cstok.assign_cmd (engine, equiv.to_cmd (engine));
});


register_command ('futurelet', function cmd_futurelet (engine) {
    var cstok = engine.scan_r_token ();
    var thenexpand = engine.next_tok_throw ();
    var equiv = engine.next_tok_throw ();
    engine.push_back (equiv); // must do this to maintain align_state
    engine.push_back (thenexpand);
    engine.trace ('futurelet %o = %o; %o', cstok, equiv, thenexpand);
    cstok.assign_cmd (engine, equiv.to_cmd (engine));
});


register_command ('string', function cmd_string (engine) {
    var tok = engine.next_tok_throw ();
    engine.trace ('* \\string %o', tok);

    if (tok.is_char ()) {
	engine.push_string (String.fromCharCode (tok.ord));
	return;
    }

    if (tok.is_cslike ()) { // active chars were handled above
	var expn = tok.name, esc = engine.escapechar__I ();
	if (esc >= 0 && esc < 256)
	    expn = String.fromCharCode (esc) + expn;
    } else
	throw new TexRuntimeError ('don\'t know how to \\string-ize %o', tok);

    engine.push_string (expn);
});


register_command ('number', function cmd_number (engine) {
    var val = engine.scan_int__I ();
    engine.trace ('* number %o', val);
    engine.push_string ('' + val);
});


register_command ('afterassignment', function cmd_afterassignment (engine) {
    var tok = engine.next_tok_throw ();
    engine.set_after_assign_token (tok);
    engine.trace ('afterassignment <- %o', tok);
});


register_command ('aftergroup', function cmd_aftergroup (engine) {
    var tok = engine.next_tok_throw ();
    engine.trace ('aftergroup <- %o', tok);
    engine.handle_aftergroup (tok);
});


// Basic math

register_command ('advance', function cmd_advance (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.to_cmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var delta = engine.scan_valtype (val.valtype);
    engine.trace ('advance %s = %o + %o', cmd.texmeaning (engine), cur, delta);
    val.set (engine, cur.advance (delta));
});


register_command ('divide', function cmd_divide (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.to_cmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var denom_I = engine.scan_int__I ();
    engine.trace ('divide %s = %o / %o', cmd.texmeaning (engine), cur, denom_I);
    val.set (engine, cur.divide__I_O (denom_I));
});


register_command ('multiply', function cmd_multiply (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.to_cmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var factor_I = engine.scan_int__I ();
    engine.trace ('multiply %s = %o * %o', cmd.texmeaning (engine), cur, factor_I);
    val.set (engine, cur.product__I_O (factor_I));
});


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
	var ord = engine.scan_char_code__I ();
	engine.scan_optional_equals ();
	var code = engine.scan_int__I ();

	if (code < 0 || code > ct_maxvals[this.codetype])
	    throw new TexRuntimeException ('illegal value %d for %s', code,
					   ct_names[this.codetype]);

	engine.trace ('%s %C=%x -> %x', ct_names[this.codetype], ord, ord, code);
	engine.set_code (this.codetype, ord, code);
    };

    proto.get_valtype = function CharCodeCommand_get_valtype () {
	return T_INT;
    };

    proto.as_valref = function CharCodeCommand_as_valref (engine) {
	var ord = engine.scan_char_code__I ();
	return new ConstantValref (T_INT, engine.get_code (this.codetype, ord));
    };

    return CharCodeCommand;
})();

register_command ('catcode', new CharCodeCommand (CT_CATEGORY, 'catcode'));
register_command ('mathcode', new CharCodeCommand (CT_MATH, 'mathcode'));
register_command ('sfcode', new CharCodeCommand (CT_SPACEFAC, 'sfcode'));
register_command ('lccode', new CharCodeCommand (CT_LOWERCASE, 'lccode'));
register_command ('uccode', new CharCodeCommand (CT_UPPERCASE, 'uccode'));
register_command ('delcode', new CharCodeCommand (CT_DELIM, 'delcode'));


// \chardef, \mathchardef, etc.

register_command ('chardef', function cmd_chardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code__I ();
    engine.trace ('chardef %o -> {inschar %C=%x}', cstok, ord, ord);
    cstok.assign_cmd (engine, new GivenCharCommand (ord));
});


register_command ('mathchardef', function cmd_mathchardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var val = engine.scan_int__I ();
    if (val < 0 || val > 0x8000)
	throw new TexRuntimeError ('need mathcode in [0,0x8000] but got %d', val);
    engine.trace ('mathchardef %o -> {insmathchar %x}', cstok, val);
    cstok.assign_cmd (engine, new GivenMathcharCommand (val));
});


// Macros.

function _cmd_def (engine, cname, expand_replacement) {
    var cstok = engine.scan_r_token ();

    var tmpl_toks = [], repl_toks = [], last_was_param = false,
        end_with_lbrace = false, next_pnum = 1;

    while (true) {
	var tok = engine.next_tok_throw ();

	if (last_was_param) {
	    if (tok.to_cmd (engine) instanceof BeginGroupCommand) {
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

    engine.trace ('%s %o: %T -> %T', cname, cstok, tmpl_toks, repl_toks);
    cstok.assign_cmd (engine, new MacroCommand (cstok, tmpl_toks, repl_toks));
}


register_command ('def', function cmd_def (engine) {
    return _cmd_def (engine, 'def', false);
});

register_command ('gdef', function cmd_gdef (engine) {
    engine.set_global_assign_mode ();
    return _cmd_def (engine, 'gdef', false);
});

register_command ('edef', function cmd_edef (engine) {
    return _cmd_def (engine, 'edef', true);
});

register_command ('xdef', function cmd_xdef (engine) {
    engine.set_global_assign_mode ();
    return _cmd_def (engine, 'xdef', true);
});


// Grouping

register_command ('begingroup', function cmd_begingroup (engine) {
    engine.handle_begingroup ();
});

register_command ('endgroup', function cmd_endgroup (engine) {
    engine.handle_endgroup ();
});


// Boxes

function _cmd_if_boxtype (engine, wanttype) {
    engine.start_parsing_condition ();
    var reg = engine.scan_char_code__I ();
    engine.done_parsing_condition ();
    var btype = engine.get_register (T_BOX, reg).btype;
    var result = (btype == wanttype);
    engine.trace ('if%s %s => %b', bt_names[wanttype], bt_names[btype], result);
    engine.handle_if (result);
};

register_command ('ifvoid', function cmd_ifvoid (engine) {
    _cmd_if_boxtype (engine, BT_VOID);
});

register_command ('ifhbox', function cmd_ifhbox (engine) {
    _cmd_if_boxtype (engine, BT_HBOX);
});

register_command ('ifvbox', function cmd_ifvbox (engine) {
    _cmd_if_boxtype (engine, BT_VBOX);
});


register_command ('hbox', (function HboxCommand_closure () {
    function HboxCommand () { Command.call (this); }
    inherit (HboxCommand, Command);
    var proto = HboxCommand.prototype;
    proto.name = 'hbox';
    proto.boxlike = true;

    proto.invoke = function HboxCommand_invoke (engine) {
	engine.trace ('hbox (for accumulation)');
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function HboxCommand_start_box (engine) {
	engine.handle_hbox ();
    };

    return HboxCommand;
}) ());


register_command ('vbox', (function VboxCommand_closure () {
    function VboxCommand () { Command.call (this); }
    inherit (VboxCommand, Command);
    var proto = VboxCommand.prototype;
    proto.name = 'vbox';
    proto.boxlike = true;

    proto.invoke = function VboxCommand_invoke (engine) {
	engine.trace ('vbox (for accumulation)');
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function VboxCommand_start_box (engine) {
	engine.handle_vbox (false);
    };

    return VboxCommand;
}) ());


register_command ('vtop', (function VtopCommand_closure () {
    function VtopCommand () { Command.call (this); }
    inherit (VtopCommand, Command);
    var proto = VtopCommand.prototype;
    proto.name = 'vtop';
    proto.boxlike = true;

    proto.invoke = function VtopCommand_invoke (engine) {
	engine.trace ('vtop (for accumulation)');
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function VtopCommand_start_box (engine) {
	engine.handle_vbox (true);
    };

    return VtopCommand;
}) ());


register_command ('copy', (function CopyCommand_closure () {
    function CopyCommand () { Command.call (this); }
    inherit (CopyCommand, Command);
    var proto = CopyCommand.prototype;
    proto.name = 'copy';
    proto.boxlike = true;

    proto.invoke = function CopyCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function CopyCommand_start_box (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	engine.trace ('copy box %d', reg);
	engine.handle_finished_box (box.clone ());
    };

    return CopyCommand;
}) ());


register_command ('box', (function BoxCommand_closure () {
    function BoxCommand () { Command.call (this); }
    inherit (BoxCommand, Command);
    var proto = BoxCommand.prototype;
    proto.name = 'box';
    proto.boxlike = true;

    proto.invoke = function BoxCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function BoxCommand_start_box (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	engine.trace ('fetch box %d', reg);
	engine.set_register (T_BOX, reg, new VoidBox ());
	engine.handle_finished_box (box);
    };

    return BoxCommand;
}) ());


register_command ('vsplit', (function VsplitCommand_closure () {
    function VsplitCommand () { Command.call (this); }
    inherit (VsplitCommand, Command);
    var proto = VsplitCommand.prototype;
    proto.name = 'vsplit';
    proto.boxlike = true;

    proto.invoke = function VsplitCommand_invoke (engine) {
	engine.scan_box_for_accum (this);
    };

    proto.start_box = function VsplitCommand_start_box (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);

	if (!engine.scan_keyword ('to'))
	    throw new TexRuntimeError ('expected keyword "to"');

	var depth_S = engine.scan_dimen__O_S (false);
	engine.trace ('vsplit box %d to %S [fake impl]', reg, depth_S);

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
}) ());


register_command ('lastbox', (function LastboxCommand_closure () {
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
}) ());


register_command ('wd', (function WdCommand_closure () {
    function WdCommand () { Command.call (this); }
    inherit (WdCommand, Command);
    var proto = WdCommand.prototype;
    proto.name = 'wd';

    proto.invoke = function WdCommand_invoke (engine) {
	// NOTE: you can't e.g. do \advance\wd0 so implementing as a settable
	// Valref is not so important.
	var reg = engine.scan_char_code__I ();
	engine.scan_optional_equals ();
	var width_S = engine.scan_dimen__O_S (false);
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.trace ('\\wd%d = %S -- noop on void box', reg, width_S);
	} else {
	    engine.trace ('\\wd%d = %S', reg, width_S);
	    box.width_S = width_S;
	}
    };

    proto.get_valtype = function WdCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function WdCommand_as_valref (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	return new ConstantValref (T_DIMEN, box.width_S);
    };

    return WdCommand;
}) ());


register_command ('ht', (function HtCommand_closure () {
    function HtCommand () { Command.call (this); }
    inherit (HtCommand, Command);
    var proto = HtCommand.prototype;
    proto.name = 'ht';

    proto.invoke = function HtCommand_invoke (engine) {
	// NOTE: you can't e.g. do \advance\ht0 so implementing as a settable
	// Valref is not so important.
	var reg = engine.scan_char_code__I ();
	engine.scan_optional_equals ();
	var height_S = engine.scan_dimen__O_S (false);
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.trace ('\\ht%d = %S -- noop on void box', reg, height_S);
	} else {
	    engine.trace ('\\ht%d = %S', reg, height_S);
	    box.height_S = height_S;
	}
    };

    proto.get_valtype = function HtCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function HtCommand_as_valref (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	return new ConstantValref (T_DIMEN, box.height_S);
    };

    return HtCommand;
}) ());


register_command ('dp', (function DpCommand_closure () {
    function DpCommand () { Command.call (this); }
    inherit (DpCommand, Command);
    var proto = DpCommand.prototype;
    proto.name = 'dp';

    proto.invoke = function DpCommand_invoke (engine) {
	// NOTE: you can't e.g. do \advance\dp0 so implementing as a settable
	// Valref is not so important.
	var reg = engine.scan_char_code__I ();
	engine.scan_optional_equals ();
	var depth_S = engine.scan_dimen__O_S (false);
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.trace ('\\dp%d = %S -- noop on void box', reg, depth_S);
	} else {
	    engine.trace ('\\dp%d = %S', reg, depth_S);
	    box.depth_S = depth_S;
	}
    };

    proto.get_valtype = function DpCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function DpCommand_as_valref (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	return new ConstantValref (T_DIMEN, box.depth_S);
    };

    return DpCommand;
}) ());


register_command ('setbox', function cmd_setbox (engine) {
    var reg = engine.scan_char_code__I ();
    engine.scan_optional_equals ();
    engine.trace ('setbox: queue #%d = ...', reg);
    engine.handle_setbox (reg);
});


register_command ('hrule', function cmd_hrule (engine) {
    if (engine.mode() != M_VERT && engine.mode() != M_IVERT)
	throw new TexRuntimeError ('can only create \\hrule in vertical mode');

    var rule = new Rule ();
    rule.height_S = 26214; // default rule = 0.4pt; T:TP sec 463
    rule.depth_S = nlib.Zero_S;

    while (true) {
	if (engine.scan_keyword ('width'))
	    rule.width_S = engine.scan_dimen__O_S (false);
	else if (engine.scan_keyword ('height'))
	    rule.height_S = engine.scan_dimen__O_S (false);
	else if (engine.scan_keyword ('depth'))
	    rule.depth_S = engine.scan_dimen__O_S (false);
	else
	    break;
    }

    engine.trace ('hrule %o', rule);
    engine.accum (rule);
});


register_command ('vrule', function cmd_vrule (engine) {
    if (engine.mode() != M_HORZ && engine.mode() != M_RHORZ)
	throw new TexRuntimeError ('can only create \\vrule in horizontal mode');

    var rule = new Rule ();
    rule.width_S = 26214; // default rule = 0.4pt; T:TP sec 463

    while (true) {
	if (engine.scan_keyword ('width'))
	    rule.width_S = engine.scan_dimen__O_S (false);
	else if (engine.scan_keyword ('height'))
	    rule.height_S = engine.scan_dimen__O_S (false);
	else if (engine.scan_keyword ('depth'))
	    rule.depth_S = engine.scan_dimen__O_S (false);
	else
	    break;
    }

    engine.trace ('vrule %o', rule);
    engine.accum (rule);
});


register_command ('unhbox', function cmd_unhbox (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var reg = engine.scan_char_code__I ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID) {
	engine.trace ('unhbox %d (but void)', reg);
	return;
    }

    if (box.btype != BT_HBOX)
	throw new TexRuntimeError ('trying to unhbox non-hbox reg %d: %U', reg, box);

    engine.trace ('unhbox %d (non-void) -> %U', reg, box);
    engine.set_register (T_BOX, reg, new VoidBox ());
    engine.accum_list (box.list);
});


register_command ('unvbox', function cmd_unvbox (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var reg = engine.scan_char_code__I ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID) {
	engine.trace ('unvbox %d (but void)', reg);
	return;
    }

    if (box.btype != BT_VBOX)
	throw new TexRuntimeError ('trying to unvbox non-vbox reg %d: %U', reg, box);

    engine.trace ('unvbox %d (non-void)', reg);
    engine.set_register (T_BOX, reg, new VoidBox ());
    engine.accum_list (box.list);
});


register_command ('unhcopy', function cmd_unhcopy (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var reg = engine.scan_char_code__I ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID)
	return;

    if (box.btype != BT_HBOX)
	throw new TexRuntimeError ('trying to unhcopy a non-hbox');

    engine.trace ('unhcopy %d', reg);
    engine.accum_list (box.list.slice ());
});


register_command ('unvcopy', function cmd_unvcopy (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var reg = engine.scan_char_code__I ();
    var box = engine.get_register (T_BOX, reg);

    if (box.btype == BT_VOID)
	return;

    if (box.btype != BT_VBOX)
	throw new TexRuntimeError ('trying to unvcopy a non-vbox');

    engine.trace ('unvcopy %d', reg);
    engine.accum_list (box.list.slice ());
});


register_command ('hfil', function cmd_hfil (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (1);
    g.stretch_order = 1;
    engine.trace ('hfil');
    engine.accum (new BoxGlue (g));
});

register_command ('hfill', function cmd_hfill (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (1);
    g.stretch_order = 2;
    engine.trace ('hfill');
    engine.accum (new BoxGlue (g));
});

register_command ('hss', function cmd_hss (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (1);
    g.stretch_order = 1;
    g.shrink_S = nlib.scale__I_S (1);
    g.shrink_order = 1;
    engine.trace ('hss');
    engine.accum (new BoxGlue (g));
});

register_command ('hfilneg', function cmd_hfilneg (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (-1);
    g.stretch_order = 1;
    engine.trace ('hfilneg');
    engine.accum (new BoxGlue (g));
});

register_command ('hskip', function cmd_hskip (engine) {
    if (engine.ensure_horizontal (this))
	return; // this command will be reread after new paragraph is started.

    var g = engine.scan_glue (false);
    engine.trace ('hskip of %o', g);
    engine.accum (new BoxGlue (g));
});


register_command ('vfil', function cmd_vfil (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (1);
    g.stretch_order = 1;
    engine.trace ('vfil');
    engine.accum (new BoxGlue (g));
});


register_command ('vfill', function cmd_vfill (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (1);
    g.stretch_order = 2;
    engine.trace ('vfill');
    engine.accum (new BoxGlue (g));
});


register_command ('vss', function cmd_vss (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (1);
    g.stretch_order = 1;
    g.shrink_S = nlib.scale__I_S (1);
    g.shrink_order = 1;
    engine.trace ('vss');
    engine.accum (new BoxGlue (g));
});

register_command ('vfilneg', function cmd_vfilneg (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = new Glue ();
    g.stretch_S = nlib.scale__I_S (-1);
    g.stretch_order = 1;
    engine.trace ('vfilneg');
    engine.accum (new BoxGlue (g));
});

register_command ('vskip', function cmd_vskip (engine) {
    if (engine.ensure_vertical (this))
	return; // command will be reread after this graf is finished.

    var g = engine.scan_glue (false);
    engine.trace ('vskip of %o', g);
    engine.accum (new BoxGlue (g));
});


register_command ('mark', function cmd_mark (engine) {
    engine.scan_left_brace ();
    var tlist = engine.scan_tok_group (true);
    var mark = new Mark (tlist.toks);
    engine.trace ('mark %T', tlist);
    engine.accum (mark);
});


function parse_tag_attrs (engine, toklist) {
    // The toklist is something like "webtex start-tag a {href} {/url/} {name}
    // {foo}". We just look for pairs of brace-delimited spans and textify
    // them.

    var attrs = {};
    var curname = null;

    for (var i = 0; i < toklist.length; i++) {
	var tok = toklist[i];

	if (!tok.is_cat (C_BGROUP))
	    continue;

	for (var j = i + 1, depth = 1; j < toklist.length; j++) {
	    tok = toklist[j];
	    if (tok.is_cat (C_BGROUP))
		depth++;
	    else if (tok.is_cat (C_EGROUP)) {
		depth--;
		if (depth == 0)
		    break;
	    }
	}

	if (j == toklist.length)
	    throw new TexRuntimeError ('unfinished tag attribute in %T', toklist);

	var value = new Toklist (toklist.slice (i + 1, j)).iotext (engine);

	if (curname == null) {
	    curname = value;
	} else {
	    attrs[curname] = value;
	    curname = null;
	}

	i = j;
    }

    if (curname != null)
	throw new TexRuntimeError ('incomplete tag attribute in %T', toklist);

    return attrs;
}

register_command ('special', function cmd_special (engine) {
    engine.scan_left_brace ();
    var tlist = engine.scan_tok_group (true);
    engine.trace ('special: %T', tlist);
    var object = null;

    // Webtex customization: we convert our processing directives
    // into custom handling objects on the fly
    var text = tlist.as_serializable ();
    if (text.indexOf ('webtex ') != 0) {
	object = new Special (tlist.toks);
    } else {
	var pieces = text.split (' ');

	if (pieces[1] == 'push-suppress') {
	    object = new SuppressionControl (false);
	} else if (pieces[1] == 'pop-suppress') {
	    object = new SuppressionControl (true);
	} else if (pieces[1] == 'start-tag') {
	    var tag = pieces[2];
	    object = new StartTag (tag, parse_tag_attrs (engine, tlist.toks));
	} else if (pieces[1] == 'end-tag') {
	    var tag = pieces[2];
	    object = new EndTag (tag);
	} else {
	    engine.warn ('unhandled webtex special "%s"', text);
	}
    }

    if (object != null)
	engine.accum (object);
});


register_command ('penalty', function cmd_penalty (engine) {
    var amount = engine.scan_int__I ();
    var penalty = new Penalty (amount);
    engine.trace ('penalty %o', amount);
    engine.accum (penalty);
});


function _cmd_box_shift (engine, desc, negate) {
    var amount_S = engine.scan_dimen__O_S (false);
    engine.trace ('%s next box by %S ...', desc, amount_S);

    function shift_the_box (engine, box) {
	engine.trace ('... finish %s', desc);
	if (negate)
	    amount_S *= -1;
	box.shift_amount_S = box.shift_amount_S + amount_S;
	engine.accum (box);
    }

    engine.scan_box (shift_the_box, false);
};

register_command ('lower', function cmd_lower (engine) {
    // Sign conventions: T:TP 185.
    _cmd_box_shift (engine, 'lower', false);
});

register_command ('raise', function cmd_raise (engine) {
    _cmd_box_shift (engine, 'raise', true);
});

register_command ('moveright', function cmd_moveright (engine) {
    _cmd_box_shift (engine, 'moveright', false);
});

register_command ('moveleft', function cmd_moveleft (engine) {
    _cmd_box_shift (engine, 'moveleft', true);
});



register_command ('kern', function cmd_kern (engine) {
    var amount_S = engine.scan_dimen__O_S (false);
    engine.trace ('kern %S', amount_S);
    engine.accum (new Kern (amount_S));
});


register_command ('unpenalty', function cmd_unpenalty (engine) {
    engine.trace ('unpenalty');
    engine.handle_un_listify (LT_PENALTY);
});

register_command ('unkern', function cmd_unkern (engine) {
    engine.trace ('unkern');
    engine.handle_un_listify (LT_KERN);
});

register_command ('unskip', function cmd_unskip (engine) {
    engine.trace ('unskip');
    engine.handle_un_listify (LT_GLUE);
});


register_command ('shipout', function cmd_shipout (engine) {
    function ship_it_good (engine, box) {
	// Note: any box type (void, hbox, vbox) is OK to ship out.
	engine.set_register (T_BOX, 255, new VoidBox ());
	engine.ship_it (box);
    };

    engine.trace ('shipout');
    engine.scan_box (ship_it_good, false);
});


register_command ('insert', function cmd_insert (engine) {
    var num = engine.scan_char_code__I ();
    if (num == 255)
	throw new TexRuntimeError ('\\insert255 is forbidden');

    // T:TP 1099: "begin_insert_or_adjust"
    engine.trace ('insert %d', num);
    engine.scan_left_brace ();

    // T:TP 1070: "normal_paragraph"
    engine.set_parameter (T_INT, 'looseness', 0);
    engine.set_parameter__OS ('hangindent', nlib.Zero_S);
    engine.set_parameter (T_INT, 'hangafter', 1);
    // TODO: clear \parshape info, which nests in the EqTb.

    engine.nest_eqtb ();
    engine.enter_mode (M_IVERT);
    engine.enter_group ('insert', function (eng) {
	var list = engine.leave_mode ();
	engine.unnest_eqtb ();
	// T:TP 1100 should go here.
	engine.warn ('ignoring finished insert #%d', num);
    });
});

// "Special registers" with single global values:
//
// ints: \deadcycles, \insertpenalties.
//
// dimens: \pagetotal, \pagegoal, \pagestretch, \pagefilstretch,
// \pagefillstretch, \pagefilllstretch, \pageshrink, \pagedepth.
//
// Other internal values; listed as a superset of the specials in TeXBook.
// distinction unclear:
//
// ints: \parshape \inputlineno \badness \lastpenalty
// dimens: \lastkern

register_command ('deadcycles', new SpecialValueCommand (T_INT, 'deadcycles'));
register_command ('insertpenalties', new SpecialValueCommand (T_INT, 'insertpenalties'));
register_command ('pagegoal', new SpecialValueCommand (T_DIMEN, 'pagegoal'));
register_command ('pagetotal', new SpecialValueCommand (T_DIMEN, 'pagetotal'));
register_command ('pagestretch', new SpecialValueCommand (T_DIMEN, 'pagestretch'));
register_command ('pagefilstretch', new SpecialValueCommand (T_DIMEN, 'pagefilstretch'));
register_command ('pagefillstretch', new SpecialValueCommand (T_DIMEN, 'pagefillstretch'));
register_command ('pagefilllstretch', new SpecialValueCommand (T_DIMEN, 'pagefilllstretch'));
register_command ('pageshrink', new SpecialValueCommand (T_DIMEN, 'pageshrink'));
register_command ('pagedepth', new SpecialValueCommand (T_DIMEN, 'pagedepth'));


register_command ('inputlineno', (function InputlinenoCommand_closure () {
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
}) ());


register_command ('lastpenalty', (function LastpenaltyCommand_closure () {
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

    proto.get_valtype = function LastSkipCommand_get_valtype  () {
	return T_INT;
    };

    proto.as_valref = function LastpenaltyCommand_as_valref (engine) {
	var val = 0;
	var item = engine.get_last_listable ();
	if (item != null && item.ltype == LT_PENALTY)
	    val = item.amount;
	return new ConstantValref (T_INT, val);
    };

    return LastpenaltyCommand;
}) ());


register_command ('lastskip', (function LastskipCommand_closure () {
    // See comment in \lastpenalty about correctness of this implementation.
    function LastskipCommand () { Command.call (this); }
    inherit (LastskipCommand, Command);
    var proto = LastskipCommand.prototype;
    proto.name = 'lastskip';

    proto.invoke = function LastskipCommand_invoke (engine) {
	throw new TexRuntimeError ('bare \\lastskip not allowed');
    };

    proto.get_valtype = function LastSkipCommand_get_valtype  () {
	return T_GLUE;
    };

    proto.as_valref = function LastskipCommand_as_valref (engine) {
	var val = new Glue ();
	var item = engine.get_last_listable ();
	if (item != null && item.ltype == LT_GLUE)
	    val = item.amount.clone ();
	return new ConstantValref (T_GLUE, val);
    };

    return LastskipCommand;
}) ());


register_command ('lastkern', (function LastkernCommand_closure () {
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

    proto.get_valtype = function LastkernCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function LastkernCommand_as_valref (engine) {
	var val_S = nlib.Zero_S;
	var item = engine.get_last_listable ();
	if (item != null && item.ltype == LT_KERN)
	    val_S = item.amount_S;
	return new ConstantValref (T_DIMEN, val_S);
    };

    return LastkernCommand;
}) ());


// Mark insertion

register_command ('botmark', function cmd_botmark (engine) {
    engine.trace ('botmark [bad noop]');
});

register_command ('firstmark', function cmd_firstmark (engine) {
    engine.trace ('firstmark [bad noop]');
});

register_command ('splitbotmark', function cmd_splitbotmark (engine) {
    engine.trace ('splitbotmark [bad noop]');
});

register_command ('splitfirstmark', function cmd_splitfirstmark (engine) {
    engine.trace ('splitfirstmark [bad noop]');
});

register_command ('topmark', function cmd_topmark (engine) {
    engine.trace ('topmark [bad noop]');
});


// Hyphenation

register_command ('patterns', function cmd_patterns (engine) {
    engine.scan_left_brace ();
    engine.scan_tok_group (false);
    engine.trace ('patterns [noop/ignored]');
});


register_command ('hyphenation', function cmd_hyphenation (engine) {
    engine.scan_left_brace ();
    engine.scan_tok_group (false);
    engine.trace ('hyphenation [noop/ignored]');
});


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

    engine.trace ('%s %T -> %T', cmdname, oldtoks, newtoks);
    engine.push_toks (newtoks);
}


register_command ('uppercase', function cmd_uppercase (engine) {
    _change_case (engine, true);
});


register_command ('lowercase', function cmd_lowercase (engine) {
    _change_case (engine, false);
});


register_command ('the', function cmd_the (engine) {
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
	engine.trace ('the (toks) %o -> %T', tok, toks);
	engine.push_toks (toks);
	return;
    }

    if (val.valtype == T_FONT) {
	var val = val.get (engine);
	engine.push (Token.new_cmd (new GivenFontCommand (val)));
	return;
    }

    var expn = val.get (engine).to_texstr ();
    engine.trace ('the %o -> %s', tok, expn);
    engine.push_string (expn);
});


register_command ('meaning', function cmd_meaning (engine) {
    var tok = engine.next_tok_throw ();
    var expn = tok.to_cmd (engine).texmeaning (engine);
    engine.trace ('meaning %o -> %s', tok, expn);
    engine.push_string (expn);
});


register_command ('jobname', function cmd_jobname (engine) {
    engine.trace ('jobname -> %s', engine.jobname);
    engine.push_string (engine.jobname);
});


register_command ('romannumeral', function cmd_romannumeral (engine) {
    // T:TP 69. "Readers who like puzzles might enjoy trying to figure out how
    // this tricky code works; therefore no explanation will be given." Here's
    // another puzzle: "GFY, DEK."
    var table = ['m', 2, 'd', 5, 'c', 2, 1, 5, 'x', 2, 'v', 5, 'i'];
    var v = 1000;
    var n = engine.scan_int__I (); // ignoring naming convention for sanity
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

    engine.trace ('romannumeral %d -> %s', n_orig, result);
    engine.push_string (result);
});


// User interaction, I/O

register_command ('message', function cmd_message (engine) {
    engine.scan_left_brace ();
    var toks = engine.scan_tok_group (true);
    engine.trace ('message %U', toks);
});


register_command ('errmessage', function cmd_errmessage (engine) {
    engine.scan_left_brace ();
    var toks = engine.scan_tok_group (true);
    engine.trace ('errmessage %U', toks);
    throw new TexRuntimeError ('TeX-triggered error: %U', toks);
});


register_command ('immediate', function cmd_immediate (engine) {
    /* This causes a following \openout, \write, or \closeout to take effect
     * immediately, rather than waiting until page shipout. I suspect that I'll
     * need to distinguish these eventually, but for now, this is a noop. */
    engine.trace ('immediate');
});


register_command ('write', function cmd_write (engine) {
    // XXX should not be immediate by default!!! -> don't expand tokens now
    var streamnum = engine.scan_streamnum ();
    engine.scan_left_brace ();
    var toks = engine.scan_tok_group (true);
    var tt = toks.iotext (engine);

    if (streamnum == 16) {
	// 16 -> the log
	engine.trace ('write:%d(->log) %s', streamnum, tt);
	return;
    }

    // If the specified file hasn't been opened, TeX writes to the console.
    var outf = engine.outfile (streamnum);
    if (outf == null)
	engine.trace ('write:%d(->console) %s', streamnum, tt);
    else {
	engine.trace ('write:%d %s', streamnum, tt);
	outf.write_string (tt + '\n');
    }
});


register_command ('input', function cmd_input (engine) {
    var fn = engine.scan_file_name ();
    engine.trace ('input %s', fn);
    engine.handle_input (fn);
});


register_command ('endinput', function cmd_endinput (engine) {
    engine.trace ('endinput');
    engine.handle_endinput ();
});


register_command ('openout', function cmd_openout (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();

    engine.trace ('openout %d = %s', snum, fn);
    var outf = engine.iostack.open_for_write (fn);
    if (outf == null)
	throw new TexRuntimeError ('failed to \\openout %s', fn);

    engine.set_outfile (snum, outf);
});


register_command ('closeout', function cmd_closeout (engine) {
    var snum = engine.scan_streamnum ();
    engine.trace ('closeout %d [noop]', snum);
    engine.set_outfile (snum, null);
});


register_command ('openin', function cmd_openin (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();

    if (snum == 16)
	throw new TexRuntimeError ('attempted terminal input');

    engine.set_infile (snum, null);

    engine.trace ('openin %d = %s', snum, fn);
    var lb = engine.iostack.try_open_linebuffer (fn);
    if (lb == null)
	// File existence is tested by \openin..\ifeof, so this should
	// be a warning only.
	engine.warn ('failed to \\openin %s', fn);

    engine.set_infile (snum, lb);
});


register_command ('closein', function cmd_closein (engine) {
    var snum = engine.scan_streamnum ();
    if (snum == 16)
	throw new TexRuntimeError ('attempted close of illegal stream');

    // I think this is all we need ...
    engine.set_infile (snum, null);
});


register_command ('ifeof', function cmd_ifeof (engine) {
    var snum = engine.scan_streamnum (), result;

    if (snum == 16)
	result = false;
    else
	result = (engine.infile (snum) == null);

    engine.trace ('ifeof %d -> %b', snum, result);
    engine.handle_if (result);
});


// High-level miscellany

register_command ('end', function cmd_end (engine) {
    engine.trace ('end');
    engine.handle_end ();
});

register_command ('dump', function cmd_dump (engine) {
    engine.trace ('dump');
});

register_command ('batchmode', function cmd_batchmode (engine) {
    engine.trace ('batchmode');
});

register_command ('errorstopmode', function cmd_errorstopmode (engine) {
    engine.trace ('errorstopmode');
});

register_command ('nonstopmode', function cmd_nonstopmode (engine) {
    engine.trace ('nonstopmode');
});

register_command ('scrollmode', function cmd_scrollmode (engine) {
    engine.trace ('scrollmode');
});

register_command ('show', function cmd_show (engine) {
    var tok = engine.next_tok ();
    engine.trace ('show: noop for %o', tok);
});

register_command ('showbox', function cmd_showbox (engine) {
    var reg = engine.scan_register_num__I ();
    var box = engine.get_register (T_BOX, reg);
    engine.trace ('showbox %d = %U', reg, box);
});

register_command ('WEBTEXtraceon', function cmd_webtex_traceon (engine) {
    engine.set_tracing (true);
});
