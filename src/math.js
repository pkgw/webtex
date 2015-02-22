// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Math layout.
//
// The listables correspond to "noads" in TeX. Math lists can contain these
// Nodes as well as the Listables Ins, Mark, Adjust, Whatsit, Penalty, Disc,
// Rule, BoxGlue, and Kern.

var LIMTYPE_NORMAL = 0, // <- limits-style or not depending on context
    LIMTYPE_LIMITS = 1,
    LIMTYPE_NOLIMITS = 2;


var Delimiter = (function Delimiter_closure () {
    function Delimiter () {
	this.small_fam = null;
	this.small_ord = null;
	this.large_fam = null;
	this.large_ord = null;
    }

    var proto = Delimiter.prototype;

    proto.toString = function Delimiter_toString () {
	return '<Delimiter sf=' + this.small_fam + ' so=' + this.small_ord +
	    ' lf=' + this.large_fam + ' lo=' + this.large_ord + '>';
    };

    return Delimiter;
}) ();


var MathNode = (function MathNode_closure () {
    // Something that can be put in a box; or more precisely, a horizontal or
    // vertical list.
    function MathNode (ltype) {
	this.ltype = ltype;

	// Blah too lazy to subclass just for this
	if (ltype == MT_OP)
	    this.limtype = LIMTYPE_NORMAL;
    }

    inherit (MathNode, Listable);
    var proto = MathNode.prototype;

    return MathNode;
}) ();


var AtomNode = (function AtomNode_closure () {
    // An "atom" that contains a nucleus, subscript, and/or superscript. Each
    // of these can be a MathChar, MathTextChar, Box, Array (of MathNodes), or
    // null.
    //
    // Most of the math types are represented as an AtomNode instance: Ord,
    // Op, Bin, Rel, Open, Close, Punct, Inner, Radical, Under, Over, Accent,
    // Vcenter.

    function AtomNode (ltype) {
	if (ltype < MT_ORD || ltype > MT_VCENTER)
	    throw new TexInternalError ('illegal Atom type %d', ltype);

	MathNode.call (this, ltype);
	this.nuc = null;
	this.sub = null;
	this.sup = null;
    }

    inherit (AtomNode, MathNode);
    var proto = AtomNode.prototype;

    proto._uisummary = function AtomNode__uisummary () {
	return 'Atom ' + mt_names[this.ltype - MT_ORD];
    };

    proto._uiitems = function AtomNode__uiitems () {
	var uilist = [this._uisummary () + ' {'];
	ml._addui (uilist, 'nuc', this.nuc);
	ml._addui (uilist, 'sub', this.sub);
	ml._addui (uilist, 'sup', this.sup);
	uilist.push ('}');
	return uilist;
    };

    return AtomNode;
}) ();


var MathChar = (function MathChar_closure () {
    function MathChar (fam, ord) {
	this.fam = fam;
	this.ord = ord;
    }

    var proto = MathChar.prototype;

    proto.as_text_char = function MathChar_as_text_char () {
	return new MathTextChar (this.fam, this.ord);
    };

    return MathChar;
}) ();


var MathTextChar = (function MathTextChar_closure () {
    function MathTextChar (fam, ord) {
	this.fam = fam;
	this.ord = ord;
    }

    var proto = MathTextChar.prototype;

    proto.as_plain_char = function MathTextChar_as_plain_char () {
	return new MathChar (this.fam, this.ord);
    };

    return MathTextChar;
}) ();


var RadicalNode = (function RadicalNode_closure () {
    function RadicalNode () {
	AtomNode.call (this, MT_RADICAL);
	this.left_delim = new Delimiter ();
    }

    inherit (RadicalNode, AtomNode);
    var proto = RadicalNode.prototype;

    proto._uisummary = function RadicalNode__uisummary () {
	return 'Radical left=' + this.left_delim;
    };

    return RadicalNode;
}) ();


var FractionNode = (function FractionNode_closure () {
    function FractionNode () {
	// In TeX, numer and denom must always be math lists.
	MathNode.call (this, MT_FRACTION);
	this.thickness_S = null;
	this.denom = null;
	this.numer = null;
	this.left_delim = new Delimiter ();
	this.right_delim = new Delimiter ();
    }

    inherit (FractionNode, MathNode);
    var proto = FractionNode.prototype;

    proto._uisummary = function FractionNode__uisummary () {
	return format ('Fraction thickness=%S left=%o right=%o',
		       this.thickness_S, this.left_delim, this.right_delim);
    };

    proto._uiitems = function FractionNode__uiitems () {
	var uilist = [this._uisummary () + ' {'];
	ml._addui (uilist, 'numer', this.numer);
	ml._addui (uilist, 'denom', this.denom);
	uilist.push ('}');
	return uilist;
    };

    return FractionNode;
}) ();


var AccentNode = (function AccentNode_closure () {
    function AccentNode () {
	AtomNode.call (this, MT_ACCENT);
	this.accent_fam = null;
	this.accent_ord = null;
    }

    inherit (AccentNode, AtomNode);
    var proto = AccentNode.prototype;

    proto._uisummary = function AccentNode__uisummary () {
	return 'Accent fam=' + this.accent_fam + ' ord=' + this.accent_ord;
    };

    return AccentNode;
}) ();


var DynDelimNode = (function DynDelimNode_closure () {
    // A dynamically-sized delimiter: may be of math type MT_LEFT or MT_RIGHT.

    function DynDelimNode (ltype) {
	MathNode.call (this, ltype);
	this.delimiter = new Delimiter ();
    }

    inherit (DynDelimNode, MathNode);
    var proto = DynDelimNode.prototype;

    proto._uisummary = function DynDelimNode__uisummary () {
	return 'DynDelim ' + this.delimiter;
    };

    return DynDelimNode;
}) ();


var MathStyleNode = (function MathStyleNode_closure () {
    function MathStyleNode (style, cramped) {
	MathNode.call (this, MT_STYLE);
	this.style = style;
	this.cramped = cramped;
    }

    inherit (MathStyleNode, MathNode);
    var proto = MathStyleNode.prototype;

    proto._uisummary = function MathStyleNode__uisummary () {
	return 'MathStyle ' + ms_names[this.style] + ' c=' + this.cramped;
    };

    return MathStyleNode;
}) ();


var StyleChoiceNode = (function StyleChoiceNode_closure () {
    function StyleChoiceNode () {
	MathNode.call (this, MT_SCHOICE);
	this.in_display = null;
	this.in_text = null;
	this.in_script = null;
	this.in_scriptscript = null;
    }

    inherit (StyleChoiceNode, MathNode);
    var proto = StyleChoiceNode.prototype;

    proto._uisummary = function StyleChoiceNode__uisummary () {
	return 'StyleChoice';
    };

    proto._uiitems = function FractionNode__uiitems () {
	var uilist = [this._uisummary () + ' {'];
	ml._addui (uilist, 'display', this.in_display);
	ml._addui (uilist, 'text', this.in_text);
	ml._addui (uilist, 'script', this.in_script);
	ml._addui (uilist, 'scriptscript', this.in_scriptscript);
	uilist.push ('}');
	return uilist;
    };

    return StyleChoiceNode;
}) ();


