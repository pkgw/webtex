'use strict;'

var commands = WEBTEX.commands = {};

commands.par = function cmd_par (engine) {
    engine.debug ('par');
};


// Language infrastructure

commands.relax = function cmd_relax (engine) {
    engine.debug ('relax');
};


commands.expandafter = function cmd_expandafter (engine) {
    var tok1 = engine.next_tok ();
    if (tok1 == null)
	throw new TexSyntaxException ('EOF inside \\expandafter (1)');

    // Note that we can't use next_x_tok () here since we can end up
    // double-expanding what comes next in \expandafter A \expandafter B ...

    var tok2 = engine.next_tok ();
    if (tok2 == null)
	throw new TexSyntaxException ('EOF inside \\expandafter (2)');

    engine.debug ('*expandafter ' + tok1 + '|' + tok2 + ' ...');

    var cmd2 = tok2.tocmd (engine);
    if (cmd2.expandable)
	cmd2.invoke (engine)
    else
	engine.push (tok2)

    engine.push (tok1);
};


commands.noexpand = function cmd_noexpand (engine) {
    throw new TexInternalException ('\\noexpand shouldn\'t get evaluated');
};


commands.endcsname = function cmd_endcsname (engine) {
    throw new TexRuntimeException ('stray \\endcsname');
};


commands.csname = function cmd_csname (engine) {
    var csname = '';

    while (true) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxException ('EOF in \\csname');
	if (tok.iscmd (engine, 'endcsname'))
	    break;
	if (!tok.ischar ())
	    throw new TexRuntimeException ('only character tokens should occur ' +
					   'between \\csname and \\endcsname');

	csname += String.fromCharCode (tok.ord);
    }

    var tok = Token.new_cseq (csname);
    engine.debug ('* \\csname...\\endcsname -> ' + tok);
    engine.push (tok);

    if (engine.cseq (csname) == null)
	tok.assign_cmd (engine, engine.commands['relax']);
};


function insert_str (engine, expn) {
    for (var i = expn.length - 1; i >= 0; i--) { // T:TP sec 464
	if (expn[i] == ' ')
	    engine.push (Token.new_char (C_SPACE, O_SPACE));
	else
	    engine.push (Token.new_char (C_OTHER, expn.charCodeAt (i)));
    }
}


commands.string = function cmd_string (engine) {
    var tok = engine.next_tok ();
    engine.debug ('* \\string ' + tok);

    if (tok.ischar ()) {
	engine.push (tok); // keep catcode
	return;
    }

    if (tok.iscslike ()) { // active chars were handled above
	var expn = tok.name, esc = engine.intpar ('escapechar');
	if (esc >= 0 && esc < 256)
	    expn = String.fromCharCode (esc) + expn;
    } else
	throw new TexRuntimeException ('don\'t know how to stringify ' + tok);

    insert_str (engine, expn);
};


commands.number = function cmd_number (engine) {
    var val = engine.scan_int ().value;
    engine.debug ('* number ' + val);
    insert_str (engine, '' + val);
};


// Register access: \count, etc.

commands.count = (function CountCommand_closure () {
    function CountCommand () { Command.call (this); }
    inherit (CountCommand, Command);
    var proto = CountCommand.prototype;
    proto.name = 'count';

    proto.invoke = function CountCommand_invoke (engine) {
	var reg = engine.scan_char_code ();
	return new GivenCountCommand (reg).invoke (engine);
    };

    proto.asvalue = function CountCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	return new IntRegValue (reg);
    };

    return CountCommand;
})();


commands.dimen = (function DimenCommand_closure () {
    function DimenCommand () { Command.call (this); }
    inherit (DimenCommand, Command);
    var proto = DimenCommand.prototype;
    proto.name = 'dimen';

    proto.invoke = function DimenCommand_invoke (engine) {
	var reg = engine.scan_char_code ();
	return new GivenDimenCommand (reg).invoke (engine);
    };

    proto.asvalue = function DimenCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	return new DimenRegValue (reg);
    };

    return DimenCommand;
})();


