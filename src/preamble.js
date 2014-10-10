// Global preamble included at the top of the wrappers in all Webtex flavors
// (Node.js, browser master, browser worker).
//
// We assume that "globalScope" and "webtexApiObject" have been set. All other
// setup is up to us.

function webtex_export (name, value) {
    webtexApiObject[name] = value;
}


// Pluggable backends. Depending on the flavor of Webtex we're building, there
// may be different implementations of common APIs that we want to use.

var backends = {};

function webtex_register_backend (name, value) {
    if (backends.hasOwnProperty (name))
	throw new TexInternalError ('registering redundant backend ' + name);

    backeds[name] = value;
}


// Webtex-global helper functions.

var global_log = (function () {
    if ('console' in globalScope && 'log' in globalScope['console']) {
	return globalScope['console']['log'].bind (globalScope['console']);
    } else {
	return function noop () {};
    }
}) ();

function global_logf () {
    global_log (format.apply (null, arguments));
}

var global_warn = (function () {
    if ('console' in globalScope && 'warn' in globalScope['console']) {
	return globalScope['console']['warn'].bind (globalScope['console']);
    } else {
	return global_log;
    }
}) ();

function global_warnf () {
    global_warn (format.apply (null, arguments));
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


function arraybuffer_to_str (arraybuf) {
    // A naive fromCharCode.apply() call can lead to exceptions about too many
    // arguments.
    //
    // XXX assuming no multi-byte/UTF8-type characters!!

    var s = '';
    var b = new Uint8Array (arraybuf);
    var nleft = b.byteLength;
    var nchunk = 4096;
    var ofs = 0;

    while (nleft > nchunk) {
	s += String.fromCharCode.apply (null, b.subarray (ofs, ofs + nchunk));
	ofs += nchunk;
	nleft -= nchunk;
    }

    s += String.fromCharCode.apply (null, b.subarray (ofs, ofs + nleft));
    return s;
}


/* Errors */

var TexSyntaxError = (function TexSyntaxErrorClosure () {
    function TexSyntaxError () {
	// Subclassing Errors is unusual. Error.call(this) happens
	// to not behave as most other constructor-type functions.
	// The pattern we use here Does What We Want.
	var tmp = Error.call (this, format.apply (null, arguments));
	tmp.name = this.name = 'TexSyntaxError';
	this.message = tmp.message;
	this.stack = tmp.stack;
    }

    inherit (TexSyntaxError, Error);
    return TexSyntaxError;
}) ();


var TexRuntimeError = (function TexRuntimeErrorClosure () {
    function TexRuntimeError () {
	var tmp = Error.call (this, format.apply (null, arguments));
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


/* EOF marker */

var EOF = {toString: function () { return 'EOF'; }};
webtex_export ('EOF', EOF);
