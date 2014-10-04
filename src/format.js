// This is loosely based on sprinf.js from
// https://github.com/alexei/sprintf.js, copied under the license shown below.
// This version removes a lot of features, adapts the coding style, and adds
// Webtex-specific functionality.
//
//
// If only one argument is supplied, the argument is returned verbatim.
// Otherwise, the format specifiers are:
//
// %c - character ordinal to escaped character via escchr()
// %C - character ordinal to escaped character via texchr()
// %d - number
// %j - JSON stringification of object
// %o - toString() stringification object
// %s - raw string
// %x - hexadecimal number (rendered with leading "0x")
//
// (The special-case of one argument matters if that argument is an arbitrary
// string that may contain percent signs.)
//
//
// Original copyright and license:
//
// Copyright (c) 2007-2013, Alexandru Marasteanu <hello [at) alexei (dot] ro>
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above copyright
// notice, this list of conditions and the following disclaimer in the
// documentation and/or other materials provided with the distribution.
// * Neither the name of this software nor the names of its contributors may be
// used to endorse or promote products derived from this software without
// specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

var format = (function format_wrapper () {
    var text_re = /^[^\x25]+/;
    var doublepercent_re = /^\x25{2}/;
    var placeholder_re = /^\x25(.)/;

    // Indices into matches for the placeholder_re:
    var WHOLE_MATCH = 0; // this is true for any regex
    var SPECIFIER = 1;

    function format () {
        var key = arguments[0];
	var cache = format.cache;

	if (arguments.length == 1)
	    return key;

        if (!cache.hasOwnProperty (key))
            cache[key] = format.parse (key);

        return format.do_it.call (null, cache[key], arguments);
    }

    format.do_it = function format_do_it (nodes, argv) {
        var cursor = 1;
	var output = [];

        for (var i = 0; i < nodes.length; i++) {
	    var node = nodes[i];

            if (typeof node === 'string')
                output.push (node);
            else {
                var arg = argv[cursor++];

                switch (node[SPECIFIER]) {
                case 'c':
		    if (typeof arg !== 'number')
			throw new Error ('format %c expected number but got ' + arg);
                    arg = escchr (arg);
                    break;
                case 'C':
		    if (typeof arg !== 'number')
			throw new Error ('format %C expected number but got ' + arg);
                    arg = texchr (arg);
                    break;
                case 'd':
		    if (typeof arg !== 'number')
			throw new Error ('format %d expected number but got ' + arg);
                    arg = arg.toString (10);
                    break;
                case 'j':
                    arg = JSON.stringify (arg);
                    break;
                case 'o':
                    arg = arg.toString ();
                    break;
                case 's':
		    if (typeof arg !== 'string')
			throw new Error ('format %s expected string but got ' + arg);
		    // Nothing to do.
                    break;
                case 'x':
		    if (typeof arg !== 'number')
			throw new Error ('format %x expected number but got ' + arg);
                    arg = '0x' + arg.toString (16);
                    break;
		default:
		    throw new Error ('unhandled format specifier ' + node[SPECIFIER]);
                }

                output.push (arg);
            }
        }

        return output.join ('');
    }

    format.cache = {};

    format.parse = function format_parse (fmt) {
	var nodes = [];

        while (fmt) {
	    var match;

            if ((match = text_re.exec (fmt)) !== null)
                nodes.push (match[WHOLE_MATCH]);
            else if ((match = doublepercent_re.exec (fmt)) !== null)
                nodes.push ('%');
            else if ((match = placeholder_re.exec (fmt)) !== null)
                nodes.push (match);
            else
		// I think this only happens with a trailing percent sign, now.
                throw new SyntaxError ('unexpected format placeholder');

            fmt = fmt.substring (match[WHOLE_MATCH].length);
        }

        return nodes;
    }

    return format;
}) ();

webtex_export ('format', format);
