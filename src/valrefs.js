// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// References to values, as many commands are.

var SpecialValref = (function SpecialValref_closure () {
    function SpecialValref (valtype, name) {
	Valref.call (this, valtype);
	this.name = name;
    }

    inherit (SpecialValref, Valref);
    var proto = SpecialValref.prototype;

    proto.get = function SpecialValref_get (engine) {
	var rv = engine.get_special_value (this.valtype, this.name);
	return Value.ensure_boxed (this.valtype, rv);
    };

    proto.set = function SpecialValref_set (engine, value) {
	value = Value.ensure_unboxed (this.valtype, value);
	engine.set_special_value (this.valtype, this.name, value);
    };

    return SpecialValref;
}) ();


var ConstantValref = (function ConstantValref_closure () {
    function ConstantValref (valtype, value) {
	Valref.call (this, valtype);
	this.value = Value.ensure_boxed (valtype, value);
    }

    inherit (ConstantValref, Valref);
    var proto = ConstantValref.prototype;

    proto.get = function ConstantValref_get (engine) {
	return this.value;
    };

    proto.set = function ConstantValref_set (engine, value) {
	throw new TexRuntimeError ('cannot set a constant Valref')
    };

    return ConstantValref;
}) ();
