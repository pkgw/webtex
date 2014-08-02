'use strict;'

var commands = WEBTEX.commands = {};

commands.par = function cmd_par (engine) {
    engine.trace ('par');
};


// Language infrastructure

commands.relax = function cmd_relax (engine) {
    engine.trace ('relax');
};


commands.expandafter = function cmd_expandafter (engine) {
    // Note that we can't use next_x_tok () here since we can end up
    // double-expanding what comes next in \expandafter A \expandafter B ...

    var tok1 = engine.next_tok_throw ();
    var tok2 = engine.next_tok_throw ();

    engine.trace ('*expandafter ' + tok1 + '|' + tok2 + ' ...');

    var cmd2 = tok2.tocmd (engine);
    if (cmd2.expandable)
	cmd2.invoke (engine);
    else
	engine.push (tok2);

    engine.push (tok1);
};


commands.noexpand = function cmd_noexpand (engine) {
    throw new TexInternalError ('\\noexpand shouldn\'t get evaluated');
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
	if (tok.iscmd (engine, 'endcsname'))
	    break;
	if (!tok.ischar ())
	    throw new TexRuntimeError ('only character tokens should occur ' +
				       'between \\csname and \\endcsname');

	csname += String.fromCharCode (tok.ord);
    }

    var tok = Token.new_cseq (csname);
    engine.trace ('* \\csname...\\endcsname -> ' + tok);
    engine.push (tok);

    var cmd = engine.get_cseq (csname);
    if (cmd == null || cmd.name == 'undefined')
	tok.assign_cmd (engine, engine.commands['relax']);
};


commands.global = function cmd_global (engine) {
    engine.trace ('global');
    engine.set_global_assign_mode ();
};


commands.outer = function cmd_outer (engine) {
    engine.trace ('outer'); // I think it's OK to make this a noop.
};


commands._long = function cmd_long (engine) {
    engine.trace ('long'); // I think it's OK to make this a noop.
};


commands._let = function cmd_let (engine) {
    var cstok = engine.scan_r_token ();

    // Note that we don't use scan_optional_equals here since it
    // expands things.

    while (true) {
	var tok = engine.next_tok_throw ();
	if (tok.iscat (C_SPACE))
	    continue
	if (tok.isotherchar (O_EQUALS)) {
	    var equiv = engine.next_tok_throw ();
	    if (equiv.iscat (C_SPACE))
		equiv = engine.next_tok_throw ();
	    break;
	}
	var equiv = tok;
	break;
    }

    engine.trace ('let ' + cstok + ' = ' + equiv);
    cstok.assign_cmd (engine, equiv.tocmd (engine));
};


commands.futurelet = function cmd_futurelet (engine) {
    var cstok = engine.scan_r_token ();
    var thenexpand = engine.next_tok_throw ();
    var equiv = engine.next_tok_throw ();
    engine.trace ('futurelet ' + cstok + ' = ' + equiv + '; ' + thenexpand);
    cstok.assign_cmd (engine, equiv.tocmd (engine));
    engine.push_toks ([thenexpand, equiv]);
};


commands.string = function cmd_string (engine) {
    var tok = engine.next_tok_throw ();
    engine.trace ('* \\string ' + tok);

    if (tok.ischar ()) {
	engine.push (tok); // keep catcode
	return;
    }

    if (tok.iscslike ()) { // active chars were handled above
	var expn = tok.name, esc = engine.escapechar ();
	if (esc >= 0 && esc < 256)
	    expn = String.fromCharCode (esc) + expn;
    } else
	throw new TexRuntimeError ('don\'t know how to \\string-ize ' + tok);

    engine.push_string (expn);
};


commands.number = function cmd_number (engine) {
    var val = engine.scan_int ().value;
    engine.trace ('* number ' + val);
    engine.push_string ('' + val);
};


commands.afterassignment = function cmd_afterassignment (engine) {
    var tok = engine.next_tok_throw ();
    engine.set_after_assign_token (tok);
    engine.trace ('afterassignment <- ' + tok);
};


// Register access and manipulation: \count, \advance, etc.

commands.count = new VariableRegisterCommand ('count', T_INT);
commands.dimen = new VariableRegisterCommand ('dimen', T_DIMEN);
commands.skip = new VariableRegisterCommand ('skip', T_GLUE);
commands.muskip = new VariableRegisterCommand ('muskip', T_MUGLUE);
commands.toks = new VariableRegisterCommand ('toks', T_TOKLIST);

