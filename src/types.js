// Various TeX data types

'use strict';

var TexInt = WEBTEX.TexInt = (function TexInt_closure () {
    // These objects are immutable.
    function TexInt (value) {
	this.value = value;
    }

    TexInt.prototype.tex_advance = function TexInt_advance (other) {
    };

    return TexInt;
}) ();


var Scaled = WEBTEX.Scaled = (function Scaled_closure () {
    // These objects are immutable.
    function Scaled (value) {
	this.value = value;
    }

    Scaled.prototype.tex_advance = function Scaled_advance (other) {
    };

    Scaled.prototype.asfloat = function Scaled_asfloat () {
	return WEBTEX.unscale (this.value);
    };

    return Scaled;
}) ();


var Dimen = (function Dimen_closure () {
    // These objects are mutable.
    function Dimen () {
	this.sp = new Scaled (0);
    }

    Dimen.prototype.tex_advance = function Dimen_advance (other) {
    };

    return Dimen;
}) ();


var Glue = (function Glue_closure () {
    function Glue () {
	this.width = new Dimen ();
	this.stretch = new Dimen ();
	this.stretch_order = 0;
	this.shrink = new Dimen ();
	this.shrink_order = 0;
    }

    Glue.prototype.tex_advance = function Glue_advance (other) {
    };

    return Glue;
}) ();


var Box = (function Box_closure () {
    function Box () {
	this.width = new Dimen ();
	this.height = new Dimen ();
	this.depth = new Dimen ();
	this.tlist = [];
    }

    return Box;
}) ();


var Rule = (function Rule_closure () {
    function Rule () {
	Box.call (this);
    }

    inherit (Rule, Box);

    return Rule;
}) ();


var Font = (function Font_closure () {
    function Font (ident, scale) {
	this.ident = ident;
	this.scale = scale;
	this.dimens = {};
	this.hyphenchar = null;
	this.skewchar = null;
    }

    return Font;
}) ();


// Our "value" system

var Value = (function Value_closure () {
    function Value () {}

    Value.prototype.tostr = function Value_tostr (engine, value) {
	return '' + value;
    };

    return Value;
}) ();


var RegisterValue = (function RegisterValue_closure () {
    function RegisterValue (reg) {
	if (reg < 0 || reg > 255)
	    throw new TexInternalException ('illegal register ' + reg);
	Value.call (this);
	this.reg = reg;
    }

    inherit (RegisterValue, Value);

    return RegisterValue;
}) ();


var ParamValue = (function ParamValue_closure () {
    function ParamValue (name) {
	Value.call (this);
	this.name = name;
    }

    inherit (ParamValue, Value);

    return ParamValue;
}) ();


var ConstantValue = (function ConstantValue_closure () {
    function ConstantValue (value) {
	Value.call (this);
	this.value = value;
    }

    inherit (ConstantValue, Value);

    ConstantValue.prototype.get = function ConstantValue_get (engine) {
	return this.value;
    };

    ConstantValue.prototype.set = function ConstantValue_set (engine, value) {
	throw new TexRuntimeException ('cannot set a constant Value')
    };

    return ConstantValue;
}) ();


function _make_int_value (type) {
    type.prototype.scan = function IntValue_scan (engine) {
	return engine.scan_int ();
    };

    return type; // convenience.
}

function _make_dimen_value (type) {
    type.prototype.scan = function DimenValue_scan (engine) {
	return engine.scan_dimen ();
    };

    type.prototype.tostr = function DimenValue_tostr (engine, value) {
	return value.asfloat ().toFixed (3) + 'pt';
    };

    return type;
}

function _make_glue_value (type) {
    type.prototype.scan = function GlueValue_scan (engine) {
	return engine.scan_glue ();
    };

    return type;
}

function _make_muglue_value (type) {
    type.prototype.scan = function MuGlueValue_scan (engine) {
	return engine.scan_glue ({mumode: true});
    };

    return type;
}

function _make_toks_value (type) {
    type.prototype.scan = function ToksValue_scan (engine) {
	engine.scan_one_optional_space ();

	var tok = engine.next_tok ();
	if (tok === null)
	    throw new TexSyntaxException ('EOF in middle of toklist assignment');

	// TODO: \tokpar=<toklist register or toklist param>
	if (!tok.iscat (C_BGROUP))
	    throw new TexSyntaxException ('expected { in toklist assignment');

	return engine.scan_tok_group (false);
    };

    type.prototype.tostr = function ToksValue_tostr (engine, value) {
	return value.join ('|');
    };

    return type;
}

function _make_font_value (type) {
    return type; // TODO
}


var ConstantIntValue = (function ConstantIntValue_closure () {
    function ConstantIntValue (value) { ConstantValue.call (this, value); }
    inherit (ConstantIntValue, ConstantValue);
    return _make_int_value (ConstantIntValue);
}) ();

var ConstantDimenValue = (function ConstantDimenValue_closure () {
    function ConstantDimenValue (value) { ConstantValue.call (this, value); }
    inherit (ConstantDimenValue, ConstantValue);
    return _make_dimen_value (ConstantDimenValue);
}) ();

