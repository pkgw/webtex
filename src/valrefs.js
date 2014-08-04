// References to values, as many commands are.

var Valref = (function Valref_closure () {
    function Valref (valtype) {
	this.valtype = valtype;
    }

    var proto = Valref.prototype;

    proto.get = function Valref_get (engine) {
	/* Retrieve the actual value of this reference. Typically involves
	 * scanning tokens in the engine. May return null if there's no value
	 * but that situation is expected. */
	throw new TexInternalError ('not implemented Valref.get');
    };

    proto.set = function Valref_set (engine, value) {
	/* Assign a new value to the storage location that this reference
	 * represents. */
	throw new TexInternalError ('not implemented Valref.set');
    };

    return Valref;
}) ();


var RegisterValref = (function RegisterValref_closure () {
    function RegisterValref (valtype, reg) {
	if (!vt_ok_for_register[valtype])
	    throw new TexInternalError ('illegal valtype for register: ' +
					vt_names[valtype]);
	if (reg < 0 || reg > 255)
	    throw new TexInternalError ('illegal register ' + reg);

	Valref.call (this, valtype);
	this.reg = reg;
    }

    inherit (RegisterValref, Valref);
    var proto = RegisterValref.prototype;

    proto.get = function RegisterValref_get (engine) {
	return engine.get_register (this.valtype, this.reg);
    };

    proto.set = function RegisterValref_set (engine, value) {
	engine.set_register (this.valtype, this.reg, value);
    };

    return RegisterValref;
}) ();


var ParamValref = (function ParamValref_closure () {
    function ParamValref (valtype, name) {
	if (!vt_ok_for_parameter[valtype])
	    throw new TexInternalError ('illegal valtype for parameter: ' +
					vt_names[valtype]);

	Valref.call (this, valtype);
	this.name = name;
    }

    inherit (ParamValref, Valref);
    var proto = ParamValref.prototype;

    proto.get = function ParamValref_get (engine) {
	return engine.get_parameter (this.valtype, this.name);
    };

    proto.set = function ParamValref_set (engine, value) {
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
	return engine.get_special_value (this.valtype, this.name);
    };

    proto.set = function SpecialValref_set (engine, value) {
	engine.set_special_value (this.valtype, this.name, value);
    };

    return SpecialValref;
}) ();


var ConstantValref = (function ConstantValref_closure () {
    function ConstantValref (valtype, value) {
	Valref.call (this, valtype);
	this.value = Value.coerce (valtype, value);
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