commands.advance = function cmd_advance (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.tocmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var delta = engine.scan_valtype (val.valtype);
    engine.trace ('advance ' + cmd + ' = ' + cur + ' + ' + delta);
    val.set (engine, cur.advance (delta));
};


commands.divide = function cmd_divide (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.tocmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var denom = engine.scan_int ();
    engine.trace ('divide ' + cmd + ' = ' + cur + ' / ' + denom);
    val.set (engine, cur.intdivide (denom));
};


commands.multiply = function cmd_multiply (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.tocmd (engine);
    var val = cmd.as_valref (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var factor = engine.scan_int ();
    engine.trace ('multiply ' + cmd + ' = ' + cur + ' * ' + factor);
    val.set (engine, cur.intproduct (factor));
};


function define_register (name, valtype, engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var reg = engine.scan_register_num ();
    engine.trace (name + 'def ' + cstok + ' -> {\\' + name + ' ' + reg + '}');
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
	    throw new TexRuntimeException ('illegal value ' + code +
					   ' for ' + ct_names[this.codetype]);

	engine.trace (ct_names[this.codetype] + ' ' + escchr (ord) + '=' +
		      ord + ' -> ' + code);
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
    engine.trace ('chardef ' + cstok + ' -> {inschar ' + escchr (ord) +
		  '=' + ord + '}');
    cstok.assign_cmd (engine, new GivenCharCommand (ord));
};


commands.mathchardef = function cmd_mathchardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var val = engine.scan_int ().value;
    if (val < 0 || val > 0x8000)
	throw new TexRuntimeError ('need mathcode in [0,0x8000] but ' +
				   'got ' + val);
    engine.trace ('mathchardef ' + cstok + ' -> {insmathchar ' + val + '}');
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
	    if (tok.iscat (C_BGROUP)) {
		tmpl_toks.push (tok);
		end_with_lbrace = true;
		break;
	    }

	    if (tok.isotherchar (O_ZERO + next_pnum)) {
		if (next_pnum > 9)
		    throw new TexRuntimeError ('macros may only have 9 parameters');

		tmpl_toks.push (Token.new_param (next_pnum));
		next_pnum += 1;
		last_was_param = false;
		continue;
	    }

	    throw new TexSyntaxError ('unexpected token ' + tok + ' following ' +
				      'parameter token');
	}

	if (tok.iscat (C_PARAM)) {
	    last_was_param = true;
	    continue;
	}

	if (tok.iscat (C_BGROUP))
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
	    if (tok.iscmd (engine, 'noexpand')) {
		repl_toks.push (engine.next_tok_throw ());
		continue;
	    } else if (tok.isexpandable (engine)) {
		if (tok.iscmd (engine, 'the')) {
		    var next = engine.next_tok_throw ();
		    var ncmd = next.tocmd (engine);

		    if (ncmd.get_valtype () == T_TOKLIST) {
			var nv = ncmd.as_valref (engine);
			repl_toks = repl_toks.concat (nv.get (engine).toks);
			continue;
		    } else {
			engine.push (next);
		    }
		}

		tok.tocmd (engine).invoke (engine);
		continue;
	    }
	}

	if (last_was_param) {
	    if (tok.iscat (C_PARAM)) {
		repl_toks.push (tok);
		last_was_param = false;
		continue;
	    }

	    if (tok.iscat (C_OTHER) && tok.ord > O_ZERO &&
		tok.ord < O_ZERO + next_pnum) {
		repl_toks.push (Token.new_param (tok.ord - O_ZERO));
		last_was_param = false;
		continue;
	    }

	    throw new TexSyntaxError ('unexpected token ' + tok + ' following ' +
				      'parameter token');
	}

	if (tok.iscat (C_PARAM)) {
	    last_was_param = true;
	    continue;
	}

	if (tok.iscat (C_BGROUP))
	    depth += 1;
	else if (tok.iscat (C_EGROUP)) {
	    depth -= 1;
	    if (depth == 0)
		break;
	}

	repl_toks.push (tok);
	last_was_param = false;
    }

    if (end_with_lbrace)
	repl_toks.push (tmpl_toks[tmpl_toks.length - 1]);

    engine.trace ([cname, cstok, '~', new Toklist (tmpl_toks),
		   '->', new Toklist (repl_toks)].join (' '));
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
	if (tok.ischar ())
	    return tok.catcode * 1000 + tok.ord;
	if (tok.iscslike ()) { // active chars will be caught by above
	    var cmd = tok.tocmd (engine);
	    if (cmd instanceof GivenCharCommand)
		throw new TexInternalError ('not implemented');
	    return 16 * 1000 + 256;
	}
	throw new TexRuntimeError ('illegal comparison subject ' + tok);
    }

    var result = (key (t1) == key (t2));
    engine.trace ('if ' + t1 + ' ~ ' + t2 + ' => ' + result);
    engine.handle_if (result);
};


