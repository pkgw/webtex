// Box-related data types.

'use strict';

var Listable = (function Listable_closure () {
    // Something that can be put in a box; or more precisely, a horizontal or
    // vertical list.
    function Listable () {}
    var proto = Listable.prototype;

    proto._uisummary = function Listable__uisummary () {
	// Returns a short string summarizing this object; used in toString()
	// and uitext().
	return 'Listable without _uisummary??';
    };

    proto.toString = function Listable_toString () {
	return '<' + this._uisummary () + '>';
    };

    proto._uiitems = function Listable__uiitems () {
	// Returns list of strings describing this item, to be displayed
	// separated by newlines. Default is good for most:
	return [this._uisummary ()];
    };

    proto.uitext = function Listable_uitext () {
	return this._uiitems ().join ('\n');
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
	// TODO?: glue_order, glue_sign, glue_set: see T:TP 135.
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

    proto._uisummary = function Box__uisummary () {
	return 'Box ' + bt_names[this.btype] + ' w=' + this.width +
	    ' h=' + this.height + ' d=' + this.depth + ' #items=' +
	    this.list.length;
    };

    proto._uiitems = function Box__uiitems () {
	var uilist = [this._uisummary () + ' {'];

	for (var i = 0; i < this.list.length; i++) {
	    var sublist = this.list[i]._uiitems ();

	    for (var j = 0; j < sublist.length; j++)
		uilist.push ('  ' + sublist[j]);
	}

	uilist.push ('}');
	return uilist;
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

    proto.set_glue = function Box_set_glue (engine, is_exact, spec) {
	// XXX way to object orientate.
	if (this.btype == BT_HBOX)
	    this._set_hbox (engine, is_exact, spec);
	else if (this.btype == BT_VBOX)
	    this._set_vbox (engine, is_exact, spec);
	else
	    throw new TexInternalError ('trying to set void box ' + this);
    };

    proto._set_hbox = function Box__set_hbox (engine, is_exact, spec) {
	// XXX: currently we don't care about the box's internal structure, so
	// we only do what's necessary to calculate the final ht/wd/dp. Well,
	// we do a few more things, but we don't actually save those results.

	var nat_width = 0;
	var stretches = [0, 0, 0, 0];
	var shrinks = [0, 0, 0, 0];
	var height = 0;
	var depth = 0;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof Boxlike) {
		nat_width += item.width.sp.value;
		height = Math.max (height, item.height.sp.value - item.shift_amount.sp.value);
		depth = Math.max (depth, item.depth.sp.value + item.shift_amount.sp.value);
	    } else if (item instanceof Kern) {
		nat_width += item.amount.sp.value;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		nat_width += g.width.sp.value;
		stretches[g.stretch_order] += g.stretch.sp.value;
		shrinks[g.shrink_order] += g.shrink.sp.value;
	    }
	}

	var settype = 0; // 0: exact; 1: stretch; 2: shrink
	var setdelta = 0; // always nonnegative

	if (is_exact) {
	    // We're setting the box to an exact width.
	    if (spec.sp.value > nat_width) {
		settype = 1;
		setdelta = spec.sp.value - nat_width;
	    } else if (spec.sp.value < nat_width) {
		settype = 2;
		setdelta = nat_width - spec.sp.value;
	    }
	} else {
	    // We're adjusting the box's width from its natural value.
	    if (spec.sp.value > 0) {
		settype = 1;
		setdelta = spec.sp.value;
	    } else if (spec.sp.value < 0) {
		settype = 2;
		setdelta = -spec.sp.value;
	    }
	}

	if (settype == 0) {
	    // Natural width. TODO here and each case: record results.
	    this.width.sp.value = nat_width;
	} else if (settype == 1) {
	    // We're stretching the box.
	    this.width.sp.value = nat_width + setdelta;
	} else {
	    // We're shrinking it.
	    this.width.sp.value = nat_width - setdelta;
	}

	this.height.sp.value = height;
	this.depth.sp.value = depth;
    };

    proto._set_vbox = function Box__set_vbox (engine, is_exact, spec) {
	// XXX: currently we don't care about the box's internal structure, so
	// we only do what's necessary to calculate the final ht/wd/dp. Well,
	// we do a few more things, but we don't actually save those results.

	var nat_height = 0;
	var stretches = [0, 0, 0, 0];
	var shrinks = [0, 0, 0, 0];
	var width = 0;
	var prev_depth = 0;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof Boxlike) {
		nat_height += item.width.sp.value + prev_depth;
		prev_depth = item.depth.sp.value;
		width = Math.max (width, item.width.sp.value + item.shift_amount.sp.value);
	    } else if (item instanceof Kern) {
		nat_height += item.amount.sp.value + prev_depth;
		prev_depth = 0;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		nat_height += g.width.sp.value + prev_depth;
		stretches[g.stretch_order] += g.stretch.sp.value;
		shrinks[g.shrink_order] += g.shrink.sp.value;
		prev_depth = 0;
	    }
	}

	var settype = 0; // 0: exact; 1: stretch; 2: shrink
	var setdelta = 0; // always nonnegative

	if (is_exact) {
	    // We're setting the box to an exact height.
	    if (spec.sp.value > nat_height) {
		settype = 1;
		setdelta = spec.sp.value - nat_height;
	    } else if (spec.sp.value < nat_height) {
		settype = 2;
		setdelta = nat_height - spec.sp.value;
	    }
	} else {
	    // We're adjusting the box's height from its natural value.
	    if (spec.sp.value > 0) {
		settype = 1;
		setdelta = spec.sp.value;
	    } else if (spec.sp.value < 0) {
		settype = 2;
		setdelta = -spec.sp.value;
	    }
	}

	if (settype == 0) {
	    // Natural height. TODO here and each case: record results.
	    this.height.sp.value = nat_height;
	} else if (settype == 1) {
	    // We're stretching the box.
	    this.height.sp.value = nat_height + setdelta;
	} else {
	    // We're shrinking it.
	    this.height.sp.value = nat_height - setdelta;
	}

	this.width.sp.value = width;

	// Depth is prev_depth, unless \boxmaxdepth makes us shift the
	// reference point.
	var bmd = engine.get_parameter (T_DIMEN, 'boxmaxdepth').sp.value;

	if (prev_depth <= bmd) {
	    this.depth.sp.value = prev_depth;
	} else {
	    var tot_height = prev_depth + this.height.sp.value;
	    this.depth.sp.value = bmd;
	    this.height.sp.value = tot_height - bmd;
	}
    };

    proto.adjust_as_vtop = function Box_adjust_as_vtop () {
	if (this.btype != BT_VBOX)
	    throw new TexRuntimeError ('adjust_as_vtop on inappropriate box ' + this);

	var tot_height = this.height.sp.value + this.depth.sp.value;
	var height = 0;

	if (this.list[0] instanceof Boxlike)
	    height = this.list[0].height.sp.value;

	this.height.sp.value = height;
	this.depth.sp.value = tot_height - height;
    };

    return Box;
}) ();


