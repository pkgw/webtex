// This is loosely based on sprinf.js from
// https://github.com/alexei/sprintf.js, copied under the license shown below.
// This version adds some Webtex-specific features and massages the code to
// fit into our API structure. It also adds trailing semicolons and uses my
// spacing / indentation conventions.
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

var sprintf = (function sprintf_wrapper () {
    var re = {
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(.)/,
    };

    function sprintf () {
        var key = arguments[0];
	var cache = sprintf.cache;

        if (!(cache[key] && cache.hasOwnProperty (key))) {
            cache[key] = sprintf.parse (key);
        }

        return sprintf.format.call (null, cache[key], arguments);
    }

    sprintf.format = function (nodes, argv) {
        var cursor = 1;
	var tree_length = nodes.length;
	var arg, i, k, match, pad, pad_character, pad_length;
	var output = [];
	var is_positive = true;
	var sign = '';

        for (i = 0; i < tree_length; i++) {
            if (typeof nodes[i] === 'string') {
                output.push (nodes[i]);
            } else if (nodes[i] instanceof Array) {
                match = nodes[i]; // convenience purposes only
                arg = argv[cursor++];

                if (typeof arg === 'function')
                    arg = arg ();

                switch (match[1]) {
                case 'b':
                    arg = arg.toString (2);
                    break;
                case 'c':
                    arg = String.fromCharCode (arg);
                    break;
                case 'd':
                case 'i':
                    arg = parseInt (arg, 10);
                    break;
                case 'e':
                    arg = arg.toExponential ();
                    break;
                case 'f':
                    arg = parseFloat (arg);
                    break;
                case 'o':
                    arg = arg.toString (8);
                    break;
                case 's':
                    break;
                case 'u':
                    arg = arg >>> 0;
                    break;
                case 'x':
                    arg = arg.toString (16);
                    break;
                case 'X':
                    arg = arg.toString (16).toUpperCase ();
                    break;
                }

                output.push (arg);
            }
        }

        return output.join ('');
    }

    sprintf.cache = {};

    sprintf.parse = function (fmt) {
	var match = [];
	var nodes = [];

        while (fmt) {
            if ((match = re.text.exec (fmt)) !== null)
                nodes.push (match[0]);
            else if ((match = re.modulo.exec (fmt)) !== null)
                nodes.push ('%');
            else if ((match = re.placeholder.exec (fmt)) !== null)
                nodes.push (match);
            else
                throw new SyntaxError('[sprintf] unexpected placeholder');

            fmt = fmt.substring (match[0].length);
        }

        return nodes;
    }

    // Helpers.

    function str_repeat (input, multiplier) {
        return Array (multiplier + 1).join (input);
    }

    return sprintf;
}) ();

webtex_export ('sprintf', sprintf);
