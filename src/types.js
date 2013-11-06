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
