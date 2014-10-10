// References to values, as many commands are.

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
	    throw new TexInternalError ('illegal valtype for parameter: %s',
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
	this.value = Value.ensure (valtype, value);
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


var FontFamilyValref = (function FontFamilyValref_closure () {
    function FontFamilyValref (style, index) {
	if (style < MS_TEXT || style > MS_SCRIPTSCRIPT)
	    throw new TexRuntimeError ('illegal font family style %d', style);
	if (index < 0 || index > 15)
	    throw new TexRuntimeError ('illegal font family number %d', index);

	Valref.call (this, T_FONT);
	this.style = style;
	this.index = index;
    }

    inherit (FontFamilyValref, Valref);
    var proto = FontFamilyValref.prototype;

    proto.get = function FontFamilyValref_get (engine) {
	return engine.get_font_family (this.style, this.index);
    };

    proto.set = function FontFamilyValref_set (engine, value) {
	engine.set_font_family (this.style, this.index, value);
    };

    return FontFamilyValref;
}) ();
