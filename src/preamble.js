/* lots of copying from Mozilla pdf.js */

'use strict';

if (!globalScope.WEBTEX) {
    globalScope.WEBTEX = {};
}

WEBTEX.IOBackend = {};


/* Diagnostic infrastructure */

var log = (function () {
    if ('console' in globalScope && 'log' in globalScope['console']) {
	return globalScope['console']['log'].bind (globalScope['console']);
    } else {
	return function noop () {};
    }
}) ();

function _make_backtrace () {
    try {
	throw new Error ();
    } catch (e) {
	return e.stack ? e.stack.split ('\n').slice (2).join ('\n') : '';
    }
}

function error (msg) {
    // If multiple arguments were passed, pass them all to the log function.
    if (arguments.length > 1) {
	var logArguments = ['Error:'];
	logArguments.push.apply (logArguments, arguments);
	log.apply (null, logArguments);
	// Join the arguments into a single string for the lines below.
	msg = [].join.call (arguments, ' ');
    } else {
	log ('Error: ' + msg);
    }
    log (_make_backtrace ());
    //PDFJS.LogManager.notify('error', msg);
    throw new Error (msg);
}

function assert (cond, msg) {
    if (!cond)
	error (msg);
}


/* Object system helpers */

function shadow (obj, prop, value) {
    Object.defineProperty (obj, prop, { value: value,
					enumerable: true,
					configurable: true,
					writable: false });
    return value;
}


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
