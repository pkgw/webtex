// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Tex's registers. There are different sets of registers that can hold ints,
// dimens, glues, muglues, toklists, and boxes.

(function register_wrapper () {
    // XXX: indexed by the T_* values in constants.js.
    var vt_ok_for_register = [true, true, true, true, true, true, false];

    engine_proto.register_state ({
	nested_init: function (eqtb) {
	    eqtb._registers = {};
	    eqtb._registers[T_INT] = {};
	    eqtb._registers[T_DIMEN] = {};
	    eqtb._registers[T_GLUE] = {};
	    eqtb._registers[T_MUGLUE] = {};
	    eqtb._registers[T_TOKLIST] = {};
	    eqtb._registers[T_BOX] = {};
	},

	nested_toplevel_init: function (eqtb) {
	    for (var i = 0; i < 256; i++) {
		eqtb._registers[T_INT][i] = 0;
		eqtb._registers[T_DIMEN][i] = nlib.Zero_S;
		eqtb._registers[T_GLUE][i] = new Glue ();
		eqtb._registers[T_MUGLUE][i] = new Glue ();
		eqtb._registers[T_TOKLIST][i] = new Toklist ();
		eqtb._registers[T_BOX][i] = new VoidBox ();
	    }
	},

	nested_serialize: function (eqtb, state, housekeeping) {
	    // Note: box registers don't get serialized. I think.

	    state.registers = { ints: {},
				dimens: {},
				glues: {},
				muglues: {},
				toklists: {} };

	    for (var i = 0; i < 256; i++) {
		var r = eqtb._registers[T_INT][i];
		if (r != null && r != 0)
		    state.registers.ints[i] = r;

		r = eqtb._registers[T_DIMEN][i];
		if (r != null && r != 0)
		    state.registers.dimens[i] = r;

		r = eqtb._registers[T_GLUE][i];
		if (r != null && r.is_nonzero ())
		    state.registers.glues[i] = r.as_serializable ();

		r = eqtb._registers[T_MUGLUE][i];
		if (r != null && r.is_nonzero ())
		    state.registers.muglues[i] = r.as_serializable ();

		r = eqtb._registers[T_TOKLIST][i];
		if (r != null && r.is_nonzero ())
		    state.registers.toklists[i] = r.as_serializable ();
	    }
	},

	deserialize: function (engine, json, housekeeping) {
	    for (var reg in json.registers.ints)
		engine.set_register (T_INT, nlib.parse__O_I (reg),
				     nlib.parse__O_I (json.registers.ints[reg]));

	    for (var reg in json.registers.dimens)
		engine.set_register (T_DIMEN, nlib.parse__O_I (reg),
				     nlib.parse__O_S (json.registers.dimens[reg]));

	    for (var reg in json.registers.glues)
		engine.set_register (T_GLUE, nlib.parse__O_I (reg),
				     Glue.deserialize (json.registers.glues[reg]));

	    for (var reg in json.registers.muglues)
		engine.set_register (T_MUGLUE, nlib.parse__O_I (reg),
				     Glue.deserialize (json.registers.muglues[reg]));

	    for (var reg in json.registers.toklists)
		engine.set_register (T_TOKLIST, nlib.parse__O_I (reg),
				     Toklist.deserialize (json.registers.toklists[reg]));
	},
    });

    engine_proto.register_nesting_method ('get_register',
					  function EquivTable_get_register (valtype, reg) {
	if (!vt_ok_for_register[valtype])
	    throw new TexRuntimeError ('illegal value type for register: %s',
				       vt_names[valtype]);
	if (reg < 0 || reg > 255)
	    throw new TexRuntimeError ('illegal register number %d', reg);

	if (this._registers[valtype].hasOwnProperty (reg))
	    return this._registers[valtype][reg];
	if (this.parent == null)
	    throw new TexRuntimeError ('unset register; type=%s number=%d',
				       vt_names[valtype], reg);
	return this.parent.get_register (valtype, reg);
    });

    engine_proto.register_nesting_method ('set_register',
					  function EquivTable_set_register (valtype, reg, value, global) {
	if (!vt_ok_for_register[valtype])
	    throw new TexRuntimeError ('illegal value type for register: %s',
				       vt_names[valtype]);
	if (reg < 0 || reg > 255)
	    throw new TexRuntimeError ('illegal register number %d', reg);

	this._registers[valtype][reg] = Value.ensure_unboxed (valtype, value);

	if (global && this.parent != null)
	    this.parent.set_register (valtype, reg, value, global);
    });

    engine_proto.register_method ('get_register',
				  function Engine_get_register (valtype, reg) {
	return this.eqtb.get_register (valtype, reg);
    });

    engine_proto.register_method ('set_register',
				  function Engine_get_register (valtype, reg, value) {
	this.eqtb.set_register (valtype, reg, value, this.global_prefix_is_active ());
	this.maybe_insert_after_assign_token ();
    });

    engine_proto.register_method ('scan_register_num__I',
				  function Engine_scan_register_num__I () {
	var v = this.scan_int__I ();

	if (v < 0 || v > 255)
	    throw new TexRuntimeError ('illegal register number %d', v);

	return v;
    });


    var RegisterValref = (function RegisterValref_closure () {
	function RegisterValref (valtype, reg) {
	    if (!vt_ok_for_register[valtype])
		throw new TexInternalError ('illegal valtype for register: %s',
					    vt_names[valtype]);
	    if (reg < 0 || reg > 255)
		throw new TexInternalError ('illegal register %d', reg);

	    Valref.call (this, valtype);
	    this.reg = reg;
	}

	inherit (RegisterValref, Valref);
	var proto = RegisterValref.prototype;

	proto.get = function RegisterValref_get (engine) {
	    var rv = engine.get_register (this.valtype, this.reg);
	    return Value.ensure_boxed (this.valtype, rv);
	};

	proto.set = function RegisterValref_set (engine, value) {
	    value = Value.ensure_unboxed (this.valtype, value);
	    engine.set_register (this.valtype, this.reg, value);
	};

	return RegisterValref;
    }) ();


    var GivenRegisterCommand = (function GivenRegisterCommand_closure () {
	function GivenRegisterCommand (valtype, desc, register) {
	    if (!vt_ok_for_register[valtype])
		throw new TexInternalError ('illegal valtype for register: %s',
					    vt_names[valtype]);
	    if (register < 0 || register > 255)
		throw new TexInternalError ('illegal register number %d', register);

	    AssignmentCommand.call (this);
	    this.valtype = valtype;
	    this.desc = desc;
	    this.register = register;
	    this.name = '<given-' + desc + '>';
	}

	inherit (GivenRegisterCommand, AssignmentCommand);
	var proto = GivenRegisterCommand.prototype;
	proto.multi_instanced = true;

	proto._serialize_data = function GivenRegisterCommand__serialize_data (state, housekeeping) {
	    return this.register;
	};

	proto.same_cmd = function GivenRegisterCommand_same_cmd (other) {
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

	proto.texmeaning = function GivenRegisterCommand_texmeaning (engine) {
	    return texchr (engine.escapechar__I ()) + this.desc +
		this.register;
	};

	return GivenRegisterCommand;
    })();


    function define_register (name, valtype, engine) {
	var cstok = engine.scan_r_token ();
	engine.scan_optional_equals ();
	var reg = engine.scan_register_num__I ();
	engine.trace ('%sdef %o -> {\\%s%d}', name, cstok, name, reg);
	cstok.assign_cmd (engine, new GivenRegisterCommand (valtype, name, reg));
    };

    register_command ('countdef', function cmd_countdef (engine) {
	define_register ('count', T_INT, engine);
    });

    register_command ('dimendef', function cmd_dimendef (engine) {
	define_register ('dimen', T_DIMEN, engine);
    });

    register_command ('skipdef', function cmd_skipdef (engine) {
	define_register ('skip', T_GLUE, engine);
    });

    register_command ('muskipdef', function cmd_muskipdef (engine) {
	define_register ('muskip', T_MUGLUE, engine);
    });

    register_command ('toksdef', function cmd_toksdef (engine) {
	define_register ('toks', T_TOKLIST, engine);
    });


    register_command_deserializer ('<given-count>', function deserialize_count (data, hk) {
	return new GivenRegisterCommand (T_INT, 'count', nlib.parse__O_I (data));
    });
    register_command_deserializer ('<given-dimen>', function deserialize_dimen (data, hk) {
	return new GivenRegisterCommand (T_DIMEN, 'dimen', nlib.parse__O_I (data));
    });
    register_command_deserializer ('<given-skip>', function deserialize_skip (data, hk) {
	return new GivenRegisterCommand (T_GLUE, 'skip', nlib.parse__O_I (data));
    });
    register_command_deserializer ('<given-muskip>', function deserialize_muskip (data, hk) {
	return new GivenRegisterCommand (T_MUGLUE, 'muskip', nlib.parse__O_I (data));
    });
    register_command_deserializer ('<given-toks>', function deserialize_toks (data, hk) {
	return new GivenRegisterCommand (T_TOKLIST, 'toks', nlib.parse__O_I (data));
    });


    var VariableRegisterCommand = (function VariableRegisterCommand_closure () {
	function VariableRegisterCommand (name, valtype) {
	    if (!vt_ok_for_register[valtype])
		throw new TexInternalError ('illegal valtype for register: %s',
					    vt_names[valtype]);

	    Command.call (this);
	    this.name = name;
	    this.valtype = valtype;
	}

	inherit (VariableRegisterCommand, Command);
	var proto = VariableRegisterCommand.prototype;

	proto.same_cmd = function VariableRegisterCommand_same_cmd (other) {
	    if (other == null)
		return false;
	    if (this.name != other.name)
		return false;
	    return this.valtype == other.valtype;
	};

	proto.invoke = function VariableRegisterCommand_invoke (engine) {
	    var reg = engine.scan_char_code__I ();
	    var grc = new GivenRegisterCommand (this.valtype, this.name, reg);
	    grc.invoke (engine);
	};

	proto.get_valtype = function VariableRegisterCommand_get_valtype () {
	    return this.valtype;
	};

	proto.as_valref = function VariableRegisterCommand_as_valref (engine) {
	    var reg = engine.scan_char_code__I ();
	    return new RegisterValref (this.valtype, reg);
	};

	return VariableRegisterCommand;
    })();


    register_command ('count', new VariableRegisterCommand ('count', T_INT));
    register_command ('dimen', new VariableRegisterCommand ('dimen', T_DIMEN));
    register_command ('skip', new VariableRegisterCommand ('skip', T_GLUE));
    register_command ('muskip', new VariableRegisterCommand ('muskip', T_MUGLUE));
    register_command ('toks', new VariableRegisterCommand ('toks', T_TOKLIST));
}) ();
