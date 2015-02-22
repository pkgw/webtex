// Copyright 2015 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Assignment and definition commands accept various prefixes like \global,
// \long, etc. We do the generic parts of the prefix handling here.

(function prefixed_commands_closure () {
    var MACRO_FLAGS = Prefixing.FLAG_LONG | Prefixing.FLAG_OUTER | Prefixing.FLAG_PROTECTED;

    engine_proto.register_state ({
	engine_init: function (engine) {
	    engine.cur_prefix_flags = 0;
	},

	is_clean: function (engine) {
	    return engine.cur_prefix_flags == 0;
	}
    });

    engine_proto.register_method ('get_prefix_flags',
				  function Engine_get_prefix_flags () {
	var cpf = this.cur_prefix_flags;

	// TeXBook p. 275 / TTP 1214
	var gd = this.get_parameter__O_I ('globaldefs');
	if (gd > 0)
	    cpf |= Prefixing.FLAG_GLOBAL;
	else if (gd < 0)
	    cpf &= (~Prefixing.FLAG_GLOBAL);

	return cpf;
    });

    engine_proto.register_method ('global_prefix_is_active',
				  function Engine_global_prefix_is_active () {
	return !!(this.get_prefix_flags () & Prefixing.FLAG_GLOBAL);
    });

    engine_proto.register_method ('with_global_prefix',
				  function Engine_with_global_prefix (callback) {
	// If \globaldefs < 0, the global flag should not take effect; but
	// this will be handled by get_prefix_flags() and/or
	// global_prefix_is_active().
	var orig_prefix_flags = this.cur_prefix_flags;
	this.cur_prefix_flags |= Prefixing.FLAG_GLOBAL;
	var rv = callback ();
	this.cur_prefix_flags = orig_prefix_flags;
	return rv;
    });

    engine_proto.register_method ('scan_through_assignments',
				  function Engine_scan_through_assignments () {
	// TTP 1270, "do_assignments". Also includes TTP 404.

	var tok = null;

	while (true) {
	    tok = this.next_x_tok_throw ();
	    if (tok.is_space (this) || tok.is_cmd (this, 'relax'))
		continue;

	    var cmd = tok.to_cmd (this);

	    if (cmd.prefixing_mode == Prefixing.MODE_NONE)
		break;

	    // XXX TeX sets a global flag set_box_allowed=False that does what
	    // it sounds like.
	    cmd.invoke (this);
	}

	return tok;
    });

    function handle_prefix (engine, flag) {
	// TTP 1211, "prefixed_command", somewhat.

	engine.cur_prefix_flags |= flag;

	var tok = engine.scan_next_unexpandable ();
	var cmd = tok.to_cmd (engine);
	engine.trace ('next: %o -> %s', tok, cmd.name);

	if (!(cmd.prefixing_mode > 0))
	    // above catches prefixing_mode === undefined
	    throw new TexRuntimeError ('command "%s" does not accept prefixes', cmd.name);

	if (cmd.prefixing_mode == Prefixing.MODE_ASSIGNMENT &&
	    engine.cur_prefix_flags & MACRO_FLAGS)
	    throw new TexRuntimeError ('command "%s" does not accept ' +
				       '\\long/\\outer/\\protected', cmd.name);

	var ret = cmd.invoke (engine);
	engine.cur_prefix_flags = 0;
	return ret;
    }

    register_command ('global', function cmd_global (engine) {
	engine.trace ('global');
	handle_prefix (engine, Prefixing.FLAG_GLOBAL);
    });

    register_command ('outer', function cmd_outer (engine) {
	engine.trace ('outer');
	handle_prefix (engine, Prefixing.FLAG_OUTER);
    });

    register_command ('long', function cmd_long (engine) {
	engine.trace ('long');
	handle_prefix (engine, Prefixing.FLAG_LONG);
    });

    register_command ('protected', function cmd_protected (engine) {
	// e-TeX
	engine.trace ('protected');
	handle_prefix (engine, Prefixing.FLAG_PROTECTED);
    });
}) ();
