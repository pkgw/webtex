// TeX's named parameters. These have various types and participate in the
// nesting state system.
//
// We have export NamedParamCommand so that engine-helpers-tmpl.js can use it
// to populate all of the ... named parameter commands.

var NamedParamCommand = (function parameter_wrapper () {
    // XXX: indexed by the T_* values in constants.js.
    var vt_ok_for_parameter = [true, true, true, true, true, false, false];

    engine_proto.register_state ({
	nested_init: function (eqtb) {
	    eqtb._parameters = {};
	    eqtb._parameters[T_INT] = {};
	    eqtb._parameters[T_DIMEN] = {};
	    eqtb._parameters[T_GLUE] = {};
	    eqtb._parameters[T_MUGLUE] = {};
	    eqtb._parameters[T_TOKLIST] = {};
	},

	nested_toplevel_init: function (eqtb) {
	    // Needed for Engine initialization to work:
	    eqtb._parameters[T_INT].globaldefs = 0;
	},

	engine_init: function (engine) {
	    // T:TP sec 240
	    engine.set_parameter (T_INT, 'mag', 1000);
	    engine.set_parameter (T_INT, 'tolerance', 1000);
	    engine.set_parameter (T_INT, 'hangafter', 1);
	    engine.set_parameter (T_INT, 'maxdeadcycles', 25);
	    engine.set_parameter (T_INT, 'escapechar', O_BACKSLASH);
	    engine.set_parameter (T_INT, 'endlinechar', O_RETURN);

	    var d = new Date ();
	    engine.set_parameter (T_INT, 'year', d.getFullYear ());
	    engine.set_parameter (T_INT, 'month', d.getMonth ());
	    engine.set_parameter (T_INT, 'day', d.getDay ());
	    engine.set_parameter (T_INT, 'time', d.getHours () * 60 + d.getMinutes ());
	},

	nested_serialize: function (eqtb, state, housekeeping) {
	    state.parameters = { ints: {},
				 dimens: {},
				 glues: {},
				 muglues: {},
				 toklists: {} };

	    var name;

	    for (name in eqtb._parameters[T_INT]) {
		if (!eqtb._parameters[T_INT].hasOwnProperty (name))
		    continue;
		if (name == 'year' || name == 'month' || name == 'day' ||
		    name == 'time')
		    continue;
		state.parameters.ints[name] = eqtb._parameters[T_INT][name];
	    }

	    for (name in eqtb._parameters[T_DIMEN]) {
		if (!eqtb._parameters[T_DIMEN].hasOwnProperty (name))
		    continue;
		state.parameters.dimens[name] = eqtb._parameters[T_DIMEN][name];
	    }

	    for (name in eqtb._parameters[T_GLUE]) {
		if (!eqtb._parameters[T_GLUE].hasOwnProperty (name))
		    continue;
		state.parameters.glues[name] = eqtb._parameters[T_GLUE][name].as_serializable ();
	    }

	    for (name in eqtb._parameters[T_MUGLUE]) {
		if (!eqtb._parameters[T_MUGLUE].hasOwnProperty (name))
		    continue;
		state.parameters.muglues[name] = eqtb._parameters[T_MUGLUE][name].as_serializable ();
	    }

	    for (name in eqtb._parameters[T_TOKLIST]) {
		if (!eqtb._parameters[T_TOKLIST].hasOwnProperty (name))
		    continue;
		state.parameters.toklists[name] = eqtb._parameters[T_TOKLIST][name].as_serializable ();
	    }
	},

	deserialize: function (engine, json, housekeeping) {
	    for (var name in json.parameters.ints)
		engine.set_parameter (T_INT, name,
				      nlib.parse__O_I (json.parameters.ints[name]));

	    for (var name in json.parameters.dimens)
		engine.set_parameter__OS (name,
					  nlib.parse__O_S (json.parameters.dimens[name]));

	    for (var name in json.parameters.glues)
		engine.set_parameter (T_GLUE, name,
				      Glue.deserialize (json.parameters.glues[name]));

	    for (var name in json.parameters.muglues)
		engine.set_parameter (T_MUGLUE, name,
				      Glue.deserialize (json.parameters.muglues[name]));

	    for (var name in json.parameters.toklists)
		engine.set_parameter (T_TOKLIST, name,
				      Toklist.deserialize (json.parameters.toklists[name]));
	},
    });

    engine_proto.register_nesting_method ('get_parameter',
					  function EquivTable_get_parameter (valtype, name) {
	if (!vt_ok_for_parameter[valtype])
	    throw new TexRuntimeError ('illegal value type for parameter: %s',
				       vt_names[valtype]);

	if (this._parameters[valtype].hasOwnProperty (name))
	    return this._parameters[valtype][name];
	if (this.parent == null)
	    throw new TexRuntimeError ('undefined named parameter %s', name);
	return this.parent.get_parameter (valtype, name);
    });

    engine_proto.register_nesting_method ('set_parameter',
					  function EquivTable_set_parameter (valtype, name, value, global) {
	if (!vt_ok_for_parameter[valtype])
	    throw new TexRuntimeError ('illegal value type for parameter: %s',
				       vt_names[valtype]);

	this._parameters[valtype][name] = Value.ensure_unboxed (valtype, value);

	if (global && this.parent != null)
	    this.parent.set_parameter (valtype, name, value, global);
    });

    engine_proto.register_method ('get_parameter',
				  function Engine_get_parameter (valtype, name) {
	return this.eqtb.get_parameter (valtype, name);
    });

    engine_proto.register_method ('get_parameter__O_I',
				  function Engine_get_parameter__O_I (name) {
	// Alias to help with naming-convention consistency.
	return this.eqtb.get_parameter (T_INT, name);
    });

    engine_proto.register_method ('get_parameter__O_S',
				  function Engine_get_parameter__O_S (name) {
	// Alias to help with naming-convention consistency.
	return this.eqtb.get_parameter (T_DIMEN, name);
    });

    engine_proto.register_method ('set_parameter',
				  function Engine_set_parameter (valtype, name, value) {
	this.eqtb.set_parameter (valtype, name, value, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    });

    engine_proto.register_method ('set_parameter__OS',
				  function Engine_set_parameter__OS (name, value_S) {
	// Alias to help with naming-convention consistency.
	this.eqtb.set_parameter (T_DIMEN, name, value_S, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    });


    var ParamValref = (function ParamValref_closure () {
	function ParamValref (valtype, name) {
	    if (!vt_ok_for_parameter[valtype])
		throw new TexInternalError ('illegal valtype for parameter: %s',
					    vt_names[valtype]);

	    Valref.call (this, valtype);
	    this.name = name;
	}

	inherit (ParamValref, Valref);
	var proto = ParamValref.prototype;

	proto.get = function ParamValref_get (engine) {
	    var rv = engine.get_parameter (this.valtype, this.name);
	    return Value.ensure_boxed (this.valtype, rv);
	};

	proto.set = function ParamValref_set (engine, value) {
	    value = Value.ensure_unboxed (this.valtype, value);
	    engine.set_parameter (this.valtype, this.name, value);
	};

	return ParamValref;
    }) ();


    var NamedParamCommand = (function NamedParamCommand_closure () {
	function NamedParamCommand (name, valtype) {
	    if (!vt_ok_for_parameter[valtype])
		throw new TexInternalError ('illegal valtype for parameter: %s',
					    vt_names[valtype]);

	    AssignmentCommand.call (this);
	    this.name = name;
	    this.valtype = valtype;
	}

	inherit (NamedParamCommand, AssignmentCommand);
	var proto = NamedParamCommand.prototype;

	proto.same_cmd = function NamedParamCommand_same_cmd (other) {
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

	return NamedParamCommand;
    })();

    return NamedParamCommand;
}) ();
