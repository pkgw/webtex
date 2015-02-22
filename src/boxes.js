// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

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

    proto.set_glue__OOS = function HBox_set_glue__OOS (engine, is_exact, spec_S, adjustments) {
	// TTP 649, "hpack".
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
	    } else if (adjustments != null) {
		if ((item instanceof Adjustment) ||
		    (item instanceof Insertion) ||
		    (item instanceof Mark)) {
		    adjustments.push (item);
		    this.list.splice (i, 1); // XXX inefficient
		}
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

    proto.expand_adjustments = function VBox_expand_adjustments (engine) {
	// This is a Webtex output hack. We don't do any page building
	// or \output routine handling, which means that we need to
	// manually pull out the contents of \vadjusts, etc, to get them
	// to be processed on the MVL.

	var newlist = [];

	for (var i = 0; i < this.list.length; i++) {
	    var item = this.list[i];

	    if ((item instanceof Adjustment) ||
		(item instanceof Insertion)) {
		Array.prototype.push.apply (newlist, item.list);
	    } else if (item instanceof Mark) {
		engine.warn ('discarding mark tokens: %T', item.toks);
	    } else {
		newlist.push (item);
	    }
	}

	this.list = newlist;
    };

    return VBox;
}) ();


(function boxes_closure () {
    engine_proto.register_state ({
	engine_init: function (engine) {
	    engine.boxop_stack = [];
	},
	is_clean: function (engine) {
	    return engine.boxop_stack.length == 0;
	},
    });


    function accum_box (engine, box) {
	// Accumulate some box into the current list. Both math and vertical
	// modes have wrinkles. TTP 1076.

	if (engine.absmode () == M_DMATH) {
	    engine.trace ('... accumulate the finished box (math)');
	    var ord = new AtomNode (MT_ORD);
	    ord.nuc = box;
	    engine.accum (ord);
	} else if (engine.absmode () == M_VERT) {
	    engine.trace ('... accumulate the finished box (vertical)');
	    engine.accum_to_vlist (box);
	    if (engine.pending_adjustments.length) {
		engine.accum_list (engine.pending_adjustments);
		engine.pending_adjustments = [];
	    }
	} else {
	    engine.trace ('... accumulate the finished box (non-math)');
	    engine.accum (box);
	    engine.set_spacefactor (1000);
	}
    }

    engine_proto.register_method ('scan_box', function Engine_scan_box (callback, is_assignment) {
	// Scan in some kind of box value. This can resolve itself
	// instantaneously (if the box value is something like \box123) or
	// much, much later (if the box value is something like
	// \vbox{.......}).
	//
	// TODO: deal with leader_flag and hrule stuff; should accept: \box,
	// \copy, \lastbox, \vsplit, \hbox, \vbox, \vtop

	var tok = this.scan_next_unexpandable ();
	var cmd = tok.to_cmd (this);
	if (typeof cmd.start_box !== 'function')
	    throw new TexRuntimeError ('expected boxlike command but got %o', tok);

        this.boxop_stack.unshift ([callback, is_assignment]);
	cmd.start_box (this);
    });

    function scan_box_for_accum (engine, cmd) {
	// This version is for when a box-like command appears unadorned,
	// rather than as the argument to a separate command. In that case,
	// the relevant token/command has already been read in.
	engine.boxop_stack.unshift ([accum_box, false]);
	cmd.start_box (engine);
    }

    function handle_finished_box (engine, box) {
	// A start_box() function on a command should eventually cause
	// handle_finished_box() to be called. This can happen
	// instantaneously (if it's e.g. \hcopy{}) or much later, after
	// some large group has ended (e.g. \hbox{....}).

	var t = engine.boxop_stack.shift ();
	var boxop = t[0], isassignment = t[1];

	if (isassignment && engine.after_assign_token != null) {
	    // Engine is an assignment expression. TODO: afterassign token in
	    // boxes gets inserted at beginning of box token list, before
	    // every[hv]box token lists (TeXbook p. 279)
	    throw new TexRuntimeError ('afterassignment for boxes');
	}

	engine.trace ('finished: %U', box);
	boxop (engine, box);
    }

    function enter_box_construction (engine, boxtype, newmode, is_vtop) {
	// This starts the construction of an \hbox-type box, where we need to
	// enter a sub-group and potentially do a lot of processing. This
	// should be called inside a start_box() handler, since we will call
	// handle_finished_box when the box is finally finished being
	// constructed. TTP 1083.

	var is_exact, spec_S;

	if (engine.scan_keyword ('to')) {
	    is_exact = true;
	    spec_S = engine.scan_dimen__O_S (false);
	} else if (engine.scan_keyword ('spread')) {
	    is_exact = false;
	    spec_S = engine.scan_dimen__O_S (false);
	} else {
	    is_exact = false;
	    spec_S = nlib.Zero_S;
	}

	function leave_box_construction (engine) {
	    // TTP 1085, 1086
	    engine.trace ('leave_box_construction is_exact=%b spec=%S', is_exact, spec_S);

	    if (boxtype == BT_VBOX)
		engine.end_graf (); // in case we were in the middle of one. Noop if not.

	    engine.unnest_eqtb ();
	    var box = ListBox.create (boxtype);
	    box.list = engine.leave_mode ();
	    box.set_glue__OOS (engine, is_exact, spec_S, engine.pending_adjustments);
	    if (is_vtop)
		box.adjust_as_vtop ();
	    handle_finished_box (engine, box);
	}

	engine.nest_eqtb (); // scan_spec does these two automagically
	engine.scan_left_brace ();

	if (boxtype == BT_VBOX) {
	    engine.normal_paragraph ();
	    engine.enter_mode (newmode);
	    engine.set_prev_depth_to_ignore ();
	    engine.maybe_push_toklist ('everyvbox');
	} else {
	    engine.enter_mode (newmode);
	    engine.set_spacefactor (1000);
	    engine.maybe_push_toklist ('everyhbox');
	}

	engine.enter_group (bt_names[boxtype], leave_box_construction);
    }

    // Commands that yield boxes.

    var BoxValuedCommand = (function BoxValuedCommand_closure () {
	function BoxValuedCommand () { Command.call (this); }
	inherit (BoxValuedCommand, Command);
	var proto = BoxValuedCommand.prototype;

	proto.invoke = function BoxValuedCommand_invoke (engine) {
	    engine.trace ('%s: accumulate', this.name);
	    scan_box_for_accum (engine, this);
	};

	proto.start_box = function BoxValuedCommand_start_box (engine) {
	    throw new TexRuntimeError ('unimplemented start_box() for %o', this);
	};

	return BoxValuedCommand;
    }) ();

    function register_box_command (name, start_box) {
	var cmd = new BoxValuedCommand ();
	cmd.name = name;
	cmd.start_box = start_box.bind (cmd);
	register_command (name, cmd);
    }

    register_box_command ('hbox', function hbox_start_box (engine) {
	enter_box_construction (engine, BT_HBOX, M_RHORZ, false);
    });

    register_box_command ('vbox', function vbox_start_box (engine) {
	    enter_box_construction (engine, BT_VBOX, M_IVERT, false);
    });

    register_box_command ('vtop', function vtop_start_box (engine) {
	    enter_box_construction (engine, BT_VBOX, M_IVERT, true);
    });

    register_box_command ('copy', function copy_start_box (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	engine.trace ('copy box %d', reg);
	handle_finished_box (engine, box.clone ());
    });

    register_box_command ('box', function box_start_box (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);
	engine.trace ('fetch box %d', reg);
	engine.set_register (T_BOX, reg, new VoidBox ());
	handle_finished_box (engine, box);
    });

    register_box_command ('vsplit', function vsplit_start_box (engine) {
	var reg = engine.scan_char_code__I ();
	var box = engine.get_register (T_BOX, reg);

	if (!engine.scan_keyword ('to'))
	    throw new TexRuntimeError ('expected keyword "to"');

	var depth_S = engine.scan_dimen__O_S (false);
	engine.trace ('vsplit box %d to %S [fake impl]', reg, depth_S);

	// TODO: use splitmaxdepth, splittopskip, etc. See TeXBook p. 124, T:TP~977.

	if (box.btype == BT_VOID) {
	    handle_finished_box (engine, new VoidBox ());
	} else if (box.btype == BT_HBOX) {
	    throw new TexRuntimeError ('cannot \\vsplit an hbox');
	} else {
	    engine.set_register (T_BOX, reg, new VoidBox ());
	    handle_finished_box (engine, box);
	}
    });

    register_box_command ('lastbox', function lastbox_start_box (engine) {
	var m = engine.mode ();

	if (m == M_VERT) {
	    throw new TexRuntimeError ('cannot use \\lastbox in vertical mode');
	} else if (Math.abs (m) == M_DMATH) {
	    handle_finished_box (engine, new VoidBox ());
	} else {
	    var last = engine.get_last_listable ();
	    if (last == null || last.ltype != LT_BOX || last.btype == BT_VOID) {
		handle_finished_box (engine, new VoidBox ());
	    } else {
		engine.pop_last_listable ();
		handle_finished_box (engine, last);
	    }
	}
    });


    // Setbox.

    register_command ('setbox', function cmd_setbox (engine) {
	var reg = engine.scan_char_code__I ();
	engine.scan_optional_equals ();
	engine.trace ('setbox: queue #%d = ...', reg);

	// We have to remember the global-ness of the assignment operation
	// since the callback may be called somewhere much later in the
	// processing.

	var is_global = engine.global_prefix_is_active ();

        function set_the_box (engine, box) {
	    // handle_finished_box() has already printed the box contents
            engine.trace ('... finish setbox to #%d (g? %b)', reg, is_global);
            engine.eqtb.set_register (T_BOX, reg, box, is_global);
	    engine.maybe_insert_after_assign_token ();
	}

        engine.scan_box (set_the_box, true);
    });


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

    var BoxDimenValref = (function BoxDimenValref_closure () {
	function BoxDimenValref (reg, propname_S) {
	    if (!(reg >= 0 && reg <= 255))
		throw new TexInternalError ('illegal box register %o', reg);

	    Valref.call (this, T_DIMEN);
	    this.reg = reg;
	    this.propname_S = propname_S;
	}

	inherit (BoxDimenValref, Valref);
	var proto = BoxDimenValref.prototype;

	proto.get = function BoxDimenValref_get (engine) {
	    var box = engine.get_register (T_BOX, this.reg);
	    return Value.ensure_boxed (T_DIMEN, box[this.propname_S]);
	};

	proto.set = function BoxDimenValref_set (engine, value_S) {
	    value_S = Value.ensure_unboxed (T_DIMEN, value_S);
	    var box = engine.get_register (T_BOX, this.reg);

	    if (box.btype == BT_VOID)
		engine.trace ('setting %s of box #%d to %S: noop -- void box',
			      this.propname_S, this.reg, value_S);
	    else
		box[this.propname_S] = value_S;
	};

	return BoxDimenValref;
    }) ();

    register_assignment_command ('wd', T_DIMEN, function wd_as_valref (engine) {
	var reg = engine.scan_char_code__I ();
	return new BoxDimenValref (reg, 'width_S');
    });

    register_assignment_command ('ht', T_DIMEN, function ht_as_valref (engine) {
	var reg = engine.scan_char_code__I ();
	return new BoxDimenValref (reg, 'height_S');
    });

    register_assignment_command ('dp', T_DIMEN, function dp_as_valref (engine) {
	var reg = engine.scan_char_code__I ();
	return new BoxDimenValref (reg, 'depth_S');
    });


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
