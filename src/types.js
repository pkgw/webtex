// Various TeX data types

'use strict';

var TexInt = WEBTEX.TexInt = (function TexInt_closure () {
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
    function Scaled () {
	this.value = 0;
    }

    Scaled.prototype = {
	tex_advance: function Scaled_advance (other) {
	},
    };

    return Scaled;
}) ();

function mk_scaled (value) {
    var v = new Scaled ();
    v.value = value;
    return v;
}


var Glue = (function Glue_closure () {
    function Glue () {
	this.width = new Scaled ();
	this.stretch = new Scaled ();
	this.stretch_order = 0;
	this.shrink = new Scaled ();
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
	this.width = new Scaled ();
	this.height = new Scaled ();
	this.depth = new Scaled ();
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