commands.skip = (function SkipCommand_closure () {
    function SkipCommand () { Command.call (this); }
    inherit (SkipCommand, Command);
    var proto = SkipCommand.prototype;
    proto.name = 'skip';

    proto.invoke = function SkipCommand_invoke (engine) {
	var reg = engine.scan_char_code ();
	// Note TeX's inconsistent "glue"/"skip" terminology
	return new GivenGlueCommand (reg).invoke (engine);
    };

    proto.asvalue = function SkipCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	return new GlueRegValue (reg);
    };

    return SkipCommand;
})();


commands.muskip = (function MuskipCommand_closure () {
    function MuskipCommand () { Command.call (this); }
    inherit (MuskipCommand, Command);
    var proto = MuskipCommand.prototype;
    proto.name = 'muskip';

    proto.invoke = function MuskipCommand_invoke (engine) {
	var reg = engine.scan_char_code ();
	// Note TeX's inconsistent "glue"/"skip" terminology
	return new GivenMuglueCommand (reg).invoke (engine);
    };

    proto.asvalue = function MuskipCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	return new MuGlueRegValue (reg);
    };

    return MuskipCommand;
})();


commands.toks = (function ToksCommand_closure () {
    function ToksCommand () { Command.call (this); }
    inherit (ToksCommand, Command);
    var proto = ToksCommand.prototype;
    proto.name = 'toks';

    proto.invoke = function ToksCommand_invoke (engine) {
	var reg = engine.scan_char_code ();
	return new GivenToksCommand (reg).invoke (engine);
    };

    proto.asvalue = function ToksCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	return new ToksRegValue (reg);
    };

    return ToksCommand;
})();


// Register manipulation: \advance, etc.

commands.advance = function cmd_advance (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.tocmd (engine);
    var val = cmd.asvalue (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var delta = val.scan (engine);
    engine.debug ('advance ' + cmd + ' = ' + cur + ' + ' + delta);
    val.set (engine, cur.advance (delta));
};


commands.divide = function cmd_divide (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.tocmd (engine);
    var val = cmd.asvalue (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var denom = engine.scan_int ();
    engine.debug ('divide ' + cmd + ' = ' + cur + ' / ' + denom);
    val.set (engine, cur.intdivide (denom));
};


commands.multiply = function cmd_multiply (engine) {
    var tok = engine.next_x_tok ();
    var cmd = tok.tocmd (engine);
    var val = cmd.asvalue (engine); // might eat tokens
    engine.scan_keyword ('by');
    var cur = val.get (engine);
    var factor = engine.scan_int ();
    engine.debug ('multiply ' + cmd + ' = ' + cur + ' * ' + factor);
    val.set (engine, cur.intproduct (factor));
};


// Setting categories: \catcode, \mathcode, etc.

commands.catcode = (function CatcodeCommand_closure () {
    function CatcodeCommand () { Command.call (this); }
    inherit (CatcodeCommand, Command);
    var proto = CatcodeCommand.prototype;

    proto.invoke = function CatcodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var ccode = engine.scan_int_4bit ();
	engine.debug ('catcode ' + escchr (ord) + '=' + ord + ' -> '
		      + ccode + '=' + cc_abbrev[ccode]);
	engine.set_catcode (ord, ccode);
    };

    proto.asvalue = function CatcodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantIntValue (new TexInt (engine.catcode (ord)));
    };

    return CatcodeCommand;
})();


commands.mathcode = (function MathcodeCommand_closure () {
    function MathcodeCommand () { Command.call (this); }
    inherit (MathcodeCommand, Command);
    var proto = MathcodeCommand.prototype;

    proto.invoke = function MathcodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var mcode = engine.scan_int ().value;
	if (mcode > 0x8000)
	    throw new TexRuntimeException ('mathcode value should be in range ' +
					   '[0,0x8000]; got ' + mcode);
	engine.debug ('mathcode ' + escchr (ord) + '=' + ord + ' -> '
		      + mcode);
	engine.set_mathcode (ord, mcode);
    };

    proto.asvalue = function MathcodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantIntValue (new TexInt (engine.mathcode (ord)));
    };

    return MathcodeCommand;
})();


