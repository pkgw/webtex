'use strict';

var Command = WEBTEX.Command = (function Command_closure () {
    function Command () {}

    var proto = Command.prototype;
    proto.expandable = false;
    proto.conditional = false;
    proto.boxlike = false;
    proto.assign_flag_mode = AFM_INVALID;
    proto.name = '<unset command name>';

    proto.toString = function Command_toString () {
	return '[' + this.name + ']';
    };

    proto.invoke = function Command_invoke (engine) {
	throw new TexInternalException ('tried to evaluate undefined/' +
					'un-evaluatable command ' + this.name);
    };

    proto.samecmd = function Command_samecmd (other) {
	if (other == null)
	    return false;
	return this.name == other.name;
    };

    proto.asvalue = function Command_asvalue (engine) {
	return null;
    };

    proto.as_int = function Command_as_int (engine) {
	var v = this.asvalue (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_int ();
    };

    proto.as_scaled = function Command_as_scaled (engine) {
	var v = this.asvalue (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_scaled ();
    };

    proto.as_dimen = function Command_as_dimen (engine) {
	var v = this.asvalue (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_dimen ();
    };

    proto.as_glue = function Command_as_glue (engine) {
	var v = this.asvalue (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_glue ();
    };

    proto.texmeaning = function Command_texmeaning (engine) {
	return texchr (engine.intpar ('escapechar')) + this.name;
    };

    return Command;
})();


// The implementations in this file don't get bound to specific
// control sequences by default.

var CommandUnimplPrimitive = (function CommandUnimplPrimitive_closure () {
    function CommandUnimplPrimitive (name) {
	Command.call (this);
	this.name = name;
    }

    inherit (CommandUnimplPrimitive, Command);
    var proto = CommandUnimplPrimitive.prototype;

    proto.invoke = function CommandUnimplPrimitive_invoke (engine) {
	throw new TexRuntimeException ('unimplemented primitive \\' + this.name);
    };

    return CommandUnimplPrimitive;
})();


var UndefinedCommand = (function UndefinedCommand_closure () {
    function UndefinedCommand (name) {
	Command.call (this);
	this.name = name;
    }

    inherit (UndefinedCommand, Command);
    var proto = UndefinedCommand.prototype;

    proto.invoke = function UndefinedCommand_invoke (engine) {
	throw new TexRuntimeException ('trying to invoke undefined command \\' + this.name);
    };

    proto.samecmd = function UndefinedCommand_samecmd (other) {
	if (other == null)
	    return false;
	return (other instanceof UndefinedCommand);
    };

    return UndefinedCommand;
})();


var MacroCommand = (function MacroCommand_closure () {
    function MacroCommand (origcs, tmpl, repl) {
	Command.call (this);
	this.origcs = origcs;
	this.tmpl = tmpl;
	this.repl = repl;
    }

    inherit (MacroCommand, Command);
    var proto = MacroCommand.prototype;
    proto.name = '<macro>';
    proto.expandable = true;

    proto.samecmd = function MacroCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	if (this.tmpl.length != other.tmpl.length)
	    return false;
	if (this.repl.length != other.repl.length)
	    return false;

	for (var i = 0; i < this.tmpl.length; i++)
	    if (!this.tmpl[i].equals (other.tmpl[i]))
		return false;

	for (var i = 0; i < this.repl.length; i++)
	    if (!this.repl[i].equals (other.repl[i]))
		return false;

	return true;
    };

    proto.invoke = function MacroCommand_invoke (engine) {
	if (!this.tmpl.length) {
	    engine.debug ('*macro ' + this.origcs + ' -> {' +
			  this.repl.join (' ') + '}');
	    for (var i = this.repl.length - 1; i >= 0; i--)
		engine.push (this.repl[i]);
	    return;
	}

	var tidx = 0, ntmpl = this.tmpl.length, param_vals = {};

	while (tidx < ntmpl) {
	    var ttok = this.tmpl[tidx];

	    if (!ttok.isparam ()) {
		// span of nonparameter tokens in template -- eat and make
		// sure that the actual token stream matches.
		var atok = engine.next_x_tok ();
		if (!atok.equals (ttok))
		    throw new TexRuntimeException ('macro invocation doesn\'t match ' +
						   'template: expected ' + ttok + ', ' +
						   'got ' + atok);
		tidx += 1;
		continue;
	    }

	    if (tidx == ntmpl - 1 || this.tmpl[tidx+1].isparam ()) {
		// Undelimited parameter. Either a single token, or a group.
		var tok = engine.next_tok ();
		if (tok == null)
		    throw new TexRuntimeException ('EOF in macro expansion');

		if (tok.iscat (C_BGROUP))
		    param_vals[ttok.pnum] = engine.scan_tok_group (false);
		else if (tok.iscmd (engine, '<space>'))
		    // TexBook pg 201: spaces are not used as undelimited args
		    continue;
		else
		    param_vals[ttok.pnum] = [tok];

		tidx += 1;
		continue;
	    }

	    // Delimited parameter -- scan until we match the trailing
	    // non-parameter tokens. Brace stripping is tricky: given
	    // X#1Y -> #1,
	    //  XabY     -> ab, and
	    //  X{ab}Y   -> ab, but
	    //  X{a}{b}Y -> {a}{b}, since otherwise you'd get "a}{b".

	    var expansion = [], match_start = tidx + 1, match_end = tidx + 2;

	    while (match_end < ntmpl && !this.tmpl[match_end].isparam ())
		match_end += 1;

	    var n_to_match = match_end - match_start, cur_match_idx = 0, depth = 0;

	    while (cur_match_idx < n_to_match) {
		var tok = engine.next_tok ();
		if (tok == null)
		    throw new TexRuntimeException ('EOF processing macro parameters');

		if (depth > 0) {
		    if (tok.iscat (C_BGROUP))
			depth += 1;
		    else if (tok.iscat (C_EGROUP))
			depth -= 1;
		    expansion.push (tok);
		    continue;
		}

		if (tok.equals (this.tmpl[match_start + cur_match_idx])) {
		    // We're making progress on matching the delimeters.
		    cur_match_idx += 1;
		    continue;
		}

		// We're not matching the template. Accumulate into the expansion.
		for (var i = 0; i < cur_match_idx; i++)
		    // If we were making progress on a match, those tokens
		    // weren't getting recorded into the expansion. Rectify
		    // that.
		    expansion.push (this.tmpl[match_start + i]);

		cur_match_idx = 0;
		expansion.push (tok);
	    }

	    if (expansion.length > 1 && expansion[0].iscat (C_BGROUP) &&
		expansion[expansion.length - 1].iscat (C_EGROUP)) {
		// Check if we can strip off these braces.
		var canstrip = true, depth = 1;

		for (var i = 1; i < expansion.length - 1; i++) {
		    var tok = expansion[i];
		    if (tok.iscat (C_BGROUP))
			depth += 1;
		    else if (tok.iscat (C_EGROUP)) {
			depth -= 1;
			if (depth == 0) {
			    canstrip = false;
			    break;
			}
		    }
		}

		if (canstrip)
		    expansion = expansion.slice (1, expansion.length - 1);
	    }

	    param_vals[ttok.pnum] = expansion // note: don't update ttok!
	    tidx = match_end;
	}

	// OK, we've finally accumulated all of the parameter values! We
	// can now insert the replacement.

	var fullrepl = [];

	for (var i = this.repl.length - 1; i >= 0; i--) {
	    var rtok = this.repl[i];

	    if (!rtok.isparam ()) {
		engine.push (rtok);
		fullrepl.push (rtok);
	    } else {
		var ptoks = param_vals[rtok.pnum];
		for (var j = ptoks.length - 1; j >= 0; j--) {
		    engine.push (ptoks[j]);
		    fullrepl.push (ptoks[j]);
		}
	    }
	}

	engine.debug ('*macro ' + this.origcs + ' ...');
	for (var i = 1; i < 9; i++)
	    if (param_vals.hasOwnProperty (i))
		engine.debug ('   #' + i + ' = {' + param_vals[i].join (' ') + '}');
	fullrepl = fullrepl.reverse ();
	engine.debug (' -> {' + fullrepl.join (' ') + '}');
    };

    proto.texmeaning = function MacroCommand_texmeaning (engine) {
	var s = 'macro:';
	function tt (t) {return t.textext (engine, true); }
	s += [].map.call (this.tmpl, tt).join ('');
	s += '->';
	s += [].map.call (this.repl, tt).join ('');
	return s;
    };

    return MacroCommand;
})();


// Commands corresponding to character tokens.

var CharacterCommand = (function CharacterCommand_closure () {
    function CharacterCommand (ord) {
	Command.call (this);
	this.ord = ord;
    }

    inherit (CharacterCommand, Command);
    var proto = CharacterCommand.prototype;

    proto.desc = 'undescribed command';

    proto.samecmd = function CharacterCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.ord == other.ord;
    };

    proto.texmeaning = function CharacterCommand_texmeaning (engine) {
	return this.desc + ' ' + texchr (this.ord);
    };

    return CharacterCommand;
})();


var BeginGroupCommand = (function BeginGroupCommand_closure () {
    function BeginGroupCommand (ord) {
	CharacterCommand.call (this, ord);

    }

    inherit (BeginGroupCommand, CharacterCommand);
    var proto = BeginGroupCommand.prototype;

    proto.name = '<begin-group>';
    proto.desc = 'begin-group character';

    proto.invoke = function BeginGroupCommand_invoke (engine) {
	return engine.handle_bgroup ();
    };

    return BeginGroupCommand;
})();


var EndGroupCommand = (function EndGroupCommand_closure () {
    function EndGroupCommand (ord) {
	CharacterCommand.call (this, ord);

    }

    inherit (EndGroupCommand, CharacterCommand);
    var proto = EndGroupCommand.prototype;

    proto.name = '<end-group>';
    proto.desc = 'end-group character';

    proto.invoke = function EndGroupCommand_invoke (engine) {
	return engine.handle_egroup ();
    };

    return EndGroupCommand;
})();


var MathShiftCommand = (function MathShiftCommand_closure () {
    function MathShiftCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (MathShiftCommand, CharacterCommand);
    var proto = MathShiftCommand.prototype;

    proto.name = '<math-shift>';
    proto.desc = 'math shift character';

    return MathShiftCommand;
})();


var AlignTabCommand = (function AlignTabCommand_closure () {
    function AlignTabCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (AlignTabCommand, CharacterCommand);
    var proto = AlignTabCommand.prototype;

    proto.name = '<align-tab>';
    proto.desc = 'alignment tab character';

    return AlignTabCommand;
})();


var MacroParameterCommand = (function MacroParameterCommand_closure () {
    function MacroParameterCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (MacroParameterCommand, CharacterCommand);
    var proto = MacroParameterCommand.prototype;

    proto.name = '<macro-parameter>';
    proto.desc = 'macro parameter character';

    return MacroParameterCommand;
})();


var SuperCommand = (function SuperCommand_closure () {
    function SuperCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (SuperCommand, CharacterCommand);
    var proto = SuperCommand.prototype;

    proto.name = '<superscript>';
    proto.desc = 'superscript character';

    return SuperCommand;
})();


var SubCommand = (function SubCommand_closure () {
    function SubCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (SubCommand, CharacterCommand);
    var proto = SubCommand.prototype;

    proto.name = '<subscript>';
    proto.desc = 'subscript character';

    return SubCommand;
})();


var SpacerCommand = (function SpacerCommand_closure () {
    function SpacerCommand (ord) {
	// Note that ord is overridden!
	CharacterCommand.call (this, O_SPACE);
    }

    inherit (SpacerCommand, CharacterCommand);
    var proto = SpacerCommand.prototype;

    proto.name = '<space>';
    proto.desc = 'blank space';

    proto.invoke = function Spacer_invoke (engine) {
	if (engine.mode == M_VERT || engine.mode == M_IVERT)
	    engine.debug ('spacer: ignored, vertical model');
	else
	    engine.debug ('spacer ...');
    };

    return SpacerCommand;
})();


var InsertLetterCommand = (function InsertLetterCommand_closure () {
    function InsertLetterCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (InsertLetterCommand, CharacterCommand);
    var proto = InsertLetterCommand.prototype;

    proto.name = '<insert-letter>';
    proto.desc = 'the letter';

    proto.invoke = function InsertLetter_invoke (engine) {
	engine.ensure_horizontal ();
	engine.debug ('accum letter ' + escchr (this.ord));
	engine.mode_accum (this.ord);
    };

    return InsertLetterCommand;
})();


var InsertOtherCommand = (function InsertOtherCommand_closure () {
    function InsertOtherCommand (ord) {
	CharacterCommand.call (this, ord);
    }

    inherit (InsertOtherCommand, CharacterCommand);
    var proto = InsertOtherCommand.prototype;

    proto.name = '<insert-other>';
    proto.desc = 'the character';

    proto.invoke = function InsertOther_invoke (engine) {
	engine.ensure_horizontal ();
	engine.debug ('accum other ' + escchr (this.ord));
	engine.mode_accum (this.ord);
    };

    return InsertOtherCommand;
})();


Command.catcode_commands = [
    null/*esc*/, BeginGroupCommand, EndGroupCommand, MathShiftCommand,
    AlignTabCommand, null/*EOL*/, MacroParameterCommand, SuperCommand,
    SubCommand, null/*ignore*/, SpacerCommand, InsertLetterCommand,
    InsertOtherCommand, null/*active*/, null/*comment*/, null/*invalid*/
];


// Synthetic commands corresponding to given constants

var GivenCharCommand = (function GivenCharCommand_closure () {
    function GivenCharCommand (ord) {
	Command.call (this);
	if (ord < 0 || ord > 255)
	    throw new TexInternalException ('illegal character ordinal ' + ord);
	this.ord = ord;
    }

    inherit (GivenCharCommand, Command);
    var proto = GivenCharCommand.prototype;
    proto.name = '<given-char>';

    proto.samecmd = function GivenCharCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.ord == other.ord;
    };

    proto.asvalue = function GivenCharCommand_asvalue (engine) {
	return new ConstantIntValue (new TexInt (this.ord));
    };

    proto.texmeaning = function GivenCharCommand_texmeaning (engine) {
	return texchr (engine.intpar ('escapechar')) + 'char' +
	    this.ord.toString (16).toUpperCase ();
    };

    return GivenCharCommand;
})();


var GivenMathcharCommand = (function GivenMathcharCommand_closure () {
    function GivenMathcharCommand (mathchar) {
	Command.call (this);
	if (mathchar < 0 || mathchar > 32767)
	    throw new TexInternalException ('illegal math character numder ' + mathchar);
	this.mathchar = mathchar;
    }

    inherit (GivenMathcharCommand, Command);
    var proto = GivenMathcharCommand.prototype;
    proto.name = '<given-mathchar>';

    proto.samecmd = function GivenMathcharCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.mathchar == other.mathchar;
    };

    proto.asvalue = function GivenMathcharCommand_asvalue (engine) {
	return new ConstantIntValue (new TexInt (this.mathchar));
    };

    proto.texmeaning = function GivenMathcharCommand_texmeaning (engine) {
	return texchr (engine.intpar ('escapechar')) + 'mathchar' +
	    this.ord.toString (16).toUpperCase ();
    };

    return GivenMathcharCommand;
})();


