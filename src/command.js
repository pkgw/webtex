'use strict;'

var Command = WEBTEX.Command = (function Command_closure () {
    function Command () {
	this.name = '<unset command name>';
	this.expandable = false;
	this.conditional = false;
	this.boxlike = false;
	this.assign_flag_mode = AFM_INVALID;
    }

    var proto = Command.prototype;

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


var CharacterCommand = (function CharacterCommand_closure () {
    function CharacterCommand (ord) {
	Command.call (this);
	this.ord = ord;
	this.desc = "undescribed command";
    }

    inherit (CharacterCommand, Command);
    var proto = CharacterCommand.prototype;

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

// XXXX
var EndGroupCommand = BeginGroupCommand;
var MathShiftCommand = BeginGroupCommand;
var AlignTabCommand = BeginGroupCommand;
var MacroParameterCommand = BeginGroupCommand;
var SuperCommand = BeginGroupCommand;
var SubCommand = BeginGroupCommand;
var SpacerCommand = BeginGroupCommand;
var InsertLetterCommand = BeginGroupCommand;
var InsertOtherCommand = BeginGroupCommand;

Command.catcode_commands = [
    null/*esc*/, BeginGroupCommand, EndGroupCommand, MathShiftCommand,
    AlignTabCommand, null/*EOL*/, MacroParameterCommand, SuperCommand,
    SubCommand, null/*ignore*/, SpacerCommand, InsertLetterCommand,
    InsertOtherCommand, null/*active*/, null/*comment*/, null/*invalid*/
];
