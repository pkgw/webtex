// Various TeX data types

'use strict';

TexInt = (function TexInt_closure () {
    function TexInt (value) {
	this.value = value;
    }

    TexInt.prototype = {
	tex_advance: function TexInt_advance (other) {
	},
    };

    return TexInt;
}) ();


Scaled = (function Scaled_closure () {
    function Scaled () {
	this.value = 0;
    }

    Scaled.prototype = {
	tex_advance: function Scaled_advance (other) {
	},
    };

    return Scaled;
}) ();


Glue = (function Glue_closure () {
    function Glue () {
	this.width = Scaled ();
	this.stretch = Scaled ();
	this.stretch_order = 0;
	this.shrink = Scaled ();
	this.shrink_order = 0;
    }

    Glue.prototype = {
	tex_advance: function Glue_advance (other) {
	},
    };

    return Glue;
}) ();


Box = (function Box_closure () {
    function Box () {
	this.width = Scaled ();
	this.height = Scaled ();
	this.depth = Scaled ();
	this.tlist = [];
    }

    Box.prototype = {
    };

    return Box;
}) ();


Rule = (function Rule_closure () {
    function Rule () {
    }

    Rule.prototype = new Box ();

    return Rule;
}) ();


Font = (function Font_closure () {
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
