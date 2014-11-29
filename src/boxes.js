// Horizontal and vertical boxes, and the many things that can be done with them.
//
// There's a lot of redundant code here that would be nice to coalesce.

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
    //
    // XXX: However, this approach kind of breaks because many fancy effects
    // are achieved by constructing math boxes that are then poked and
    // prodded, so we can't just cram everything into a CanvasBox and call it
    // a day. Currently we only create temporary CanvasBoxes on shipout, which
    // could be done in a one big function rather than via a class.

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


(function boxes_closure () {
    // Basic box construction.

    register_command ('hbox', (function HboxCommand_closure () {
	function HboxCommand () { Command.call (this); }
	inherit (HboxCommand, Command);
	var proto = HboxCommand.prototype;
	proto.name = 'hbox';
	proto.boxlike = true;

	proto.invoke = function HboxCommand_invoke (engine) {
	    engine.trace ('hbox (for accumulation)');
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function HboxCommand_start_box (engine) {
	    engine.handle_hbox ();
	};

	return HboxCommand;
    }) ());


    register_command ('vbox', (function VboxCommand_closure () {
	function VboxCommand () { Command.call (this); }
	inherit (VboxCommand, Command);
	var proto = VboxCommand.prototype;
	proto.name = 'vbox';
	proto.boxlike = true;

	proto.invoke = function VboxCommand_invoke (engine) {
	    engine.trace ('vbox (for accumulation)');
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function VboxCommand_start_box (engine) {
	    engine.handle_vbox (false);
	};

	return VboxCommand;
    }) ());


    register_command ('vtop', (function VtopCommand_closure () {
	function VtopCommand () { Command.call (this); }
	inherit (VtopCommand, Command);
	var proto = VtopCommand.prototype;
	proto.name = 'vtop';
	proto.boxlike = true;

	proto.invoke = function VtopCommand_invoke (engine) {
	    engine.trace ('vtop (for accumulation)');
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function VtopCommand_start_box (engine) {
	    engine.handle_vbox (true);
	};

	return VtopCommand;
    }) ());


    // Box registers and other manipulations.

    register_command ('setbox', function cmd_setbox (engine) {
	var reg = engine.scan_char_code__I ();
	engine.scan_optional_equals ();
	engine.trace ('setbox: queue #%d = ...', reg);
	engine.handle_setbox (reg);
    });


    register_command ('copy', (function CopyCommand_closure () {
	function CopyCommand () { Command.call (this); }
	inherit (CopyCommand, Command);
	var proto = CopyCommand.prototype;
	proto.name = 'copy';
	proto.boxlike = true;

	proto.invoke = function CopyCommand_invoke (engine) {
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function CopyCommand_start_box (engine) {
	    var reg = engine.scan_char_code__I ();
	    var box = engine.get_register (T_BOX, reg);
	    engine.trace ('copy box %d', reg);
	    engine.handle_finished_box (box.clone ());
	};

	return CopyCommand;
    }) ());


    register_command ('box', (function BoxCommand_closure () {
	function BoxCommand () { Command.call (this); }
	inherit (BoxCommand, Command);
	var proto = BoxCommand.prototype;
	proto.name = 'box';
	proto.boxlike = true;

	proto.invoke = function BoxCommand_invoke (engine) {
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function BoxCommand_start_box (engine) {
	    var reg = engine.scan_char_code__I ();
	    var box = engine.get_register (T_BOX, reg);
	    engine.trace ('fetch box %d', reg);
	    engine.set_register (T_BOX, reg, new VoidBox ());
	    engine.handle_finished_box (box);
	};

	return BoxCommand;
    }) ());


    register_command ('vsplit', (function VsplitCommand_closure () {
	function VsplitCommand () { Command.call (this); }
	inherit (VsplitCommand, Command);
	var proto = VsplitCommand.prototype;
	proto.name = 'vsplit';
	proto.boxlike = true;

	proto.invoke = function VsplitCommand_invoke (engine) {
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function VsplitCommand_start_box (engine) {
	    var reg = engine.scan_char_code__I ();
	    var box = engine.get_register (T_BOX, reg);

	    if (!engine.scan_keyword ('to'))
		throw new TexRuntimeError ('expected keyword "to"');

	    var depth_S = engine.scan_dimen__O_S (false);
	    engine.trace ('vsplit box %d to %S [fake impl]', reg, depth_S);

	    // TODO: use splitmaxdepth, splittopskip, etc. See TeXBook p. 124, T:TP~977.

	    if (box.btype == BT_VOID) {
		engine.handle_finished_box (new VoidBox ());
		return;
	    }

	    if (box.btype == BT_HBOX)
		throw new TexRuntimeError ('cannot \\vsplit an hbox');

	    engine.set_register (T_BOX, reg, new VoidBox ());
	    engine.handle_finished_box (box);
	};

	return VsplitCommand;
    }) ());


    register_command ('lastbox', (function LastboxCommand_closure () {
	function LastboxCommand () { Command.call (this); }
	inherit (LastboxCommand, Command);
	var proto = LastboxCommand.prototype;
	proto.name = 'lastbox';
	proto.boxlike = true;

	proto.invoke = function LastboxCommand_invoke (engine) {
	    engine.scan_box_for_accum (this);
	};

	proto.start_box = function LastboxCommand_start_box (engine) {
	    var m = engine.mode ();
	    if (m == M_VERT)
		throw new TexRuntimeError ('cannot use \\lastbox in vertical mode');
	    if (m == M_MATH || m == M_DMATH) {
		engine.handle_finished_box (new VoidBox ());
		return;
	    }

	    var last = engine.get_last_listable ();
	    if (last == null || last.ltype != LT_BOX || last.btype == BT_VOID) {
		engine.handle_finished_box (new VoidBox ());
		return;
	    }

	    engine.pop_last_listable ();
	    engine.handle_finished_box (last);
	};

	return LastboxCommand;
    }) ());


    // Box conditionals.

    function if_boxtype (engine, wanttype) {
	engine.start_parsing_condition ();
	var reg = engine.scan_char_code__I ();
	engine.done_parsing_condition ();
	var btype = engine.get_register (T_BOX, reg).btype;
	var result = (btype == wanttype);
	engine.trace ('if%s %s => %b', bt_names[wanttype], bt_names[btype], result);
	engine.handle_if (result);
    };

    register_command ('ifvoid', function cmd_ifvoid (engine) {
	if_boxtype (engine, BT_VOID);
    });

    register_command ('ifhbox', function cmd_ifhbox (engine) {
	if_boxtype (engine, BT_HBOX);
    });

    register_command ('ifvbox', function cmd_ifvbox (engine) {
	if_boxtype (engine, BT_VBOX);
    });


    // Box properties.

    register_command ('wd', (function WdCommand_closure () {
	function WdCommand () { Command.call (this); }
	inherit (WdCommand, Command);
	var proto = WdCommand.prototype;
	proto.name = 'wd';

	proto.invoke = function WdCommand_invoke (engine) {
	    // NOTE: you can't e.g. do \advance\wd0 so implementing as a settable
	    // Valref is not so important.
	    var reg = engine.scan_char_code__I ();
	    engine.scan_optional_equals ();
	    var width_S = engine.scan_dimen__O_S (false);
	    var box = engine.get_register (T_BOX, reg);

	    if (box.btype == BT_VOID) {
		engine.trace ('\\wd%d = %S -- noop on void box', reg, width_S);
	    } else {
		engine.trace ('\\wd%d = %S', reg, width_S);
		box.width_S = width_S;
	    }
	};

	proto.get_valtype = function WdCommand_get_valtype () {
	    return T_DIMEN;
	};

	proto.as_valref = function WdCommand_as_valref (engine) {
	    var reg = engine.scan_char_code__I ();
	    var box = engine.get_register (T_BOX, reg);
	    return new ConstantValref (T_DIMEN, box.width_S);
	};

	return WdCommand;
    }) ());


    register_command ('ht', (function HtCommand_closure () {
	function HtCommand () { Command.call (this); }
	inherit (HtCommand, Command);
	var proto = HtCommand.prototype;
	proto.name = 'ht';

	proto.invoke = function HtCommand_invoke (engine) {
	    // NOTE: you can't e.g. do \advance\ht0 so implementing as a settable
	    // Valref is not so important.
	    var reg = engine.scan_char_code__I ();
	    engine.scan_optional_equals ();
	    var height_S = engine.scan_dimen__O_S (false);
	    var box = engine.get_register (T_BOX, reg);

	    if (box.btype == BT_VOID) {
		engine.trace ('\\ht%d = %S -- noop on void box', reg, height_S);
	    } else {
		engine.trace ('\\ht%d = %S', reg, height_S);
		box.height_S = height_S;
	    }
	};

	proto.get_valtype = function HtCommand_get_valtype () {
	    return T_DIMEN;
	};

	proto.as_valref = function HtCommand_as_valref (engine) {
	    var reg = engine.scan_char_code__I ();
	    var box = engine.get_register (T_BOX, reg);
	    return new ConstantValref (T_DIMEN, box.height_S);
	};

	return HtCommand;
    }) ());


    register_command ('dp', (function DpCommand_closure () {
	function DpCommand () { Command.call (this); }
	inherit (DpCommand, Command);
	var proto = DpCommand.prototype;
	proto.name = 'dp';

	proto.invoke = function DpCommand_invoke (engine) {
	    // NOTE: you can't e.g. do \advance\dp0 so implementing as a settable
	    // Valref is not so important.
	    var reg = engine.scan_char_code__I ();
	    engine.scan_optional_equals ();
	    var depth_S = engine.scan_dimen__O_S (false);
	    var box = engine.get_register (T_BOX, reg);

	    if (box.btype == BT_VOID) {
		engine.trace ('\\dp%d = %S -- noop on void box', reg, depth_S);
	    } else {
		engine.trace ('\\dp%d = %S', reg, depth_S);
		box.depth_S = depth_S;
	    }
	};

	proto.get_valtype = function DpCommand_get_valtype () {
	    return T_DIMEN;
	};

	proto.as_valref = function DpCommand_as_valref (engine) {
	    var reg = engine.scan_char_code__I ();
	    var box = engine.get_register (T_BOX, reg);
	    return new ConstantValref (T_DIMEN, box.depth_S);
	};

	return DpCommand;
    }) ());


    // Unboxing.

    register_command ('unhbox', function cmd_unhbox (engine) {
	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.

	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.trace ('unhbox %d (but void)', reg);
	    return;
	}

	if (box.btype != BT_HBOX)
	    throw new TexRuntimeError ('trying to unhbox non-hbox reg %d: %U', reg, box);

	engine.trace ('unhbox %d (non-void) -> %U', reg, box);
	engine.set_register (T_BOX, reg, new VoidBox ());
	engine.accum_list (box.list);
    });


    register_command ('unvbox', function cmd_unvbox (engine) {
	if (engine.ensure_vertical (this))
	    return; // command will be reread after this graf is finished.

	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID) {
	    engine.trace ('unvbox %d (but void)', reg);
	    return;
	}

	if (box.btype != BT_VBOX)
	    throw new TexRuntimeError ('trying to unvbox non-vbox reg %d: %U', reg, box);

	engine.trace ('unvbox %d (non-void)', reg);
	engine.set_register (T_BOX, reg, new VoidBox ());
	engine.accum_list (box.list);
    });


    register_command ('unhcopy', function cmd_unhcopy (engine) {
	if (engine.ensure_horizontal (this))
	    return; // this command will be reread after new paragraph is started.

	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID)
	    return;

	if (box.btype != BT_HBOX)
	    throw new TexRuntimeError ('trying to unhcopy a non-hbox');

	engine.trace ('unhcopy %d', reg);
	engine.accum_list (box.list.slice ());
    });


    register_command ('unvcopy', function cmd_unvcopy (engine) {
	if (engine.ensure_vertical (this))
	    return; // command will be reread after this graf is finished.

	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);

	if (box.btype == BT_VOID)
	    return;

	if (box.btype != BT_VBOX)
	    throw new TexRuntimeError ('trying to unvcopy a non-vbox');

	engine.trace ('unvcopy %d', reg);
	engine.accum_list (box.list.slice ());
    });


    // Shifting boxes. Sign conventions: TTP 185.

    function shift_a_box (engine, desc, negate) {
	var amount_S = engine.scan_dimen__O_S (false);
	engine.trace ('%s next box by %S ...', desc, amount_S);

	function shift_the_box (engine, box) {
	    engine.trace ('... finish %s', desc);
	    if (negate)
		amount_S *= -1;
	    box.shift_amount_S = box.shift_amount_S + amount_S;
	    engine.accum (box);
	}

	engine.scan_box (shift_the_box, false);
    };

    register_command ('lower', function cmd_lower (engine) {
	shift_a_box (engine, 'lower', false);
    });

    register_command ('raise', function cmd_raise (engine) {
	shift_a_box (engine, 'raise', true);
    });

    register_command ('moveright', function cmd_moveright (engine) {
	shift_a_box (engine, 'moveright', false);
    });

    register_command ('moveleft', function cmd_moveleft (engine) {
	shift_a_box (engine, 'moveleft', true);
    });

    // Diagnostics.

    register_command ('showbox', function cmd_showbox (engine) {
	var reg = engine.scan_register_num__I ();
	var box = engine.get_register (T_BOX, reg);
	engine.trace ('showbox %d = %U', reg, box);
    });

}) ();
