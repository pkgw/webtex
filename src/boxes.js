// Box-related data types = things that can go in lists = Listables.
//
// The standard TeX Listables are Box (hbox and vbox), Rule, Insert, Mark,
// Adjust, Ligature, Disc(retionary linebreak), Whatsit, Math, BoxGlue, Kern,
// Penalty, Unset. Then there are the math "noads" but those are defined in
// math.js.
//
// We separate Whatsits into IO and Specials and add our own items.

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

    Listable.new_box = function Listable_new_box (btype) {
	if (btype == BT_VOID)
	    return new VoidBox ();
	if (btype == BT_HBOX)
	    return new HBox ();
	if (btype == BT_VBOX)
	    return new VBox ();
	throw new TexInternalError ('unexpected box type ' + btype);
    };

    return Listable;
}) ();


var Boxlike = (function Boxlike_closure () {
    // A box-like listable has width, height, depth.
    function Boxlike () {
	this.width = new Dimen ();
	this.height = new Dimen ();
	this.depth = new Dimen ();
	this.shift_amount = new Dimen (); // positive is down (right) in H (V) box
    }

    inherit (Boxlike, Listable);
    var proto = Boxlike.prototype;

    proto._uishape = function Boxlike__uishape () {
	return 'w=' + this.width + ' h=' + this.height + ' d=' + this.depth;
    };

    proto._copyto = function Boxlike__copyto (other) {
	other.width = this.width.clone ();
	other.height = this.height.clone ();
	other.depth = this.depth.clone ();
	other.shift_amount = this.shift_amount.clone ();
    };

    return Boxlike;
}) ();


var ListBox = (function ListBox_closure () {
    function ListBox (btype) {
	if (btype < BT_VOID || btype > BT_CBOX)
	    throw new TexInternalError ('ListBox needs boxtype; got ' + btype);

	Boxlike.call (this);
	this.ltype = LT_BOX;
	this.btype = btype;
	this.list = [];
	this.glue_state = 0; // 0 -> glue not set
	this.glue_set = null;
    }

    inherit (ListBox, Boxlike);
    var proto = ListBox.prototype;

    proto._uiitems = function ListBox__uiitems () {
	var uilist = [this._uisummary () + ' {'];

	for (var i = 0; i < this.list.length; i++) {
	    var sublist = this.list[i]._uiitems ();

	    for (var j = 0; j < sublist.length; j++)
		uilist.push ('  ' + sublist[j]);
	}

	uilist.push ('}');
	return uilist;
    };

    proto._copyto = function ListBox__copyto (other) {
	Boxlike.prototype._copyto.call (this, other);
	other.btype = this.btype;
	other.list = this.list.slice ();
    };

    return ListBox;
}) ();


var VoidBox = (function VoidBox_closure () {
    // A VoidBox inherits ListBox, but doesn't chain to its constructor or
    // anything, so that it just doesn't have width/height/etc defined.
    // However, VoidBoxes will count as instanceof ListBox.

    function VoidBox () {
	this.ltype = LT_BOX;
	this.btype = BT_VOID;
    }

    inherit (VoidBox, ListBox);
    var proto = VoidBox.prototype;

    proto._uisummary = function VoidBox__uisummary () {
	return 'VoidBox';
    };

    proto._uiitems = function VoidBox__uiitems () {
	return [this._uisummary ()];
    };

    proto._copyto = function VoidBox__copyto (other) {
	other.btype = this.btype;
    };

    proto.traverse = function VoidBox_traverse (x0, y0, callback) {
	throw new TexInternalError ('cannot traverse a VoidBox');
    };

    return VoidBox;
}) ();


