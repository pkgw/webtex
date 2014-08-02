// Box-related data types.

'use strict';

var Listable = (function Listable_closure () {
    // Something that can be put in a box; or more precisely, a horizontal or
    // vertical list.
    function Listable () {}
    var proto = Listable.prototype;

    proto.toString = function Listable_toString () {
	/* Returns the developer-friendly stringification of this object.
	 * Should not get back to the TeX engine. */
	return '[Listable without toString?]';
    };

    return Listable;
}) ();


var Boxlike = (function Boxlike_closure () {
    // A Listable that is like a box itself: it has width, height, depth.
    function Boxlike (type) {
	this.width = new Dimen ();
	this.height = new Dimen ();
	this.depth = new Dimen ();
	this.shift_amount = new Dimen ();
	// TODO: glue_order, glue_sign, glue_set: see T:TP 135.
    }

    inherit (Boxlike, Listable);
    var proto = Boxlike.prototype;

    proto._copyto = function Boxlike__copyto (other) {
	other.width = this.width.clone ();
	other.height = this.height.clone ();
	other.depth = this.depth.clone ();
	other.shift_amount = this.shift_amount.clone ();
    };

    return Boxlike;
}) ();


var Box = (function Box_closure () {
    function Box (btype) {
	Boxlike.call (this);
	this.ltype = LT_BOX;
	this.btype = btype;
	this.list = [];
    }

    inherit (Box, Boxlike);
    var proto = Box.prototype;

    proto.toString = function Box_toString () {
	return '<Box ' + bt_names[this.btype] + ' w=' + this.width +
	    ' h=' + this.height + ' d=' + this.depth + ' #toks=' +
	    this.list.length + '>';
    };

    proto._copyto = function Box__copyto (other) {
	Boxlike.prototype._copyto.call (this, other);
	other.btype = this.btype;
	other.list = this.list.slice ();
    };

    proto.clone = function Box_clone () {
	var b = new Box (this.btype);
	this._copyto (b);
	return b;
    };

    // Some compatible API with Value for convenience.

    // proto.is_nonzero = function Box_is_nonzero () {
    // 	// The way TeX handles things, an all-zero non-void box is best
    // 	// considered nonzero.
    // 	return this.type != BT_VOID;
    // };

    // proto.as_serializable = function Box_as_serializable () {
    // 	if (this.list.length)
    // 	    throw new TexInternalException ('can\'t serialize box lists yet');
    // 	return [this.btype,
    // 		this.width.as_serializable (),
    // 		this.height.as_serializable (),
    // 		this.depth.as_serializable ()];
    // };

    // Box.deserialize = function Box_deserialize (data) {
    // 	var b = new Box (BT_VOID);
    // 	b.btype = parseInt (data[0], 10);
    // 	b.width = Dimen.deserialize (data[1]);
    // 	b.height = Dimen.deserialize (data[2]);
    // 	b.depth = Dimen.deserialize (data[3]);
    // 	b.list = []; // XXX temp?
    // 	return b;
    // };

    return Box;
}) ();


var Rule = (function Rule_closure () {
    function Rule () {
	Boxlike.call (this);
	this.ltype = LT_RULE;
    }

    inherit (Rule, Boxlike);
    var proto = Rule.prototype;

    proto.toString = function Rule_toString () {
	return '<Rule  w=' + this.width + ' h=' + this.height +
	    ' d=' + this.depth + '>';
    };

    return Rule;
}) ();


var Mark = (function Mark_closure () {
    function Mark (toks) {
	this.ltype = LT_MARK;
	this.toks = toks;
    }

    inherit (Mark, Listable);
    var proto = Mark.prototype;

    proto.toString = function Mark_toString () {
	return '<Mark ' + (new Toklist (this.toks).as_serializable ()) + '>';
    };

    return Mark;
}) ();


var Kern = (function Kern_closure () {
    function Kern (amount) {
	this.ltype = LT_KERN;
	this.amount = amount;
    }

    inherit (Kern, Listable);
    var proto = Kern.prototype;

    proto.toString = function Kern_toString () {
	return '<Kern ' + amount + '>';
    };

    return Kern;
}) ();


var Special = (function Special_closure () {
    function Special (toks) {
	this.ltype = LT_SPECIAL;
	this.toks = toks;
    }

    inherit (Special, Listable);
    var proto = Special.prototype;

    proto.toString = function Special_toString () {
	return '<Special ' + (new Toklist (this.toks).as_serializable ()) + '>';
    };

    return Special;
}) ();


var Penalty = (function Penalty_closure () {
    function Penalty (amount) {
	this.ltype = LT_PENALTY;
	this.amount = amount;
    }

    inherit (Penalty, Listable);
    var proto = Penalty.prototype;

    proto.toString = function Penalty_toString () {
	return '<Penalty ' + amount + '>';
    };

    return Penalty;
}) ();
