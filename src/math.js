// Math-related data types.
//
// These correspond to "noads" in TeX. Math lists can contain these Nodes as
// well as the Listables Ins, Mark, Adjust, Whatsit, Penalty, Disc, Rule,
// BoxGlue, and Kern.

'use strict';

var Delimiter = (function Delimiter_closre () {
    function Delimiter () {
	this.small_fam = null;
	this.small_ord = null;
	this.large_fam = null;
	this.large_ord = null;
    }

    var proto = Delimiter.prototype;
    return Delimiter;
}) ();


var MathNode = (function MathNode_closure () {
    // Something that can be put in a box; or more precisely, a horizontal or
    // vertical list.
    function MathNode (ltype) {
	this.ltype = ltype;
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
    // Op, Bin, Rel, Open, Close, Punct, Inner, Under*, Over*, Vcenter*.
    // Asterisked types don't use `sub` or `sup`.

    function AtomNode (ltype) {
	MathNode.call (this, ltype);
	this.nuc = null;
	this.sub = null;
	this.sup = null;
    }

    inherit (AtomNode, MathNode);
    var proto = AtomNode.prototype;

    return AtomNode;
}) ();


var MathChar = (function MathChar_closure () {
    function MathChar (fam, ord) {
	this.fam = fam;
	this.ord = ord;
    }
    return MathChar;
}) ();


var MathTextChar = (function MathTextChar_closure () {
    function MathTextChar (fam, ord) {
	this.fam = fam;
	this.ord = ord;
    }
    return MathTextChar;
}) ();


var RadicalNode = (function RadicalNode_closure () {
    function RadicalNode () {
	MathNode.call (this, MT_RADICAL);
	this.left_delim = new Delimiter ();
    }

    inherit (RadicalNode, MathNode);
    var proto = RadicalNode.prototype;

    return RadicalNode;
}) ();


var FractionNode = (function FractionNode_closure () {
    function FractionNode () {
	MathNode.call (this, MT_FRACTION);
	this.thickness = null;
	this.denom = null;
	this.numer = null;
	this.left_delim = new Delimiter ();
	this.right_delim = new Delimiter ();
    }

    inherit (FractionNode, MathNode);
    var proto = FractionNode.prototype;

    return FractionNode;
}) ();


var AccentNode = (function AccentNode_closure () {
    function AccentNode () {
	MathNode.call (this, MT_ACCENT);
	this.nuc = null;
	this.accent_fam = null;
	this.accent_ord = null;
    }

    inherit (AccentNode, MathNode);
    var proto = AccentNode.prototype;

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

    return StyleChoiceNode;
}) ();


var mathlib = (function mathlib_closure () {
    var ml = {};

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
	var ltype = (mathcode >> 13) & 0x7 + MT_ORD;

	if (mathcode >= 0x7000) {
	    if (cur_fam >= 0 && cur_fam < 16)
		fam = cur_fam;
	    ltype = MT_ORD;
	}

	var atom = new AtomNode (ltype);
	atom.nuc = new MathChar (fam, ord);
	return atom;
    };

    var SymDimens = {
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

	return MathState;
    }) ();

    function make_ord (q, next) {
	if (q.sub != null || q.sup != null)
	    return;
	if (!(q.nuc instanceof MathChar))
	    return;
	if (next == null)
	    return;

	switch (next.ltype) {
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

	if (!(next.nuc instanceof MathChar))
	    return;

	if (next.nuc.fam != q.nuc.fam)
	    return;

	throw TexInternalError ('implement make_ord');
    }

    function hpack_natural (engine, hlist) {
	var b = new Box (BT_HBOX);

	if (hlist != null) {
	    b.list = hlist;
	    b.set_glue (engine, false, new Dimen ());
	}

	return b;
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
		var next = null;
		if (i < m_len)
		    next = mlist[i+1];
		make_ord (q, next);
		break;
	    case MT_FRACTION:
	    case MT_OP:
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
	    } else if (q.nuc instanceof Box) {
		p = [q.nuc];
	    } else if (q.nuc instanceof Array) {
		var sublist = mlist_to_hlist (engine, q.nuc, state.style,
					      state.cramped, false);
		p = [hpack_natural (sublist)]; // XXX
	    } else {
		throw new TexInternalError ('unrecognized nucleus value ' + q.nuc);
	    }

	    q.new_hlist = p;

	    if (q.sub != null || q.sup != null)
		make_scripts (q, delta);

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
