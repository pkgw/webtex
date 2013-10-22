/* lots of copying from Mozilla pdf.js */

'use strict';

var globalScope = (typeof window === 'undefined') ? this : window;

if (!globalScope.WEBTEX) {
    globalScope.WEBTEX = {};
}


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


function inherit (sub, base, prototype) {
    sub.prototype = Object.create (base.prototype);
    sub.prototype.constructor = sub;

    for (var prop in prototype) {
	sub.prototype[prop] = prototype[prop];
    }
};


/* Errors */

var TexSyntaxException = (function TexSyntaxExceptionClosure () {
    function TexSyntaxException (msg) {
	this.name = 'TexSyntaxException';
	this.message = msg;
    }

    TexSyntaxException.prototype = new Error ();
    TexSyntaxException.constructor = TexSyntaxException;
    return TexSyntaxException;
}) ();


var TexRuntimeException = (function TexRuntimeExceptionClosure () {
    function TexRuntimeException (msg) {
	this.name = 'TexRuntimeException';
	this.message = msg;
    }

    TexRuntimeException.prototype = new Error ();
    TexRuntimeException.constructor = TexRuntimeException;
    return TexRuntimeException;
}) ();


var TexInternalException = (function TexInternalExceptionClosure () {
    function TexInternalException (msg) {
	this.name = 'TexInternalException';
	this.message = msg;
    }

    TexInternalException.prototype = new Error ();
    TexInternalException.constructor = TexInternalException;
    return TexInternalException;
}) ();