commands.sfcode = (function SfcodeCommand_closure () {
    function SfcodeCommand () { Command.call (this); }
    inherit (SfcodeCommand, Command);
    var proto = SfcodeCommand.prototype;

    proto.invoke = function SfcodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var sfcode = engine.scan_int ().value;
	if (sfcode > 0x7FFF)
	    throw new TexRuntimeException ('sfcode value should be in range ' +
					   '[0,0x7FFF]; got ' + sfcode);
	engine.debug ('sfcode ' + escchr (ord) + '=' + ord + ' -> '
		      + sfcode);
	engine.set_sfcode (ord, sfcode);
    };

    proto.asvalue = function SfcodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantIntValue (new TexInt (engine.sfcode (ord)));
    };

    return SfcodeCommand;
})();


commands.lccode = (function LccodeCommand_closure () {
    function LccodeCommand () { Command.call (this); }
    inherit (LccodeCommand, Command);
    var proto = LccodeCommand.prototype;

    proto.invoke = function LccodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var lccode = engine.scan_char_code ();
	engine.debug ('lccode ' + escchr (ord) + '=' + ord + ' -> '
		      + escchr (lccode) + '=' + lccode);
	engine.set_lccode (ord, lccode);
    };

    proto.asvalue = function LccodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantIntValue (new TexInt (engine.lccode (ord)));
    };

    return LccodeCommand;
})();


commands.uccode = (function UccodeCommand_closure () {
    function UccodeCommand () { Command.call (this); }
    inherit (UccodeCommand, Command);
    var proto = UccodeCommand.prototype;

    proto.invoke = function UccodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var uccode = engine.scan_char_code ();
	engine.debug ('uccode ' + escchr (ord) + '=' + ord + ' -> '
		      + escchr (uccode) + '=' + uccode);
	engine.set_uccode (ord, uccode);
    };

    proto.asvalue = function UccodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantIntValue (new TexInt (engine.uccode (ord)));
    };

    return UccodeCommand;
})();


commands.delcode = (function DelcodeCommand_closure () {
    function DelcodeCommand () { Command.call (this); }
    inherit (DelcodeCommand, Command);
    var proto = DelcodeCommand.prototype;

    proto.invoke = function DelcodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var delcode = engine.scan_int ().value;
	if (delcode >0xFFFFFF)
	    throw new TexRuntimeException ('delcode value should be in range ' +
					   '[0,0xFFFFFF]; got ' + delcode);
	engine.debug ('delcode ' + escchr (ord) + '=' + ord + ' -> '
		      + escchr (delcode) + '=' + delcode);
	engine.set_delcode (ord, delcode);
    };

    proto.asvalue = function DelcodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return new ConstantIntValue (new TexInt (engine.delcode (ord)));
    };

    return DelcodeCommand;
})();


// \chardef, \mathchardef, etc.

commands.chardef = function cmd_chardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.debug ('chardef ' + cstok + ' -> {inschar ' + escchr (ord) +
		  '=' + ord + '}');
    cstok.assign_cmd (engine, new GivenCharCommand (ord));
};


commands.mathchardef = function cmd_mathchardef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var val = engine.scan_int ().value;
    if (val < 0 || val > 32768)
	throw new TexRuntimeException ('need mathcode in [0,0x8000] but ' +
				       'got ' + val);
    engine.debug ('mathchardef ' + cstok + ' -> {insmathchar ' + val + '}');
    cstok.assign_cmd (engine, new GivenMathcharCommand (val));
};


commands.countdef = function cmd_countdef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var reg = engine.scan_register_num ();
    engine.debug ('countdef ' + cstok + ' -> {\\count' + reg + '}');
    cstok.assign_cmd (engine, new GivenCountCommand (reg));
};


commands.dimendef = function cmd_dimendef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var reg = engine.scan_register_num ();
    engine.debug ('dimendef ' + cstok + ' -> {\\dimen' + reg + '}');
    cstok.assign_cmd (engine, new GivenDimenCommand (reg));
};