var GivenRegisterCommand = (function GivenRegisterCommand_closure () {
    function GivenRegisterCommand (register) {
	Command.call (this);
	if (register < 0 || register > 255)
	    throw new TexInternalException ('illegal register number ' + register);
	this.register = register;
    }

    inherit (GivenRegisterCommand, Command);
    var proto = GivenRegisterCommand.prototype;
    proto.name = '<given-register>';
    proto.desc = '[unassigned register type]';
    proto.assign_flag_mode = AFM_CONSUME;

    proto.samecmd = function GivenRegisterCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.register == other.register;
    };

    proto.invoke = function GivenRegisterCommand_invoke (engine) {
	var v = this.asvalue (engine);
	engine.scan_optional_equals ();
	var newval = v.scan (engine);
	engine.debug (this.desc + ' #' + this.register + ' = ' +
		      v.stringify (engine, newval));
	v.set (engine, newval);
    };

    // subclasses implement asvalue()

    proto.texmeaning = function GivenRegisterCommand_texmeaning (engine) {
	return texchr (engine.intpar ('escapechar')) + this.desc +
	    this.register;
    };

    return GivenRegisterCommand;
})();


var GivenCountCommand = (function GivenCountCommand_closure () {
    function GivenCountCommand (reg) { GivenRegisterCommand.call (this, reg); }
    inherit (GivenCountCommand, GivenRegisterCommand);
    var proto = GivenCountCommand.prototype;
    proto.name = '<given-count>';
    proto.desc = 'count';

    proto.asvalue = function GivenCountCommand_asvalue (engine) {
	return new IntRegValue (this.register);
    };

    return GivenCountCommand;
})();