var Rule = (function Rule_closure () {
    function Rule () {
	Boxlike.call (this);
	this.ltype = LT_RULE;
    }

    inherit (Rule, Boxlike);
    var proto = Rule.prototype;

    proto._uisummary = function Rule__uisummary () {
	return 'Rule w=' + this.width + ' h=' + this.height +
	    ' d=' + this.depth;
    };

    return Rule;
}) ();


var Character = (function Character_closure () {
    function Character (font, ord) {
	Boxlike.call (this);
	this.ltype = LT_CHARACTER;
	this.font = font;
	this.ord = ord;
    }

    inherit (Character, Boxlike);
    var proto = Character.prototype;

    proto._uisummary = function Character__uisummary () {
	return 'Character w=' + this.width + ' h=' + this.height +
	    ' d=' + this.depth + ' ord=' + escchr (this.ord) +
	    ' font=' + this.font;
    };

    return Character;
}) ();


var Mark = (function Mark_closure () {
    function Mark (toks) {
	this.ltype = LT_MARK;
	this.toks = toks;
    }

    inherit (Mark, Listable);
    var proto = Mark.prototype;

    proto._uisummary = function Mark__uisummary () {
	return 'Mark ' + new Toklist (this.toks).as_serializable ();
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

    proto._uisummary = function Kern__uisummary () {
	return 'Kern ' + this.amount;
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

    proto._uisummary = function Special__uisummary () {
	return 'Special ' + new Toklist (this.toks).as_serializable ();
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

    proto._uisummary = function Penalty__uisummary () {
	return 'Penalty ' + this.amount;
    };

    return Penalty;
}) ();


var BoxGlue = (function BoxGlue_closure () {
    function BoxGlue (amount) {
	this.ltype = LT_GLUE;
	this.amount = amount;
    }

    inherit (BoxGlue, Listable);
    var proto = BoxGlue.prototype;

    proto._uisummary = function BoxGlue__uisummary () {
	return 'BoxGlue ' + this.amount;
    };

    return BoxGlue;
}) ();


var StartTag = (function StartTag_closure () {
    function StartTag (name, attrs) {
	this.ltype = LT_STARTTAG;
	this.name = name;
	this.attrs = attrs;
    }

    inherit (StartTag, Listable);
    var proto = StartTag.prototype;

    proto._uisummary = function StartTag__uisummary () {
	return 'StartTag ' + this.name + ' ' + this.attrs;
    };

    return StartTag;
}) ();


var EndTag = (function EndTag_closure () {
    function EndTag (name) {
	this.ltype = LT_ENDTAG;
	this.name = name;
    }

    inherit (EndTag, Listable);
    var proto = EndTag.prototype;

    proto._uisummary = function EndTag__uisummary () {
	return 'EndTag ' + this.name;
    };

    return EndTag;
}) ();