commands.ifx = function cmd_ifx (engine) {
    var t1 = engine.next_tok_throw (), t2 = engine.next_tok_throw (), result;

    if (t1.kind != t2.kind)
	result = false;
    else if (t1.ischar ())
	result = (t1.ord == t2.ord);
    else {
	var cmd1 = t1.tocmd (engine), cmd2 = t2.tocmd (engine);
	result = cmd1.samecmd (cmd2);
    }

    engine.trace ('ifx ' + t1 + ' ~ ' + t2 + ' => ' + result);
    engine.handle_if (result);
};


commands.ifnum = function cmd_ifnum (engine) {
    engine.start_parsing_if_condition ();
    var val1 = engine.scan_int ().value;

    while (true) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxError ('EOF inside \\ifnum');
	if (!tok.iscat (C_SPACE))
	    break;
    }

    // It's a little futzy to not check the validity of tok before
    // reading val2.
    var val2 = engine.scan_int ().value, result;
    engine.done_parsing_if_condition ();

    if (tok.isotherchar (O_LESS))
	result = (val1 < val2);
    else if (tok.isotherchar (O_GREATER))
	result = (val1 > val2);
    else if (tok.isotherchar (O_EQUALS))
	result = (val1 == val2);
    else
	throw new TexSyntaxError ('expected <,=,> in \\ifnum but got ' + tok);

    engine.trace (['ifnum', val1, tok, val2, '?', result].join (' '));
    engine.handle_if (result);
};


commands.ifodd = function cmd_ifodd (engine) {
    engine.start_parsing_if_condition ();
    var val = engine.scan_int ().value;
    engine.done_parsing_if_condition ();
    var result = (val % 2 == 1);
    engine.trace ('ifodd ' + val + '?');
    engine.handle_if (result);
};


commands.ifdim = function cmd_ifdim (engine) {
    engine.start_parsing_if_condition ();
    var val1 = engine.scan_dimen ();

    while (1) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxError ('EOF inside \\ifdim');
	if (!tok.iscat (C_SPACE))
	    break;
    }

    var val2 = engine.scan_dimen (), result;
    engine.done_parsing_if_condition ();

    if (tok.isotherchar (O_LESS))
	result = (val1.sp.value < val2.sp.value);
    else if (tok.isotherchar (O_GREATER))
	result = (val1.sp.value > val2.sp.value);
    else if (tok.isotherchar (O_EQUALS))
	result = (val1.sp.value == val2.sp.value);
    else
	throw new TexSyntaxError ('expected <,=,> in \\ifdim but got ' + tok);

    engine.trace (['ifdim', val1, tok, val2, '?'].join (' '));
    engine.handle_if (result);
};


commands.iffalse = function cmd_iffalse (engine) {
    engine.trace ('iffalse');
    engine.handle_if (false);
};


commands.iftrue = function cmd_iftrue (engine) {
    engine.trace ('iftrue');
    engine.handle_if (true);
};


commands.ifcase = function cmd_ifcase (engine) {
    engine.start_parsing_if_condition ();
    var val = engine.scan_int ().value;
    engine.done_parsing_if_condition ();
    engine.trace ('ifcase ' + val);
    engine.handle_if_case (val);
};


commands._else = function cmd_else (engine) {
    engine.trace ('else [non-eaten]');
    engine.handle_else ();
};


commands.or = function cmd_or (engine) {
    engine.trace ('or [non-eaten]');
    engine.handle_or ();
};


commands.fi = function cmd_fi (engine) {
    engine.trace ('fi [non-eaten]');
    engine.handle_fi ();
};


commands.ifhmode = function cmd_ifhmode (engine) {
    engine.trace ('ifhmode');
    engine.handle_if (engine.mode () == M_HORZ || engine.mode () == M_RHORZ);
};


