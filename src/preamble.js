'use strict';

webtexApiObject.IOBackend = {}; // XXX


var global_log = (function () {
    if ('console' in globalScope && 'log' in globalScope['console']) {
	return globalScope['console']['log'].bind (globalScope['console']);
    } else {
	return function noop () {};
    }
}) ();


var global_warn = (function () {
    if ('console' in globalScope && 'warn' in globalScope['console']) {
	return globalScope['console']['warn'].bind (globalScope['console']);
    } else {
	return global_log;
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

var TexSyntaxError = (function TexSyntaxErrorClosure () {
    function TexSyntaxError () {
	// Subclassing Errors is unusual. Error.call(this) happens
	// to not behave as most other constructor-type functions.
	// The pattern we use here Does What We Want.
	var tmp = Error.apply (this, arguments);
	tmp.name = this.name = 'TexSyntaxError';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexSyntaxError, Error);
    return TexSyntaxError;
}) ();


var TexRuntimeError = (function TexRuntimeErrorClosure () {
    function TexRuntimeError () {
	var tmp = Error.apply (this, arguments);
	tmp.name = this.name = 'TexRuntimeError';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexRuntimeError, Error);
    return TexRuntimeError;
}) ();


var TexInternalError = (function TexInternalErrorClosure () {
    function TexInternalError () {
	var tmp = Error.apply (this, arguments);
	tmp.name = this.name = 'TexInternalError';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexInternalError, Error);
    return TexInternalError;
}) ();


/* Dealing with processing restarts */

var NeedMoreData = {toString: function () { return 'NeedMoreData'; }};
var EOF = {toString: function () { return 'EOF'; }};

webtex_export ('NeedMoreData', NeedMoreData);
webtex_export ('EOF', EOF);
