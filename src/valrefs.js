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
    function RegisterValref (reg) {
	if (reg < 0 || reg > 255)
	    throw new TexInternalError ('illegal register ' + reg);
	Valref.call (this);
	this.reg = reg;
    }

    inherit (RegisterValref, Valref);

    return RegisterValref;
}) ();


var ParamValref = (function ParamValref_closure () {
    function ParamValref (name) {
	Valref.call (this);
	this.name = name;
    }

    inherit (ParamValref, Valref);

    return ParamValref;
}) ();


var ConstantValref = (function ConstantValref_closure () {
    function ConstantValref (value) {
	Valref.call (this);
	this.value = value;
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


function _make_int_valref (type) {
    type.prototype.scan = function IntValref_scan (engine) {
	return engine.scan_int ();
    };

    return type; // convenience.
}

function _make_dimen_valref (type) {
    type.prototype.scan = function DimenValref_scan (engine) {
	return engine.scan_dimen ();
    };

    return type;
}

function _make_glue_valref (type) {
    type.prototype.scan = function GlueValref_scan (engine) {
	return engine.scan_glue ();
    };

    return type;
}

function _make_muglue_valref (type) {
    type.prototype.scan = function MuGlueValref_scan (engine) {
	return engine.scan_glue ({mumode: true});
    };

    return type;
}

function _make_toks_valref (type) {
    type.prototype.scan = function ToksValref_scan (engine) {
	engine.scan_one_optional_space ();

	var tok = engine.next_tok ();
	if (tok === NeedMoreData || tok === EOF)
	    throw tok;

	// TODO: \tokpar=<toklist register or toklist param>
	if (!tok.iscat (C_BGROUP))
	    throw new TexSyntaxError ('expected { in toklist assignment; got ' + tok);

	return engine.scan_tok_group (false);
    };

    type.prototype.is_toks_value = true;

    return type;
}

function _make_font_valref (type) {
    return type; // TODO
}


var ConstantIntValref = (function ConstantIntValref_closure () {
    function ConstantIntValref (value) { ConstantValref.call (this, value); }
    inherit (ConstantIntValref, ConstantValref);
    return _make_int_valref (ConstantIntValref);
}) ();

var ConstantDimenValref = (function ConstantDimenValref_closure () {
    function ConstantDimenValref (value) { ConstantValref.call (this, value); }
    inherit (ConstantDimenValref, ConstantValref);
    return _make_dimen_valref (ConstantDimenValref);
}) ();

var ConstantFontValref = (function ConstantFontValref_closure () {
    function ConstantFontValref (value) { ConstantValref.call (this, value); }
    inherit (ConstantFontValref, ConstantValref);
    return _make_font_valref (ConstantFontValref);
}) ();


var IntRegValref = (function IntRegValref_closure () {
    function IntRegValref (reg) { RegisterValref.call (this, reg); }
    inherit (IntRegValref, RegisterValref);
    var proto = IntRegValref.prototype;

    proto.get = function IntRegValref_get (engine) {
	return engine.countreg (this.reg);
    };

    proto.set = function IntRegValref_set (engine, value) {
	engine.set_countreg (this.reg, value);
    };

    return _make_int_valref (IntRegValref);
}) ();


var DimenRegValref = (function DimenRegValref_closure () {
    function DimenRegValref (reg) { RegisterValref.call (this, reg); }
    inherit (DimenRegValref, RegisterValref);
    var proto = DimenRegValref.prototype;

    proto.get = function DimenRegValref_get (engine) {
	return engine.dimenreg (this.reg);
    };

    proto.set = function DimenRegValref_set (engine, value) {
	engine.set_dimenreg (this.reg, value);
    };

    return _make_dimen_valref (DimenRegValref);
}) ();


var GlueRegValref = (function GlueRegValref_closure () {
    function GlueRegValref (reg) { RegisterValref.call (this, reg); }
    inherit (GlueRegValref, RegisterValref);
    var proto = GlueRegValref.prototype;

    proto.get = function GlueRegValref_get (engine) {
	return engine.gluereg (this.reg);
    };

    proto.set = function GlueRegValref_set (engine, value) {
	engine.set_gluereg (this.reg, value);
    };

    return _make_glue_valref (GlueRegValref);
}) ();


var MuGlueRegValref = (function MuGlueRegValref_closure () {
    function MuGlueRegValref (reg) { RegisterValref.call (this, reg); }
    inherit (MuGlueRegValref, RegisterValref);
    var proto = MuGlueRegValref.prototype;

    proto.get = function MuGlueRegValref_get (engine) {
	return engine.mugluereg (this.reg);
    };

    proto.set = function MuGlueRegValref_set (engine, value) {
	engine.set_mugluereg (this.reg, value);
    };

    return _make_muglue_valref (MuGlueRegValref);
}) ();


var ToksRegValref = (function ToksRegValref_closure () {
    function ToksRegValref (reg) { RegisterValref.call (this, reg); }
    inherit (ToksRegValref, RegisterValref);
    var proto = ToksRegValref.prototype;

    proto.get = function ToksRegValref_get (engine) {
	return engine.tokreg (this.reg);
    };

    proto.set = function ToksRegValref_set (engine, value) {
	engine.set_tokreg (this.reg, value);
    };

    return _make_toks_valref (ToksRegValref);
}) ();


var IntParamValref = (function IntParamValref_closure () {
    function IntParamValref (name) { ParamValref.call (this, name); }
    inherit (IntParamValref, ParamValref);
    var proto = IntParamValref.prototype;

    proto.get = function IntParamValref_get (engine) {
	return new TexInt (engine.intpar (this.name));
    };

    proto.set = function IntParamValref_set (engine, value) {
	value = TexInt.xcheck (value);
	engine.set_intpar (this.name, value);
    };

    return _make_int_valref (IntParamValref);
}) ();


var DimenParamValref = (function DimenParamValref_closure () {
    function DimenParamValref (name) { ParamValref.call (this, name); }
    inherit (DimenParamValref, ParamValref);
    var proto = DimenParamValref.prototype;

    proto.get = function DimenParamValref_get (engine) {
	return engine.dimenpar (this.name);
    };

    proto.set = function DimenParamValref_set (engine, value) {
	engine.set_dimenpar (this.name, value);
    };

    return _make_dimen_valref (DimenParamValref);
}) ();


var GlueParamValref = (function GlueParamValref_closure () {
    function GlueParamValref (name) { ParamValref.call (this, name); }
    inherit (GlueParamValref, ParamValref);
    var proto = GlueParamValref.prototype;

    proto.get = function GlueParamValref_get (engine) {
	return engine.gluepar (this.name);
    };

    proto.set = function GlueParamValref_set (engine, value) {
	engine.set_gluepar (this.name, value);
    };

    return _make_glue_valref (GlueParamValref);
}) ();


var MuGlueParamValref = (function MuGlueParamValref_closure () {
    function MuGlueParamValref (name) { ParamValref.call (this, name); }
    inherit (MuGlueParamValref, ParamValref);
    var proto = MuGlueParamValref.prototype;

    proto.get = function MuGlueParamValref_get (engine) {
	return engine.mugluepar (this.name);
    };

    proto.set = function MuGlueParamValref_set (engine, value) {
	engine.set_mugluepar (this.name, value);
    };

    return _make_muglue_valref (MuGlueParamValref);
}) ();


var ToksParamValref = (function ToksParamValref_closure () {
    function ToksParamValref (name) { ParamValref.call (this, name); }
    inherit (ToksParamValref, ParamValref);
    var proto = ToksParamValref.prototype;

    proto.get = function ToksParamValref_get (engine) {
	return engine.tokpar (this.name);
    };

    proto.set = function ToksParamValref_set (engine, value) {
	engine.set_tokpar (this.name, value);
    };

    return _make_toks_valref (ToksParamValref);
}) ();
