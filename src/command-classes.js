// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

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
	throw new TexRuntimeError ('unimplemented primitive \\%s', this.name);
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
	throw new TexRuntimeError ('trying to invoke undefined command \\%s',
				   this.csname);
    };

    proto.same_cmd = function UndefinedCommand_same_cmd (other) {
	if (other == null)
	    return false;
	return (other instanceof UndefinedCommand);
    };

    return UndefinedCommand;
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

    proto.same_cmd = function CharacterCommand_same_cmd (other) {
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
	return new BeginGroupCommand (nlib.parse__O_I (data));
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
	return new EndGroupCommand (nlib.parse__O_I (data));
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
	    var mlist = mathlib.finish_math_list (engine, null);
	    var mstyle = MS_DISPLAY;
	    if (m == M_MATH)
		mstyle = MS_TEXT;

	    var hlist = mathlib.mlist_to_hlist (engine, mlist, mstyle, false, false);
	    var box = new HBox ();
	    box.list = hlist;
	    box.set_glue__OOS (engine, false, nlib.Zero_S);
	    box.render_as_canvas = true;
	    engine.trace ('rendered math: %U', box);

	    var ms_S = engine.get_parameter__O_S ('mathsurround');
	    engine.accum (new MathDelim (ms_S, false));
	    engine.accum (box);
	    engine.accum (new MathDelim (ms_S, true));
	    engine.unnest_eqtb (); // XXX: check that this matches an unsave, not pop_nest
	} else {
	    var tok = engine.next_tok_throw ();
	    if (tok.to_cmd (engine) instanceof MathShiftCommand &&
		(m == M_VERT || m == M_HORZ || m == M_DMATH)) { // XXX don't understand mode check; see T:TP
		    engine.end_graf ();
		engine.trace ('math shift: enter display');
		engine.enter_math (M_DMATH, true);

		// TTP 1146: setting predisplaysize. We use the default, which is max_dimen:
		engine.set_parameter__OS ('predisplaysize', 0x3fffffff);

		// TeX futzes the display width based on the indentation parameters,
		// but it's essentially hsize. TTP 1149.
		engine.set_parameter__OS ('displaywidth',
					  engine.get_parameter__O_S ('hsize'));
		engine.set_parameter__OS ('displayindent', nlib.Zero_S);
		engine.maybe_push_toklist ('everydisplay');
		// XXX: no pagebuilder
	    } else {
		engine.trace ('math shift: enter non-display');
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
	    engine.trace ('... superscript got %o', subitem);
	    prev.sup = subitem;
	});
    };

    SuperCommand.deserialize = function SuperCommand_deserialize (data, hk) {
	return new SuperCommand (nlib.parse__O_I (data));
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
	    engine.trace ('... subscript got %o', subitem);
	    prev.sub = subitem;
	});
    };

    SubCommand.deserialize = function SubCommand_deserialize (data, hk) {
	return new SubCommand (nlib.parse__O_I (data));
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
	    var sf = engine.get_spacefactor ();
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
		    g.amount_S = f.get_dimen__N_S (7);
		else
		    g.amount_S = f.get_dimen__N_S (2);

		g.stretch_S = f.get_dimen__N_S (3);
		g.stretch_S = nlib.xn_over_d__ISI_SS (sf, g.stretch_S, 1000)[0];

		g.shrink_S = f.get_dimen__N_S (4);
		g.shrink_S = nlib.xn_over_d__ISI_SS (1000, g.shrink_S, sf)[0];
	    }
	}

	engine.accum (new BoxGlue (g));
    };

    SpacerCommand.deserialize = function SpacerCommand_deserialize (data, hk) {
	return new SpacerCommand (nlib.parse__O_I (data));
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
	    engine.trace ('math-accum letter %C -> %x', this.ord, mc);
	    var fam = engine.get_parameter__O_I ('fam');
	    var node = mathlib.set_math_char (engine, this.ord, mc, fam);
	    if (node != null) // may get null if character is active.
		engine.accum (node);
	    return;
	}

	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.
	engine.trace ('accum letter %C', this.ord);
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
	    engine.trace ('math-accum other %C -> %x', this.ord, mc);
	    var fam = engine.get_parameter__O_I ('fam');
	    var node = mathlib.set_math_char (engine, this.ord, mc, fam);
	    if (node != null) // may get null if character is active.
		engine.accum (node);
	    return;
	}

	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.
	engine.trace ('accum other %C', this.ord);
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
	    throw new TexInternalError ('illegal character ordinal %d', ord);
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
	return new GivenCharCommand (nlib.parse__O_I (data));
    };

    proto.invoke = function GivenCharCommand_invoke (engine) {
	if (engine.mode () == M_MATH || engine.mode () == M_DMATH) {
	    // XXX copy-pasted in letter and GivenChar
	    var mc = engine.get_code (CT_MATH, this.ord);
	    engine.trace ('math-accum given-char %C -> %x', this.ord, mc);
	    var fam = engine.get_parameter__O_I ('fam');
	    var node = mathlib.set_math_char (engine, this.ord, mc, fam);
	    if (node != null) // may get null if character is active.
		engine.accum (node);
	    return;
	}

	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.
	engine.trace ('accum given-char %C', this.ord);
	engine.accum (engine.get_misc ('cur_font').box_for_ord (this.ord));
    };

    proto.same_cmd = function GivenCharCommand_same_cmd (other) {
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
	return texchr (engine.escapechar__I ()) + 'char"' +
	    this.ord.toString (16).toUpperCase ();
    };

    return GivenCharCommand;
})();


var GivenMathcharCommand = (function GivenMathcharCommand_closure () {
    function GivenMathcharCommand (mathchar) {
	Command.call (this);
	if (mathchar < 0 || mathchar > 0x8000)
	    throw new TexInternalError ('illegal math character number %d', mathchar);
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
	return new GivenMathcharCommand (nlib.parse__O_I (data));
    };

    proto.invoke = function GivenMathcharCommand_invoke (engine) {
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('cannot insert math character in non-math context');

	engine.trace ('given-math %x', this.mathchar);
	var fam = engine.get_parameter__O_I ('fam');
	var node = mathlib.set_math_char (engine, this.mathchar & 0xFF, this.mathchar, fam);
	if (node != null) // may get null if character is active.
	    engine.accum (node);
    }

    proto.same_cmd = function GivenMathcharCommand_same_cmd (other) {
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
	return texchr (engine.escapechar__I ()) + 'mathchar"' +
	    this.mathchar.toString (16).toUpperCase ();
    };

    return GivenMathcharCommand;
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
	engine.trace ('%s = %o', this.name, newval);
	this.as_valref (engine).set (engine, newval);
    };

    return SpecialValueCommand;
})();
