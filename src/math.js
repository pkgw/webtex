// Math-related data types.
//
// These correspond to "noads" in TeX. We don't make these subclasses
// of Listable and I think that'll be OK.

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
    function MathNode (mtype) {
	this.mtype = mtype;
    }

    var proto = MathNode.prototype;
    return MathNode;
}) ();


var AtomNode = (function AtomNode_closure () {
    // An "atom" that contains a nucleus, subscript, and/or superscript.
    //
    // Most of the math types are represented as an AtomNode instance: Ord,
    // Op, Bin, Rel, Open, Close, Punct, Inner, Under*, Over*, Vcenter*.
    // Asterisked types don't use `sub` or `sup`.

    function AtomNode (mtype) {
	MathNode.call (this, mtype);
	this.nuc = null;
	this.sub = null;
	this.sup = null;
    }

    inherit (AtomNode, MathNode);
    var proto = AtomNode.prototype;

    return AtomNode;
}) ();


var RadicalNode = (function RadicalNode_closure () {
    function RadicalNode () {
	AtomNode.call (this, MT_RADICAL);
	this.left_delim = new Delimiter ();
    }

    inherit (RadicalNode, AtomNode);
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

    inherit (FractionNode, AtomNode);
    var proto = FractionNode.prototype;

    return FractionNode;
}) ();


var AccentNode = (function AccentNode_closure () {
    function AccentNode () {
	MathNode.call (this, MT_ACCENT);
	this.nucleus = null;
	this.accent_fam = null;
	this.accent_ord = null;
    }

    inherit (AccentNode, MathNode);
    var proto = AccentNode.prototype;

    return AccentNode;
}) ();


var DynDelimNode = (function DynDelimNode_closure () {
    // A dynamically-sized delimiter: may be of math type MT_LEFT or MT_RIGHT.

    function DynDelimNode (mtype) {
	MathNode.call (this, mtype);
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