var mathlib = (function mathlib_closure () {
    var ml = {};

    ml._addui = function mathlib__addui (uilist, desc, elem) {
	if (elem == null)
	    return;

	if (elem instanceof MathChar) {
	    uilist.push ('  ' + desc + '= char fam=' + elem.fam + ' ord=' + elem.ord);
	    return;
	}

	if (elem instanceof MathTextChar) {
	    uilist.push ('  ' + desc + '= tchar fam=' + elem.fam + ' ord=' + elem.ord);
	    return;
	}

	if (elem instanceof ListBox) {
	    var pfx = '  ' + desc + '= ';
	    var sublist = elem._uiitems ();

	    for (var i = 0; i < sublist.length; i++) {
		uilist.push (pfx + sublist[i]);
		pfx = '    ';
	    }
	} else {
	    // List of math items
	    var pfx = '  ' + desc + '= {';

	    for (var i = 0; i < elem.length; i++) {
		var sublist = elem[i]._uiitems ();
		for (var j = 0; j < sublist.length; j++) {
		    uilist.push (pfx + sublist[j]);
		    pfx = '    ';
		}
	    }

	    uilist.push ('  }');
	}
    }

    // Scaling math units

    function mu_mult__SSS_S (n_S, x_S, f_S) {
	// TTP 716. Type-safety violations are intentional.
	var tmp_S = nlib.xn_over_d__ISI_SS (x_S, f_S, 0x10000)[0];
	return nlib.nx_plus_y__ISS_S (n_S, x_S, tmp_S);
    }

    function scale_math_glue (state, muglue) {
	// TTP 716.
	var tmp_SS = nlib.x_over_n__SI_SS (state.mu_S, 0x10000);
	var n_S = tmp_SS[0],
	    f_S = tmp_SS[1];

	if (f_S < nlib.Zero_S) {
	    n_S -= 1;
	    f_S += 0x10000;
	}

	var g = new Glue ();
	g.amount_S = mu_mult__SSS_S (n_S, muglue.amount_S, f_S);

	g.stretch_order = muglue.stretch_order;
	if (g.stretch_order == 0)
	    g.stretch_S = mu_mult__SSS_S (n_S, muglue.stretch_S, f_S);
	else
	    g.stretch_S = muglue.stretch_S;

	g.shrink_order = muglue.shrink_order;
	if (g.shrink_order == 0)
	    g.shrink_S = mu_mult__SSS_S (n_S, muglue.shrink_S, f_S);
	else
	    g.shrink_S = muglue.shrink_S;

	return g;
    }

    ml.set_math_char = function mathlib_set_math_char (engine, ord, mathcode, cur_fam) {
	// T:TP 1155.
	if (mathcode >= 0x8000) {
	    // Treat as active character. Right semantics here?
	    var cmd = engine.get_active (ord);
	    if (cmd == null)
		throw new TexRuntimeError ('mathcode %d implies active ' +
					   'character but it isn\'t', mathcode);
	    engine.push (Token.new_cmd (cmd));
	    return null;
	}

	var ord = mathcode & 0xFF;
	var fam = (mathcode >> 8) & 0xF;
	var ltype = ((mathcode >> 12) & 0x7) + MT_ORD;

	if (mathcode >= 0x7000) {
	    if (cur_fam >= 0 && cur_fam < 16)
		fam = cur_fam;
	    ltype = MT_ORD;
	}

	var atom = new AtomNode (ltype);
	atom.nuc = new MathChar (fam, ord);
	return atom;
    };

    // Scanning equations and built-in math commands

    var default_thickness_marker_S = 0x40000000;

    function finish_math_list (engine, trailing_right_node) {
	// TTP 1184 "fin_mlist"
	var umn = engine.get_unfinished_math_node ();
	var retval = engine.leave_mode ();

	if (umn == null) {
	    if (trailing_right_node != null)
		retval.push (trailing_right_node);
	} else {
	    umn.denom = retval;

	    if (trailing_right_node == null)
		retval = [umn];
	    else {
		// "{\left| a \over b \right|}" was temporarily parsed as
		// `FractionNode { numer = \left| a, denom = b }` ; we need to
		// pull the \left| out of the fraction.
		if (umn.numer[0].ltype != MT_LEFT)
		    throw new TexRuntimeError ('\\right must come after \\left');

		var left = umn.numer.shift ();
		retval = [left, umn, trailing_right_node];
	    }
	}

	return retval;
    }
    ml.finish_math_list = finish_math_list;

    ml.scan_math = function mathlib_scan_math (engine, callback) {
	// T:TP 1151
	var tok = null;

	while (true) {
	    tok = engine.next_x_tok_throw ();
	    if (!tok.is_space (engine) && !tok.is_cmd (engine, 'relax'))
		break;
	}

	var cmd = tok.to_cmd (engine);
	var c = null;
	var check_active = false;

	if (cmd instanceof InsertLetterCommand || cmd instanceof InsertOtherCommand ||
	    cmd instanceof GivenCharCommand) {
	    c = engine.get_code (CT_MATH, cmd.ord);
	    check_active = true;
	} else if (cmd instanceof GivenMathcharCommand) {
	    c = cmd.mathchar;
	} else if (cmd.same_cmd (engine.commands['char'])) {
	    c = engine.get_code (CT_MATH, engine.scan_char_code__I ());
	    check_active = true;
	} else if (cmd.same_cmd (engine.commands['mathchar'])) {
	    c = engine.scan_int_15bit__I ();
	}
	// XXX unimplemented: \delimiter case

	if (check_active && c == 0x8000) {
	    // Treat as active character. Right semantics here?
	    cmd = engine.get_active (ord);
	    if (cmd == null)
		throw new TexRuntimeError ('mathcode %d implies active ' +
					   'character but it isn\'t', mathcode);
	    engine.push (Token.new_cmd (cmd));
	    ml.scan_math (engine, callback);
	    return;
	}

	if (c != null) {
	    var ord = c & 0xFF;
	    var fam = (c >> 8) % 16;

	    if (c >= 0x7000) {
		var cf = engine.get_parameter__O_I ('fam');
		if (cf >= 0 && cf <= 15)
		    fam = cf;
	    }

	    callback (engine, new MathChar (fam, ord));
	    return;
	}

	// If we got here, we must see a brace-enclosed subformula.

	engine.push_back (tok);
	engine.scan_left_brace ();
	engine.enter_math (M_MATH, false);
	engine.enter_group ('submath', function (eng) {
	    var list = finish_math_list (eng, null);
	    eng.unnest_eqtb ();
	    callback (eng, list);
	});
    };

    ml.scan_delimiter = function mathlib_scan_delimiter (engine, is_radical) {
	var val = null;

	if (is_radical)
	    val = engine.scan_int_27bit__I ();
	else {
	    var tok = null; // T:TP 404 -- next non-blank non-relax non-call token:

	    while (true) {
		tok = engine.next_x_tok_throw ();
		if (!tok.is_space (engine) && !tok.is_cmd (engine, 'relax'))
		    break;
	    }

	    var cmd = tok.to_cmd (engine);
	    if (cmd instanceof InsertLetterCommand ||
		cmd instanceof InsertOtherCommand)
		val = engine.get_code (CT_DELIM, cmd.ord);
	    else
		// XXX: not handling \delimiter
		throw new TexRuntimeError ('expected math delimiter; got %o', tok);
	}

	var d = new Delimiter ();
	d.small_fam = (val >> 20) & 0xF;
	d.small_ord = (val >> 12) & 0xFF;
	d.large_fam = (val >> 8) & 0xF;
	d.large_ord = (val >> 0) & 0xFF;
	return d;
    };

    // Entering and leaving math mode

    function init_math (engine) {
	// TTP 1138, "init_math"
	var m = engine.mode ();
	var tok = engine.next_tok_throw ();
	if (tok.to_cmd (engine) instanceof MathShiftCommand &&
	    (m == M_VERT || m == M_HORZ || m == M_DMATH)) { // XXX don't understand mode check
	    engine.end_graf ();
	    engine.trace ('math shift: enter display');
	    engine.enter_math (M_DMATH, true);

	    // TTP 1146: setting predisplaysize. We use the default, which is max_dimen:
	    engine.set_parameter__OS ('predisplaysize', 0x3fffffff);

	    // TeX futzes the display width based on the indentation parameters,
	    // but it's essentially hsize. TTP 1149.
	    engine.set_parameter__OS ('displaywidth',
				      engine.get_parameter__O_S ('hsize'));
	    engine.set_parameter__OS ('displayindent', nlib.Zero_S);
	    engine.maybe_push_toklist ('everydisplay');
	    // XXX: no pagebuilder
	} else {
	    engine.trace ('math shift: enter non-display');
	    engine.push_back (tok);
	    engine.enter_math (M_MATH, true);
	    engine.maybe_push_toklist ('everymath');
	}
    }

    function after_math (engine) {
	// TTP 1194, "after_math". Called when a math shift command causes us
	// to exit math mode. XXX: skipping TTP 1195 sanity checks.
	engine.trace ('math shift: exit');

	var first_mode = engine.mode ();
	var have_left_eqno = engine.mode_stack[0].math_eqno_is_left || false; // XXX hack
	var mlist = finish_math_list (engine, null); // causes us to leave the mode
	var eqno_box = null;

	if (first_mode == M_MATH && engine.mode () == M_DMATH) {
	    // The mode structure tells us that we were in an \eqno clause
	    // inside a math display. We need to save mlist as the eqno bit
	    // and finish up the actual main display math part.
	    var tok = engine.next_x_tok ();
	    if (!(tok.to_cmd (engine) instanceof MathShiftCommand))
		throw new TexRuntimeError ('display math must be ended with $$; got $ then %s', tok);

	    var eqlist = ml.mlist_to_hlist (engine, mlist, MS_TEXT, false, false);
	    eqno_box = hpack_natural (engine, eqlist);
	    // XXX recover whether we're \eqno or \leqno

	    mlist = finish_math_list (engine, null);
	    first_mode = M_DMATH;
	}

	if (first_mode == M_MATH) {
	    // TTP 1196. Text-mode math.
	    var ms_S = engine.get_parameter__O_S ('mathsurround');
	    engine.accum (new MathDelim (ms_S, false));

	    var hlist = ml.mlist_to_hlist (engine, mlist, MS_TEXT, false, false);
	    var box = new HBox ();
	    box.list = hlist;
	    box.set_glue__OOS (engine, false, nlib.Zero_S);

	    // XXX: we are appending the equation as a single box in canvas
	    // mode, rather than splicing in the list of boxes with canvas
	    // delimiters. This may break code that pokes back into the list
	    // of items after the math is rendered.
	    box.render_as_canvas = true;
	    engine.trace ('rendered math: %U', box);
	    engine.accum (box);

	    engine.accum (new MathDelim (ms_S, true));

	    engine.set_spacefactor (1000);
	    engine.unnest_eqtb ();
	} else {
	    // TTP 1199. Display-mode math. Check for second "$", if we
	    // haven't already done so.
	    if (eqno_box == null) {
		var tok = engine.next_x_tok ();
		if (!(tok.to_cmd (engine) instanceof MathShiftCommand))
		    throw new TexRuntimeError ('display math must be ended with $$; got $ then %s', tok);
	    }

	    var hlist = ml.mlist_to_hlist (engine, mlist, MS_DISPLAY, false, false);
	    var pending_adjustments = [];
	    var box = new HBox ();
	    box.list = hlist;
	    box.set_glue__OOS (engine, false, nlib.Zero_S, pending_adjustments);

	    var w_S = box.width_S;
	    var z_S = engine.get_parameter__O_S ('displaywidth');
	    var s_S = engine.get_parameter__O_S ('displayindent');
	    var e_S = nlib.Zero_S;
	    var q_S = nlib.Zero_S;

	    if (eqno_box != null) {
		// This is a pretty circuitous route to get the text-style
		// math quad size.
		var tmpstate = new MathState (engine, MS_TEXT, false);
		var mq_S = tmpstate.sym_dimen__NN_S (MS_TEXT, SymDimens.MathQuad);

		e_S = eqno_box.width_S;
		q_S = e_S + mq_S;
	    }

	    if (w_S + q_S > z_S) {
		// TTP 1201. Equation plus eq-number is wider than the space
		// we have. We may be able to make it fit by squeezing the
		// equation down, though. If we can't, we'll need to put the
		// equation number on its own line, something that can also be
		// forced by setting the number's width to 0.
		box.save_glue_info ();

		if (e_S != nlib.Zero_S && (box._glue_shrink_order > 0 ||
					   w_S - box._glue_shrink_S + q_S <= z_S)) {
		    box.set_glue__OOS (engine, true, z_S - q_S); // It fits!
		} else {
		    // It doesn't fit :-(
		    e_S = nlib.Zero_S;
		    if (w_S > z_S)
			box.set_glue__OOS (engine, true, z_S);
		    w_S = box.width_S;
		}
	    }

	    // TTP 1202
	    var d_S = half (z_S - w_S);

	    if (e_S > nlib.Zero_S && d_S < 2 * e_S) {
		d_S = half (z_S - w_S - e_S);
		if (mlist.length && mlist[0].ltype == LT_GLUE)
		    d_S = nlib.Zero_S;
	    }

	    // TTP 1203
	    engine.accum (new Penalty (engine.get_parameter__O_I ('predisplaypenalty')));
	    var g1, g2;

	    if (d_S + s_S <= engine.get_parameter__O_S ('predisplaysize') || have_left_eqno) {
		g1 = engine.get_parameter (T_GLUE, 'abovedisplayskip');
		g2 = engine.get_parameter (T_GLUE, 'belowdisplayskip');
	    } else {
		g1 = engine.get_parameter (T_GLUE, 'abovedisplayshortskip');
		g2 = engine.get_parameter (T_GLUE, 'belowdisplayshortskip');
	    }

	    if (have_left_eqno && e_S == nlib.Zero_S) {
		eqno_box.shift_amount_S = s_S;
		engine.accum_to_vlist (eqno_box);
		engine.accum (new Penalty (10000)); // "inf_penalty"
	    } else {
		engine.accum (new BoxGlue (g1));
	    }

	    // TTP 1204
	    if (e_S != nlib.Zero_S) {
		var r = new Kern (z_S - w_S - e_S - d_S);
		if (have_left_eqno) {
		    eqno_box.list.push (r);
		    eqno_box.list = eqno_box.list.concat (box_list);
		    box = eqno_box;
		    d_S = nlib.Zero_S;
		} else {
		    box.list.push (r);
		    box.list = box.list.concat (eqno_box.list);
		}

		box.set_glue__OOS (engine, false, nlib.Zero_S);
	    }

	    box.shift_amount_S = s_S + d_S;
	    engine.accum_to_vlist (box);

	    // TTP 1205
	    if (eqno_box != null && e_S == nlib.zero_S && !have_left_eqno) {
		engine.accum (new Penalty (10000)); // "inf_penalty"
		eqno_box.shift_amount_S = s_S + z_S - a.width_S;
		engine.accum_to_vlist (eqno_box);
		g2 = null;
	    }

	    engine.accum_list (pending_adjustments);
	    engine.accum (new Penalty (engine.get_parameter__O_I ('postdisplaypenalty')));

	    if (g2 != null)
		engine.accum (new BoxGlue (g2));

	    // TTP 1199
	    engine.unnest_eqtb ();
	    resume_after_display (engine);
	}
    }

    function handle_math_shift (engine, cmd) {
	// TTP 1090, 1137, 1193. Vertical mode? Command will be reread after new paragraph
	// is started.
	if (engine.ensure_horizontal (this))
	    return;

	if (engine.absmode () == M_HORZ)
	    init_math (engine);
	else
	    // XXX: check currently in math shift group.
	    after_math (engine);
    }
    ml.handle_math_shift = handle_math_shift;

    engine_proto.register_method ('enter_math', function Engine_enter_math (mode, is_outer) {
	// TTP 1136: "push_math", more or less
	this.enter_mode (mode);
	this.trace ('<is_outer=%b>', is_outer);
	this.nest_eqtb ();

	if (is_outer)
	    this.set_parameter (T_INT, 'fam', -1);
    });

    function resume_after_display (engine) {
	// TTP 1200 "resume_after_display". XXX not complete. Skips the
	// unnest_eqtb/"unsave".

	// XXX square off grouping, modes, etc.
	// XXX: moving pagebuilder invocation
	if (engine.mode () == M_VERT)
	    engine.run_page_builder ();

	engine.enter_mode (M_HORZ);
	engine.set_spacefactor (1000);
	// XXX: set clang, prev_graf
	engine.scan_one_optional_space ();
    }
    ml.resume_after_display = resume_after_display;

    // Math commands

    var MathComponentCommand = (function MathComponentCommand_closure () {
	function MathComponentCommand (name, mathtype) {
	    Command.call (this);
	    this.mathtype = mathtype;
	    this.name = name;
	}

	inherit (MathComponentCommand, Command);
	var proto = MathComponentCommand.prototype;

	proto.invoke = function MathComponentCommand_invoke (engine) {
	    if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
		throw new TexRuntimeError ('\\%s illegal outside of math mode', this.name);

	    engine.trace (this.name);
	    var node = new AtomNode (this.mathtype);

	    mathlib.scan_math (engine, function (engine, subitem) {
		node.nuc = subitem;
		engine.accum (node);
	    });
	};

	return MathComponentCommand;
    })();


    var MathStyleCommand = (function MathStyleCommand_closure () {
	function MathStyleCommand (name, mathstyle) {
	    Command.call (this);
	    this.mathstyle = mathstyle;
	    this.name = name;
	}

	inherit (MathStyleCommand, Command);
	var proto = MathStyleCommand.prototype;

	proto.invoke = function MathStyleCommand_invoke (engine) {
	    if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
		throw new TexRuntimeError ('\\%s illegal outside of math mode', this.name);
	    engine.trace (this.name);
	    engine.accum (new MathStyleNode (this.mathstyle, false));
	};

	return MathStyleCommand;
    })();


    register_command ('displaystyle', new MathStyleCommand ('displaystyle', MS_DISPLAY));
    register_command ('textstyle', new MathStyleCommand ('textstyle', MS_TEXT));
    register_command ('scriptstyle', new MathStyleCommand ('scriptstyle', MS_SCRIPT));
    register_command ('scriptscriptstyle', new MathStyleCommand ('scriptscriptstyle', MS_SCRIPTSCRIPT));

    register_command ('mathord', new MathComponentCommand ('mathord', MT_ORD));
    register_command ('mathop', new MathComponentCommand ('mathop', MT_OP));
    register_command ('mathbin', new MathComponentCommand ('mathbin', MT_BIN));
    register_command ('mathrel', new MathComponentCommand ('mathrel', MT_REL));
    register_command ('mathopen', new MathComponentCommand ('mathopen', MT_OPEN));
    register_command ('mathclose', new MathComponentCommand ('mathclose', MT_CLOSE));
    register_command ('mathpunct', new MathComponentCommand ('mathpunct', MT_PUNCT));
    register_command ('mathinner', new MathComponentCommand ('mathinner', MT_INNER));
    register_command ('underline', new MathComponentCommand ('underline', MT_UNDER));
    register_command ('overline', new MathComponentCommand ('overline', MT_OVER));

    register_command ('radical', function cmd_radical (engine) {
	// T:TP 1162-1163
	engine.trace ('radical');

	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('\\radical may only be used in math mode');

	var n = new RadicalNode ();
	engine.accum (n);

	n.left_delim = mathlib.scan_delimiter (engine, true);
	mathlib.scan_math (engine, function (eng, subitem) {
	    engine.trace ('... radical got: %o', subitem);
	    n.nuc = subitem;
	});
    });

    register_command ('mathchoice', function cmd_mathchoice (engine) {
	// T:TP 1171-1174
	engine.trace ('mathchoice');

	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('\\mathchoice may only be used in math mode');

	var mc = new StyleChoiceNode ();
	engine.accum (mc);
	mc._cur = 0;

	function finish_one (eng) {
	    var list = mathlib.finish_math_list (engine, null);
	    engine.unnest_eqtb ();

	    if (mc._cur == 0)
		mc.in_display = list;
	    else if (mc._cur == 1)
		mc.in_text = list;
	    else if (mc._cur == 2)
		mc.in_script = list;
	    else if (mc._cur == 3)
		mc.in_scriptscript = list;

	    mc._cur += 1;
	    if (mc._cur < 4)
		scan_one ();
	    else
		engine.trace ('... finished mathchoice: %o', mc);
	}

	function scan_one () {
	    engine.enter_math (M_MATH, false);
	    engine.enter_group ('mathchoice', finish_one);
	    engine.scan_left_brace ();
	}

	scan_one ();
    });


    function _cmd_limit_switch (engine, desc, value) {
	// T:TP 1158, 1159
	engine.trace (desc);
	if (engine.absmode () != M_DMATH)
	    throw new TexRuntimeError ('\\%s may only be used in math mode', desc);

	var last = engine.get_last_listable ();

	if (last == null ||
	    !(last instanceof AtomNode) ||
	    last.ltype != MT_OP)
	    throw new TexRuntimeError ('\\%s must follow an operator; got %s', desc, last);

	last.limtype = value;
    };

    register_command ('nolimits', function cmd_nolimits (engine) {
	_cmd_limit_switch (engine, 'nolimits', LIMTYPE_NOLIMITS);
    });

    register_command ('limits', function cmd_limits (engine) {
	_cmd_limit_switch (engine, 'limits', LIMTYPE_LIMITS);
    });

    register_command ('displaylimits', function cmd_displaylimits (engine) {
	_cmd_limit_switch (engine, 'displaylimits', LIMTYPE_NORMAL);
    });


    register_command ('mkern', function cmd_mkern (engine) {
	if (engine.absmode () != M_DMATH)
	    throw new TexRuntimeError ('\\mkern may only be used in math mode');

	var amount_S = engine.scan_dimen__O_S (true);
	engine.trace ('mkern of %S (mu)', amount_S);
	engine.accum (new Kern (amount_S, Kern.KIND_MATH));
    });

    register_command ('mskip', function cmd_mskip (engine) {
	if (engine.absmode () != M_DMATH)
	    throw new TexRuntimeError ('\\mskip may only be used in math mode');

	var g = engine.scan_glue (true);
	engine.trace ('mskip of %o', g);
	engine.accum (new BoxGlue (g, BoxGlue.KIND_MATH));
    });

    register_command ('nonscript', function cmd_nonscript (engine) {
	// TTP 1171.
	engine.trace ('nonscript');
	if (engine.absmode () != M_DMATH)
	    throw new TexRuntimeError ('\\nonscript may only be used in math mode');

	engine.accum (new BoxGlue (new Glue (), BoxGlue.KIND_COND_MATH));
    });

    register_command ('vcenter', function cmd_vcenter (engine) {
	engine.trace ('vcenter');
	if (engine.absmode () != M_DMATH)
	    throw new TexRuntimeError ('\\vcenter may only be used in math mode');

	// XXX this is scan_spec (TTP:645), which is duplicated in
	// Engine._handle_box and Engine.init_align.

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

	engine.scan_left_brace ();
	engine.normal_paragraph ();
	engine.nest_eqtb ();
	engine.enter_mode (M_IVERT);
	engine.enter_group ('vcenter', function (eng) {
	    engine.end_graf ();
	    var box = new VBox ();
	    box.list = engine.leave_mode ();
	    engine.unnest_eqtb ();
	    box.set_glue__OOS (engine, is_exact, spec_S);

	    var atom = new AtomNode (MT_VCENTER);
	    atom.nuc = box;
	    engine.accum (atom);
	});

	engine.set_prev_depth_to_ignore ();
	engine.maybe_push_toklist ('everyvbox');
    });

    // TTP 1178: fraction-type stuff

    function handle_math_fraction (engine, kind, has_delims) {
	// TTP 1181: "math_fraction"
	if (engine.mode () != M_MATH && engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('%o not allowed outside of math mode', kind);

	if (engine.get_unfinished_math_node () != null)
	    throw new TexRuntimeError ('consecutive ungrouped \\%s-type commands ' +
				       'are not allowed', kind);

	var n = new FractionNode ();
	n.numer = engine.get_cur_list ();

	if (has_delims) {
	    n.left_delim = ml.scan_delimiter (engine, false);
	    n.right_delim = ml.scan_delimiter (engine, false);
	}

	if (kind == 'above') {
	    n.thickness_S = engine.scan_dimen__O_S (false);
	} else if (kind == 'over') {
	    n.thickness_S = default_thickness_marker_S;
	} else { // atop:
	    n.thickness_S = nlib.Zero_S;
	}

	engine.set_unfinished_math_node (n);
	engine.reset_cur_list ();
    }

    register_command ('above', function cmd_above (engine) {
	engine.trace ('above');
	handle_math_fraction (engine, 'above', false);
    });

    register_command ('atop', function cmd_atop (engine) {
	engine.trace ('atop');
	handle_math_fraction (engine, 'atop', false);
    });

    register_command ('over', function cmd_over (engine) {
	engine.trace ('over');
	handle_math_fraction (engine, 'over', false);
    });

    register_command ('abovewithdelims', function cmd_above_with_delims (engine) {
	engine.trace ('abovewithdelims');
	handle_math_fraction (engine, 'above', true);
    });

    register_command ('atopwithdelims', function cmd_atop_with_delims (engine) {
	engine.trace ('atopwithdelims');
	handle_math_fraction (engine, 'atop', true);
    });

    register_command ('overwithdelims', function cmd_over_with_delims (engine) {
	engine.trace ('overwithdelims');
	handle_math_fraction (engine, 'overwithdelims', true);
    });

    // left and right delimiters

    function math_left_group (eng) {
	throw new TexRuntimeError ('\\left group must be ended with \\right');
    }
    math_left_group.is_left_group = true;

    register_command ('left', function cmd_left (engine) {
	// TTP 1191, "math_left_right"
	var p = new DynDelimNode (MT_LEFT);
	p.delimiter = ml.scan_delimiter (engine, false);
	engine.trace ('left delimiter %U', p);
	engine.enter_math (M_MATH, false);
	engine.enter_group ('math-left', math_left_group);
	engine.accum (p)
    });

    register_command ('right', function cmd_right (engine) {
	// TTP 1191, "math_left_right"
	var ginfo = engine.group_exit_stack.pop ();
	if (!(ginfo[1].is_left_group))
	    throw new TexRuntimeError ('\\right must come after \\left');

	var p = new DynDelimNode (MT_RIGHT);
	p.delimiter = ml.scan_delimiter (engine, false);

	var mlist = finish_math_list (engine, p);
	engine.unnest_eqtb ();

	var n = new AtomNode (MT_INNER);
	n.nuc = mlist;
	engine.accum (n);
    });

    // Equation numbering

    function handle_eqno (engine, cmdname, is_left) {
	// TTP 1140 ; TTP 1142 "start_eq_no"
	engine.trace (cmdname);
	if (engine.mode () != M_DMATH)
	    throw new TexRuntimeError ('\\%s must be used in display math mode', cmdname);

	engine.enter_math (M_MATH, true);
	engine.mode_stack[0].math_eqno_is_left = is_left; // XXX haaaaack
	engine.maybe_push_toklist ('everymath');
    };

    register_command ('eqno', function cmd_eqno (engine) {
	handle_eqno (engine, 'eqno', false);
    });

    register_command ('leqno', function cmd_leqno (engine) {
	handle_eqno (engine, 'leqno', true);
    });


    // Rendering of math lists into horizontal lists

    var SymDimens = {
	MathXHeight: 5,
	MathQuad: 6,
	Num1: 8, // note: no #7
	Num2: 9,
	Num3: 10,
	Denom1: 11,
	Denom2: 12,
	Sup1: 13,
	Sup2: 14,
	Sup3: 15,
	Sub1: 16,
	Sub2: 17,
	SupDrop: 18,
	SubDrop: 19,
	Delim1: 20,
	Delim2: 21,
	AxisHeight: 22,
    };

    var ExtDimens = {
	DefaultRuleThickness: 8,
	BigOpSpacing1: 9,
	BigOpSpacing2: 10,
	BigOpSpacing3: 11,
	BigOpSpacing4: 12,
	BigOpSpacing5: 13,
    };

    function half (x) {
	return (x + 1) >> 1;
    }

    var MathState = (function MathState_closure () {
	function MathState (engine, style, cramped) {
	    this.engine = engine;
	    this.style = style;
	    this.cramped = cramped;
	    this.size = null;
	    this.mu_S = null;
	};

	var proto = MathState.prototype;

	proto.sym_dimen__NN_S = function MathState_sym_dimen__NN_S (size, number) {
	    // Note that fontdimen numbers are 1-based, not 0-based.
	    // get_font_family is defined in terms of the MS_* constants so no
	    // offset needed there.
	    var f = this.engine.get_font_family (size, 2);
	    if (f == null)
		throw new TexRuntimeError ('need math symbol fontdimen but no symbol font defined');
	    return f.get_dimen__N_S (number);
	};

	proto.ext_dimen__N_S = function MathState_ext_dimen__N_S (number) {
	    var f = this.engine.get_font_family (this.size, 3);
	    if (f == null)
		throw new TexRuntimeError ('need math ext fontdimen but no ext font defined');
	    return f.get_dimen__N_S (number);
	};

	proto.font = function MathState_font (fam) {
	    var f = this.engine.get_font_family (this.size, fam);
	    if (f == null)
		throw new TexRuntimeError ('need math family %o but no font defined',
					   fam);
	    return f;
	};

	proto.update_sizes = function MathState_update_sizes () {
	    this.size = this.style; // reinterpret layout style as font size
	    if (this.size == MS_DISPLAY)
		this.size = MS_TEXT;

	    var mq_S = this.sym_dimen__NN_S (this.size, SymDimens.MathQuad);
	    this.mu_S = nlib.x_over_n__SI_SS (mq_S, 18)[0];
	};

	proto.clone = function MathState_clone () {
	    return new MathState (this.engine, this.style, this.cramped);
	};

	var ms_sup_style = [MS_SCRIPT, MS_SCRIPT, MS_SCRIPTSCRIPT, MS_SCRIPTSCRIPT];
	var ms_num_style = [MS_TEXT, MS_SCRIPT, MS_SCRIPTSCRIPT, MS_SCRIPTSCRIPT];

	proto.superscript = function MathState_superscript () {
	    var res = this.clone ();
	    res.style = ms_sup_style[res.style];
	    return res;
	};

	proto.subscript = function MathState_subscript () {
	    var res = this.clone ();
	    res.style = ms_sup_style[res.style];
	    res.cramped = true;
	    return res;
	};

	proto.to_cramped = function MathState_to_cramped () {
	    var res = this.clone ();
	    res.cramped = true;
	    return res;
	};

	proto.to_numer = function MathState_to_numer () {
	    var res = this.clone ();
	    res.style = ms_num_style[res.style];
	    return res;
	};

	proto.to_denom = function MathState_to_denom () {
	    var res = this.clone ();
	    res.style = ms_num_style[res.style];
	    res.cramped = true;
	    return res;
	};

	return MathState;
    }) ();


    function math_kern (state, p) {
	// XXX TODO: if this is a special \mkern kern, we need to scale its
	// size by the current math unit (stored in 'state'). See T:TP 717.
    }

    function make_ord (state, mlist, i) {
	var q = mlist[i];

	outer: while (true) {
	    if (q.sub != null || q.sup != null)
		return;
	    if (!(q.nuc instanceof MathChar))
		return;

	    if (i == mlist.length - 1)
		return;

	    var p = mlist[i+1];

	    switch (p.ltype) {
	    case MT_ORD:
	    case MT_OP:
	    case MT_BIN:
	    case MT_REL:
	    case MT_OPEN:
	    case MT_CLOSE:
	    case MT_PUNCT:
		break;
	    default:
		return;
	    }

	    if (!(p.nuc instanceof MathChar))
		return;

	    if (p.nuc.fam != q.nuc.fam)
		return;

	    q.nuc = q.nuc.as_text_char ();
	    var f = state.font (q.nuc.fam);
	    var m = f.get_metrics ();
	    if (!m.is_lig (q.nuc.ord))
		return;

	    var lk = m.ligkern;
	    var ofs = m.rembyte (q.nuc.ord)
	    var data = lk[ofs];

	    if (((data >> 24) & 0xFF) > 0x80) { // skip_byte > stop_flag?
		ofs = 256 * ((data >> 8) & 0xFF) + (data & 0xFF); // op_byte, rem_byte
		data = lk[ofs];
	    }

	    while (true) {
		if (((data >> 16) & 0xFF) == p.nuc.ord) { // next_char matches?
		    if (((data >> 24) & 0xFF) <= 0x80) { // skip_byte <= stop_flag?
			var op = ((data >> 8) & 0xFF);

			if (op >= 0x80) { // op_byte >= kern_flag?
			    var k = 256 * op + (data & 0xFF); // op_byte, rem_byte
			    mlist.splice (i + 1, 0, new Kern (k));
			} else {
			    switch (op) {
			    case 1: case 5:
				q.nuc.ord = data & 0xFF; // rem_byte
				break;
			    case 2: case 6:
				p.nuc.ord = data & 0xFF; // rem_byte
				break;
			    case 3: case 7: case 11:
				var r = new AtomNode ();
				if (op < 11)
				    r.nuc = new MathChar (q.nuc.fam,
							  data & 0xFF); // rem_byte
				else
				    r.nuc = new MathTextChar (q.nuc.fam,
							      data & 0xFF); // rem_byte
				mlist.splice (i + 1, 0, r);
				break;
			    default:
				mlist.splice (i + 1, 1);
				q.nuc.ord = data & 0xFF; // rem_byte
				q.sub = p.sub;
				q.sup = p.sup;
				break;
			    }

			    if (op > 3)
				return;
			    if (q.nuc instanceof MathTextChar)
				q.nuc = q.nuc.as_plain_char ();
			    continue outer;
			}
		    }
		}

		if (((data >> 24) & 0xFF) >= 0x80) // skip_byte > stop_flag?
		    return;

		ofs += ((data >> 24) & 0xFF) + 1; // ofs += skip_byte + 1
		data = lk[ofs];
	    }
	}
    }

    function hpack_natural (engine, hlist) {
	var b = new HBox ();

	if (hlist != null) {
	    if (!(hlist instanceof Array))
		throw new TexInternalError ('hpack_natural takes arrays');
	    b.list = hlist;
	    b.set_glue__OOS (engine, false, nlib.Zero_S);
	}

	return b;
    }

    function vpack_natural (engine, vlist) {
	var b = new VBox ();

	if (vlist != null) {
	    b.list = vlist;
	    b.set_glue__OOS (engine, false, nlib.Zero_S);
	}

	return b;
    }

    function clean_box (state, p) {
	var cur_mlist = null;
	var q = null;
	var x = null;

	if (p instanceof MathChar) {
	    cur_mlist = [new AtomNode (MT_ORD)];
	    cur_mlist[0].nuc = p;
	} else if (p instanceof ListBox) {
	    q = p.list;
	} else if (p instanceof Array) {
	    cur_mlist = p;
	} else {
	    q = [];
	}

	if (cur_mlist != null)
	    q = ml.mlist_to_hlist (state.engine, cur_mlist, state.style, state.cramped, false);

	if (q.length == 0 || q[0] instanceof Character)
	    x = hpack_natural (state.engine, q);
	else if (q.length == 1 && q[0] instanceof ListBox && q[0].shift_amount_S == 0)
	    x = q[0];
	else {
	    x = hpack_natural (state.engine, q);
	    if (x.list.length == 2 && x[0] instanceof Character && x[1] instanceof Kern)
		x.list = [x.list[0]];
	}

	return x;
    }

    function rebox__OOS (engine, box, width_S) {
	// TTP 715 "rebox"

	if (box.width_S == width_S || box.list.length == 0) {
	    box.width_S = width_S;
	    return box;
	}

	if (box instanceof VBox)
	    box = hpack_natural (engine, box);

	if (box.list.length == 1 && (box.list[0] instanceof Character)) {
	    // Compensate for the italic correction of this lone character
	    var v_S = box.list[0].font.box_for_ord (box.list[0].ord).width_S;
	    if (v_S != box.width_S)
		box.list.push (new Kern (box.width_S - v_S));
	}

	var hss = new Glue ();
	hss.stretch_S = nlib.scale__I_S (1);
	hss.stretch_order = 1;
	hss.shrink_S = nlib.scale__I_S (1);
	hss.shrink_order = 1;

	box.list.unshift (new BoxGlue (hss));
	box.list.push (new BoxGlue (hss));
	box.set_glue__OOS (engine, true, width_S);
	return box;
    }

    function fraction_rule (t_S) {
	var r = new Rule ();
	r.height_S = t_S;
	r.depth_S = nlib.Zero_S;
	return r;
    }

    function overbar__OSS_O (b, k, t) {
	return vpack_natural ([new Kern (t),
			       fraction_rule (t),
			       new Kern (k),
			       b]);
    }

    function var_delimiter__OOS (state, delim, v_S) {
	// delim: Delimiter
	// v: desired delimiter height

	var f = null; // selected font
	var c = null; // selected ord

	// First we figure out the right size character to use.

	var foundit = false;
	var w_S = nlib.Zero_S; // best seen height so far
	var info = [[delim.small_fam, delim.small_ord],
		    [delim.large_fam, delim.large_ord]];

	for (var i = 0; i < 2; i++) {
	    var z = info[i][0]; // fam of current attempt
	    var x = info[i][1]; // ord of current attempt

	    if (foundit)
		break;
	    if (z == 0 && x == null)
		continue;

	    for (var s = state.size; s > 0; s--) { // size in current attempt
		var g = state.engine.get_font_family (s, z);
		if (g == null)
		    continue;

		var m = g.get_metrics ();
		var y = x;

		while (true) {
		    if (!m.has_ord (y))
			break;

		    if (m.is_extensible (y)) {
			// Extensibles can get arbitrarily large, so we must
			// be done.
			f = g;
			c = y;
			// sigh, gotos can be kinda useful:
			foundit = true;
			s = -1;
			break;
		    }

		    var u_S = m.height_plus_depth__O_S (y);
		    if (u_S > w_S) {
			f = g;
			c = y;
			w_S = u_S;

			if (u_S >= v_S) {
			    // big enough; go with it
			    foundit = true;
			    s = -1;
			    break;
			}
		    }

		    if (!m.is_list (y))
			break;

		    y = m.rembyte (y);
		}
	    }
	}

	// Now, build the delimiter character.
	var b = null;

	if (f == null) {
	    state.engine.trace ('making null delimiter');
	    b = new HBox ();
	    b.width_S = state.engine.get_parameter__O_S ('nulldelimiterspace');
	} else if (!f.get_metrics ().is_extensible (c)) {
	    state.engine.trace ('making single-char delimiter font=%o chr=%c', f, c);
	    b = new HBox ();
	    b.list = [f.box_for_ord (c)];
	    b.set_glue__OOS (state.engine, false, nlib.Zero_S);
	} else {
	    // Need to build a giant delimiter manually :-(
	    state.engine.trace ('making extensible delimiter');
	    b = new VBox ();
	    var m = f.get_metrics ();
	    var r = m.extensible_recipe (c);
	    var rep = (r >>  0) & 0xFF;
	    var bot = (r >>  8) & 0xFF;
	    var mid = (r >> 16) & 0xFF;
	    var top = (r >> 24) & 0xFF;

	    c = rep;
	    var u_S = m.height_plus_depth__O_S (c);
	    w_S = nlib.Zero_S;
	    b.width_S = m.width (c).value_S + m.italic_correction__O_S (c);

	    if (bot != 0)
		w_S += m.height_plus_depth__O_S (bot);

	    if (mid != 0)
		w_S += m.height_plus_depth__O_S (mid);

	    if (top != 0)
		w_S += m.height_plus_depth__O_S (top);

	    // how many pieces?
	    var n = 0;
	    if (u_S > 0) {
		while (w_S < v_S) {
		    w_S += u_S;
		    n += 1;
		    if (mid != 0)
			w_S += u_S;
		}
	    }

	    if (bot != 0)
		stack_into_box (b, f, bot);

	    for (var i = 0; i < n; i++)
		stack_into_box (b, f, rep);

	    if (mid != 0) {
		stack_into_box (b, f, mid);
		for (var i = 0; i < n; i++)
		    stack_into_box (b, f, rep);
	    }

	    if (top != 0)
		stack_into_box (b, f, top);

	    b.depth_S = w_S - b.height_S;
	}

	b.shift_amount_S = half (b.height_S - b.depth_S)
	    - state.sym_dimen__NN_S (state.size, SymDimens.AxisHeight);
	return b;
    }

    function make_op (state, q) {
	var delta;

	if (q.limtype == LIMTYPE_NORMAL && state.style == MS_DISPLAY)
	    q.limtype = LIMTYPE_LIMITS;

	if (!(q.nuc instanceof MathChar))
	    delta = 0;
	else {
	    // XXX skipping list-tag char stuff
	    var f = state.font (q.nuc.fam);
	    var m = f.get_metrics ();
	    delta = m.italic_correction__O_S (q.nuc.ord);
	    var x = clean_box (state, q.nuc);

	    if (q.sub != null && q.limtype != LIMTYPE_LIMITS)
		x.width_S -= delta; // remove italic correction

	    x.shift_amount_S = half ((x.height_S - x.depth_S)
				     - state.sym_dimen__NN_S (state.size, SymDimens.AxisHeight));
	    q.nuc = x;
	}

	if (q.limtype != LIMTYPE_LIMITS)
	    return delta;

	var x = clean_box (state.superscript (), q.sup);
	var y = clean_box (state, q.nuc);
	var z = clean_box (state.subscript (), q.sub);
	var v = new VBox ();
	v.width_S = Math.max (x.width_S, y.width_S, z.width_S);

	x = rebox__OOS (state.engine, x, v.width_S);
	y = rebox__OOS (state.engine, y, v.width_S);
	z = rebox__OOS (state.engine, z, v.width_S);
	x.shift_amount_S = half (delta);
	z.shift_amount_S = -x.shift_amount_S;
	v.height_S = y.height_S;
	v.depth_S = y.height_S;

	if (q.sup == null) {
	    v.list = [y];
	} else {
	    var shift_up = state.ext_dimen__N_S (ExtDimens.BigOpSpacing3) - x.depth_S;
	    shift_up = Math.max (shift_up, state.ext_dimen__N_S (ExtDimens.BigOpSpacing1));
	    var k1 = new Kern (shift_up);
	    var k2 = new Kern (state.ext_dimen__N_S (ExtDimens.BigOpSpacing5));
	    v.list = [k2, x, k1, y];
	    v.height_S += state.ext_dimen__N_S (ExtDimens.BigOpSpacing5);
	    v.height_S += x.height_S;
	    v.height_S += x.depth_S;
	    v.height_S += shift_up;
	}

	if (q.sub != null) {
	    var shift_down = state.ext_dimen__N_S (ExtDimens.BigOpSpacing4) - z.height_S;
	    shift_down = Math.max (shift_down, state.ext_dimen__N_S (ExtDimens.BigOpSpacing2));
	    var k1 = new Kern (shift_down);
	    var k2 = new Kern (state.ext_dimen__N_S (ExtDimens.BigOpSpacing5));
	    v.list = v.list.concat ([k1, z, k2]);
	    v.height_S += state.ext_dimen__N_S (ExtDimens.BigOpSpacing5);
	    v.height_S += z.height_S;
	    v.height_S += z.depth_S;
	    v.height_S += shift_down;
	}

	q.new_hlist = [v];
	return delta;
    }

    function make_radical (state, q) {
	var drt = state.ext_dimen__N_S (ExtDimens.DefaultRuleThickness);
	var mxh = state.sym_dimen__NN_S (state.size, SymDimens.MathXHeight);

	// T:TP 737
	var x = clean_box (state.to_cramped (), q.nuc);
	var clr;

	if (state.style == MS_DISPLAY)
	    clr = drt + Math.abs (mxh) >> 2;
	else {
	    clr = drt;
	    clr += Math.abs (clr) >> 2;
	}

	var y = var_delimiter__OOS (state, q.left_delim,
			       x.height_S + x.depth_S + clr + drt);
	var delta = y.depth_S - (x.height_S + x.depth_S + clr);
	if (delta > 0)
	    clr += half (delta);

	y.shift_amount_S = -(x.height_S + clr);
	q.nuc = hpack_natural (state.engine, [y, overbar__OSS_O (x, clr, y.height_S)]);
    }

    function make_vcenter (state, q) {
	if (!q.nuc instanceof VBox)
	    throw new TexInternalError ('vcenter needs VBox');

	var v = q.nuc;
	var delta = v.height_S + v.depth_S;
	v.height_S = state.sym_dimen__NN_S (state.size, SymDimens.AxisHeight) + half (delta);
	v.depth_S = delta - v.height_S;
    }

    function make_over (state, q) {
	var drt_S = state.ext_dimen__N_S (ExtDimens.DefaultRuleThickness);
	q.nuc = overbar__OSS_O (clean_box (state.to_cramped (), q.nuc),
				3 * drt_S,
				drt_S);
    }

    function make_fraction (state, q) {
	var drt_S = state.ext_dimen__N_S (ExtDimens.DefaultRuleThickness);
	var ah_S = state.sym_dimen__NN_S (state.size, SymDimens.AxisHeight);

	if (q.thickness_S == default_thickness_marker_S)
	    q.thickness_S = drt_S;

	var x = clean_box (state.to_numer (), q.numer);
	var z = clean_box (state.to_denom (), q.denom);

	if (x.width_S < z.width_S)
	    x = rebox__OOS (state.engine, x, z.width_S);
	else
	    z = rebox__OOS (state.engine, z, x.width_S);

	var shift_up_S, shift_down_S;

	if (state.style == MS_DISPLAY) {
	    shift_up_S = state.sym_dimen__NN_S (state.size, SymDimens.Num1);
	    shift_down_S = state.sym_dimen__NN_S (state.size, SymDimens.Denom1);
	} else {
	    shift_down_S = state.sym_dimen__NN_S (state.size, SymDimens.Denom2);
	    if (q.thickness_S != 0)
		shift_up_S = state.sym_dimen__NN_S (state.size, SymDimens.Num2);
	    else
		shift_up_S = state.sym_dimen__NN_S (state.size, SymDimens.Num3);
	}

	var clr_S, delta_S;

	if (q.thickness_S == 0) {
	    if (state.style == MS_DISPLAY)
		clr_S = 7 * drt_S;
	    else
		clr_S = 3 * drt_S;

	    delta_S = half (clr_S - ((shift_up_S - x.depth_S) - (z.height_S - shift_down_S)));

	    if (delta_S > 0) {
		shift_up_S += delta_S;
		shift_down_S += delta_S;
	    }
	} else {
	    if (state.style == MS_DISPLAY)
		clr_S = 3 * drt_S;
	    else
		clr_S = drt_S;

	    delta_S = half (q.thickness_S);
	    var delta1_S = clr_S - ((shift_up_S - x.depth_S) - (ah_S + delta_S));
	    var delta2_S = clr_S - ((ah_S - delta_S) - (z.height_S - shift_down_S));

	    if (delta1_S > 0)
		shift_up_S += delta1_S;
	    if (delta2_S > 0)
		shift_down_S += delta2_S;
	}

	var v = new VBox ();
	v.height_S = x.height_S + shift_up_S;
	v.depth_S = z.depth_S + shift_down_S;
	v.width_S = x.width_S;
	v.glue_state = 1; // pretend we've set the glue
	v.glue_set = 1;

	if (q.thickness_S == 0) {
	    var k = new Kern ((shift_up_S + x.depth_S) - (z.height_S - shift_down_S));
	    v.list = [x, k, z];
	} else {
	    var y = fraction_rule (q.thickness_S);
	    var p1 = new Kern ((ah_S - delta_S) - (z.height_S - shift_down_S));
	    var p2 = new Kern ((shift_up_S - x.depth_S) - (ah_S + delta_S));
	    v.list = [x, p2, y, p1, z];
	}

	if (state.style == MS_DISPLAY)
	    delta_S = state.sym_dimen__NN_S (state.size, SymDimens.Delim1);
	else
	    delta_S = state.sym_dimen__NN_S (state.size, SymDimens.Delim2);

	x = var_delimiter__OOS (state, q.left_delim, delta_S);
	z = var_delimiter__OOS (state, q.right_delim, delta_S);
	q.new_hlist = [hpack_natural (state.engine, [x, v, z])];
    }

    function make_scripts (engine, state, q, delta) {
	// T:TP 756
	var p = q.new_hlist;
	var shift_up = 0;
	var shift_down = 0;
	var t = 0;
	var clr = 0;
	var mxh = state.sym_dimen__NN_S (state.size, SymDimens.MathXHeight);

	if (p == null || !(p[0] instanceof Character)) {
	    var z = hpack_natural (engine, p);
	    if (state.style == MS_DISPLAY || state.style == MS_TEXT)
		t = MS_SCRIPT;
	    else
		t = MS_SCRIPTSCRIPT;

	    shift_up = z.height_S - state.sym_dimen__NN_S (t, SymDimens.SupDrop);
	    shift_down = z.depth_S + state.sym_dimen__NN_S (t, SymDimens.SubDrop);
	}

	if (q.sup == null) {
	    // We're only called if there's a script, so sub most be non-null.
	    var x = clean_box (state.subscript (), q.sub);
	    x.width_S += engine.get_parameter__O_S ('scriptspace');

	    clr = x.height_S - Math.abs (mxh * 4) / 5;
	    var sub1 = state.sym_dimen__NN_S (state.size, SymDimens.Sub1);
	    x.shift_amount_S = Math.max (shift_down, clr, sub1);
	} else {
	    var x = clean_box (state.superscript (), q.sup);
	    x.width_S += engine.get_parameter__O_S ('scriptspace');

	    if (state.cramped)
		clr = state.sym_dimen__NN_S (state.size, SymDimens.Sup3);
	    else if (state.style == MS_DISPLAY)
		clr = state.sym_dimen__NN_S (state.size, SymDimens.Sup1);
	    else
		clr = state.sym_dimen__NN_S (state.size, SymDimens.Sup2);

	    shift_up = Math.max (shift_up, clr);
	    clr = x.depth_S + Math.abs (mxh) / 4
	    shift_up = Math.max (shift_up, clr);

	    if (q.sub == null)
		x.shift_amount_S = -shift_up;
	    else {
		var y = clean_box (state.subscript (), q.sub);
		y.width_S += engine.get_parameter__O_S ('scriptspace');

		shift_down = max (shift_down,
				  state.sym_dimen__NN_S (state.size, SymDimens.Sub2));

		clr = 4 * state.ext_dimen__N_S (ExtDimens.DefaultRuleThickness);
		clr -= (shift_up - x.depth_S) - (y.height_S - shift_down);
		if (clr > 0) {
		    shift_down += clr;
		    clr = Math.abs (mxh * 4) / 5 - (shift_up - x.depth_S);
		    if (clr > 0) {
			shift_up += clr;
			shift_down -= clr;
		    }
		}

		x.shift_amount_S = delta;
		var k = new Kern ((shift_up - x.depth_S) -
				  (y.height_S - shift_down));
		x = vpack_natural ([x, k, y]);
		x.shift_amount_S = shift_down;
	    }
	}

	if (q.new_hlist == null)
	    q.new_hlist = [x];
	else
	    q.new_hlist.push (x);
    }

    function make_left_right (q, state, max_d_S, max_h_S) {
	var cur_size;

	if (state.style == MS_DISPLAY)
	    cur_size = MS_TEXT;
	else
	    cur_size = state.style;

	var delta2_S = max_d_S + state.sym_dimen__NN_S (cur_size, SymDimens.AxisHeight);
	var delta1_S = max_h_S + max_d_S - delta2_S;

	if (delta2_S > delta1_S)
	    delta1_S = delta2_S;

	var delta_S = (delta1_S / 500 >> 0) * state.engine.get_parameter__O_I ('delimiterfactor');
	delta2_S = 2 * delta1_S - state.engine.get_parameter__O_S ('delimitershortfall');
	if (delta_S < delta2_S)
	    delta_S = delta2_S;

	q.new_hlist = var_delimiter__OOS (state, q.delimiter, cur_size, delta_S);

	if (q.ltype == MT_LEFT)
	    return MT_OPEN;
	return MT_CLOSE;
    }

    function mlist_to_hlist (engine, mlist, style, cramped, penalties) {
	var state = new MathState (engine, style, cramped);
	var i = 0;
	var r_type = MT_OP;
	var r = null;
	var max_d_S = nlib.Zero_S;
	var max_h_S = nlib.Zero_S;

	state.update_sizes ();

	while (i < mlist.length) {
	    var delta = 0;
	    var q = mlist[i];
	    var p = null;
	    var process_atom = true; // gotos to "check_dimensions",
				     // "done_with_noad", or "done_with_node"
				     // mean setting this to false.
	    var check_dimensions = true; // gotos to "done_with_noad" or
					 // "done_with_node" mean setting this
					 // to false.
	    var remember_as_prev = true; // gotos to "done_with_node" mean
					 // setting this to false.

	    if (q.ltype == MT_BIN) {
		// If we have a binary operator but it doesn't seem to be in
		// the right context, treat it as an ordinary instead.
		switch (r_type) {
		case MT_BIN:
		case MT_OP:
		case MT_REL:
		case MT_OPEN:
		case MT_PUNCT:
		case MT_LEFT:
		    q.ltype = MT_ORD;
		    continue; // note: intentionally not incrementing 'i'
		}
	    }

	    switch (q.ltype) {
	    case MT_BIN:
		break;
	    case MT_REL:
	    case MT_CLOSE:
	    case MT_PUNCT:
	    case MT_RIGHT:
		// Previous item was supposed to be a binary operator but it
		// turns out not to have been in the right context.
		if (r_type == MT_BIN)
		    r.ltype = MT_ORD;
		if (q.ltype == MT_RIGHT) {
		    // goto done_with_noad:
		    process_atom = check_dimensions = false;
		}
		break;
	    case MT_LEFT:
		// goto done_with_noad:
		process_atom = check_dimensions = false;
		break;
	    case MT_ORD:
		make_ord (state, mlist, i);
		break;
	    case MT_OP:
		delta = make_op (state, q);
		break;
	    case MT_RADICAL:
		make_radical (state, q);
		break;
	    case MT_VCENTER:
		make_vcenter (state, q);
		break;
	    case MT_STYLE:
		state.style = q.style;
		state.cramped = q.cramped;
		state.update_sizes ();
		// goto done_with_node:
		process_atom = check_dimensions = remember_as_prev = false;
		break;
	    case MT_OVER:
		make_over (state, q);
		break;
	    case MT_FRACTION:
		make_fraction (state, q);
		// goto check_dimensions:
		process_atom = false;
		break;
	    case MT_OPEN:
	    case MT_INNER:
		break;
	    case MT_UNDER:
	    case MT_ACCENT:
		throw new TexInternalError ('unimplemented math %o', q);
	    case MT_SCHOICE:
		if (state.style == MS_DISPLAY)
		    p = q.in_display;
		else if (state.style == MS_TEXT)
		    p = q.in_text;
		else if (state.style == MS_SCRIPT)
		    p = q.in_script;
		else if (state.style == MS_SCRIPTSCRIPT)
		    p = q.in_scriptscript;
		// Ugh, super not cool that we're mutating the list, but
		// that's what TeX does.
		var newq = new MathStyleNode (state.style, state.cramped);
		Array.prototype.splice.apply (mlist, [i, 1, newq].concat (p));
		// goto done_with_node:
		process_atom = check_dimensions = remember_as_prev = false;
		break;
	    case LT_INSERT:
	    case LT_MARK:
	    case LT_ADJUST:
	    case LT_SPECIAL:
	    case LT_PENALTY:
	    case LT_IO:
	    case LT_DISCRETIONARY:
		// goto done_with_node:
		process_atom = check_dimensions = remember_as_prev = false;
		break;
	    case LT_KERN:
		math_kern (state, q);
		// goto done_with_node:
		process_atom = check_dimensions = remember_as_prev = false;
		break;
	    case LT_GLUE:
		if (q.kind == BoxGlue.KIND_MATH) {
		    q.kind = BoxGlue.KIND_REGULAR;
		    q.amount = scale_math_glue (state, q.amount);
		} else if (q.kind == BoxGlue.KIND_COND_MATH && state.style != MS_TEXT) {
		    // Here too we grossly mutate the list, but we must. If we're in script
		    // or scriptscript mode, and this is a cond_math glue, and the next
		    // item is a glue or a kern: get rid of the next item.
		    if (i < mlist.length - 1) {
			var tmp = mlist[i+1];
			if (tmp.ltype == LT_GLUE || tmp.ltype == LT_KERN)
			    mlist.splice (i + 1, 1);
		    }
		}
		// goto done_with_node:
		process_atom = check_dimensions = remember_as_prev = false;
		break;
	    case LT_RULE:
		throw new TexInternalError ('unimplemented not-quite-math %o', q);
	    default:
		throw new TexInternalError ('unrecognized math %o', q);
	    }

	    if (process_atom) {
		if (q.nuc instanceof MathChar || q.nuc instanceof MathTextChar) {
		    var f = state.font (q.nuc.fam);
		    var m = f.get_metrics ();
		    if (!m.has_ord (q.nuc.ord)) {
			engine.warn ('missing character fam=%o ord=%c',
				     q.nuc.fam, q.nuc.ord);
			p = null;
		    } else {
			delta = m.italic_correction__O_S (q.nuc.ord);
			p = [f.box_for_ord (q.nuc.ord)];
			if (q.nuc instanceof MathTextChar && f.get_dimen__N_S (2) != 0)
			    delta = 0;
			if (q.sub == null && delta != 0) {
			    p.push (new Kern (delta));
			    delta = 0;
			}
		    }
		} else if (q.nuc == null) {
		    p = null;
		} else if (q.nuc instanceof ListBox) {
		    p = q.nuc.list;
		} else if (q.nuc instanceof Array) {
		    var sublist = mlist_to_hlist (engine, q.nuc, state.style,
						  state.cramped, false);
		    p = hpack_natural (engine, sublist).list;
		} else {
		    throw new TexInternalError ('unrecognized nucleus value %o', q.nuc);
		}

		q.new_hlist = p;

		if (q.sub != null || q.sup != null)
		    make_scripts (engine, state, q, delta);
	    }

	    if (check_dimensions) {
		var z = hpack_natural (q.new_hlist);
		max_h_S = Math.max (max_h_S, z.height_S);
		max_d_S = Math.max (max_d_S, z.depth_S);
	    }

	    if (remember_as_prev) {
		r = q;
		r_type = r.ltype;
	    }

	    i += 1;
	}

	if (r_type == MT_BIN)
	    r.ltype = MT_ORD;

	r_type = 0;
	state.style = style;
	state.cramped = cramped;
	state.update_sizes ();
	i = 0;
	var outlist = [];

	while (i < mlist.length) {
	    var q = mlist[i];
	    var t = MT_ORD;
	    // XXX: penalty
	    var do_usual = true; // gotos to "delete_q" or "done" mean set this to false
	    var save_r_type = true; // gotos to "delete_q" mean set this to false

	    switch (q.ltype) {
	    case MT_OP:
	    case MT_OPEN:
	    case MT_CLOSE:
	    case MT_PUNCT:
	    case MT_INNER:
		t = q.type;
		break;
	    case MT_BIN:
		t = MT_BIN;
		// XXX: set penalty
		break;
	    case MT_REL:
		t = MT_REL;
		// XXX: set penalty
		break;
	    case MT_ORD:
	    case MT_VCENTER:
	    case MT_OVER:
	    case MT_UNDER:
	    case MT_RADICAL: // don't care about noad data size
	    case MT_ACCENT: // don't care about noad data size
		break;
	    case MT_FRACTION:
		t = MT_INNER;
		break;
	    case MT_LEFT:
	    case MT_RIGHT:
		t = make_left_right (q, state, max_d_S, max_h_S);
		break;
	    case MT_STYLE:
		state.style = q.style;
		state.cramped = q.cramped;
		state.update_sizes ();
		// goto delete_q:
		do_usual = false;
		break;
	    case LT_PENALTY:
	    case LT_IO:
	    case LT_SPECIAL:
	    case LT_RULE:
	    case LT_DISCRETIONARY:
	    case LT_ADJUST:
	    case LT_INSERT:
	    case LT_MARK:
	    case LT_GLUE:
	    case LT_KERN:
		outlist.push (q);
		do_usual = false;
		break;
	    default:
		throw new TexInternalError ('unexpected math node %o', q);
	    }

	    if (do_usual) {
		// XXX: insert appropriate spacing

		if (q.new_hlist != null)
		    outlist = outlist.concat (q.new_hlist);

		// XXX: penalties?

		r_type = t;
	    }

	    i++;
	}

	return outlist;
    };
    ml.mlist_to_hlist = mlist_to_hlist;

    return ml;
}) ();
