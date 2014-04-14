'use strict;'

var commands = WEBTEX.commands = {};

commands.par = function cmd_par (engine) {
    engine.debug ('par');
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
	return ConstantIntValue (new TexInt (engine.catcode (ord)));
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
	return ConstantIntValue (new TexInt (engine.mathcode (ord)));
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
	return ConstantIntValue (new TexInt (engine.sfcode (ord)));
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
	return ConstantIntValue (new TexInt (engine.lccode (ord)));
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
	return ConstantIntValue (new TexInt (engine.uccode (ord)));
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
	return ConstantIntValue (new TexInt (engine.delcode (ord)));
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
	var tok = engine.next_tok ();
	if (tok == null)
	    throw new TexSyntaxError ('EOF in middle of \\' + cname + ' command');

	if (expand_replacement) {
	    // We can't just use next_x_tok because \the{toklist} is
	    // not supposed to be sub-expanded (TeXBook p. 216). Yargh.
	    if (tok.iscmd (engine, 'the')) {
		var next = engine.next_tok ();
		var nv = next.tocmd (engine).asvalue (engine);
		if (nv instanceof ToksValue) {
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
