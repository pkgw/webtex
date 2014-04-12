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

    CommandUnimplPrimitive.invoke = function CommandUnimplPrimitive_invoke (engine) {
	throw new TexRuntimeException ('unimplemented primitive \\' + this.name);
    }

    return CommandUnimplPrimitive;
})();
