// References to values, as many commands are.

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


var SpecialValref = (function SpecialValref_closure () {
    function SpecialValref (valtype, name) {
	Valref.call (this, valtype);
	this.name = name;
    }

    inherit (SpecialValref, Valref);
    var proto = SpecialValref.prototype;

    proto.get = function SpecialValref_get (engine) {
	var rv = engine.get_special_value (this.valtype, this.name);
	return Value.ensure_boxed (this.valtype, rv);
    };

    proto.set = function SpecialValref_set (engine, value) {
	value = Value.ensure_unboxed (this.valtype, value);
	engine.set_special_value (this.valtype, this.name, value);
    };

    return SpecialValref;
}) ();


var ConstantValref = (function ConstantValref_closure () {
    function ConstantValref (valtype, value) {
	Valref.call (this, valtype);
	this.value = Value.ensure_boxed (valtype, value);
    }

    inherit (ConstantValref, Valref);
    var proto = ConstantValref.prototype;

    proto.get = function ConstantValref_get (engine) {
	return this.value;
    };

    proto.set = function ConstantValref_set (engine, value) {
	throw new TexRuntimeError ('cannot set a constant Valref')
    };

    return ConstantValref;
}) ();