commands.ifvmode = function cmd_ifvmode (engine) {
    engine.trace ('ifvmode');
    engine.handle_if (engine.mode () == M_VERT || engine.mode () == M_IVERT);
};


commands.ifmmode = function cmd_ifmmode (engine) {
    engine.trace ('ifmmode');
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
	engine.handle_vbox ();
    };

    return VboxCommand;
})();


commands.wd = (function WdCommand_closure () {
    function WdCommand () { Command.call (this); }
    inherit (WdCommand, Command);
    var proto = WdCommand.prototype;
    proto.name = 'wd';

    proto.invoke = function WdCommand_invoke (engine) {
	throw new TexInternalError ('not implemented bare \\wd');
    };

    proto.get_valtype = function WdCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function WdCommand_as_valref (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOXLIST, reg);
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
	throw new TexInternalError ('not implemented bare \\ht');
    };

    proto.get_valtype = function HtCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function HtCommand_as_valref (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.get_register (T_BOXLIST, reg);
	return new ConstantValref (T_DIMEN, box.height);
    };

    return HtCommand;
})();


commands.setbox = function cmd_setbox (engine) {
    var reg = engine.scan_char_code ();
    engine.scan_optional_equals ();
    engine.trace ('setbox: queue #' + reg + ' = ...');
    engine.handle_setbox (reg);
};


commands.vrule = function cmd_vrule (engine) {
    if (engine.mode() != M_HORZ && engine.mode() != M_RHORZ)
	throw new TexRuntimeError ('can only create \\vrule in horizontal mode');

    var rule = new Box (BT_RULE);
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

    engine.trace ('vrule ' + rule);
    return rule;
};


commands.unhbox = function cmd_unhbox (engine) {
    engine.ensure_horizontal ();
    var reg = engine.scan_char_code ();
    var box = engine.get_register (T_BOXLIST, reg);

    if (!box.tlist.length)
	return

    throw new TexInternalError ('see TeXbook pg. 285');
};


commands.hfil = function cmd_hfil (engine) {
    engine.ensure_horizontal ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (1, 0);
    g.stretch_order = 1;
    return g;
};

commands.hfill = function cmd_hfill (engine) {
    engine.ensure_horizontal ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (1, 0);
    g.stretch_order = 2;
    return g;
};

commands.hss = function cmd_hss (engine) {
    engine.ensure_horizontal ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (1, 0);
    g.stretch_order = 1;
    g.shrink.sp = Scaled.new_from_parts (1, 0);
    g.shrink_order = 1;
    return g;
};

commands.hfilneg = function cmd_hfilneg (engine) {
    engine.ensure_horizontal ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (-1, 0);
    g.stretch_order = 1;
    return g;
};

commands.hskip = function cmd_hskip (engine) {
    engine.ensure_horizontal ();
    return engine.scan_glue (false);
};


commands.vfil = function cmd_vfil (engine) {
    engine.ensure_vertical ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (1, 0);
    g.stretch_order = 1;
    return g;
};


commands.vfill = function cmd_vfill (engine) {
    engine.ensure_vertical ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (1, 0);
    g.stretch_order = 2;
    return g;
};


commands.vss = function cmd_vss (engine) {
    engine.ensure_vertical ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (1, 0);
    g.stretch_order = 1;
    g.shrink.sp = Scaled.new_from_parts (1, 0);
    g.shrink_order = 1;
    return g;
};

commands.vfilneg = function cmd_vfilneg (engine) {
    engine.ensure_vertical ();
    var g = new Glue ();
    g.stretch.sp = Scaled.new_from_parts (-1, 0);
    g.stretch_order = 1;
    return g;
};

commands.vskip = function cmd_vskip (engine) {
    engine.ensure_vertical ();
    return engine.scan_glue (false);
};