var HBox = (function HBox_closure () {
    function HBox () {
	ListBox.call (this, BT_HBOX);
    }

    inherit (HBox, ListBox);
    var proto = HBox.prototype;

    proto._uisummary = function HBox__uisummary () {
	return 'HBox ' + this._uishape () + ' #items=' + this.list.length;
    };

    proto.clone = function HBox_clone () {
	var b = new HBox ();
	this._copyto (b);
	return b;
    };

    proto.set_glue = function HBox_set_glue (engine, is_exact, spec) {
	// T:TP 649

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
	    // Natural width.
	    this.width.sp.value = nat_width;
	    this.glue_state = 1; // ordinary (zeroth-order infinite) stretch
	    this.glue_set = 0.; // ... but no actual stretching.
	} else if (settype == 1) {
	    // We're stretching the box.
	    this.width.sp.value = nat_width + setdelta;

	    if (stretches[3] != 0)
		this.glue_state = 4;
	    else if (stretches[2] != 0)
		this.glue_state = 3;
	    else if (stretches[1] != 0)
		this.glue_state = 2;
	    else
		this.glue_state = 1;

	    // Note: here, TeX does indeed use floating-point math.
	    this.glue_set = (1.0 * stretches[this.glue_state - 1]) / setdelta;
	} else {
	    // We're shrinking it.
	    this.width.sp.value = nat_width - setdelta;

	    if (shrinks[3] != 0)
		this.glue_state = -4;
	    else if (shrinks[2] != 0)
		this.glue_state = -3;
	    else if (shrinks[1] != 0)
		this.glue_state = -2;
	    else
		this.glue_state = -1;

	    this.glue_set = (1.0 * shrinks[-this.glue_state - 1]) / setdelta;
	}

	this.height.sp.value = height;
	this.depth.sp.value = depth;
    };

    proto.traverse = function HBox_traverse (x0, y0, callback) {
	if (this.glue_state == 0)
	    throw new TexInternalError ('cannot traverse unglued box ' + this);

	var gs = this.glue_state;
	var gr = this.glue_set; // the glue set ratio
	var x = x0;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof ListBox) {
		item.traverse (x, y0 + item.shift_amount.sp.value, callback);
		x += item.width.sp.value;
	    } else if (item instanceof Boxlike) {
		callback (x, y0 + item.shift_amount.sp.value, item);
		x += item.width.sp.value;
	    } else if (item instanceof Kern) {
		x += item.amount.sp.value;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		var dx = g.width.sp.value;

		if (gs > 0) {
		    if (g.stretch_order == gs - 1)
			dx += gr * g.stretch.sp.value;
		} else {
		    if (g.shrink_order == -gs - 1)
			dx += gr * g.shrink.sp.value;
		}

		x += dx;
	    } else {
		callback (x, y0, item);
	    }
	}
    };

    return HBox;
}) ();


var VBox = (function VBox_closure () {
    function VBox () {
	ListBox.call (this, BT_VBOX);
    }

    inherit (VBox, ListBox);
    var proto = VBox.prototype;

    proto._uisummary = function VBox__uisummary () {
	return 'VBox ' + this._uishape () + ' #items=' + this.list.length;
    };

    proto.clone = function VBox_clone () {
	var b = new VBox ();
	this._copyto (b);
	return b;
    };

    proto.set_glue = function VBox_set_glue (engine, is_exact, spec) {
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
	    // Natural height.
	    this.height.sp.value = nat_height;
	    this.glue_state = 1; // ordinary (zeroth-order infinite) stretch
	    this.glue_set = 0.; // ... but no actual stretching.
	} else if (settype == 1) {
	    // We're stretching the box.
	    this.height.sp.value = nat_height + setdelta;

	    if (stretches[3] != 0)
		this.glue_state = 4;
	    else if (stretches[2] != 0)
		this.glue_state = 3;
	    else if (stretches[1] != 0)
		this.glue_state = 2;
	    else
		this.glue_state = 1;

	    this.glue_set = (1.0 * stretches[this.glue_state - 1]) / setdelta;
	} else {
	    // We're shrinking it.
	    this.height.sp.value = nat_height - setdelta;

	    if (shrinks[3] != 0)
		this.glue_state = -4;
	    else if (shrinks[2] != 0)
		this.glue_state = -3;
	    else if (shrinks[1] != 0)
		this.glue_state = -2;
	    else
		this.glue_state = -1;

	    this.glue_set = (1.0 * shrinks[-this.glue_state - 1]) / setdelta;
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

    proto.adjust_as_vtop = function VBox_adjust_as_vtop () {
	var tot_height = this.height.sp.value + this.depth.sp.value;
	var height = 0;

	if (this.list[0] instanceof Boxlike)
	    height = this.list[0].height.sp.value;

	this.height.sp.value = height;
	this.depth.sp.value = tot_height - height;
    };

    proto.traverse = function VBox_traverse (x0, y0, callback) {
	if (this.glue_state == 0)
	    throw new TexInternalError ('cannot traverse unglued box' + this);

	var gs = this.glue_state;
	var gr = this.glue_set; // the glue set ratio
	var y = y0 - this.height.sp.value;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof ListBox) {
		y += item.height.sp.value;
		item.traverse (x0 + item.shift_amount.sp.value, y, callback);
		y += item.depth.sp.value;
	    } else if (item instanceof Boxlike) {
		y += item.height.sp.value;
		callback (x0 + item.shift_amount.sp.value, y, item);
		y += item.depth.sp.value;
	    } else if (item instanceof Kern) {
		y += item.amount.sp.value;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		var dy = g.width.sp.value;

		if (gs > 0) {
		    if (g.stretch_order == gs - 1)
			dy += gr * g.stretch.sp.value;
		} else {
		    if (g.shrink_order == -gs - 1)
			dy += gr * g.shrink.sp.value;
		}

		y += dy
	    } else {
		callback (x0, y, item);
	    }
	}
    };

    return VBox;
}) ();