commands.skipdef = function cmd_skipdef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var reg = engine.scan_register_num ();
    engine.debug ('skipdef ' + cstok + ' -> {\\skip' + reg + '}');
    cstok.assign_cmd (engine, new GivenGlueCommand (reg));
};


commands.toksdef = function cmd_toksdef (engine) {
    var cstok = engine.scan_r_token ();
    engine.scan_optional_equals ();
    var reg = engine.scan_register_num ();
    engine.debug ('toksdef ' + cstok + ' -> {\\toks' + reg + '}');
    cstok.assign_cmd (engine, new GivenToksCommand (reg));
};


// Non-specific definition infrastructure

commands.global = function cmd_global (engine) {
    engine.debug ('global');
    engine.set_global_assign_mode ();
};

commands.outer = function cmd_outer (engine) {
    // I think it's OK to make this a noop.
    engine.debug ('outer');
};

commands._long = function cmd_long (engine) {
    // I think it's OK to make this a noop.
    engine.debug ('long');
};

commands._let = function cmd_let (engine) {
    var cstok = engine.scan_r_token ();

    // Note that we don't use scan_optional_equals here since it
    // expands things.

    while (true) {
	var tok = engine.next_tok ();
	if (tok == null)
	    throw new TexSyntaxException ('EOF in \\let');
	if (tok.iscat (C_SPACE))
	    continue
	if (tok.isotherchar (O_EQUALS)) {
	    var equiv = engine.next_tok ();
	    if (equiv.iscat (C_SPACE))
		equiv = engine.next_tok ();
	    break;
	}
	var equiv = tok;
	break;
    }

    engine.debug ('let ' + cstok + ' = ' + equiv);
    cstok.assign_cmd (engine, equiv.tocmd (engine));
};


commands.futurelet = function cmd_futurelet (engine) {
    var cstok = engine.scan_r_token ();
    var thenexpand = engine.next_tok ();
    var equiv = engine.next_tok ();
    engine.debug ('futurelet ' + cstok + ' = ' + equiv + '; ' + thenexpand);
    cstok.assign_cmd (engine, equiv.tocmd (engine));
    engine.push (equiv);
    engine.push (thenexpand);
};