var GivenDimenCommand = (function GivenDimenCommand_closure () {
    function GivenDimenCommand (reg) { GivenRegisterCommand.call (this, reg); }
    inherit (GivenDimenCommand, GivenRegisterCommand);
    var proto = GivenDimenCommand.prototype;
    proto.name = '<given-dimen>';
    proto.desc = 'dimen';

    proto.asvalue = function GivenDimenCommand_asvalue (engine) {
	return new DimenRegValue (this.register);
    };

    return GivenDimenCommand;
})();


var GivenGlueCommand = (function GivenGlueCommand_closure () {
    function GivenGlueCommand (reg) { GivenRegisterCommand.call (this, reg); }
    inherit (GivenGlueCommand, GivenRegisterCommand);
    var proto = GivenGlueCommand.prototype;
    proto.name = '<given-glue>';
    proto.desc = 'glue';

    proto.asvalue = function GivenGlueCommand_asvalue (engine) {
	return new GlueRegValue (this.register);
    };

    return GivenGlueCommand;
})();


var GivenMuglueCommand = (function GivenMuglueCommand_closure () {
    function GivenMuglueCommand (reg) { GivenRegisterCommand.call (this, reg); }
    inherit (GivenMuglueCommand, GivenRegisterCommand);
    var proto = GivenMuglueCommand.prototype;
    proto.name = '<given-muglue>';
    proto.desc = 'muglue';

    proto.asvalue = function GivenMuglueCommand_asvalue (engine) {
	return new MuglueRegValue (this.register);
    };

    return GivenMuglueCommand;
})();


