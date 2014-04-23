// References to values, as many commands are.

var Valref = (function Valref_closure () {
    function Valref () {}
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

    proto.scan = function Valref_scan (engine) {
	/* Scan a value of the kind that this object references. Note that
	 * this is some kind of literal that the engine's ready to read;
	 * it's not necessarily the value that this particular reference
	 * points to. */
	throw new TexInternalError ('not implemented Valref.scan');
    };

    proto.is_toks_value = false;
    /* Somewhat hacky property to help with toklist scanning. Works how
     * it sounds. */

    return Valref;
}) ();


var RegisterValref = (function RegisterValref_closure () {
    function RegisterValref (valtype, reg) {
	if (!vt_ok_for_register[valtype])
	    throw new TexInternalError ('illegal valtype for register: ' +
					vt_names[valtype]);
	if (reg < 0 || reg > 255)
	    throw new TexInternalError ('illegal register ' + reg);

	Valref.call (this);
	this.valtype = valtype;
	this.reg = reg;
	this.is_toks_value = (valtype == T_TOKLIST); // XXX temporary
    }

    inherit (RegisterValref, Valref);
    var proto = RegisterValref.prototype;

    proto.scan = function RegisterValref_scan (engine) {
	// XXX this function will probably no longer be needed once we switch
	// over.
	return engine.scan_valtype (this.valtype);
    };

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

	Valref.call (this);
	this.valtype = valtype;
	this.name = name;
	this.is_toks_value = (valtype == T_TOKLIST); // XXX temporary
    }

    inherit (ParamValref, Valref);
    var proto = ParamValref.prototype;

    proto.scan = function ParamValref_scan (engine) {
	// XXX to be removed.
	return engine.scan_valtype (this.valtype);
    };

    proto.get = function ParamValref_get (engine) {
	return engine.get_parameter (this.valtype, this.name);
    };

    proto.set = function ParamValref_set (engine, value) {
	engine.set_parameter (this.valtype, this.name, value);
    };

    return ParamValref;
}) ();


var ConstantValref = (function ConstantValref_closure () {
    function ConstantValref (valtype, value) {
	Valref.call (this);
	this.valtype = valtype;
	this.value = Value.coerce (valtype, value);
	this.is_toks_value = (valtype == T_TOKLIST); // XXX temporary
    }

    inherit (ConstantValref, Valref);
    var proto = ConstantValref.prototype;

    proto.scan = function ConstantValref_scan (engine) {
	// XXX to be removed.
	return engine.scan_valtype (this.valtype);
    };

    proto.get = function ConstantValref_get (engine) {
	return this.value;
    };

    proto.set = function ConstantValref_set (engine, value) {
	throw new TexRuntimeError ('cannot set a constant Valref')
    };

    return ConstantValref;
}) ();
