'use strict';

var Command = (function Command_closure () {
    function Command () {}

    var proto = Command.prototype;
    proto.expandable = false;
    proto.conditional = false;
    proto.boxlike = false;
    proto.multi_instanced = false; // can multiple Command instances with the same name exist?
    proto.assign_flag_mode = AFM_INVALID;
    proto.name = '<unset command name>';

    proto.toString = function Command_toString () {
	return '[' + this.name + ']';
    };

    proto.invoke = function Command_invoke (engine) {
	throw new TexInternalError ('tried to evaluate undefined/' +
				    'un-evaluatable command ' + this.name);
    };

    proto.samecmd = function Command_samecmd (other) {
	if (other == null)
	    return false;
	return this.name == other.name;
    };

    proto.get_valtype = function Command_get_valtype () {
	// Return the type of the value that this command yields, or null if
	// not applicable. Needed so that \the can peek and see whether it's
	// about to get a token list so that xdef can do the right thing.
	// Otherwise, some kinds of as_valref() calls will eat tokens that
	// don't get put back into the parser when \the decides to do nothing
	// unusual.
	return null;
    };

    proto.as_valref = function Command_as_valref (engine) {
	return null;
    };

    proto.as_int = function Command_as_int (engine) {
	var v = this.as_valref (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_int ();
    };

    proto.as_scaled = function Command_as_scaled (engine) {
	var v = this.as_valref (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_scaled ();
    };

    proto.as_dimen = function Command_as_dimen (engine) {
	var v = this.as_valref (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_dimen ();
    };

    proto.as_glue = function Command_as_glue (engine) {
	var v = this.as_valref (engine);
	if (v == null)
	    return null;
	return v.get (engine).as_glue ();
    };

    proto.texmeaning = function Command_texmeaning (engine) {
	return texchr (engine.escapechar ()) + this.name;
    };

    // Serialization.

    proto.get_serialize_ident = function Command_get_serialize_ident (state, housekeeping) {
	if (this._serialize_ident == null) {
	    if (!this.multi_instanced) {
		// Builtin unique command, no need to serialize anything. Just
		// need to remember that it exists.
		if (housekeeping.commands.hasOwnProperty (this.name))
		    throw new TexRuntimeError ('multiple commands with name ' + this.name);
		housekeeping.commands[this.name] = true;
		this._serialize_ident = this.name;
	    } else {
		// Command is not unique. We need to give this particular
		// instance a special name and save its unique, special
		// parameters.

		var data = this._serialize_data (state, housekeeping);
		var cmdlist = null;

		if (!state.commands.hasOwnProperty (this.name))
		    cmdlist = state.commands[this.name] = [];
		else
		    cmdlist = state.commands[this.name];

		this._serialize_ident = this.name + '/' + cmdlist.length;
		cmdlist.push (data);
	    }
	}

	return this._serialize_ident;
    };

    proto._serialize_data = function Command__serialize_data (state, housekeeping) {
	throw new TexRuntimeError ('_serialize_data not implemented for command');
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
	throw new TexRuntimeError ('unimplemented primitive \\' + this.name);
    };

    return CommandUnimplPrimitive;
})();


var UndefinedCommand = (function UndefinedCommand_closure () {
    function UndefinedCommand (name) {
	Command.call (this);
	this.csname = name;
    }

    inherit (UndefinedCommand, Command);
    var proto = UndefinedCommand.prototype;
    proto.name = 'undefined';
    proto.multi_instanced = true; // simplest way forward.

    proto._serialize_data = function UndefinedCommand__serialize_data (state, housekeeping) {
	return this.csname;
    };

    UndefinedCommand.deserialize = function UndefinedCommand_deserialize (data, hk) {
	return new UndefinedCommand (data);
    };

    proto.invoke = function UndefinedCommand_invoke (engine) {
	throw new TexRuntimeError ('trying to invoke undefined command \\' + this.csname);
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
    proto.multi_instanced = true;

    proto._serialize_data = function MacroCommand__serialize_data (state, housekeeping) {
	return [this.origcs.to_serialize_str (),
		(new Toklist (this.tmpl)).as_serializable (),
		(new Toklist (this.repl)).as_serializable ()];
    };

    MacroCommand.deserialize = function MacroCommand_deserialize (data, housekeeping) {
	var origcs = Toklist.deserialize (data[0]).toks[0];
	var tmpl = Toklist.deserialize (data[1]).toks;
	var repl = Toklist.deserialize (data[2]).toks;
	return new MacroCommand (origcs, tmpl, repl);
    };

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
	    engine.trace ('*macro ' + this.origcs + ' -> ' +
			  new Toklist (this.repl));
	    engine.push_toks (this.repl);
	    return;
	}

	var tidx = 0, ntmpl = this.tmpl.length, param_vals = {};

	while (tidx < ntmpl) {
	    var ttok = this.tmpl[tidx];

	    if (!ttok.is_param ()) {
		// span of nonparameter tokens in template -- eat and make
		// sure that the actual token stream matches.
		var atok = engine.next_tok_throw ();
		if (!atok.equals (ttok))
		    throw new TexRuntimeError ('macro invocation doesn\'t match ' +
					       'template: expected ' + ttok + ', ' +
					       'got ' + atok);
		tidx += 1;
		continue;
	    }

	    if (tidx == ntmpl - 1 || this.tmpl[tidx+1].is_param ()) {
		// Undelimited parameter. Either a single token, or a group.
		var tok = engine.next_tok_throw ();

		if (tok.is_cat (C_BGROUP))
		    param_vals[ttok.pnum] = engine.scan_tok_group (false).toks;
		else if (tok.is_cat (C_SPACE))
		    // TexBook pg 201: spaces are not used as undelimited args;
		    // here we intentionally do not use isspace() (T:TP 393).
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

	    while (match_end < ntmpl && !this.tmpl[match_end].is_param ())
		match_end += 1;

	    var n_to_match = match_end - match_start, cur_match_idx = 0, depth = 0;

	    while (cur_match_idx < n_to_match) {
		var tok = engine.next_tok_throw ();

		if (depth > 0) {
		    if (tok.is_cat (C_BGROUP))
			depth += 1;
		    else if (tok.is_cat (C_EGROUP))
			depth -= 1;
		    expansion.push (tok);
		    continue;
		}

		if (tok.equals (this.tmpl[match_start + cur_match_idx])) {
		    // We're making progress on matching the delimeters.
		    cur_match_idx += 1;
		    continue;
		}

		// We're not matching the template. We need to accumulate
		// something into the expansion.

		if (cur_match_idx == 0) {
		    // We weren't matching at all; straightforward.
		    expansion.push (tok);
		} else {
		    // More complicated situation. If a macro's template is
		    // #1xxy and the pattern fed into it is abcxxxy, #1 should
		    // map to abcx. For this to work, we need to start
		    // rescanning for a pattern match at the second x, which
		    // will have already been thrown away (but can be
		    // recovered since it is precisely a token in this.tmpl).
		    // We also need to add the first x to the expansion since
		    // we now know that it isn't matching the template.
		    expansion.push (this.tmpl[match_start]);
		    engine.push_back (tok);
		    engine.push_toks (this.tmpl.slice (match_start + 1,
						       match_start + cur_match_idx));
		    cur_match_idx = 0;
		}
	    }

	    if (expansion.length > 1 && expansion[0].is_cat (C_BGROUP) &&
		expansion[expansion.length - 1].is_cat (C_EGROUP)) {
		// Check if we can strip off these braces.
		var canstrip = true, depth = 1;

		for (var i = 1; i < expansion.length - 1; i++) {
		    var tok = expansion[i];
		    if (tok.is_cat (C_BGROUP))
			depth += 1;
		    else if (tok.is_cat (C_EGROUP)) {
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
	// can now build the replacement.

	var fullrepl = [];

	for (var i = 0; i < this.repl.length; i++) {
	    var rtok = this.repl[i];

	    if (!rtok.is_param ()) {
		fullrepl.push (rtok);
	    } else {
		var ptoks = param_vals[rtok.pnum];
		for (var j = 0; j < ptoks.length; j++) {
		    fullrepl.push (ptoks[j]);
		}
	    }
	}

	engine.trace ('*macro ' + this.origcs + ' ...');
	for (var i = 1; i < 10; i++)
	    if (param_vals.hasOwnProperty (i))
		engine.trace ('   #' + i + ' = ' + new Toklist (param_vals[i]));
	engine.trace (' -> ' + new Toklist (fullrepl));
	engine.push_toks (fullrepl);
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
    proto.multi_instanced = true; // simplest way forward.

    proto.desc = 'undescribed command';

    proto._serialize_data = function CharacterCommand__serialize_data (state, housekeeping) {
	return this.ord;
    };

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
	engine.trace ('explicit bgroup');
	engine.handle_bgroup ();
    };

    BeginGroupCommand.deserialize = function BeginGroupCommand_deserialize (data, hk) {
	return new BeginGroupCommand (parseInt (data, 10));
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
	engine.trace ('explicit egroup');
	engine.handle_egroup ();
    };

    EndGroupCommand.deserialize = function EndGroupCommand_deserialize (data, hk) {
	return new EndGroupCommand (parseInt (data, 10));
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

    proto.invoke = function MathShiftCommand_invoke (engine) {
	// T:TP 1138.
	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.

	var m = engine.mode ();

	if (m == M_DMATH || m == M_MATH) {
	    // T:TP 1194 -- after_math(). XXX: this code is a poor approximation so far.
	    engine.trace ('math shift: exit');
	    var mlist = engine.leave_mode ();
	    var mstyle = MS_DISPLAY;
	    if (m == M_MATH)
		mstyle = MS_TEXT;

	    var hlist = mathlib.mlist_to_hlist (engine, mlist, mstyle, false, false);
	    var box = new HBox ();
	    box.list = hlist;
	    box.set_glue (engine, false, new Dimen ());
	    box = new CanvasBox (box); // our magic!

	    var ms = engine.get_parameter (T_DIMEN, 'mathsurround');
	    engine.accum (new MathDelim (ms, false));
	    engine.accum (box);
	    engine.accum (new MathDelim (ms, true));
	    engine.unnest_eqtb ();
	} else {
	    engine.trace ('math shift: enter');

	    var tok = engine.next_tok_throw ();
	    if (tok.to_cmd (engine) instanceof MathShiftCommand &&
		(m == M_VERT || m == M_HORZ || m == M_DMATH)) { // XXX don't understand mode check; see T:TP
		    engine.end_graf ();
		engine.enter_math (M_DMATH, true);
		// XXX: pre_display_size_code to an overhang of prev graf (T:TP 1145)
		// XXX: display_width_code to width of display
		// XXX: display_indent_code to its indent
		engine.maybe_push_toklist ('everydisplay');
		// XXX: no pagebuilder
	    } else {
		engine.push_back (tok);
		engine.enter_math (M_MATH, true);
		engine.maybe_push_toklist ('everymath');
	    }
	}
    };

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

    proto.invoke = function AlignTabCommand_invoke (engine) {
	// The invoke() function is never called if the alignment tab appears
	// properly inside an alignment.
	throw new TexRuntimeError ('alignment tab characters may only occur ' +
				   'inside alignments');
    };

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

    proto.invoke = function SuperCommand_invoke (engine) {
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('superscript not allowed outside of math mode');

	// T:TP 1176
	engine.trace ('superscript ...');
	var prev = engine.get_last_listable ();
	if (prev != null) {
	    if (!(prev instanceof AtomNode))
		prev = null;
	    else if (prev.sup != null)
		throw new TexRuntimeError ('double superscripts not allowed');
	}

	if (prev == null) {
	    prev = new AtomNode (MT_ORD);
	    engine.accum (prev);
	}

	mathlib.scan_math (engine, function (eng, subitem) {
	    engine.trace ('... superscript got ' + subitem);
	    prev.sup = subitem;
	});
    };

    SuperCommand.deserialize = function SuperCommand_deserialize (data, hk) {
	return new SuperCommand (parseInt (data, 10));
    };

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

    proto.invoke = function SubCommand_invoke (engine) {
	// XXX: code duplication with superscript
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('subscript not allowed outside of math mode');

	// T:TP 1176
	engine.trace ('subscript ...');
	var prev = engine.get_last_listable ();
	if (prev != null) {
	    if (!(prev instanceof AtomNode))
		prev = null;
	    else if (prev.sub != null)
		throw new TexRuntimeError ('double subscripts not allowed');
	}

	if (prev == null) {
	    prev = new AtomNode (MT_ORD);
	    engine.accum (prev);
	}

	mathlib.scan_math (engine, function (eng, subitem) {
	    engine.trace ('... subscript got ' + subitem);
	    prev.sub = subitem;
	});
    };

    SubCommand.deserialize = function SubCommand_deserialize (data, hk) {
	return new SubCommand (parseInt (data, 10));
    };

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
	// T:TP 1041-1044.
	if (engine.mode () == M_VERT || engine.mode () == M_IVERT) {
	    engine.trace ('spacer: ignored, vertical mode');
	    return;
	}

	if (engine.mode () == M_MATH || engine.mode () == M_DMATH) {
	    engine.trace ('spacer: ignored, math mode');
	    return;
	}

	if (engine.mode () == M_HORZ || engine.mode () == M_RHORZ) {
	    engine.trace ('spacer: h mode, accumed.');
	    var sf = engine.get_special_value (T_INT, 'spacefactor').value;
	    var xs = engine.get_parameter (T_GLUE, 'xspaceskip');
	    var ss = engine.get_parameter (T_GLUE, 'spaceskip');
	    var g = null;

	    if (sf >= 2000 && xs.is_nonzero ())
		g = xs;
	    else if (ss.is_nonzero ())
		g = ss;
	    else {
		var g = new Glue ();
		var f = engine.get_misc ('cur_font');
		if (sf >= 2000)
		    g.width.set_to (f.get_dimen (7));
		else
		    g.width.set_to (f.get_dimen (2));
		g.stretch.set_to (f.get_dimen (3));
		g.shrink.set_to (f.get_dimen (4));
		g.stretch.set_to (g.stretch.sp.times_n_over_d (sf, 1000)[0]);
		g.shrink.set_to (g.shrink.sp.times_n_over_d (1000, sf)[0]);
	    }
	}

	engine.accum (new BoxGlue (g));
    };

    SpacerCommand.deserialize = function SpacerCommand_deserialize (data, hk) {
	return new SpacerCommand (parseInt (ord, 10));
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
	if (engine.mode () == M_MATH || engine.mode () == M_DMATH) {
	    // XXX copy-pasted in letter and GivenChar
	    var mc = engine.get_code (CT_MATH, this.ord);
	    engine.trace ('math-accum letter ' + escchr (this.ord) + ' -> 0x' +
			  mc.toString (16));
	    var fam = engine.get_parameter (T_INT, 'fam');
	    var node = mathlib.set_math_char (engine, this.ord, mc, fam);
	    if (node != null) // may get null if character is active.
		engine.accum (node);
	    return;
	}

	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.
	engine.trace ('accum letter ' + escchr (this.ord));
	engine.accum (engine.get_misc ('cur_font').box_for_ord (this.ord));
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
	if (engine.mode () == M_MATH || engine.mode () == M_DMATH) {
	    // XXX copy-pasted in letter and GivenChar
	    var mc = engine.get_code (CT_MATH, this.ord);
	    engine.trace ('math-accum other ' + escchr (this.ord) + ' -> 0x' +
			  mc.toString (16));
	    var fam = engine.get_parameter (T_INT, 'fam');
	    var node = mathlib.set_math_char (engine, this.ord, mc, fam);
	    if (node != null) // may get null if character is active.
		engine.accum (node);
	    return;
	}

	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.
	engine.trace ('accum other ' + escchr (this.ord));
	engine.accum (engine.get_misc ('cur_font').box_for_ord (this.ord));
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
	    throw new TexInternalError ('illegal character ordinal ' + ord);
	this.ord = ord;
    }

    inherit (GivenCharCommand, Command);
    var proto = GivenCharCommand.prototype;
    proto.name = '<given-char>';
    proto.multi_instanced = true;

    proto._serialize_data = function GivenCharCommand__serialize_data (state, housekeeping) {
	return this.ord;
    };

    GivenCharCommand.deserialize = function GivenCharCommand_deserialize (data, hk) {
	return new GivenCharCommand (parseInt (data, 10));
    };

    proto.invoke = function GivenCharCommand_invoke (engine) {
	if (engine.mode () == M_MATH || engine.mode () == M_DMATH) {
	    // XXX copy-pasted in letter and GivenChar
	    var mc = engine.get_code (CT_MATH, this.ord);
	    engine.trace ('math-accum given-char ' + escchr (this.ord) + ' -> 0x' +
			  mc.toString (16));
	    var fam = engine.get_parameter (T_INT, 'fam');
	    var node = mathlib.set_math_char (engine, this.ord, mc, fam);
	    if (node != null) // may get null if character is active.
		engine.accum (node);
	    return;
	}

	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.
	engine.trace ('accum given-char ' + escchr (this.ord));
	engine.accum (engine.get_misc ('cur_font').box_for_ord (this.ord));
    };

    proto.samecmd = function GivenCharCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.ord == other.ord;
    };

    proto.get_valtype = function GivenCharCommand_get_valtype () {
	return T_INT;
    };

    proto.as_valref = function GivenCharCommand_as_valref (engine) {
	return new ConstantValref (T_INT, this.ord);
    };

    proto.texmeaning = function GivenCharCommand_texmeaning (engine) {
	return texchr (engine.escapechar ()) + 'char"' +
	    this.ord.toString (16).toUpperCase ();
    };

    return GivenCharCommand;
})();


var GivenMathcharCommand = (function GivenMathcharCommand_closure () {
    function GivenMathcharCommand (mathchar) {
	Command.call (this);
	if (mathchar < 0 || mathchar > 0x8000)
	    throw new TexInternalError ('illegal math character numder ' + mathchar);
	this.mathchar = mathchar;
    }

    inherit (GivenMathcharCommand, Command);
    var proto = GivenMathcharCommand.prototype;
    proto.name = '<given-mathchar>';
    proto.multi_instanced = true;

    proto._serialize_data = function GivenMathcharCommand__serialize_data (state, housekeeping) {
	return this.mathchar;
    };

    GivenMathcharCommand.deserialize = function GivenMathcharCommand_deserialize (data, hk) {
	return new GivenMathcharCommand (parseInt (data, 10));
    };

    proto.invoke = function GivenMathcharCommand_invoke (engine) {
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('cannot insert math character in non-math context');

	engine.trace ('given-math 0x' + this.mathchar.toString (16));
	var fam = engine.get_parameter (T_INT, 'fam');
	var node = mathlib.set_math_char (engine, this.mathchar & 0xFF, this.mathchar, fam);
	if (node != null) // may get null if character is active.
	    engine.accum (node);
    }

    proto.samecmd = function GivenMathcharCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.mathchar == other.mathchar;
    };

    proto.get_valtype = function GivenMathcharCommand_get_valtype () {
	return T_INT;
    };

    proto.as_valref = function GivenMathcharCommand_as_valref (engine) {
	return new ConstantValref (T_INT, this.mathchar);
    };

    proto.texmeaning = function GivenMathcharCommand_texmeaning (engine) {
	return texchr (engine.escapechar ()) + 'mathchar"' +
	    this.mathchar.toString (16).toUpperCase ();
    };

    return GivenMathcharCommand;
})();


var GivenRegisterCommand = (function GivenRegisterCommand_closure () {
    function GivenRegisterCommand (valtype, desc, register) {
	Command.call (this);
	if (!vt_ok_for_register[valtype])
	    throw new TexInternalError ('illegal valtype for register: ' +
					vt_names[valtype]);
	if (register < 0 || register > 255)
	    throw new TexInternalError ('illegal register number ' + register);

	this.valtype = valtype;
	this.desc = desc;
	this.register = register;
	this.name = '<given-' + desc + '>';
    }

    inherit (GivenRegisterCommand, Command);
    var proto = GivenRegisterCommand.prototype;
    proto.multi_instanced = true;
    proto.assign_flag_mode = AFM_CONSUME;

    proto._serialize_data = function GivenRegisterCommand__serialize_data (state, housekeeping) {
	return this.register;
    };

    proto.samecmd = function GivenRegisterCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	if (this.valtype != other.valtype)
	    return false;
	return this.register == other.register;
    };

    proto.get_valtype = function GivenRegisterCommand_get_valtype () {
	return this.valtype;
    };

    proto.as_valref = function GivenRegisterCommand_as_valref (engine) {
	return new RegisterValref (this.valtype, this.register);
    };

    proto.invoke = function GivenRegisterCommand_invoke (engine) {
	engine.scan_optional_equals ();
	var newval = engine.scan_valtype (this.valtype);
	engine.trace (this.desc + ' #' + this.register + ' = ' + newval);

	this.as_valref (engine).set (engine, newval);
    };

    proto.texmeaning = function GivenRegisterCommand_texmeaning (engine) {
	return texchr (engine.escapechar ()) + this.desc +
	    this.register;
    };

    return GivenRegisterCommand;
})();


var VariableRegisterCommand = (function VariableRegisterCommand_closure () {
    function VariableRegisterCommand (name, valtype) {
	if (!vt_ok_for_register[valtype])
	    throw new TexInternalError ('illegal valtype for register: ' +
					vt_names[valtype]);

	Command.call (this);
	this.name = name;
	this.valtype = valtype;
    }

    inherit (VariableRegisterCommand, Command);
    var proto = VariableRegisterCommand.prototype;

    proto.samecmd = function VariableRegisterCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.valtype == other.valtype;
    };

    proto.invoke = function VariableRegisterCommand_invoke (engine) {
	var reg = engine.scan_char_code ();
	var grc = new GivenRegisterCommand (this.valtype, this.name, reg);
	grc.invoke (engine);
    };

    proto.get_valtype = function VariableRegisterCommand_get_valtype () {
	return this.valtype;
    };

    proto.as_valref = function VariableRegisterCommand_as_valref (engine) {
	var reg = engine.scan_char_code ();
	return new RegisterValref (this.valtype, reg);
    };

    return VariableRegisterCommand;
})();


var GivenFontCommand = (function GivenFontCommand_closure () {
    function GivenFontCommand (font) {
	Command.call (this);
	this.font = font;
    }

    inherit (GivenFontCommand, Command);
    var proto = GivenFontCommand.prototype;
    proto.name = '<given-font>';
    proto.multi_instanced = true;

    proto._serialize_data = function GivenFontCommand__serialize_data (state, housekeeping) {
	return this.font.get_serialize_ident (state, housekeeping);
    };

    proto.samecmd = function GivenFontCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.font.equals (other.font);
    };

    proto.invoke = function GivenFontCommand_invoke (engine) {
	engine.trace ('activate font ' + this.font);
	engine.set_misc ('cur_font', this.font);
    };

    proto.get_valtype = function GivenFontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function GivenFontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, this.font);
    };

    proto.texmeaning = function GivenFontCommand_texmeaning (engine) {
	return 'select font ' + this.font.texmeaning (engine);
    };

    return GivenFontCommand;
})();


