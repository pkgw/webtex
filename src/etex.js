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

    register_command ('ifcsname', function cmd_ifcsname (engine) {
	var csname = '';
	engine.start_parsing_condition ();

	while (true) {
	    var tok = engine.next_x_tok ();
	    if (tok == null)
		throw new TexSyntaxError ('EOF in \\ifcsname');
	    if (tok.is_cmd (engine, 'endcsname'))
		break;
	    if (!tok.is_char ())
		throw new TexRuntimeError ('only character tokens should occur ' +
					   'between \\ifcsname and \\endcsname');

	    csname += String.fromCharCode (tok.ord);
	}

	engine.done_parsing_condition ();

	var cmd = engine.get_cseq (csname);
	var result = (cmd != null && cmd.name != 'undefined');
	engine.trace ('ifcsname %s => %b', csname, result);
	engine.handle_if (result);
    });

    register_command ('unexpanded', function cmd_unexpanded (engine) {
	engine.trace ('unexpanded ...');
	engine.scan_left_brace ();

	var depth = 1;
	var toks = [];

	while (true) {
	    var tok = engine.next_tok_throw ();

	    if (tok.is_cat (C_BGROUP))
		depth += 1;
	    else if (tok.is_cat (C_EGROUP)) {
		depth -= 1;
		if (depth == 0)
		    break;
	    }

	    toks.push (tok);
	}

	engine.trace ('... => %T', toks);
	engine.push_toks (toks);
    });

}) ();
