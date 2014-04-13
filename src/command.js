'use strict;'

var Command = WEBTEX.Command = (function Command_closure () {
    function Command () {
	this.expandable = false;
	this.conditional = false;
	this.boxlike = false;
	this.assign_flag_mode = AFM_INVALID;
    }

    var proto = Command.prototype;

    proto.name = '<unset command name>';

    proto.invoke = function Command_invoke (engine) {
	throw new TexInternalError ('tried to evaluate undefined/un-evaluatable ' +
				    'command ' + this.name);
    };

    proto.samecmd = function Command_samecmd (other) {
	if (other === null)
	    return false;
	return this.name == other.name;
    };

    proto.asvalue = function Command_asvalue (engine) {
	return null;
    };

    proto.texmeaning = function Command_texmeaning (engine) {
	return texchr (engine.intpar ('escapechar')) + this.name;
    };

    return Command;
})();


var CommandUnimplPrimitive = (function CommandUnimplPrimitive_closure () {
    function CommandUnimplPrimitive () {
	Command.call (this);
    }

    inherit (CommandUnimplPrimitive, Command);
    var proto = CommandUnimplPrimitive.prototype;

    proto.invoke = function CommandUnimplPrimitive_invoke (engine) {
	throw new TexRuntimeException ('unimplemented primitive \\' + this.name);
    }

    return CommandUnimplPrimitive;
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
	if (other === null)
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
	    throw new ValueError ('illegal character ordinal ' + ord);
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
	return texchar (engine.intpar ('escapechar')) + 'char' +
	    this.ord.toString (16).toUpperCase ();
    };

    return GivenCharCommand;
})();


var GivenMathcharCommand = (function GivenMathcharCommand_closure () {
    function GivenMathcharCommand (mathchar) {
	Command.call (this);
	if (mathchar < 0 || mathchar > 32767)
	    throw new ValueError ('illegal math character numder ' + mathchar);
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
	return texchar (engine.intpar ('escapechar')) + 'mathchar' +
	    this.ord.toString (16).toUpperCase ();
    };

    return GivenMathcharCommand;
})();


var GivenRegisterCommand = (function GivenRegisterCommand_closure () {
    function GivenRegisterCommand (Register) {
	Command.call (this);
	if (register < 0 || register > 255)
	    throw new ValueError ('illegal register number ' + register);
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
		      v.tostr (engine, newval));
	v.set (engine, newval);
    };

    // subclasses implement asvalue()

    proto.texmeaning = function GivenRegisterCommand_texmeaning (engine) {
	return texchar (engine.intpar ('escapechar')) + this.desc +
	    this.register;
    };

    return GivenRegisterCommand;
})();


var GivenCountCommand = (function GivenCountCommand_closure () {
    function GivenCountCommand (reg) { GivenRegisterCommand.call (reg); }
    inherit (GivenCountCommand, GivenRegisterCommand);
    var proto = GivenCountCommand.prototype;
    proto.name = '<given-count>';
    proto.desc = 'count';

    proto.asvalue = function GivenCountCommand_asvalue (engine) {
	return IntRegValue (this.register);
    };

    return GivenCountCommand;
})();


var GivenDimenCommand = (function GivenDimenCommand_closure () {
    function GivenDimenCommand (reg) { GivenRegisterCommand.call (reg); }
    inherit (GivenDimenCommand, GivenRegisterCommand);
    var proto = GivenDimenCommand.prototype;
    proto.name = '<given-dimen>';
    proto.desc = 'dimen';

    proto.asvalue = function GivenDimenCommand_asvalue (engine) {
	return DimenRegValue (this.register);
    };

    return GivenDimenCommand;
})();


var GivenGlueCommand = (function GivenGlueCommand_closure () {
    function GivenGlueCommand (reg) { GivenRegisterCommand.call (reg); }
    inherit (GivenGlueCommand, GivenRegisterCommand);
    var proto = GivenGlueCommand.prototype;
    proto.name = '<given-glue>';
    proto.desc = 'glue';

    proto.asvalue = function GivenGlueCommand_asvalue (engine) {
	return GlueRegValue (this.register);
    };

    return GivenGlueCommand;
})();


var GivenMuglueCommand = (function GivenMuglueCommand_closure () {
    function GivenMuglueCommand (reg) { GivenRegisterCommand.call (reg); }
    inherit (GivenMuglueCommand, GivenRegisterCommand);
    var proto = GivenMuglueCommand.prototype;
    proto.name = '<given-muglue>';
    proto.desc = 'muglue';

    proto.asvalue = function GivenMuglueCommand_asvalue (engine) {
	return MuglueRegValue (this.register);
    };

    return GivenMuglueCommand;
})();


var GivenToksCommand = (function GivenToksCommand_closure () {
    function GivenToksCommand (reg) { GivenRegisterCommand.call (reg); }
    inherit (GivenToksCommand, GivenRegisterCommand);
    var proto = GivenToksCommand.prototype;
    proto.name = '<given-toks>';
    proto.desc = 'toks';

    proto.asvalue = function GivenToksCommand_asvalue (engine) {
	return ToksRegValue (this.register);
    };

    return GivenToksCommand;
})();