var FontFamilyCommand = (function FontFamilyCommand_closure () {
    function FontFamilyCommand (style, stylename) {
	Command.call (this);

	this.style = style;
	this.name = stylename + 'font';
    }

    inherit (FontFamilyCommand, Command);
    var proto = FontFamilyCommand.prototype;
    proto.assign_flag_mode = AFM_CONSUME;

    proto.invoke = function FontFamilyCommand_invoke (engine) {
	var index = engine.scan_int_4bit ();
	engine.scan_optional_equals ();
	var newval = engine.scan_valtype (T_FONT);
	engine.trace (this.name + ' #' + index + ' = ' + newval);
	(new FontFamilyValref (this.style, index)).set (engine, newval);
    };

    proto.get_valtype = function FontFamilyCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function FontFamilyCommand_as_valref (engine) {
	var index = engine.scan_int_4bit ();
	return new FontFamilyValref (this.style, index);
    };

    return FontFamilyCommand;
})();


var MathComponentCommand = (function MathComponentCommand_closure () {
    function MathComponentCommand (name, mathtype) {
	Command.call (this);
	this.mathtype = mathtype;
	this.name = name;
    }

    inherit (MathComponentCommand, Command);
    var proto = MathComponentCommand.prototype;

    proto.invoke = function MathComponentCommand_invoke (engine) {
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('\\' + this.name + ' illegal outside of math mode');

	engine.trace (this.name);
	var node = new AtomNode (this.mathtype);

	mathlib.scan_math (engine, function (engine, subitem) {
	    node.nuc = subitem;
	    engine.accum (node);
	});
    };

    return MathComponentCommand;
})();