function _cmd_def (engine, cname, expand_replacement) {
    var cstok = engine.scan_r_token ();

    var tmpl_toks = [], repl_toks = [], last_was_param = false,
        end_with_lbrace = false, next_pnum = 1;

    while (true) {
	var tok = engine.next_tok ();
	if (tok == null)
	    throw new TexSyntaxException ('EOF in middle of \\' + cname +
					  ' command');

	if (last_was_param) {
	    if (tok.iscat (C_BGROUP)) {
		tmpl_toks.push (tok);
		end_with_lbrace = true;
		break;
	    }

	    if (tok.isotherchar (O_ZERO + next_pnum)) {
		if (next_pnum > 8)
		    throw new TexRuntimeException ('macros may only have 8 parameters');

		tmpl_toks.push (Token.new_param (next_pnum));
		next_pnum += 1;
		last_was_param = false;
		continue;
	    }

	    throw new TexSyntaxException ('unexpected token ' + tok + ' following ' +
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
	var tok = engine.next_tok ();
	if (tok == null)
	    throw new TexSyntaxException ('EOF in middle of \\' + cname + ' command');

	if (expand_replacement) {
	    // We can't just use next_x_tok because \the{toklist} is
	    // not supposed to be sub-expanded (TeXBook p. 216). Yargh.
	    if (tok.iscmd (engine, 'the')) {
		var next = engine.next_tok ();
		var nv = next.tocmd (engine).asvalue (engine);
		if (nv.is_toks_value === true) {
		    repl_toks += nv.get (engine);
		    continue
		} else {
		    engine.push (next);
		}
	    } else if (tok.iscmd (engine, 'noexpand')) {
		repl_toks.push (engine.next_tok ());
		continue;
	    } else if (tok.isexpandable (engine)) {
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

	    throw new TexSyntaxException ('unexpected token ' + tok + ' following ' +
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

    engine.debug ([cname, cstok, '~', '{' + tmpl_toks.join (' ') + '}',
		   '->', '{' + repl_toks.join (' ') + '}'].join (' '));
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

commands.afterassignment = function cmd_afterassignment (engine) {
    var tok = engine.next_tok ();
    engine.set_after_assign_token (tok);
    engine.debug ('afterassignment <- ' + tok);
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
    var t1 = engine.next_x_tok (), t2 = engine.next_x_tok ();

    // The comparison rules here are a bit funky.

    function key (tok) {
	if (tok.ischar ())
	    return tok.catcode * 1000 + tok.ord;
	if (tok.iscslike ()) { // active chars will be caught by above
	    var cmd = tok.tocmd (engine);
	    if (cmd instanceof CharGivenCommand)
		throw new TexInternalException ('not implemented');
	    return 16 * 1000 + 256;
	}
	throw new TexRuntimeException ('illegal comparison subject ' + tok);
    }

    var result = (key (t1) == key (t2));
    engine.debug ('if ' + t1 + ' ~ ' + t2 + ' => ' + result);
    engine.handle_if (result);
};


commands.ifx = function cmd_ifx (engine) {
    var t1 = engine.next_tok (), t2 = engine.next_tok (), result;

    if (t1.kind != t2.kind)
	result = false;
    else if (t1.ischar ())
	result = (t1.ord == t2.ord);
    else {
	var cmd1 = t1.tocmd (engine), cmd2 = t2.tocmd (engine);
	result = cmd1.samecmd (cmd2);
    }

    engine.debug ('ifx ' + t1 + ' ~ ' + t2 + ' => ' + result);
    engine.handle_if (result);
};


commands.ifnum = function cmd_ifnum (engine) {
    var val1 = engine.scan_int ().value;

    while (true) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxException ('EOF inside \\ifnum');
	if (!tok.iscat (C_SPACE))
	    break;
    }

    // It's a little futzy to not check the validity of tok before
    // reading val2.
    var val2 = engine.scan_int ().value, result;

    if (tok.isotherchar (O_LESS))
	result = (val1 < val2);
    else if (tok.isotherchar (O_GREATER))
	result = (val1 > val2);
    else if (tok.isotherchar (O_EQUALS))
	result = (val1 == val2);
    else
	throw new TexSyntaxException ('expected <,=,> in \\ifnum but got ' + tok);

    engine.debug (['ifnum', val1, tok, val2, '?'].join (' '));
    engine.handle_if (result);
};


commands.ifodd = function cmd_ifodd (engine) {
    var val = engine.scan_int ().value;
    var result = (val % 2 == 1);
    engine.debug ('ifodd ' + val + '?');
    engine.handle_if (result);
};


commands.ifdim = function cmd_ifdim (engine) {
    var val1 = engine.scan_dimen ();

    while (1) {
	var tok = engine.next_x_tok ();
	if (tok == null)
	    throw new TexSyntaxException ('EOF inside \\ifdim');
	if (!tok.iscat (C_SPACE))
	    break;
    }

    var val2 = engine.scan_dimen (), result;

    if (tok.isotherchar (O_LESS))
	result = (val1.sp.value < val2.sp.value);
    else if (tok.isotherchar (O_GREATER))
	result = (val1.sp.value > val2.sp.value);
    else if (tok.isotherchar (O_EQUALS))
	result = (val1.sp.value == val2.sp.value);
    else
	throw new TexSyntaxException ('expected <,=,> in \\ifdim but got ' + tok);

    engine.debug (['ifdim', val1, tok, val2, '?'].join (' '));
    engine.handle_if (result);
};


commands.iffalse = function cmd_iffalse (engine) {
    engine.debug ('iffalse');
    engine.handle_if (false);
};


commands.iftrue = function cmd_iftrue (engine) {
    engine.debug ('iftrue');
    engine.handle_if (true);
};


commands.ifcase = function cmd_ifcase (engine) {
    var val = engine.scan_int ().value;
    engine.debug ('ifcase ' + val);
    engine.handle_if_case (val);
};


commands._else = function cmd_else (engine) {
    engine.debug ('else [non-eaten]');
    engine.handle_else ();
};


commands.or = function cmd_or (engine) {
    engine.debug ('or [non-eaten]');
    engine.handle_or ();
};


commands.fi = function cmd_fi (engine) {
    engine.debug ('fi [non-eaten]');
    engine.handle_fi ();
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


commands.wd = (function WdCommand_closure () {
    function WdCommand () { Command.call (this); }
    inherit (WdCommand, Command);
    var proto = WdCommand.prototype;
    proto.name = 'wd';

    proto.invoke = function WdCommand_invoke (engine) {
	throw new TexInternalException ('not implemented bare \\wd');
    };

    proto.asvalue = function WdCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.boxreg (reg);
	return new ConstantDimenValue (box.width);
    };

    return WdCommand;
})();


commands.ht = (function HtCommand_closure () {
    function HtCommand () { Command.call (this); }
    inherit (HtCommand, Command);
    var proto = HtCommand.prototype;
    proto.name = 'ht';

    proto.invoke = function HtCommand_invoke (engine) {
	throw new TexInternalException ('not implemented bare \\ht');
    };

    proto.asvalue = function HtCommand_asvalue (engine) {
	var reg = engine.scan_char_code ();
	var box = engine.boxreg (reg);
	return new ConstantDimenValue (box.height);
    };

    return HtCommand;
})();


commands.setbox = function cmd_setbox (engine) {
    var reg = engine.scan_char_code ();
    engine.scan_optional_equals ();
    engine.debug ('setbox: queue #' + reg + ' = ...');
    engine.handle_setbox (reg);
};


commands.vrule = function cmd_vrule (engine) {
    if (engine.mode() != M_HORZ && engine.mode() != M_RHORZ)
	throw new TexRuntimeException ('can only create \\vrule in horizontal mode');

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

    engine.debug ('vrule ' + rule);
    return rule;
};


commands.unhbox = function cmd_unhbox (engine) {
    engine.ensure_horizontal ();
    var reg = engine.scan_char_code ();
    var box = engine.boxreg (reg);

    if (!box.tlist.length)
	return

    throw new TexInternalException ('see TeXbook pg. 285');
};


// Font

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
		throw new TexRuntimeException ('illegal font size ' + s);
	} else if (engine.scan_keyword ('scaled')) {
	    s = -engine.scan_int ().value;
	    if (s >= 0 || s < -32768)
		throw new TexRuntimeException ('illegal font magnification factor ' + (-s));
	}

	var font = new Font (fn, s);
	var cmd = new GivenFontCommand (font);
	engine.debug ('font ' + cstok + ' = ' + font);
	cstok.assign_cmd (engine, cmd);
    };

    proto.asvalue = function FontCommand_asvalue (engine) {
	return new ConstantFontValue (engine.font ('<current>'));
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
	engine.debug ('activate null font');
	engine.set_font ('<current>', engine.font ('<null>'));
    };

    proto.asvalue = function NullFontCommand_asvalue (engine) {
	return new ConstantFontValue (engine.font ('<null>'));
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
	var tok = engine.next_tok ();
	var font = tok.tocmd (engine).asvalue (engine);

	if (!(font instanceof ConstantFontValue))
	    throw new TexRuntimeException ('expected \\fontdimen to be followed ' +
					   'by a font; got ' + tok);

	engine.scan_optional_equals ();
	var val = engine.scan_dimen ();
	engine.debug (['fontdimen', font, num, '=', val].join (' '));
	font.get (engine).dimens[num] = val;
    };

    proto.asvalue = function FontDimenCommand_asvalue (engine) {
	var num = engine.scan_int ();
	var tok = engine.next_tok ();
	var font = tok.tocmd (engine).asvalue (engine);

	if (!(font instanceof ConstantFontValue))
	    throw new TexRuntimeException ('expected \\fontdimen to be followed ' +
					   'by a font; got ' + tok);

	var val = font.get (engine).dimens[num];
	if (val == null) {
	    engine.warn ('making up fontdimen for ' + font + ' ' + num);
	    val = new Dimen ();
	    val.sp = Scaled.new_from_parts (12, 0);
	}

	// FIXME: should be settable.
	return new ConstantDimenValue (val);
    };

    return FontDimenCommand;
})();


commands.skewchar = function cmd_skewchar (engine) {
    var tok = engine.next_tok ();
    var val = tok.tocmd (engine).asvalue (engine);

    if (!(val instanceof ConstantFontValue))
	throw new TexRuntimeException ('expected \\skewchar to be followed by a font; ' +
				       'got ' + tok);

    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.debug (['skewchar', val.get (engine), '=', escchr (ord)].join (' '));
    engine.maybe_insert_after_assign_token ();
};


commands.hyphenchar = function cmd_hyphenchar (engine) {
    var tok = engine.next_tok ();
    var val = tok.tocmd (engine).asvalue (engine);

    if (!(val instanceof ConstantFontValue))
	throw new TexRuntimeException ('expected \\hyphenchar to be followed by a font; ' +
				       'got ' + tok);

    engine.scan_optional_equals ();
    var ord = engine.scan_char_code ();
    engine.debug (['hyphenchar', val.get (engine), '=', escchr (ord), '[noop]'].join (' '));
    engine.maybe_insert_after_assign_token ();
};


function _def_family (engine, fam) {
    var slot = engine.scan_int_4bit ();
    engine.scan_optional_equals ();
    var tok = engine.next_tok ();
    var val = tok.tocmd (engine).asvalue (engine);

    if (!(val instanceof ConstantFontValue))
	throw new TexRuntimeException ('expected \\' + fam + ' to assign a font; ' +
				       'got ' +tok);

    engine.debug (['fam', slot, '=', val.get (engine), '[noop]'].join (' '));
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
    var tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\patterns');
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxException ('expected { immediately after \\patterns');

    engine.scan_tok_group (false);
    engine.debug ('patterns [noop/ignored]');
};


commands.hyphenation = function cmd_hyphenation (engine) {
    var tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\hyphenation');
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxException ('expected { immediately after \\hyphenation');

    engine.scan_tok_group (false);
    engine.debug ('hyphenation [noop/ignored]');
};


// Miscellaneous text manipulation

function _change_case (engine, isupper) {
    if (isupper)
	var cmdname = 'uppercase', casecode = engine.uccode;
    else
	var cmdname = 'lowercase', casecode = engine.lccode;

    var tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\' + cmdname);
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxException ('expected { immediately after \\' + cmdname);

    var oldtoks = engine.scan_tok_group (false), newtoks = [];

    for (var i = 0; i < oldtoks.length; i++) {
	var tok = oldtoks[i];

	if (tok.ischar ()) {
	    var neword = casecode.call (engine, tok.ord);
	    if (neword == 0)
		neword = tok.ord;
	    newtoks.push (Token.new_char (tok.catcode, neword));
	} else
	    newtoks.push (tok);
    }

    engine.debug ([cmdname, '~' + oldtoks.join (''), '->',
		   '~' + newtoks.join ('')].join (' '));

    while (newtoks.length)
	engine.push (newtoks.pop ());
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

    var tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\the command');

    var val = tok.tocmd (engine).asvalue (engine);
    if (val == null)
	throw new TexRuntimeException ('unable to get internal value (for ' +
				       '\\the) from ' + tok);

    if (val.is_toks_value) {
	var toks = val.get (engine);
	for (var i = toks.length - 1; i >= 0; i--)
	    engine.push (toks[i]);
	engine.debug ('the (toks) ' + tok + ' -> ' + val.stringify (engine, toks));
	return;
    }

    var expn = val.get (engine).to_texstr ();
    engine.debug ('the ' + tok + ' -> ' + expn);
    insert_str (engine, expn);
};


commands.meaning = function cmd_meaning (engine) {
    var tok = engine.next_tok ();
    var expn = tok.tocmd (engine).texmeaning (engine);
    engine.debug (['meaning', tok, '->', expn].join (' '));
    insert_str (engine, expn);
};


commands.jobname = function cmd_jobname (engine) {
    engine.debug ('jobname -> ' + engine.jobname);
    insert_str (engine, engine.jobname);
};


// User interaction, I/O

commands.message = function cmd_message (engine) {
    var tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\message');

    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxException ('expected { immediately after \\message');

    var toks = engine.scan_tok_group ();
    engine.debug ('message ~' +
		  toks.map (function (t) { return t.uitext (); }).join (''));
};


commands.errmessage = function cmd_errmessage (engine) {
    var tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\errmessage');

    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxException ('expected { immediately after \\errmessage');

    var toks = engine.scan_tok_group ();
    text = toks.map (function (t) { return t.uitext (); }).join ('');
    engine.debug ('errmessage ~' + text);
    throw new TexRuntimeException ('TeX-triggered error: ' + text);
};


commands.immediate = function cmd_immediate (engine) {
    /* This causes a following \openout, \write, or \closeout to take effect
     * immediately, rather than waiting until page shipout. I suspect that I'll
     * need to distinguish these eventually, but for now, this is a noop. */
    engine.debug ('immediate');
};


commands.write = function cmd_write (engine) {
    var streamnum = engine.scan_streamnum (), tok = engine.next_tok ();
    if (tok == null)
	throw new TexSyntaxException ('EOF in middle of \\write command');
    if (!tok.iscat (C_BGROUP))
	throw new TexSyntaxException ('expected { immediately after \\write');

    var toks = engine.scan_tok_group (false);
    var s = toks.map (function (t) { t.uitext (); }).join ('');
    engine.debug ('write:' + streamnum + ' ' + s);
};


commands.input = function cmd_input (engine) {
    var fn = engine.scan_file_name ();
    engine.debug ('input ' + fn);
    engine.handle_input (fn);
};


commands.endinput = function cmd_endinput (engine) {
    engine.debug ('endinput');
    engine.handle_endinput ();
};


commands.openout = function cmd_openout (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();
    engine.debug ('openout ' + snum + ' = ' + fn + ' [noop]');
};


commands.closeout = function cmd_closeout (engine) {
    var snum = engine.scan_streamnum ();
    engine.debug ('closeout ' + snum + ' [noop]');
};


commands.openin = function cmd_openin (engine) {
    var snum = engine.scan_streamnum ();
    engine.scan_optional_equals ();
    var fn = engine.scan_file_name ();

    if (snum == 16)
	throw new TexRuntimeException ('attempted terminal input');

    engine.set_infile (snum, null);

    engine.debug ('openin ' + snum + ' = ' + fn);
    var ls = WEBTEX.IOBackend.try_open_linesource (fn);
    if (ls == null)
	// File existence is tested by \openin..\ifeof, so this should
	// be a warning only.
	engine.warn ('failed to \\openin ' + fn);

    engine.set_infile (snum, ls);
};


commands.closein = function cmd_closein (engine) {
    var snum = engine.scan_streamnum ();
    if (snum == 16)
	throw new TexRuntimeException ('attempted close of illegal stream');

    // I think this is all we need ...
    engine.set_infile (snum, null);
};


commands.ifeof = function cmd_ifeof (engine) {
    var snum = engine.scan_streamnum (), result;

    if (snum == 16)
	result = false;
    else
	result = (engine.infile (snum) == null);

    engine.debug ('ifeof ' + snum + ' -> ' + result);
    engine.handle_if (result);
};


// High-level miscellany

commands.dump = function cmd_dump (engine) {
    engine.debug ('dump');
};

commands.batchmode = function cmd_batchmode (engine) {
    engine.debug ('batchmode');
};

commands.errorstopmode = function cmd_errorstopmode (engine) {
    engine.debug ('errorstopmode');
};

commands.nonstopmode = function cmd_nonstopmode (engine) {
    engine.debug ('nonstopmode');
};

commands.scrollmode = function cmd_scrollmode (engine) {
    engine.debug ('scrollmode');
};