// "Special registers"
//
// ints: \prevgraf, \deadcycles, \insertpenalties, \inputlineno, \badness,
// \parshape. In horizontal mode, also \spacefactor.
//
// dimens: \pagetotal, \pagegoal, \pagestretch, \pagefilstretch,
// \pagefillstretch, \pagefilllstretch, \pageshrink, \pagedepth. In vertical
// mode, also \prevdepth.

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
		throw new TexRuntimeError ('illegal font size ' + s);
	} else if (engine.scan_keyword ('scaled')) {
	    s = -engine.scan_int ().value;
	    if (s >= 0 || s < -32768)
		throw new TexRuntimeError ('illegal font magnification factor ' + (-s));
	}

	var font = new Font (fn, s);
	var cmd = new GivenFontCommand (font);
	engine.trace ('font ' + cstok + ' = ' + font);
	cstok.assign_cmd (engine, cmd);
    };

    proto.get_valtype = function FontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function FontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, engine.get_font ('<current>'));
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
	engine.trace ('activate null font');
	engine.set_font ('<current>', engine.get_font ('<null>'));
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
	var num = engine.scan_int ();
	var tok = engine.next_tok_throw ();
	var font = tok.tocmd (engine).as_valref (engine);

	if (font.valtype != T_FONT)
	    throw new TexRuntimeError ('expected \\fontdimen to be followed ' +
				       'by a font; got ' + tok);

	engine.scan_optional_equals ();
	var val = engine.scan_dimen ();
	engine.trace (['fontdimen', font, num, '=', val].join (' '));
	font.get (engine).dimens[num] = val;
    };

    proto.get_valtype = function FontDimenCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function FontDimenCommand_as_valref (engine) {
	var num = engine.scan_int ();
	var tok = engine.next_tok_throw ();
	var font = tok.tocmd (engine).as_valref (engine);

	if (font.valtype != T_FONT)
	    throw new TexRuntimeError ('expected \\fontdimen to be followed ' +
				       'by a font; got ' + tok);

	var val = font.get (engine).dimens[num];
	if (val == null) {
	    engine.warn ('making up fontdimen for ' + font + ' ' + num);
	    val = new Dimen ();
	    val.sp = Scaled.new_from_parts (12, 0);
	}

	// FIXME: should be settable.
	return new ConstantValref (T_DIMEN, val);
    };

    return FontDimenCommand;
})();


commands.skewchar = function cmd_skewchar (engine) {
    var tok = engine.next_tok_throw ();
    var val = tok.tocmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\skewchar to be followed by a font; ' +
				   'got ' + tok);

    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.trace (['skewchar', val.get (engine), '=', escchr (ord)].join (' '));
    engine.maybe_insert_after_assign_token ();
};


commands.hyphenchar = function cmd_hyphenchar (engine) {
    var tok = engine.next_tok_throw ();
    var val = tok.tocmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\hyphenchar to be followed by a font; ' +
				   'got ' + tok);

    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.trace (['hyphenchar', val.get (engine), '=', escchr (ord), '[noop]'].join (' '));
    engine.maybe_insert_after_assign_token ();
};


function _def_family (engine, fam) {
    var slot = engine.scan_int_4bit ();
    engine.scan_optional_equals ();
    var tok = engine.next_tok_throw ();
    var val = tok.tocmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\' + fam + ' to assign a font; ' +
				   'got ' +tok);

    engine.trace (['fam', slot, '=', val.get (engine), '[noop]'].join (' '));
    engine.maybe_insert_after_assign_token ();
};


commands.textfont = function cmd_textfont (engine) {
    return _def_family (engine, 'textfont');
};

commands.scriptfont = function cmd_scriptfont (engine) {
    return _def_family (engine, 'scriptfont');
};

commands.scriptscriptfont = function cmd_scriptscriptfont (engine) {
    return _def_family (engine, 'scriptscriptfont');
};


// Hyphenation

commands.patterns = function cmd_patterns (engine) {
    var tok = engine.next_tok_throw ();
    if (tok == null)
	throw new TexSyntaxError ('EOF in middle of \\patterns');
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxError ('expected { immediately after \\patterns');

    engine.scan_tok_group (false);
    engine.trace ('patterns [noop/ignored]');
};


commands.hyphenation = function cmd_hyphenation (engine) {
    var tok = engine.next_tok_throw ();
    if (tok == null)
	throw new TexSyntaxError ('EOF in middle of \\hyphenation');
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxError ('expected { immediately after \\hyphenation');

    engine.scan_tok_group (false);
    engine.trace ('hyphenation [noop/ignored]');
};


// Miscellaneous text manipulation

