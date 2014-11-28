// Box-related data types = things that can go in lists = Listables.
//
// The standard TeX Listables are Box (hbox and vbox), Rule, Insert, Mark,
// Adjust, Ligature, Disc(retionary linebreak), Whatsit, Math, BoxGlue, Kern,
// Penalty, Unset. Then there are the math "noads" but those are defined in
// math.js.
//
// We separate Whatsits into IO and Specials and add our own items.


var Boxlike = (function Boxlike_closure () {
    // A box-like listable has width, height, depth.
    function Boxlike () {
	this.width_S = nlib.Zero_S;
	this.height_S = nlib.Zero_S;
	this.depth_S = nlib.Zero_S;
	this.shift_amount_S = nlib.Zero_S; // positive is down (right) in H (V) box
    }

    inherit (Boxlike, Listable);
    var proto = Boxlike.prototype;

    proto._uishape = function Boxlike__uishape () {
	return format ('w=%S h=%S d=%S', this.width_S, this.height_S, this.depth_S);
    };

    proto._copyto = function Boxlike__copyto (other) {
	other.width_S = this.width_S;
	other.height_S = this.height_S;
	other.depth_S = this.depth_S;
	other.shift_amount_S = this.shift_amount_S;
    };

    return Boxlike;
}) ();


var ListBox = (function ListBox_closure () {
    function ListBox (btype) {
	if (btype < BT_VOID || btype > BT_CBOX)
	    throw new TexInternalError ('ListBox needs boxtype; got %o', btype);

	Boxlike.call (this);
	this.ltype = LT_BOX;
	this.btype = btype;
	this.list = [];
	this.glue_state = 0; // 0 -> glue not set
	this.glue_set = null;
	this.render_as_canvas = false;
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
	other.glue_state = this.glue_state;
	other.glue_set = this.glue_set;
	other.render_as_canvas = this.render_as_canvas;
	other.list = this.list.slice ();
    };

    proto.save_glue_info = function ListBox_save_glue_info () {
	// Bastardized version of TTP 649, for alignments (specifically TTP
	// 796 & 810). I don't get why TeX doesn't just call vpack in the alignment
	// reboxing routines, but there must be a reason.

	var stretches_S = [0, 0, 0, 0];
	var shrinks_S = [0, 0, 0, 0];

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof BoxGlue) {
		var g = item.amount;
		stretches_S[g.stretch_order] += g.stretch_S;
		shrinks_S[g.shrink_order] += g.shrink_S;
	    }
	}

	if (stretches_S[3] != 0) {
	    this._glue_stretch_order = 3;
	    this._glue_stretch_S = stretches_S[3];
	} else if (stretches_S[2] != 0) {
	    this._glue_stretch_order = 2;
	    this._glue_stretch_S = stretches_S[2];
	} else if (stretches_S[1] != 0) {
	    this._glue_stretch_order = 1;
	    this._glue_stretch_S = stretches_S[1];
	} else {
	    this._glue_stretch_order = 0;
	    this._glue_stretch_S = stretches_S[0];
	}

	if (shrinks_S[3] != 0) {
	    this._glue_shrink_order = 3;
	    this._glue_shrink_S = shrinks_S[3];
	} else if (shrinks_S[2] != 0) {
	    this._glue_shrink_order = 2;
	    this._glue_shrink_S = shrinks_S[2];
	} else if (shrinks_S[1] != 0) {
	    this._glue_shrink_order = 1;
	    this._glue_shrink_S = shrinks_S[1];
	} else {
	    this._glue_shrink_order = 0;
	    this._glue_shrink_S = shrinks_S[0];
	}
    };

    ListBox.create = function ListBox_create (btype) {
	if (btype == BT_VOID)
	    return new VoidBox ();
	if (btype == BT_HBOX)
	    return new HBox ();
	if (btype == BT_VBOX)
	    return new VBox ();
	throw new TexInternalError ('unexpected box type %o', btype);
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

    proto.traverse__SSO = function VoidBox_traverse__SSO (x0_S, y0_S, callback__SSO) {
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

    proto.set_glue__OOS = function HBox_set_glue__OOS (engine, is_exact, spec_S) {
	// T:TP 649
	//
	// TTP 653: "The code here implicitly uses the fact that running
	// dimensions are indicated by [running_S], which will be ignored in
	// the calculations because it is a highly negative number."

	var nat_width_S = nlib.Zero_S;
	var stretches_S = [0, 0, 0, 0];
	var shrinks_S = [0, 0, 0, 0];
	var height_S = nlib.Zero_S;
	var depth_S = nlib.Zero_S;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof Boxlike) {
		nat_width_S += item.width_S;
		height_S = Math.max (height_S, item.height_S - item.shift_amount_S);
		depth_S = Math.max (depth_S, item.depth_S + item.shift_amount_S);
	    } else if (item instanceof Kern) {
		nat_width_S += item.amount_S;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		nat_width_S += g.amount_S;
		stretches_S[g.stretch_order] += g.stretch_S;
		shrinks_S[g.shrink_order] += g.shrink_S;
	    }
	}

	var settype = 0; // 0: exact; 1: stretch; 2: shrink
	var setdelta_S = 0; // always nonnegative

	if (is_exact) {
	    // We're setting the box to an exact width.
	    if (spec_S > nat_width_S) {
		settype = 1;
		setdelta_S = spec_S - nat_width_S;
	    } else if (spec_S < nat_width_S) {
		settype = 2;
		setdelta_S = nat_width_S - spec_S;
	    }
	} else {
	    // We're adjusting the box's width from its natural value.
	    if (spec_S > 0) {
		settype = 1;
		setdelta_S = spec_S;
	    } else if (spec_S < 0) {
		settype = 2;
		setdelta_S = -spec_S;
	    }
	}

	if (settype == 0) {
	    // Natural width.
	    this.width_S = nat_width_S;
	    this.glue_state = 1; // ordinary (zeroth-order infinite) stretch
	    this.glue_set = 0.; // ... but no actual stretching.
	} else if (settype == 1) {
	    // We're stretching the box.
	    this.width_S = nat_width_S + setdelta_S;

	    if (stretches_S[3] != 0)
		this.glue_state = 4;
	    else if (stretches_S[2] != 0)
		this.glue_state = 3;
	    else if (stretches_S[1] != 0)
		this.glue_state = 2;
	    else
		this.glue_state = 1;

	    // Note: here, TeX does indeed use floating-point math.
	    if (stretches_S[this.glue_state - 1] != 0)
		this.glue_set = (1.0 * setdelta_S) / stretches_S[this.glue_state - 1];
	    else
		this.glue_set = 0.0; // what to do?
	} else {
	    // We're shrinking it.
	    this.width_S = nat_width_S - setdelta_S;

	    if (shrinks_S[3] != 0)
		this.glue_state = -4;
	    else if (shrinks_S[2] != 0)
		this.glue_state = -3;
	    else if (shrinks_S[1] != 0)
		this.glue_state = -2;
	    else
		this.glue_state = -1;

	    if (shrinks_S[-this.glue_state -1] != 0)
		this.glue_set = (1.0 * setdelta_S) / shrinks_S[-this.glue_state - 1];
	    else
		this.glue_set = 0.0;
	}

	this.height_S = height_S;
	this.depth_S = depth_S;
    };

    proto.traverse__SSO = function HBox_traverse__SSO (x0_S, y0_S, callback__SSO) {
	if (this.list.length == 0)
	    return; // ignore unglued error in this case.
	if (this.glue_state == 0)
	    throw new TexInternalError ('cannot traverse unglued box %o', this);

	var gs = this.glue_state;
	var gr = this.glue_set; // the glue set ratio
	var x_S = x0_S;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof Rule) {
		if (Rule.is_running__S (item.width_S))
		    item.width_S = this.width_S;
		if (Rule.is_running__S (item.height_S))
		    item.height_S = this.height_S;
		if (Rule.is_running__S (item.depth_S))
		    item.depth_S = this.depth_S;
	    }

	    if (item instanceof ListBox) {
		item.traverse__SSO (x_S, y0_S + item.shift_amount_S, callback__SSO);
		x_S += item.width_S;
	    } else if (item instanceof Boxlike) {
		callback__SSO (x_S, y0_S + item.shift_amount_S, item);
		x_S += item.width_S;
	    } else if (item instanceof Kern) {
		x_S += item.amount_S;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		var dx_S = g.amount_S;

		if (gs > 0) {
		    if (g.stretch_order == gs - 1)
			dx_S += (gr * g.stretch_S) | 0;
		} else {
		    if (g.shrink_order == -gs - 1)
			dx_S += (gr * g.shrink_S) | 0;
		}

		x_S += dx_S;
	    } else {
		callback__SSO (x_S, y0_S, item);
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

    proto.set_glue__OOS = function VBox_set_glue__OOS (engine, is_exact, spec_S) {
	var nat_height_S = nlib.Zero_S;
	var stretches_S = [0, 0, 0, 0];
	var shrinks_S = [0, 0, 0, 0];
	var width_S = nlib.Zero_S;
	var prev_depth_S = nlib.Zero_S;

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof Boxlike) {
		nat_height_S += item.height_S + prev_depth_S;
		prev_depth_S = item.depth_S;
		width_S = Math.max (width_S, item.width_S + item.shift_amount_S);
	    } else if (item instanceof Kern) {
		nat_height_S += item.amount_S + prev_depth_S;
		prev_depth_S = nlib.Zero_S;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		nat_height_S += g.amount_S + prev_depth_S;
		stretches_S[g.stretch_order] += g.stretch_S;
		shrinks_S[g.shrink_order] += g.shrink_S;
		prev_depth_S = nlib.Zero_S;
	    }
	}

	var settype = 0; // 0: exact; 1: stretch; 2: shrink
	var setdelta_S = 0; // always nonnegative

	if (is_exact) {
	    // We're setting the box to an exact height.
	    if (spec_S > nat_height_S) {
		settype = 1;
		setdelta_S = spec_S - nat_height_S;
	    } else if (spec_S < nat_height_S) {
		settype = 2;
		setdelta_S = nat_height_S - spec_S;
	    }
	} else {
	    // We're adjusting the box's height from its natural value.
	    if (spec_S > 0) {
		settype = 1;
		setdelta_S = spec_S;
	    } else if (spec_S < 0) {
		settype = 2;
		setdelta_S = -spec_S;
	    }
	}

	if (settype == 0) {
	    // Natural height.
	    this.height_S = nat_height_S;
	    this.glue_state = 1; // ordinary (zeroth-order infinite) stretch
	    this.glue_set = 0.; // ... but no actual stretching.
	} else if (settype == 1) {
	    // We're stretching the box.
	    this.height_S = nat_height_S + setdelta_S;

	    if (stretches_S[3] != 0)
		this.glue_state = 4;
	    else if (stretches_S[2] != 0)
		this.glue_state = 3;
	    else if (stretches_S[1] != 0)
		this.glue_state = 2;
	    else
		this.glue_state = 1;

	    if (stretches_S[this.glue_state - 1] != 0)
		this.glue_set = (1.0 * setdelta_S) / stretches_S[this.glue_state - 1];
	    else
		this.glue_set = 0.0;
	} else {
	    // We're shrinking it.
	    this.height_S = nat_height_S - setdelta_S;

	    if (shrinks_S[3] != 0)
		this.glue_state = -4;
	    else if (shrinks_S[2] != 0)
		this.glue_state = -3;
	    else if (shrinks_S[1] != 0)
		this.glue_state = -2;
	    else
		this.glue_state = -1;

	    if (shrinks_S[-this.glue_state - 1] != 0)
		this.glue_set = (1.0 * setdelta_S) / shrinks_S[-this.glue_state - 1];
	    else
		this.glue_set = 0.0;
	}

	this.width_S = width_S;

	// Depth is prev_depth, unless \boxmaxdepth makes us shift the
	// reference point.
	var bmd_S = engine.get_parameter__O_S ('boxmaxdepth');

	if (prev_depth_S <= bmd_S) {
	    this.depth_S = prev_depth_S;
	} else {
	    var tot_height_S = prev_depth_S + this.height_S;
	    this.depth_S = bmd_S;
	    this.height_S = tot_height_S - bmd_S;
	}
    };

    proto.adjust_as_vtop = function VBox_adjust_as_vtop () {
	var tot_height_S = this.height_S + this.depth_S;
	var height_S = 0;

	if (this.list[0] instanceof Boxlike)
	    height_S = this.list[0].height_S;

	this.height_S = height_S;
	this.depth_S = tot_height_S - height_S;
    };

    proto.traverse__SSO = function VBox_traverse__SSO (x0_S, y0_S, callback__SSO) {
	if (this.list.length == 0)
	    return; // ignore unglued error in this case.
	if (this.glue_state == 0)
	    throw new TexInternalError ('cannot traverse unglued box %o', this);

	var gs = this.glue_state;
	var gr = this.glue_set; // the glue set ratio
	var y_S = y0_S - this.height_S;

	if (gr == null)
	    throw new TexInternalError ('unset glue in %o', this);

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if (item instanceof Rule) {
		if (Rule.is_running__S (item.width_S))
		    item.width_S = this.width_S;
		if (Rule.is_running__S (item.height_S))
		    item.height_S = this.height_S;
		if (Rule.is_running__S (item.depth_S))
		    item.depth_S = this.depth_S;
	    }

	    if (item instanceof ListBox) {
		y_S += item.height_S;
		item.traverse__SSO (x0_S + item.shift_amount_S, y_S, callback__SSO);
		y_S += item.depth_S;
	    } else if (item instanceof Boxlike) {
		y_S += item.height_S;
		callback__SSO (x0_S + item.shift_amount_S, y_S, item);
		y_S += item.depth_S;
	    } else if (item instanceof Kern) {
		y_S += item.amount_S;
	    } else if (item instanceof BoxGlue) {
		var g = item.amount;
		var dy_S = g.amount_S;

		if (gs > 0) {
		    if (g.stretch_order == gs - 1)
			dy_S += (gr * g.stretch_S) | 0;
		} else {
		    if (g.shrink_order == -gs - 1)
			dy_S += (gr * g.shrink_S) | 0;
		}

		y_S += dy_S;
	    } else {
		callback__SSO (x0_S, y_S, item);
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
	    throw new TexInternalError ('CanvasBox source should be HBox or ' +
					'VBox; got %o', srcbox);

	ListBox.call (this, BT_CBOX);
	this.graphics = [];

	this.width_S = srcbox.width_S;
	this.height_S = srcbox.height_S;
	this.depth_S = srcbox.depth_S;
	this.shift_amount_S = srcbox.shift_amount_S;

	// TODO, I think: record true width/height/depth of subcomponents.

	srcbox.traverse__SSO (nlib.Zero_S, nlib.Zero_S, function (x, y, item) {
	    if (item instanceof Character) {
		this.graphics.push ([x, y, item]);
	    } else if (item instanceof Rule) {
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

    proto.traverse__SSO = function CanvasBox_traverse__SSO (x0_S, y0_S, callback__SSO) {
	for (var i = 0; i < this.list.length; i++) {
	    callback__SSO (x0_S, y0_S, this.list[i]);
	}
    };

    proto.to_render_data = function CanvasBox_to_render_data () {
	var data = {w: this.width_S,
		    h: this.height_S,
		    d: this.depth_S};
	var gl = []; // "graphics list"

	for (var i = 0; i < this.graphics.length; i++) {
	    var q = this.graphics[i];
	    var x = q[0];
	    var y = this.height_S + q[1];
	    var subitem = q[2];

	    if (subitem instanceof Character) {
		if (subitem.font.enc_idents == null)
		    throw new TexRuntimeError ('cannot draw character in unsupported font %s',
					       subitem.font.ident);

		gl.push ({x: x,
			  y: y,
			  pfb: subitem.font.pfbname,
			  es: subitem.font.metrics.effective_size,
			  ggid: subitem.font.enc_idents[subitem.ord]});
	    } else if (subitem instanceof Rule) {
		y -= subitem.height_S;
		gl.push ({x: x,
			  y: y,
			  w: subitem.width_S,
			  h: subitem.height_S + subitem.depth_S});
	    } else {
		throw new TexInternalError ('unhandled CanvasBox graphic %o', subitem);
	    }
	}

	data.gl = gl;
	return data;
    };

    return CanvasBox;
}) ();


var Rule = (function Rule_closure () {
    var running_S = -0x40000000; // "running" rule dimension

    function Rule () {
	Boxlike.call (this);
	this.ltype = LT_RULE;
	this.width_S = running_S;
	this.depth_S = running_S;
	this.height_S = running_S;
    }

    inherit (Rule, Boxlike);
    var proto = Rule.prototype;

    proto._uisummary = function Rule__uisummary () {
	return 'Rule ' + this._uishape ();
    };

    proto._uishape = function Rule__uishape () {
	var w = '(running)', h = '(running)', d = '(running)';

	if (this.width_S != running_S)
	    w = format ('%S', this.width_S);
	if (this.height_S != running_S)
	    h = format ('%S', this.height_S);
	if (this.depth_S != running_S)
	    d = format ('%S', this.depth_S);

	return format ('w=%s h=%s d=%s', w, h, d);
    };

    Rule.is_running__S = function Rule__is_running__S (amount_S) {
	// Note: classmethod: call Rule.is_running__S()
	return amount_S == running_S;
    };

    return Rule;
}) ();


var Character = (function Character_closure () {
    function Character (font, ord) {
	if (!(font instanceof Font))
	    throw new TexInternalError ('Character needs font; got %o', font);
	if (!(ord >= 0 && ord < 256))
	    throw new TexInternalError ('Character needs ord; got %o', ord);

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
    function MathDelim (width_S, is_after) {
	Boxlike.call (this);
	this.ltype = LT_MATH;
	this.width_S = width_S;
	this.is_after = is_after;
    }

    inherit (MathDelim, Boxlike);
    var proto = MathDelim.prototype;

    proto._uisummary = function MathDelim__uisummary () {
	return format ('MathDelim w=%S', this.width_S);
    };

    return MathDelim;
}) ();


var Mark = (function Mark_closure () {
    function Mark (toks) {
	if (!(toks instanceof Array))
	    throw new TexInternalError ('Mark needs Token array; got %o', toks);

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
    function Kern (amount_S) {
	this.ltype = LT_KERN;
	this.amount_S = amount_S;

	if (typeof this.amount_S !== 'number')
	    throw new TexInternalError ('QQQ %o', amount_S);
    }

    inherit (Kern, Listable);
    var proto = Kern.prototype;

    proto._uisummary = function Kern__uisummary () {
	return format ('Kern %S', this.amount_S);
    };

    return Kern;
}) ();


var Special = (function Special_closure () {
    function Special (toks) {
	if (!(toks instanceof Array))
	    throw new TexInternalError ('Special needs Token array; got %o', toks);

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
	this.amount = nlib.maybe_unbox__O_I (amount);
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
	    throw new TexInternalError ('BoxGlue needs glue; got %o', amount);

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
	    throw new TexInternalError ('StartTag needs string; got %o', name);

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
	    throw new TexInternalError ('StartTag needs string; got %o', name);

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


var SuppressionControl = (function SuppressionControl_closure () {
    function SuppressionControl (is_pop) {
	this.ltype = LT_STARTTAG; // XXX lazy should straighten this out
	this.is_pop = !!is_pop;
    }

    inherit (SuppressionControl, Listable);
    var proto = SuppressionControl.prototype;

    proto._uisummary = function SuppressionControl__uisummary () {
	if (this.is_pop)
	    return 'SuppressionControl pop';
	return 'SuppressionControl push';
    };

    return SuppressionControl;
}) ();