var MathStyleCommand = (function MathStyleCommand_closure () {
    function MathStyleCommand (name, mathstyle) {
	Command.call (this);
	this.mathstyle = mathstyle;
	this.name = name;
    }

    inherit (MathStyleCommand, Command);
    var proto = MathStyleCommand.prototype;

    proto.invoke = function MathStyleCommand_invoke (engine) {
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('\\' + this.name + ' illegal outside of math mode');
	engine.trace (this.name);
	engine.accum (new MathStyleNode (this.mathstyle, false));
    };

    return MathStyleCommand;
})();


// Commands for named parameters

var NamedParamCommand = (function NamedParamCommand_closure () {
    function NamedParamCommand (name, valtype) {
	if (!vt_ok_for_parameter[valtype])
	    throw new TexInternalError ('illegal valtype for parameter: ' +
					vt_names[valtype]);

	Command.call (this);
	this.name = name;
	this.valtype = valtype;
    }

    inherit (NamedParamCommand, Command);
    var proto = NamedParamCommand.prototype;
    proto.assign_flag_mode = AFM_CONSUME;

    proto.samecmd = function NamedParamCommand_samecmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.valtype == other.valtype;
    };

    proto.get_valtype = function NamedParamCommand_get_valtype () {
	return this.valtype;
    };

    proto.as_valref = function NamedParamCommand_as_valref (engine) {
	return new ParamValref (this.valtype, this.name);
    };

    proto.invoke = function NamedParamCommand_invoke (engine) {
	engine.scan_optional_equals ();
	var newval = engine.scan_valtype (this.valtype);
	engine.trace ([this.name, '=', newval].join (' '));
	this.as_valref (engine).set (engine, newval);
    };

    return NamedParamCommand;
})();


var SpecialValueCommand = (function SpecialValueCommand_closure () {
    function SpecialValueCommand (valtype, name) {
	Command.call (this);
	this.valtype = valtype;
	this.name = name;
    }

    inherit (SpecialValueCommand, Command);
    var proto = SpecialValueCommand.prototype;

    proto.get_valtype = function SpecialValueCommand_get_valtype () {
	return this.valtype;
    };

    proto.as_valref = function SpecialValueCommand_as_valref (engine) {
	return new SpecialValref (this.valtype, this.name);
    };

    proto.invoke = function SpecialValueCommand_invoke (engine) {
	engine.scan_optional_equals ();
	var newval = engine.scan_valtype (this.valtype);
	engine.trace ([this.name, '=', newval].join (' '));
	this.as_valref (engine).set (engine, newval);
    };

    return SpecialValueCommand;
})();