var GivenToksCommand = (function GivenToksCommand_closure () {
    function GivenToksCommand (reg) { GivenRegisterCommand.call (this, reg); }
    inherit (GivenToksCommand, GivenRegisterCommand);
    var proto = GivenToksCommand.prototype;
    proto.name = '<given-toks>';
    proto.desc = 'toks';

    proto.asvalue = function GivenToksCommand_asvalue (engine) {
	return new ToksRegValue (this.register);
    };

    return GivenToksCommand;
})();


var GivenFontCommand = (function GivenFontCommand_closure () {
    function GivenFontCommand (font) {
	Command.call (this);
	this.font = font;
    }

    inherit (GivenFontCommand, Command);
    var proto = GivenFontCommand.prototype;
    proto.name = '<given-font>';
    proto.assign_flags_mode = AFM_CONSUME;

    proto.samecmd = function GivenFontCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.font.equals (other.font);
    };

    proto.invoke = function GivenFontCommand_invoke (engine) {
	engine.debug ('activate font ' + this.font);
	engine.set_font ('<current>', this.font);
    };

    proto.asvalue = function GivenFontCommand_asvalue (engine) {
	return new ConstantFontValue (this.font);
    };

    proto.texmeaning = function GivenFontCommand_texmeaning (engine) {
	return 'select font ' + this.font.texmeaning (engine);
    };

    return GivenFontCommand;
})();


