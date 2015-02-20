// Copyright 2015 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Implementations of eTeX commands.

(function etex_wrapper () {
    var ETEX_VERSION = 2,
	ETEX_REVISION = ".6";

    register_command ('eTeXversion', (function EtexVersionCommand_closure () {
	function EtexVersionCommand () { Command.call (this); }
	inherit (EtexVersionCommand, Command);
	var proto = EtexVersionCommand.prototype;
	proto.name = 'eTeXversion';

	proto.invoke = function EtexVersionCommand_invoke (engine) {
	    throw new TexInternalError ('\\eTeXversion may not be invoked');
	};

	proto.get_valtype = function EtexVersionCommand_get_valtype () {
	    return T_INT;
	};

	proto.as_valref = function EtexVersionCommand_as_valref (engine) {
	    return new ConstantValref (T_INT, ETEX_VERSION);
	};

	return EtexVersionCommand;
    }) ());

}) ();
