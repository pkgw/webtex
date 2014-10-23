// Tex's registers. There are different sets of registers that can hold ints,
// dimens, glues, muglues, toklists, and boxes.

(function register_wrapper () {
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
	this.eqtb.set_register (valtype, reg, value, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    });

    engine_proto.register_method ('scan_register_num__I',
				  function Engine_scan_register_num__I () {
	var v = this.scan_int__I ();

	if (v < 0 || v > 255)
	    throw new TexRuntimeError ('illegal register number %d', v);

	return v;
    });
}) ();