// Commands for named parameters

var NamedParamCommand = (function NamedParamCommand_closure () {
    function NamedParamCommand (name) {
	Command.call (this);
	this.name = name;
    }

    inherit (NamedParamCommand, Command);
    var proto = NamedParamCommand.prototype;
    proto.name = '<unnamed param>';
    proto.desc = '<undescribed>';

    proto.invoke = function NamedParamCommand_invoke (engine) {
	var v = this.asvalue (engine);
	engine.scan_optional_equals ();
	var newval = v.scan (engine);
	engine.debug ([this.desc, this.name, '=',
		       v.stringify (engine, newval)].join (' '));
	v.set (engine, newval);
    };

    proto.asvalue = function NamedParamCommand_asvalue (engine) {
	throw new TexInternalException ('not implemented');
    };

    return NamedParamCommand;
})();


var NamedIntCommand = (function NamedIntCommand_closure () {
    function NamedIntCommand (name) { NamedParamCommand.call (this, name); }
    inherit (NamedIntCommand, NamedParamCommand);
    var proto = NamedIntCommand.prototype;
    proto.desc = 'intpar';

    proto.asvalue = function NamedIntCommand_asvalue (engine) {
	return new IntParamValue (this.name);
    };

    return NamedIntCommand;
})();


var NamedDimenCommand = (function NamedDimenCommand_closure () {
    function NamedDimenCommand (name) { NamedParamCommand.call (this, name); }
    inherit (NamedDimenCommand, NamedParamCommand);
    var proto = NamedDimenCommand.prototype;
    proto.desc = 'dimenpar';

    proto.asvalue = function NamedDimenCommand_asvalue (engine) {
	return new DimenParamValue (this.name);
    };

    return NamedDimenCommand;
})();


