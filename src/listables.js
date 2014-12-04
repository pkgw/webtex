// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Things that can go in lists = Listables.
//
// The standard TeX Listables are Box (hbox and vbox), Rule, Insert, Mark,
// Adjust, Ligature, Disc(retionary linebreak), Whatsit, Math, BoxGlue, Kern,
// Penalty, Unset. Then there are the math "noads" but those are defined in
// math.js. Boxes are in boxes.js.
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
	return format ('StartTag %s %j', this.name, this.attrs);
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
	return format ('EndTag %s', this.name);
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


var CanvasControl = (function CanvasControl_closure () {
    // Items of this kind demarcate spans that should be rendered as canvases.
    // This is needed because, e.g., math aligns come as series of hboxes
    // whose relative positions are quite important.

    function CanvasControl (is_pop) {
	this.ltype = LT_STARTTAG; // XXX lazy should straighten this out
	this.is_pop = !!is_pop;
    }

    inherit (CanvasControl, Listable);
    var proto = CanvasControl.prototype;

    proto._uisummary = function CanvasControl__uisummary () {
	if (this.is_pop)
	    return 'CanvasControl pop';
	return 'CanvasControl push';
    };

    return CanvasControl;
}) ();


var Image = (function Image_closure () {
    function Image (attrs) {
	this.ltype = LT_STARTTAG; // XXX lazy should straighten this out
	this.src = attrs.src;

	if (this.src == null)
	    throw new TexRuntimeError ('cannot create Image without "src" attribute');
    }

    inherit (Image, Listable);
    var proto = Image.prototype;

    proto._uisummary = function Image__uisummary () {
	return format ('Image src=%s', this.src);
    };

    return Image;
}) ();