var ConstantFontValue = (function ConstantFontValue_closure () {
    function ConstantFontValue (value) { ConstantValue.call (this, value); }
    inherit (ConstantFontValue, ConstantValue);
    return _make_font_value (ConstantFontValue);
}) ();


var IntRegValue = (function IntRegValue_closure () {
    function IntRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (IntRegValue, RegisterValue);

    IntRegValue.prototype.get = function IntRegValue_get (engine) {
	return engine.countreg (this.reg);
    };

    IntRegValue.prototype.set = function IntRegValue_set (engine, value) {
	engine.set_countreg (this.reg, value);
    };

    return _make_int_value (IntRegValue);
}) ();

var DimenRegValue = (function DimenRegValue_closure () {
    function DimenRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (DimenRegValue, RegisterValue);

    DimenRegValue.prototype.get = function DimenRegValue_get (engine) {
	return engine.dimenreg (this.reg);
    };

    DimenRegValue.prototype.set = function DimenRegValue_set (engine, value) {
	engine.set_dimenreg (this.reg, value);
    };

    return _make_dimen_value (DimenRegValue);
}) ();

var GlueRegValue = (function GlueRegValue_closure () {
    function GlueRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (GlueRegValue, RegisterValue);

    GlueRegValue.prototype.get = function GlueRegValue_get (engine) {
	return engine.gluereg (this.reg);
    };

    GlueRegValue.prototype.set = function GlueRegValue_set (engine, value) {
	engine.set_gluereg (this.reg, value);
    };

    return _make_glue_value (GlueRegValue);
}) ();

var MuGlueRegValue = (function MuGlueRegValue_closure () {
    function MuGlueRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (MuGlueRegValue, RegisterValue);

    MuGlueRegValue.prototype.get = function MuGlueRegValue_get (engine) {
	return engine.mugluereg (this.reg);
    };

    MuGlueRegValue.prototype.set = function MuGlueRegValue_set (engine, value) {
	engine.set_mugluereg (this.reg, value);
    };

    return _make_muglue_value (MuGlueRegValue);
}) ();

var ToksRegValue = (function ToksRegValue_closure () {
    function ToksRegValue (reg) { RegisterValue.call (this, reg); }
    inherit (ToksRegValue, RegisterValue);

    ToksRegValue.prototype.get = function ToksRegValue_get (engine) {
	return engine.toksreg (this.reg);
    };

    ToksRegValue.prototype.set = function ToksRegValue_set (engine, value) {
	engine.set_toksreg (this.reg, value);
    };

    return _make_toks_value (ToksRegValue);
}) ();


var IntParamValue = (function IntParamValue_closure () {
    function IntParamValue (name) { ParamValue.call (this, name); }
    inherit (IntParamValue, ParamValue);

    IntParamValue.prototype.get = function IntParamValue_get (engine) {
	return engine.countpar (this.name);
    };

    IntParamValue.prototype.set = function IntParamValue_set (engine, value) {
	engine.set_countpar (this.name, value);
    };

    return _make_int_value (IntParamValue);
}) ();

var DimenParamValue = (function DimenParamValue_closure () {
    function DimenParamValue (name) { ParamValue.call (this, name); }
    inherit (DimenParamValue, ParamValue);

    DimenParamValue.prototype.get = function DimenParamValue_get (engine) {
	return engine.dimenpar (this.name);
    };

    DimenParamValue.prototype.set = function DimenParamValue_set (engine, value) {
	engine.set_dimenpar (this.name, value);
    };

    return _make_dimen_value (DimenParamValue);
}) ();

var GlueParamValue = (function GlueParamValue_closure () {
    function GlueParamValue (name) { ParamValue.call (this, name); }
    inherit (GlueParamValue, ParamValue);

    GlueParamValue.prototype.get = function GlueParamValue_get (engine) {
	return engine.gluepar (this.name);
    };

    GlueParamValue.prototype.set = function GlueParamValue_set (engine, value) {
	engine.set_gluepar (this.name, value);
    };

    return _make_glue_value (GlueParamValue);
}) ();

var MuGlueParamValue = (function MuGlueParamValue_closure () {
    function MuGlueParamValue (name) { ParamValue.call (this, name); }
    inherit (MuGlueParamValue, ParamValue);

    MuGlueParamValue.prototype.get = function MuGlueParamValue_get (engine) {
	return engine.mugluepar (this.name);
    };

    MuGlueParamValue.prototype.set = function MuGlueParamValue_set (engine, value) {
	engine.set_mugluepar (this.name, value);
    };

    return _make_muglue_value (MuGlueParamValue);
}) ();

var ToksParamValue = (function ToksParamValue_closure () {
    function ToksParamValue (name) { ParamValue.call (this, name); }
    inherit (ToksParamValue, ParamValue);

    ToksParamValue.prototype.get = function ToksParamValue_get (engine) {
	return engine.tokspar (this.name);
    };

    ToksParamValue.prototype.set = function ToksParamValue_set (engine, value) {
	engine.set_tokspar (this.name, value);
    };

    return _make_toks_value (ToksParamValue);
}) ();