var NamedGlueCommand = (function NamedGlueCommand_closure () {
    function NamedGlueCommand (name) { NamedParamCommand.call (this, name); }
    inherit (NamedGlueCommand, NamedParamCommand);
    var proto = NamedGlueCommand.prototype;
    proto.desc = 'gluepar';

    proto.asvalue = function NamedGlueCommand_asvalue (engine) {
	return new GlueParamValue (this.name);
    };

    return NamedGlueCommand;
})();


var NamedMuGlueCommand = (function NamedMuGlueCommand_closure () {
    function NamedMuGlueCommand (name) { NamedParamCommand.call (this, name); }
    inherit (NamedMuGlueCommand, NamedParamCommand);
    var proto = NamedMuGlueCommand.prototype;
    proto.desc = 'mugluepar';

    proto.asvalue = function NamedMuGlueCommand_asvalue (engine) {
	return new MuGlueParamValue (this.name);
    };

    return NamedMuGlueCommand;
})();


var NamedToksCommand = (function NamedToksCommand_closure () {
    function NamedToksCommand (name) { NamedParamCommand.call (this, name); }
    inherit (NamedToksCommand, NamedParamCommand);
    var proto = NamedToksCommand.prototype;
    proto.desc = 'tokspar';

    proto.asvalue = function NamedToksCommand_asvalue (engine) {
	return new ToksParamValue (this.name);
    };

    return NamedToksCommand;
})();