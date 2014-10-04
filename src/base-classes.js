// Base classes for some of the key TeX data types.

var Value = (function Value_closure () {
    // A Value is some kind of datum that can be stored in the TeX engine.
    // Various kinds of values are stored in registers, named parameters, and
    // so on.

    function Value () {}
    var proto = Value.prototype;

    proto.toString = function Value_toString () {
	// Returns the developer-friendly stringification of this object.
	// Should not get back to the TeX engine.
	return '[Value without toString?]';
    };

    proto.to_texstr = function Value_to_texstr () {
	// This function returns the stringification of the value as
	// implemented by TeX's \the primitive.
	throw new TexInternalError ('not implemented Value.to_texstr');
    };

    proto.clone = function Value_clone () {
	// Returns a new, identical copy of this value.
	throw new TexInternalError ('not implemented Value.clone');
    };

    proto.equals = function Value_equals () {
	// Returns whether this object has the same value as another. So far
	// only used to compare fonts in GivenFontCommand.samecmd, so this may
	// be very overly generic.
	throw new TexInternalError ('not implemented Value.equals');
    };

    proto.is_nonzero = function Value_is_nonzero () {
	// Returns whether this object is different than the default value for
	// its class.
	throw new TexInternalError ('not implemented Value.is_nonzero');
    };

    proto.as_int = function Value_as_int () {
	// Returns a TexInt that this value is equivalent to, or null if such
	// a conversion is not allowed.
	throw new TexInternalError ('not implemented Value.as_int');
    };

    proto.as_scaled = function Value_as_scaled () {
	// Returns a Scaled that this value is equivalent to, or null if such
	// a conversion is not allowed. Note that Scaleds are not exposed to
	// TeX programs; they are always wrapped by Dimens. Currently this is
	// only used in Engine.scan_dimen and may be superfluous.
	throw new TexInternalError ('not implemented Value.as_scaled');
    };

    proto.as_dimen = function Value_as_dimen () {
	// Returns a Dimen that this value is equivalent to, or null if such a
	// conversion is not allowed. This is used in Engine.scan_dimen.
	throw new TexInternalError ('not implemented Value.as_dimen');
    };

    proto.as_glue = function Value_as_glue () {
	// Returns a Glue that this value is equivalent to, or null if such a
	// conversion is not allowed. This is used in Engine.scan_glue.
	throw new TexInternalError ('not implemented Value.as_glue');
    };

    proto.as_serializable = function Value_as_serializable () {
	// Returns a unique JSON-compatible representation.
	throw new TexInternalError ('not implemented Value.as_serializable');
    };

    proto.advance = function Value_advance (other) {
	// Implement \advance for this value -- that is, addition. Returns a
	// new advanced value, because some Values are immutable.
	throw new TexInternalError ('not implemented Value.advance');
    };

    proto.intproduct = function Value_intproduct (other) {
	// Implement \multiply for this value, which is integer
	// multiplication. `other` should be passed through TexInt.xcheck().
	// Returns a new multiplied value, because some Values are immutable.
	throw new TexInternalError ('not implemented Value.intproduct');
    };

    proto.intdivide = function Value_intdivide (other) {
	// Implement \divide for this value, which is integer division.
	// `other` should be passed through TexInt.xcheck(). Returns a new
	// divided value, because some Values are immutable.
	throw new TexInternalError ('not implemented Value.intdivide');
    };

    // Static functions.

    Value.ensure = function Value_ensure (valtype, value) {
	if (valtype == T_INT)
	    return new TexInt (TexInt.xcheck (value));

	if (valtype == T_DIMEN) {
	    if (!(value instanceof Dimen))
		throw new TexInternalError ('value is not dimen: ' + value);
	    return value;
	}

	if (valtype == T_GLUE || valtype == T_MUGLUE) {
	    if (!(value instanceof Glue))
		throw new TexInternalError ('value is not (mu)glue: ' + value);
	    return value;
	}

	if (valtype == T_TOKLIST) {
	    if (!(value instanceof Toklist))
		throw new TexInternalError ('value is not toklist: ' + value);
	    return value;
	}

	if (valtype == T_BOX) {
	    if (!(value instanceof ListBox))
		throw new TexInternalError ('value is not box: ' + value);
	    return value;
	}

	if (valtype == T_FONT) {
	    if (!(value instanceof Font))
		throw new TexInternalError ('value is not font: ' + value);
	    return value;
	}

	throw new TexInternalError ('unrecognized valtype ' + valtype);
    };

    return Value;
}) ();


var Valref = (function Valref_closure () {
    // A Valref is a reference to a value. It can be retrieved or overwritten,
    // giving us a generic system for implementing commands such as \advance.

    function Valref (valtype) {
	this.valtype = valtype;
    }

    var proto = Valref.prototype;

    proto.get = function Valref_get (engine) {
	// Retrieve the actual value of this reference. Typically involves
	// scanning tokens in the engine. May return null if there's no value
	// but that situation is expected.
	throw new TexInternalError ('not implemented Valref.get');
    };

    proto.set = function Valref_set (engine, value) {
	// Assign a new value to the storage location that this reference
	// represents.
	throw new TexInternalError ('not implemented Valref.set');
    };

    return Valref;
}) ();


var Listable = (function Listable_closure () {
    // A Listable is something that can be put in a horizontal, vertical, or
    // math list.

    function Listable () {
	this.ltype = null;
    }

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
