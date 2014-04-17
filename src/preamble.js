'use strict';

WEBTEX.IOBackend = {};


var global_log = (function () {
    if ('console' in globalScope && 'log' in globalScope['console']) {
	return globalScope['console']['log'].bind (globalScope['console']);
    } else {
	return function noop () {};
    }
}) ();


function inherit (ctor, superCtor) {
    /* Copying node.js */
    ctor.super_ = superCtor;
    ctor.prototype = Object.create (superCtor.prototype, {
	constructor: {
	    value: ctor,
	    enumerable: false,
	    writable: true,
	    configurable: true
	}
    });
}


/* Errors */

var TexSyntaxException = (function TexSyntaxExceptionClosure () {
    function TexSyntaxException () {
	// Subclassing Errors is unusual. Error.call(this) happens
	// to not behave as most other constructor-type functions.
	// The pattern we use here Does What We Want.
	var tmp = Error.apply (this, arguments);
	tmp.name = this.name = 'TexSyntaxException';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexSyntaxException, Error);
    return TexSyntaxException;
}) ();


var TexRuntimeException = (function TexRuntimeExceptionClosure () {
    function TexRuntimeException () {
	var tmp = Error.apply (this, arguments);
	tmp.name = this.name = 'TexRuntimeException';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexRuntimeException, Error);
    return TexRuntimeException;
}) ();


var TexInternalException = (function TexInternalExceptionClosure () {
    function TexInternalException () {
	var tmp = Error.apply (this, arguments);
	tmp.name = this.name = 'TexInternalException';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexInternalException, Error);
    return TexInternalException;
}) ();
