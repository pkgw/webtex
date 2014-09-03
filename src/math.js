// Math-related data types.
//
// These correspond to "noads" in TeX. Math lists can contain these Nodes as
// well as the Listables Ins, Mark, Adjust, Whatsit, Penalty, Disc, Rule,
// BoxGlue, and Kern.

'use strict';

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
	    throw new TexInternalError ('illegal Atom type ' + ltype);

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
	this.thickness = null;
	this.denom = null;
	this.numer = null;
	this.left_delim = new Delimiter ();
	this.right_delim = new Delimiter ();
    }

    inherit (FractionNode, MathNode);
    var proto = FractionNode.prototype;

    proto._uisummary = function FractionNode__uisummary () {
	return 'Fraction thickness=' + this.thickness + ' left=' + this.left_delim +
	    ' right=' + this.right_delim;
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

    ml.set_math_char = function mathlib_set_math_char (ord, mathcode, cur_fam) {
	// T:TP 1155.
	if (mathcode >= 0x8000) {
	    // Treat as active character. Right semantics here?
	    var cmd = engine.get_active (ord);
	    if (cmd == null)
		throw new TexRuntimeError ('mathcode ' + mathcode + 'implies active ' +
					   'character but it isn\'t');
	    engine.push (Token.new_cmd (cmd));
	    return null;
	}

	var ord = mathcode & 0xFF;
	var fam = (mathcode >> 8) & 0xF;
	var ltype = ((mathcode >> 13) & 0x7) + MT_ORD;

	if (mathcode >= 0x7000) {
	    if (cur_fam >= 0 && cur_fam < 16)
		fam = cur_fam;
	    ltype = MT_ORD;
	}

	var atom = new AtomNode (ltype);
	atom.nuc = new MathChar (fam, ord);
	return atom;
    };

    ml.scan_math = function mathlib_scan_math (engine, callback) {
	// T:TP 1151
	var tok = null;

	while (true) {
	    tok = engine.next_x_tok_throw ();
	    if (!tok.isspace (engine) && !tok.iscmd (engine, 'relax'))
		break;
	}

	var cmd = tok.tocmd (engine);
	var c = null;
	var check_active = false;

	if (cmd instanceof InsertLetterCommand || cmd instanceof InsertOtherCommand ||
	    cmd instanceof GivenCharCommand) {
	    c = engine.get_code (CT_MATH, cmd.ord);
	    check_active = true;
	} else if (cmd instanceof GivenMathcharCommand) {
	    c = cmd.mathchar;
	} else if (cmd.samecmd (engine.commands['char'])) {
	    c = engine.get_code (CT_MATH, engine.scan_char_code ());
	    check_active = true;
	} else if (cmd.samecmd (engine.commands['mathchar'])) {
	    c = engine.scan_int_15bit ();
	}
	// XXX unimplemented: \delimiter case

	if (check_active && c == 0x8000) {
	    // Treat as active character. Right semantics here?
	    cmd = engine.get_active (ord);
	    if (cmd == null)
		throw new TexRuntimeError ('mathcode ' + mathcode + 'implies active ' +
					       'character but it isn\'t');
	    engine.push (Token.new_cmd (cmd));
	    ml.scan_math (engine, callback);
	    return;
	}

	if (c != null) {
	    var ord = c & 0xFF;
	    var fam = (c >> 8) % 16;

	    if (c >= 0x7000) {
		var cf = engine.get_parameter (T_INT, 'fam');
		if (cf >= 0 && cf <= 15)
		    fam = cf;
	    }

	    callback (engine, new MathChar (fam, ord));
	    return;
	}

	// If we got here, we must see a brace-enclosed subformula.

	engine.push (tok);
	engine.scan_left_brace ();
	engine.nest_eqtb ();
	engine.enter_mode (M_MATH);
	engine.group_exit_stack.push ([function (eng) {
	    var list = eng.leave_mode ();
	    eng.unnest_eqtb ();
	    callback (eng, list);
	}, []]);
    };

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
	    this.mu = null; // this is a Scaled
	};

	var proto = MathState.prototype;

	proto.sym_dimen = function MathState_sym_dimen (size, number) {
	    // Note that fontdimen numbers are 1-based, not 0-based.
	    // get_font_family is defined in terms of the MS_* constants so no
	    // offset needed there.
	    var f = this.engine.get_font_family (size, 2);
	    if (f == null)
		throw new TexRuntimeError ('need math symbol fontdimen but no symbol font defined');
	    return f.get_dimen (number);
	};

	proto.ext_dimen = function MathState_ext_dimen (number) {
	    var f = this.engine.get_font_family (this.size, 2);
	    if (f == null)
		throw new TexRuntimeError ('need math ext fontdimen but no ext font defined');
	    return f.get_dimen (number);
	};

	proto.font = function MathState_font (fam) {
	    var f = this.engine.get_font_family (this.size, fam);
	    if (f == null)
		throw new TexRuntimeError ('need math family ' + fam + ' but no font defined');
	    return f;
	};

	proto.update_sizes = function MathState_update_sizes () {
	    this.size = this.style; // reinterpret layout style as font size
	    if (this.size == MS_DISPLAY)
		this.size = MS_TEXT;

	    var mq = this.sym_dimen (this.size, SymDimens.MathQuad).sp;
	    this.mu = mq.over_n (18);
	};

	proto.clone = function MathState_clone () {
	    return new MathState (this.engine, this.style, this.cramped);
	};

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

	return MathState;
    }) ();

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
			    mlist.splice (i + 1, 0, new Kern (Dimen.new_scaled (k)));
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

			    if (op > q)
				return;
			    if (q.nuc instanceof MathTextChar)
				q.nuc = q.nuc.as_plain_char ();
			    continue outer;
			}
		    }
		}

		if (((data >> 24) & 0xFF) > 0x80) // skip_byte > stop_flag?
		    return;

		ofs += ((data >> 24) & 0xFF) + 1; // ofs += skip_byte + 1
		data = lk[ofs];
	    }
	}
    }

    function hpack_natural (engine, hlist) {
	var b = new HBox ();

	if (hlist != null) {
	    b.list = hlist;
	    b.set_glue (engine, false, new Dimen ());
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
	else if (q.length == 1 && q[0] instanceof ListBox && !q.shift_amount.is_nonzero ())
	    x = q;
	else {
	    x = hpack_natural (state.engine, q);
	    if (x.list.length == 2 && x[0] instanceof Character && x[1] instanceof Kern)
		x.list = [x.list[0]];
	}

	return x;
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
	    delta = m.italic_correction (q.nuc.ord);
	    var x = clean_box (state, q.nuc);

	    if (q.sub != null && q.limtype != LIMTYPE_LIMITS)
		x.width.sp.value -= delta // remove italic correction

	    x.shift_amount.sp.value = half ((x.height.sp.value - x.depth.sp.value)
					    - state.sym_dimen (state.size, SymDimens.AxisHeight));
	    q.nuc = x;
	}

	if (q.limtype != LIMTYPE_LIMITS)
	    return delta;

	var x = clean_box (state.superscript (), q.sup);
	var y = clean_box (state, q.nuc);
	var z = clean_box (state.subscript (), q.sub);
	var v = new VBox ();
	v.width.sp.value = Math.max (x.width.sp.value, y.width.sp.value, z.width.sp.value);

	x = rebox (x, v.width.sp.value);
	y = rebox (y, v.width.sp.value);
	z = rebox (z, v.width.sp.value);
	x.shift_amount.sp.value = half (delta);
	z.shift_amount.sp.value = -x.shift_amount.sp.value;
	v.height = y.height.clone ();
	v.depth = y.height.clone ();

	if (q.sup == null) {
	    v.list = [y];
	} else {
	    var shift_up = state.ext_dimen (ExtDimens.BigOpSpacing3).sp.value - x.depth.sp.value;
	    shift_up = Math.max (shift_up, state.ext_dimen (ExtDimens.BigOpSpacing1).sp.value);
	    var k1 = new Kern (Dimen.new_scaled (shift_up));
	    var k2 = new Kern (state.ext_dimen (ExtDimens.BigOpSpacing5));
	    v.list = [k2, x, k1, y];
	    v.height.advance (state.ext_dimen (ExtDimens.BigOpSpacing5));
	    v.height.advance (x.height);
	    v.height.advance (x.depth);
	    v.height.sp.value += shift_up;
	}

	if (q.sub != null) {
	    var shift_down = state.ext_dimen (ExtDimens.BigOpSpacing4).sp.value - z.height.sp.value;
	    shift_down = Math.max (shift_down, state.ext_dimen (ExtDimens.BigOpSpacing2).sp.value);
	    var k1 = new Kern (Dimen.new_scaled (shift_down));
	    var k2 = new Kern (state.ext_dimen (ExtDimens.BigOpSpacing5));
	    v.list = v.list.concat ([k1, z, k2]);
	    v.height.advance (state.ext_dimen (ExtDimens.BigOpSpacing5));
	    v.height.advance (z.height);
	    v.height.advance (z.depth);
	    v.height.sp.value += shift_down;
	}

	q.new_hlist = v;
	return delta;
    }

    function make_scripts (engine, state, q, delta) {
	// T:TP 756
	var p = q.new_hlist;
	var shift_up = 0;
	var shift_down = 0;
	var t = 0;
	var clr = 0;
	var mxh = state.sym_dimen (state.size, SymDimens.MathXHeight).sp.value;

	if (!(p[0] instanceof Character)) {
	    var z = hpack_natural (engine, p);
	    if (state.style == MS_DISPLAY || state.style == MS_TEXT)
		t = MS_SCRIPT;
	    else
		t = MS_SCRIPTSCRIPT;

	    shift_up = z.height.sp.value - state.sym_dimen (t, SymDimens.SupDrop).sp.value;
	    shift_down = z.depth.sp.value + state.sym_dimen (t, SymDimens.SubDrop).sp.value;
	}

	if (q.sup == null) {
	    // We're only called if there's a script, so sub most be non-null.
	    var x = clean_box (state.subscript (), q.sub);
	    x.width.advance (engine.get_parameter (T_DIMEN, 'scriptspace'));

	    clr = x.height.sp.value - Math.abs (mxh * 4) / 5;
	    var sub1 = state.sym_dimen (state.size, SymDimens.Sub1).sp.value;
	    x.shift_amount.sp.value = Math.max (shift_down, clr, sub1);
	} else {
	    var x = clean_box (state.superscript (), q.sup);
	    x.width.advance (engine.get_parameter (T_DIMEN, 'scriptspace'));

	    if (state.cramped)
		clr = state.sym_dimen (state.size, SymDimens.Sup3).sp.value;
	    else if (state.style == MS_DISPLAY)
		clr = state.sym_dimen (state.size, SymDimens.Sup1).sp.value;
	    else
		clr = state.sym_dimen (state.size, SymDimens.Sup2).sp.value;

	    shift_up = Math.max (shift_up, clr);
	    clr = x.depth.sp.value + Math.abs (mxh) / 4
	    shift_up = Math.max (shift_up, clr);

	    if (q.sub == null)
		x.shift_amount.sp.value = -shift_up
	    else {
		var y = clean_box (state.subscript (), q.sub);
		y.width.advance (engine.get_parameter (T_DIMEN, 'scriptspace'));

		shift_down = max (shift_down,
				  state.sym_dimen (state.size, SymDimens.Sub2).sp.value);

		clr = 4 * state.ext_dimen (ExtDimens.DefaultRuleThickness).sp.value;
		clr -= (shift_up - x.depth.sp.value) - (y.height.sp.value - shift_down);
		if (clr > 0) {
		    shift_down += clr;
		    clr = Math.abs (mxh * 4) / 5 - (shift_up - x.depth.sp.value);
		    if (clr > 0) {
			shift_up += clr;
			shift_down -= clr;
		    }
		}

		x.shift_amount.sp.value = delta;
		var k = new Kern (Dimen.new_scaled ((shift_up - x.depth.sp.value) -
						    (y.height.sp.value - shift_down)));
		x = vpack_natural ([x, k, y]);
		x.shift_amount.sp.value = shift_down;
	    }
	}

	if (q.new_hlist == null)
	    q.new_hlist = [x];
	else
	    q.new_hlist.push (x);
    }

    ml.mlist_to_hlist = function mlist_to_hlist (engine, mlist, style, cramped, penalties) {
	var state = new MathState (engine, style, cramped);
	var m_len = mlist.length;
	var i = 0;
	var r_type = MT_OP;
	var r = null;
	var max_d = 0;
	var max_h = 0;

	state.update_sizes ();

	while (i < m_len) {
	    var delta = 0;
	    var q = mlist[i];
	    var p = null;

	    if (q.ltype == MT_BIN) {
		// If we have a binary operator but it doesn't seem to be in
		// the right context, treat it as an ordinal instead.
		switch (r_type) {
		case MT_BIN:
		case MT_OP:
		case MT_REL:
		case MT_OPEN:
		case MT_PUNCT:
		case MT_LEFT:
		    q.ltype = MT_ORD;
		    continue;
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
		if (q.ltype == MT_RIGHT)
		    {} // XXX goto done_with_noad;
		break;
	    case MT_LEFT:
		// XXX goto done_with_noad
		break;
	    case MT_ORD:
		make_ord (state, mlist, i);
		break;
	    case MT_OP:
		delta = make_op (state, q);
		break;
	    case MT_FRACTION:
	    case MT_OPEN:
	    case MT_INNER:
	    case MT_RADICAL:
	    case MT_OVER:
	    case MT_UNDER:
	    case MT_ACCENT:
	    case MT_VCENTER:
	    case MT_STYLE:
	    case MT_SCHOICE:
		throw new TexInternalError ('unimplemented math ' + q);
	    case LT_INSERT:
	    case LT_MARK:
	    case LT_ADJUST:
	    case LT_SPECIAL:
	    case LT_PENALTY:
	    case LT_IO:
	    case LT_DISCRETIONARY:
		// XXX goto done_with_node
		break;
	    case LT_RULE:
	    case LT_GLUE:
	    case LT_KERN:
		throw new TexInternalError ('unimplemented not-quite-math ' + q);
	    default:
		throw new TexInternalError ('unrecognized math ' + q);
	    }

	    if (q.nuc instanceof MathChar || q.nuc instanceof MathTextChar) {
		var f = state.font (q.nuc.fam);
		var m = f.get_metrics ();
		if (!m.has_ord (q.nuc.ord)) {
		    engine.warn ('missing character fam=' + q.nuc.fam + ' ord=' + q.nuc.ord);
		    p = null;
		} else {
		    delta = m.italic_correction (q.nuc.ord);
		    p = [f.box_for_ord (q.nuc.ord)];
		    if (q.nuc instanceof MathTextChar && f.get_dimen (2).is_nonzero ())
			delta = 0;
		    if (q.sub == null && delta != 0) {
			p.push (new Kern (Dimen.new_scaled (delta)));
			delta = 0;
		    }
		}
	    } else if (q.nuc == null) {
		p = null;
	    } else if (q.nuc instanceof ListBox) {
		p = [q.nuc];
	    } else if (q.nuc instanceof Array) {
		var sublist = mlist_to_hlist (engine, q.nuc, state.style,
					      state.cramped, false);
		p = [hpack_natural (sublist)];
	    } else {
		throw new TexInternalError ('unrecognized nucleus value ' + q.nuc);
	    }

	    q.new_hlist = p;

	    if (q.sub != null || q.sup != null)
		make_scripts (engine, state, q, delta);

	    var z = hpack_natural (q.new_hlist);
	    max_h = Math.max (max_h, z.height);
	    max_d = Math.max (max_d, z.depth);

	    r = q;
	    r_type = r.ltype;

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

	while (i < m_len) {
	    var q = mlist[i];
	    var t = MT_ORD;
	    // XXX: penalty

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
		t = make_left_right (q, state, max_d, max_h);
		break;
	    case MT_STYLE:
		throw TexInternalError ('implement 763');
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
		throw TexInternalError ('implement regular nodes');
	    default:
		throw TexInternalError ('unexpected math node ' + q);
	    }

	    // XXX: insert appropriate spacing

	    if (q.new_hlist != null)
		outlist = outlist.concat (q.new_hlist);

	    // XXX: penalties?

	    r_type = t;
	    i++;
	}

	return outlist;
    };

    return ml;
}) ();
