// Various TeX data types

'use strict';

var TexInt = WEBTEX.TexInt = (function TexInt_closure () {
    // These objects are immutable.
    function TexInt (value) {
	this.value = value;
    }

    TexInt.prototype = {
	tex_advance: function TexInt_advance (other) {
	},
    };

    return TexInt;
}) ();


var Scaled = WEBTEX.Scaled = (function Scaled_closure () {
    // These objects are immutable.
    function Scaled (value) {
	this.value = value;
    }

    Scaled.prototype = {
	tex_advance: function Scaled_advance (other) {
	},

	asfloat: function Scaled_asfloat () {
	    return WEBTEX.unscale (this.value);
	}
    };

    return Scaled;
}) ();


var Dimen = (function Dimen_closure () {
    // These objects are mutable.
    function Dimen () {
	this.sp = new Scaled (0);
    }

    Dimen.prototype = {
	tex_advance: function Dimen_advance (other) {
	},
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

    Glue.prototype = {
	tex_advance: function Glue_advance (other) {
	},
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

    Box.prototype = {
    };

    return Box;
}) ();


var Rule = (function Rule_closure () {
    function Rule () {
    }

    Rule.prototype = new Box ();

    return Rule;
}) ();


var Font = (function Font_closure () {
    function Font (ident, scale) {
	this.ident = ident;
	this.scale = scale;
	this.dimens = {};
	this.hyphenchar = undefined;
	this.skewchar = undefined;
    }

    Font.prototype = {
    };

    return Font;
}) ();


// Our "value" system

var Value = (function Value_closure () {
    function Value () {}

    Value.prototype = {
	tostr: function Value_tostr (engine, value) {
	    return '' + value;
	}
    };

    return Value;
}) ();


var RegisterValue = (function RegisterValue_closure () {
    function RegisterValue (reg) {
	if (reg < 0 || reg > 255)
	    throw new TexInternalException ('illegal register ' + reg);
	this.reg = reg;
    }

    RegisterValue.prototype = new Value ();

    return RegisterValue;
}) ();


var ParamValue = (function ParamValue_closure () {
    function ParamValue (name) {
	this.name = name;
    }

    ParamValue.prototype = new Value ();

    return ParamValue;
}) ();


var IntValue = (function IntValue_closure () {
    function IntValue () {}

    IntValue.prototype = new Value ();

    IntValue.prototype.scan = function IntValue_scan (engine) {
	return engine.scan_int ();
    };

    return IntValue;
}) ();


var DimenValue = (function DimenValue_closure () {
    function DimenValue () {}

    DimenValue.prototype = new Value ();

    DimenValue.prototype.scan = function DimenValue_scan (engine) {
	return engine.scan_dimen ();
    };

    DimenValue.prototype.tostr = function DimenValue_tostr (engine, value) {
	return value.asfloat ().toFixed (3) + 'pt';
    };

    return DimenValue;
}) ();


var GlueValue = (function GlueValue_closure () {
    function GlueValue () {}

    GlueValue.prototype = new Value ();

    GlueValue.scan = function GlueValue_scan (engine) {
	return engine.scan_glue ();
    };

    return GlueValue;
}) ();


var MuGlueValue = (function MuGlueValue_closure () {
    function MuGlueValue () {}

    MuGlueValue.prototype = new Value ();

    MuGlueValue.scan = function MuGlueValue_scan (engine) {
	return engine.scan_glue ({mumode: true});
    };

    return MuGlueValue;
}) ();


var ToksValue = (function ToksValue_closure () {
    function ToksValue () {}

    ToksValue.prototype = new Value ();

    ToksValue.scan = function ToksValue_scan (engine) {
	engine.scan_one_optional_space ();

	var tok = engine.next_tok ();
	if (typeof tok === 'undefined')
	    throw new TexSyntaxException ('EOF in middle of toklist assignment');

	// TODO: \tokpar=<toklist register or toklist param>
	if (!tok.iscat (C_BGROUP))
	    throw new TexSyntaxException ('expected { in toklist assignment');

	return engine.scan_tok_group (false);
    };

    ToksValue.tostr = function ToksValue_tostr (engine, value) {
	return value.join ('|');
    };

    return ToksValue;
}) ();


var FontValue = (function FontValue_closure () {
    function FontValue () {}

    FontValue.prototype = new Value ();

    return FontValue;
}) ();