var CanvasBox = (function CanvasBox_closure () {
    // A CanvasBox is a ListBox that has had the locations of its drawable
    // sub-elements extracted and precomputed, leaving only non-drawable
    // sub-elements in its official 'list'. We use these for equations so that
    // the HTML chrome doesn't have to try to guess which kerns, etc., are
    // important for layout; if kerning and box-shifting matters in the UI
    // presentation, the relevant effects should be encapulated in a CanvasBox.

    function CanvasBox (srcbox) {
	if (!(srcbox instanceof HBox || srcbox instanceof VBox))
	    throw new TexInternalError ('CanvasBox source should be HBox or VBox; got ' + srcbox);

	ListBox.call (this, BT_CBOX);
	this.graphics = [];

	this.width = srcbox.width.clone ();
	this.height = srcbox.height.clone ();
	this.depth = srcbox.depth.clone ();
	this.shift_amount = srcbox.shift_amount.clone ();

	// TODO, I think: record true width/height/depth of subcomponents.

	srcbox.traverse (0, 0, function (x, y, item) {
	    if (item instanceof Character || item instanceof Rule) {
		this.graphics.push ([x, y, item]);
	    } else {
		this.list.push (item);
	    }
	}.bind (this));
    }

    inherit (CanvasBox, ListBox);
    var proto = CanvasBox.prototype;

    proto._uisummary = function CanvasBox__uisummary () {
	return 'CanvasBox ' + this._uishape () + ' #items=' + this.list.length +
	    ' #graphics=' + this.graphics.length;
    };

    proto._uiitems = function ListBox__uiitems () {
	var uilist = [this._uisummary () + ' items {'];

	for (var i = 0; i < this.list.length; i++) {
	    var sublist = this.list[i]._uiitems ();
	    for (var j = 0; j < sublist.length; j++)
		uilist.push ('  ' + sublist[j]);
	}

	uilist.push ('} graphics {');

	for (var i = 0; i < this.graphics.length; i++) {
	    var q = this.graphics[i];
	    uilist.push ('  x=' + q[0] + ' y=' + q[1] + ' ' + q[2]);
	}

	uilist.push ('}');
	return uilist;
    };

    proto._copyto = function CanvasBox__copyto (other) {
	ListBox.prototype._copyto.call (this, other);
	other.graphics = this.graphics.slice ();
    };

    proto.clone = function CanvasBox_clone () {
	var b = new CanvasBox ();
	this._copyto (b);
	return b;
    };

    proto.traverse = function CanvasBox_traverse (x0, y0, callback) {
	for (var i = 0; i < this.list.length; i++) {
	    callback (x0, y0, this.list[i]);
	}
    };

    return CanvasBox;
}) ();


var Rule = (function Rule_closure () {
    function Rule () {
	Boxlike.call (this);
	this.ltype = LT_RULE;
    }

    inherit (Rule, Boxlike);
    var proto = Rule.prototype;

    proto._uisummary = function Rule__uisummary () {
	return 'Rule ' + this._uishape ();
    };

    return Rule;
}) ();


var Character = (function Character_closure () {
    function Character (font, ord) {
	if (!(font instanceof Font))
	    throw new TexInternalError ('Character needs font; got ' + font);
	if (!(ord >= 0 && ord < 256))
	    throw new TexInternalError ('Character needs ord; got ' + ord);

	Boxlike.call (this);
	this.ltype = LT_CHARACTER;
	this.font = font;
	this.ord = ord;
    }

    inherit (Character, Boxlike);
    var proto = Character.prototype;

    proto._uisummary = function Character__uisummary () {
	return 'Character ' + this._uishape () + ' ord=' +
	    escchr (this.ord) + ' font=' + this.font;
    };

    return Character;
}) ();


var MathDelim = (function MathDelim_closure () {
    function MathDelim (width, is_after) {
	if (!(width instanceof Dimen))
	    throw new TexInternalError ('MathDelim needs dimen; got ' + width);

	Boxlike.call (this);
	this.ltype = LT_MATH;
	this.width = width;
	this.is_after = is_after;
    }

    inherit (MathDelim, Boxlike);
    var proto = MathDelim.prototype;

    proto._uisummary = function MathDelim__uisummary () {
	return 'MathDelim w=' + this.width;
    };

    return MathDelim;
}) ();


var Mark = (function Mark_closure () {
    function Mark (toks) {
	if (!(toks instanceof Array))
	    throw new TexInternalError ('Mark needs Token array; got ' + toks);

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
	if (!(amount instanceof Dimen))
	    throw new TexInternalError ('Kern needs Dimen; got ' + amount);

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
	if (!(toks instanceof Array))
	    throw new TexInternalError ('Special needs Token array; got ' + toks);

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
	this.amount = TexInt.xcheck (amount);
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
	if (!(amount instanceof Glue))
	    throw new TexInternalError ('BoxGlue needs glue; got ' + amount);

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
	if (typeof (name) != 'string')
	    throw new TexInternalError ('StartTag needs string; got ' + name);

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
	if (typeof (name) != 'string')
	    throw new TexInternalError ('StartTag needs string; got ' + name);

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