function _change_case (engine, isupper) {
    if (isupper)
	var cmdname = 'uppercase', codetype = CT_UPPERCASE;
    else
	var cmdname = 'lowercase', codetype = CT_LOWERCASE;

    var tok = engine.next_tok_throw ();
    if (tok == null)
	throw new TexSyntaxError ('EOF in middle of \\' + cmdname);
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxError ('expected { immediately after \\' + cmdname);

    var oldtoks = engine.scan_tok_group (false).toks, newtoks = [];

    for (var i = 0; i < oldtoks.length; i++) {
	var tok = oldtoks[i];

	if (tok.ischar ()) {
	    var neword = engine.get_code (codetype, tok.ord);
	    if (neword == 0)
		neword = tok.ord;
	    newtoks.push (Token.new_char (tok.catcode, neword));
	} else
	    newtoks.push (tok);
    }

    engine.trace ([cmdname, '~' + new Toklist (oldtoks), '->',
		   '~' + new Toklist (newtoks)].join (' '));
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

    var tok = engine.next_tok_throw ();
    var val = tok.tocmd (engine).as_valref (engine);
    if (val == null)
	throw new TexRuntimeError ('unable to get internal value (for ' +
				   '\\the) from ' + tok);

    if (val.valtype == T_TOKLIST) {
	var toks = val.get (engine);
	engine.trace ('the (toks) ' + tok + ' -> ' + toks);
	engine.push_toks (toks);
	return;
    }

    var expn = val.get (engine).to_texstr ();
    engine.trace ('the ' + tok + ' -> ' + expn);
    engine.push_string (expn);
};


commands.meaning = function cmd_meaning (engine) {
    var tok = engine.next_tok_throw ();
    var expn = tok.tocmd (engine).texmeaning (engine);
    engine.trace (['meaning', tok, '->', expn].join (' '));
    engine.push_string (expn);
};


commands.jobname = function cmd_jobname (engine) {
    engine.trace ('jobname -> ' + engine.jobname);
    engine.push_string (engine.jobname);
};


// User interaction, I/O

commands.message = function cmd_message (engine) {
    var tok = engine.next_tok_throw ();

    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxError ('expected { immediately after \\message');

    var toks = engine.scan_tok_group ();
    engine.trace ('message ' + toks.uitext ());
};


commands.errmessage = function cmd_errmessage (engine) {
    var tok = engine.next_tok_throw ();

    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxError ('expected { immediately after \\errmessage');

    var toks = engine.scan_tok_group ();
    engine.trace ('errmessage ~' + toks.uitext ());
    throw new TexRuntimeError ('TeX-triggered error: ' + toks.uitext ());
};


commands.immediate = function cmd_immediate (engine) {
    /* This causes a following \openout, \write, or \closeout to take effect
     * immediately, rather than waiting until page shipout. I suspect that I'll
     * need to distinguish these eventually, but for now, this is a noop. */
    engine.trace ('immediate');
};


commands.write = function cmd_write (engine) {
    var streamnum = engine.scan_streamnum (), tok = engine.next_tok_throw ();
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxError ('expected { immediately after \\write');

    var toks = engine.scan_tok_group (false);
    engine.trace ('write:' + streamnum + ' ' + toks.uitext ());
};


commands.input = function cmd_input (engine) {
    var fn = engine.scan_file_name ();
    engine.trace ('input ' + fn);
    engine.handle_input (fn);
};


commands.endinput = function cmd_endinput (engine) {
    engine.trace ('endinput');
    engine.handle_endinput ();
};


commands.openout = function cmd_openout (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();
    engine.trace ('openout ' + snum + ' = ' + fn + ' [noop]');
};


commands.closeout = function cmd_closeout (engine) {
    var snum = engine.scan_streamnum ();
    engine.trace ('closeout ' + snum + ' [noop]');
};


commands.openin = function cmd_openin (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();

    if (snum == 16)
	throw new TexRuntimeError ('attempted terminal input');

    engine.set_infile (snum, null);

    engine.trace ('openin ' + snum + ' = ' + fn);
    var lb = engine.bundle.try_open_linebuffer (fn);
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

    engine.trace ('ifeof ' + snum + ' -> ' + result);
    engine.handle_if (result);
};


// High-level miscellany

commands.dump = function cmd_dump (engine) {
    engine.trace ('dump');
};

commands.batchmode = function cmd_batchmode (engine) {
    engine.trace ('batchmode');
};

commands.errorstopmode = function cmd_errorstopmode (engine) {
    engine.trace ('errorstopmode');
};

commands.nonstopmode = function cmd_nonstopmode (engine) {
    engine.trace ('nonstopmode');
};

commands.scrollmode = function cmd_scrollmode (engine) {
    engine.trace ('scrollmode');
};
