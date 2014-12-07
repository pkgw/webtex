// Copyright 2012 Mozilla Foundation, 2014 Peter Williams and collaborators
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file is derived from stream.js, fonts.js, parser.js, and
// font_renderer.js in Mozilla's pdf.js.
//
// My purposes are much narrower than those of pdf.js, so a lot of this code
// is not really needed, and the style is fairly different than the one used
// in the rest of Webtex. But I'd like to maintain straightforward
// comparability with pdf.js. If this turns out to be a performance
// bottleneck, it might be worth tightening things up.

var Type1Font = (function Type1Font_closure () {
    function isSpace (ch) {
	// Space is one of the following characters: SPACE, TAB, CR or LF.
	return (ch === 0x20 || ch === 0x09 || ch === 0x0D || ch === 0x0A);
    }


    // pdf.js's internal Stream class has a ton of features that we don't need
    // for our one use case. Used methods are: getByte, getBytes,
    // makeSubStream, peekBytes, pos, skip

    var Stream = (function StreamClosure() {
	function Stream(arrayBuffer, start, length, dict) {
	    this.bytes = (arrayBuffer instanceof Uint8Array ?
			  arrayBuffer : new Uint8Array(arrayBuffer));
	    this.start = start || 0;
	    this.pos = this.start;
	    this.end = (start + length) || this.bytes.length;
	    this.dict = dict;
	}

	// required methods for a stream. if a particular stream does not
	// implement these, an error should be thrown
	Stream.prototype = {
	    get length() {
		return this.end - this.start;
	    },
	    get isEmpty() {
		return this.length === 0;
	    },
	    getByte: function Stream_getByte() {
		if (this.pos >= this.end) {
		    return -1;
		}
		return this.bytes[this.pos++];
	    },
	    getUint16: function Stream_getUint16() {
		var b0 = this.getByte();
		var b1 = this.getByte();
		return (b0 << 8) + b1;
	    },
	    getInt32: function Stream_getInt32() {
		var b0 = this.getByte();
		var b1 = this.getByte();
		var b2 = this.getByte();
		var b3 = this.getByte();
		return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
	    },
	    // returns subarray of original buffer
	    // should only be read
	    getBytes: function Stream_getBytes(length) {
		var bytes = this.bytes;
		var pos = this.pos;
		var strEnd = this.end;

		if (!length) {
		    return bytes.subarray(pos, strEnd);
		}
		var end = pos + length;
		if (end > strEnd) {
		    end = strEnd;
		}
		this.pos = end;
		return bytes.subarray(pos, end);
	    },
	    peekByte: function Stream_peekByte() {
		var peekedByte = this.getByte();
		this.pos--;
		return peekedByte;
	    },
	    peekBytes: function Stream_peekBytes(length) {
		var bytes = this.getBytes(length);
		this.pos -= bytes.length;
		return bytes;
	    },
	    skip: function Stream_skip(n) {
		if (!n) {
		    n = 1;
		}
		this.pos += n;
	    },
	    reset: function Stream_reset() {
		this.pos = this.start;
	    },
	    moveStart: function Stream_moveStart() {
		this.start = this.pos;
	    },
	    makeSubStream: function Stream_makeSubStream(start, length, dict) {
		return new Stream(this.bytes.buffer, start, length, dict);
	    },
	    isStream: true
	};

	return Stream;
    })();


    function parse_type1_charstrings (name, file, properties) {
	// Some bad generators embed pfb file as is, we have to strip 6-byte
	// headers. Also, length1 and length2 might be off by 6 bytes as well.
	// http://www.math.ubc.ca/~cass/piscript/type1.pdf

	var PFB_HEADER_SIZE = 6;
	var headerBlockLength = properties.length1;
	var eexecBlockLength = properties.length2;
	var pfbHeader = file.peekBytes(PFB_HEADER_SIZE);
	var pfbHeaderPresent = pfbHeader[0] === 0x80 && pfbHeader[1] === 0x01;
	if (pfbHeaderPresent) {
	    file.skip(PFB_HEADER_SIZE);
	    headerBlockLength = (pfbHeader[5] << 24) | (pfbHeader[4] << 16) |
		(pfbHeader[3] << 8) | pfbHeader[2];
	}

	// Get the data block containing glyphs and subrs informations
	var headerBlock = new Stream(file.getBytes(headerBlockLength));
	var headerBlockParser = new Type1Parser(headerBlock);
	headerBlockParser.extractFontHeader(properties);

	if (pfbHeaderPresent) {
	    pfbHeader = file.getBytes(PFB_HEADER_SIZE);
	    eexecBlockLength = (pfbHeader[5] << 24) | (pfbHeader[4] << 16) |
		(pfbHeader[3] << 8) | pfbHeader[2];
	}

	// Decrypt the data blocks and retrieve it's content
	var eexecBlock = new Stream(file.getBytes(eexecBlockLength));
	var eexecBlockParser = new Type1Parser(eexecBlock, true);
	var data = eexecBlockParser.extractFontProgram();
	for (var info in data.properties) {
	    properties[info] = data.properties[info];
	}

	return data.charstrings;
    };


    /*
     * Type1Parser encapsulate the needed code for parsing a Type1 font
     * program. Some of its logic depends on the Type2 charstrings
     * structure.
     * Note: this doesn't really parse the font since that would require evaluation
     * of PostScript, but it is possible in most cases to extract what we need
     * without a full parse.
     */
    var Type1Parser = (function Type1ParserClosure() {
	/*
	 * Decrypt a Sequence of Ciphertext Bytes to Produce the Original Sequence
	 * of Plaintext Bytes. The function took a key as a parameter which can be
	 * for decrypting the eexec block of for decoding charStrings.
	 */
	var EEXEC_ENCRYPT_KEY = 55665;
	var CHAR_STRS_ENCRYPT_KEY = 4330;

	function isHexDigit(code) {
	    return code >= 48 && code <= 57 || // '0'-'9'
            code >= 65 && code <= 70 || // 'A'-'F'
            code >= 97 && code <= 102;  // 'a'-'f'
	}

	function decrypt(data, key, discardNumber) {
	    var r = key | 0, c1 = 52845, c2 = 22719;
	    var count = data.length;
	    var decrypted = new Uint8Array(count);
	    for (var i = 0; i < count; i++) {
		var value = data[i];
		decrypted[i] = value ^ (r >> 8);
		r = ((value + r) * c1 + c2) & ((1 << 16) - 1);
	    }
	    return Array.prototype.slice.call(decrypted, discardNumber);
	}

	function decryptAscii(data, key, discardNumber) {
	    var r = key | 0, c1 = 52845, c2 = 22719;
	    var count = data.length, maybeLength = count >>> 1;
	    var decrypted = new Uint8Array(maybeLength);
	    var i, j;
	    for (i = 0, j = 0; i < count; i++) {
		var digit1 = data[i];
		if (!isHexDigit(digit1)) {
		    continue;
		}
		i++;
		var digit2;
		while (i < count && !isHexDigit(digit2 = data[i])) {
		    i++;
		}
		if (i < count) {
		    var value = parseInt(String.fromCharCode(digit1, digit2), 16);
		    decrypted[j++] = value ^ (r >> 8);
		    r = ((value + r) * c1 + c2) & ((1 << 16) - 1);
		}
	    }
	    return Array.prototype.slice.call(decrypted, discardNumber, j);
	}

	function isSpecial(c) {
	    return c === 0x2F || // '/'
            c === 0x5B || c === 0x5D || // '[', ']'
            c === 0x7B || c === 0x7D || // '{', '}'
            c === 0x28 || c === 0x29; // '(', ')'
	}

	function Type1Parser(stream, encrypted) {
	    if (encrypted) {
		var data = stream.getBytes();
		var isBinary = !(isHexDigit(data[0]) && isHexDigit(data[1]) &&
				 isHexDigit(data[2]) && isHexDigit(data[3]));
		stream = new Stream(isBinary ? decrypt(data, EEXEC_ENCRYPT_KEY, 4) :
				    decryptAscii(data, EEXEC_ENCRYPT_KEY, 4));
	    }
	    this.stream = stream;
	    this.nextChar();
	}

	Type1Parser.prototype = {
	    readNumberArray: function Type1Parser_readNumberArray() {
		this.getToken(); // read '[' or '{' (arrays can start with either)
		var array = [];
		while (true) {
		    var token = this.getToken();
		    if (token === null || token === ']' || token === '}') {
			break;
		    }
		    array.push(parseFloat(token || 0));
		}
		return array;
	    },

	    readNumber: function Type1Parser_readNumber() {
		var token = this.getToken();
		return parseFloat(token || 0);
	    },

	    readInt: function Type1Parser_readInt() {
		// Use '| 0' to prevent setting a double into length such as the double
		// does not flow into the loop variable.
		var token = this.getToken();
		return parseInt(token || 0, 10) | 0;
	    },

	    readBoolean: function Type1Parser_readBoolean() {
		var token = this.getToken();

		// Use 1 and 0 since that's what type2 charstrings use.
		return token === 'true' ? 1 : 0;
	    },

	    nextChar : function Type1_nextChar() {
		return (this.currentChar = this.stream.getByte());
	    },

	    getToken: function Type1Parser_getToken() {
		// Eat whitespace and comments.
		var comment = false;
		var ch = this.currentChar;
		while (true) {
		    if (ch === -1) {
			return null;
		    }

		    if (comment) {
			if (ch === 0x0A || ch === 0x0D) {
			    comment = false;
			}
		    } else if (ch === 0x25) { // '%'
			comment = true;
		    } else if (!isSpace(ch)) {
			break;
		    }
		    ch = this.nextChar();
		}
		if (isSpecial(ch)) {
		    this.nextChar();
		    return String.fromCharCode(ch);
		}
		var token = '';
		do {
		    token += String.fromCharCode(ch);
		    ch = this.nextChar();
		} while (ch >= 0 && !isSpace(ch) && !isSpecial(ch));
		return token;
	    },

	    /*
	     * Returns an object containing a Subrs array and a CharStrings
	     * array extracted from and eexec encrypted block of data
	     */
	    extractFontProgram: function Type1Parser_extractFontProgram() {
		var stream = this.stream;

		var subrs = [], charstrings = [];
		var program = {
		    subrs: [],
		    charstrings: [],
		    properties: {
			'privateData': {
			    'lenIV': 4
			}
		    }
		};
		var token, length, data, lenIV, encoded;
		while ((token = this.getToken()) !== null) {
		    if (token !== '/') {
			continue;
		    }
		    token = this.getToken();
		    switch (token) {
		    case 'CharStrings':
			// The number immediately following CharStrings must be greater or
			// equal to the number of CharStrings.
			this.getToken();
			this.getToken(); // read in 'dict'
			this.getToken(); // read in 'dup'
			this.getToken(); // read in 'begin'
			while(true) {
			    token = this.getToken();
			    if (token === null || token === 'end') {
				break;
			    }

			    if (token !== '/') {
				continue;
			    }
			    var glyph = this.getToken();
			    length = this.readInt();
			    this.getToken(); // read in 'RD' or '-|'
			    data = stream.makeSubStream(stream.pos, length);
			    lenIV = program.properties.privateData['lenIV'];
			    encoded = decrypt(data.getBytes(), CHAR_STRS_ENCRYPT_KEY, lenIV);
			    // Skip past the required space and binary data.
			    stream.skip(length);
			    this.nextChar();
			    token = this.getToken(); // read in 'ND' or '|-'
			    if (token === 'noaccess') {
				this.getToken(); // read in 'def'
			    }
			    charstrings.push({
				glyph: glyph,
				encoded: encoded
			    });
			}
			break;
		    case 'Subrs':
			var num = this.readInt();
			this.getToken(); // read in 'array'
			while ((token = this.getToken()) === 'dup') {
			    var index = this.readInt();
			    length = this.readInt();
			    this.getToken(); // read in 'RD' or '-|'
			    data = stream.makeSubStream(stream.pos, length);
			    lenIV = program.properties.privateData['lenIV'];
			    encoded = decrypt(data.getBytes(), CHAR_STRS_ENCRYPT_KEY, lenIV);
			    // Skip past the required space and binary data.
			    stream.skip(length);
			    this.nextChar();
			    token = this.getToken(); // read in 'NP' or '|'
			    if (token === 'noaccess') {
				this.getToken(); // read in 'put'
			    }
			    subrs[index] = encoded;
			}
			break;
		    case 'BlueValues':
		    case 'OtherBlues':
		    case 'FamilyBlues':
		    case 'FamilyOtherBlues':
			var blueArray = this.readNumberArray();
			break;
		    case 'StemSnapH':
		    case 'StemSnapV':
			program.properties.privateData[token] = this.readNumberArray();
			break;
		    case 'StdHW':
		    case 'StdVW':
			program.properties.privateData[token] =
			    this.readNumberArray()[0];
			break;
		    case 'BlueShift':
		    case 'lenIV':
		    case 'BlueFuzz':
		    case 'BlueScale':
		    case 'LanguageGroup':
		    case 'ExpansionFactor':
			program.properties.privateData[token] = this.readNumber();
			break;
		    case 'ForceBold':
			program.properties.privateData[token] = this.readBoolean();
			break;
		    }
		}

		for (var i = 0; i < charstrings.length; i++) {
		    glyph = charstrings[i].glyph;
		    encoded = charstrings[i].encoded;
		    var charString = new Type1CharString();
		    var error = charString.convert(encoded, subrs);
		    var output = charString.output;
		    if (error) {
			// It seems when FreeType encounters an error while evaluating a glyph
			// that it completely ignores the glyph so we'll mimic that behaviour
			// here and put an endchar to make the validator happy.
			output = [14];
		    }
		    program.charstrings.push({
			glyphName: glyph,
			charstring: output,
			width: charString.width,
			lsb: charString.lsb,
			seac: charString.seac
		    });
		}

		return program;
	    },

	    extractFontHeader: function Type1Parser_extractFontHeader(properties) {
		var token;
		while ((token = this.getToken()) !== null) {
		    if (token !== '/') {
			continue;
		    }
		    token = this.getToken();
		    switch (token) {
		    case 'FontMatrix':
			var matrix = this.readNumberArray();
			properties.fontMatrix = matrix;
			break;
		    case 'Encoding':
			// PKGW modified to not record encoding info: we don't care.
			var encodingArg = this.getToken();
			if (!/^\d+$/.test(encodingArg)) {
			    // encoding name is specified
			} else {
			    var size = parseInt(encodingArg, 10) | 0;
			    this.getToken(); // read in 'array'

			    for (var j = 0; j < size; j++) {
				token = this.getToken();
				// skipping till first dup or def (e.g. ignoring for statement)
				while (token !== 'dup' && token !== 'def') {
				    token = this.getToken();
				    if (token === null) {
					return; // invalid header
				    }
				}
				if (token === 'def') {
				    break; // read all array data
				}
				var index = this.readInt();
				this.getToken(); // read in '/'
				var glyph = this.getToken();
				this.getToken(); // read the in 'put'
			    }
			}
			break;
		    case 'FontBBox':
			var fontBBox = this.readNumberArray();
			// adjusting ascent/descent
			properties.ascent = fontBBox[3];
			properties.descent = fontBBox[1];
			properties.ascentScaled = true;
			break;
		    }
		}
	    }
	};

	return Type1Parser;
    })();


    /*
     * CharStrings are encoded following the the CharString Encoding sequence
     * describe in Chapter 6 of the "Adobe Type1 Font Format" specification.
     * The value in a byte indicates a command, a number, or subsequent bytes
     * that are to be interpreted in a special way.
     *
     * CharString Number Encoding:
     *  A CharString byte containing the values from 32 through 255 inclusive
     *  indicate an integer. These values are decoded in four ranges.
     *
     * 1. A CharString byte containing a value, v, between 32 and 246 inclusive,
     * indicate the integer v - 139. Thus, the integer values from -107 through
     * 107 inclusive may be encoded in single byte.
     *
     * 2. A CharString byte containing a value, v, between 247 and 250 inclusive,
     * indicates an integer involving the next byte, w, according to the formula:
     * [(v - 247) x 256] + w + 108
     *
     * 3. A CharString byte containing a value, v, between 251 and 254 inclusive,
     * indicates an integer involving the next byte, w, according to the formula:
     * -[(v - 251) * 256] - w - 108
     *
     * 4. A CharString containing the value 255 indicates that the next 4 bytes
     * are a two complement signed integer. The first of these bytes contains the
     * highest order bits, the second byte contains the next higher order bits
     * and the fourth byte contain the lowest order bits.
     *
     *
     * CharString Command Encoding:
     *  CharStrings commands are encoded in 1 or 2 bytes.
     *
     *  Single byte commands are encoded in 1 byte that contains a value between
     *  0 and 31 inclusive.
     *  If a command byte contains the value 12, then the value in the next byte
     *  indicates a command. This "escape" mechanism allows many extra commands
     * to be encoded and this encoding technique helps to minimize the length of
     * the charStrings.
     */
    var Type1CharString = (function Type1CharStringClosure() {
	var COMMAND_MAP = {
	    'hstem': [1],
	    'vstem': [3],
	    'vmoveto': [4],
	    'rlineto': [5],
	    'hlineto': [6],
	    'vlineto': [7],
	    'rrcurveto': [8],
	    'callsubr': [10],
	    'flex': [12, 35],
	    'drop' : [12, 18],
	    'endchar': [14],
	    'rmoveto': [21],
	    'hmoveto': [22],
	    'vhcurveto': [30],
	    'hvcurveto': [31]
	};

	function Type1CharString() {
	    this.width = 0;
	    this.lsb = 0;
	    this.flexing = false;
	    this.output = [];
	    this.stack = [];
	}

	Type1CharString.prototype = {
	    convert: function Type1CharString_convert(encoded, subrs) {
		var count = encoded.length;
		var error = false;
		var wx, sbx, subrNumber;
		for (var i = 0; i < count; i++) {
		    var value = encoded[i];
		    if (value < 32) {
			if (value === 12) {
			    value = (value << 8) + encoded[++i];
			}
			switch (value) {
			case 1: // hstem
			    this.stack = [];
			    break;
			case 3: // vstem
			    this.stack = [];
			    break;
			case 4: // vmoveto
			    if (this.flexing) {
				if (this.stack.length < 1) {
				    error = true;
				    break;
				}
				// Add the dx for flex and but also swap the values so they are
				// the right order.
				var dy = this.stack.pop();
				this.stack.push(0, dy);
				break;
			    }
			    error = this.executeCommand(1, COMMAND_MAP.vmoveto);
			    break;
			case 5: // rlineto
			    error = this.executeCommand(2, COMMAND_MAP.rlineto);
			    break;
			case 6: // hlineto
			    error = this.executeCommand(1, COMMAND_MAP.hlineto);
			    break;
			case 7: // vlineto
			    error = this.executeCommand(1, COMMAND_MAP.vlineto);
			    break;
			case 8: // rrcurveto
			    error = this.executeCommand(6, COMMAND_MAP.rrcurveto);
			    break;
			case 9: // closepath
			    // closepath is a Type1 command that does not take argument and is
			    // useless in Type2 and it can simply be ignored.
			    this.stack = [];
			    break;
			case 10: // callsubr
			    if (this.stack.length < 1) {
				error = true;
				break;
			    }
			    subrNumber = this.stack.pop();
			    error = this.convert(subrs[subrNumber], subrs);
			    break;
			case 11: // return
			    return error;
			case 13: // hsbw
			    if (this.stack.length < 2) {
				error = true;
				break;
			    }
			    // To convert to type2 we have to move the width value to the
			    // first part of the charstring and then use hmoveto with lsb.
			    wx = this.stack.pop();
			    sbx = this.stack.pop();
			    this.lsb = sbx;
			    this.width = wx;
			    this.stack.push(wx, sbx);
			    error = this.executeCommand(2, COMMAND_MAP.hmoveto);
			    break;
			case 14: // endchar
			    this.output.push(COMMAND_MAP.endchar[0]);
			    break;
			case 21: // rmoveto
			    if (this.flexing) {
				break;
			    }
			    error = this.executeCommand(2, COMMAND_MAP.rmoveto);
			    break;
			case 22: // hmoveto
			    if (this.flexing) {
				// Add the dy for flex.
				this.stack.push(0);
				break;
			    }
			    error = this.executeCommand(1, COMMAND_MAP.hmoveto);
			    break;
			case 30: // vhcurveto
			    error = this.executeCommand(4, COMMAND_MAP.vhcurveto);
			    break;
			case 31: // hvcurveto
			    error = this.executeCommand(4, COMMAND_MAP.hvcurveto);
			    break;
			case (12 << 8) + 0: // dotsection
			    // dotsection is a Type1 command to specify some hinting feature
			    // for dots that do not take a parameter and it can safely be
			    // ignored for Type2.
			    this.stack = [];
			    break;
			case (12 << 8) + 1: // vstem3
			    this.stack = [];
			    break;
			case (12 << 8) + 2: // hstem3
			    this.stack = [];
			    break;
			case (12 << 8) + 6: // seac
			    // seac is like type 2's special endchar but it doesn't use the
			    // first argument asb, so remove it.
			    if (SEAC_ANALYSIS_ENABLED) {
				this.seac = this.stack.splice(-4, 4);
				error = this.executeCommand(0, COMMAND_MAP.endchar);
			    } else {
				error = this.executeCommand(4, COMMAND_MAP.endchar);
			    }
			    break;
			case (12 << 8) + 7: // sbw
			    if (this.stack.length < 4) {
				error = true;
				break;
			    }
			    // To convert to type2 we have to move the width value to the
			    // first part of the charstring and then use rmoveto with
			    // (dx, dy). The height argument will not be used for vmtx and
			    // vhea tables reconstruction -- ignoring it.
			    var wy = this.stack.pop();
			    wx = this.stack.pop();
			    var sby = this.stack.pop();
			    sbx = this.stack.pop();
			    this.lsb = sbx;
			    this.width = wx;
			    this.stack.push(wx, sbx, sby);
			    error = this.executeCommand(3, COMMAND_MAP.rmoveto);
			    break;
			case (12 << 8) + 12: // div
			    if (this.stack.length < 2) {
				error = true;
				break;
			    }
			    var num2 = this.stack.pop();
			    var num1 = this.stack.pop();
			    this.stack.push(num1 / num2);
			    break;
			case (12 << 8) + 16: // callothersubr
			    if (this.stack.length < 2) {
				error = true;
				break;
			    }
			    subrNumber = this.stack.pop();
			    var numArgs = this.stack.pop();
			    if (subrNumber === 0 && numArgs === 3) {
				var flexArgs = this.stack.splice(this.stack.length - 17, 17);
				this.stack.push(
				    flexArgs[2] + flexArgs[0], // bcp1x + rpx
				    flexArgs[3] + flexArgs[1], // bcp1y + rpy
				    flexArgs[4], // bcp2x
				    flexArgs[5], // bcp2y
				    flexArgs[6], // p2x
				    flexArgs[7], // p2y
				    flexArgs[8], // bcp3x
				    flexArgs[9], // bcp3y
				    flexArgs[10], // bcp4x
				    flexArgs[11], // bcp4y
				    flexArgs[12], // p3x
				    flexArgs[13], // p3y
				    flexArgs[14] // flexDepth
				    // 15 = finalx unused by flex
				    // 16 = finaly unused by flex
				);
				error = this.executeCommand(13, COMMAND_MAP.flex, true);
				this.flexing = false;
				this.stack.push(flexArgs[15], flexArgs[16]);
			    } else if (subrNumber === 1 && numArgs === 0) {
				this.flexing = true;
			    }
			    break;
			case (12 << 8) + 17: // pop
			    // Ignore this since it is only used with othersubr.
			    break;
			case (12 << 8) + 33: // setcurrentpoint
			    // Ignore for now.
			    this.stack = [];
			    break;
			default:
			    warn('Unknown type 1 charstring command of "' + value + '"');
			    break;
			}
			if (error) {
			    break;
			}
			continue;
		    } else if (value <= 246) {
			value = value - 139;
		    } else if (value <= 250) {
			value = ((value - 247) * 256) + encoded[++i] + 108;
		    } else if (value <= 254) {
			value = -((value - 251) * 256) - encoded[++i] - 108;
		    } else {
			value = (encoded[++i] & 0xff) << 24 | (encoded[++i] & 0xff) << 16 |
			    (encoded[++i] & 0xff) << 8 | (encoded[++i] & 0xff) << 0;
		    }
		    this.stack.push(value);
		}
		return error;
	    },

	    executeCommand: function(howManyArgs, command, keepStack) {
		var stackLength = this.stack.length;
		if (howManyArgs > stackLength) {
		    return true;
		}
		var start = stackLength - howManyArgs;
		for (var i = start; i < stackLength; i++) {
		    var value = this.stack[i];
		    if (value === (value | 0)) { // int
			this.output.push(28, (value >> 8) & 0xff, value & 0xff);
		    } else { // fixed point
			value = (65536 * value) | 0;
			this.output.push(255,
					 (value >> 24) & 0xFF,
					 (value >> 16) & 0xFF,
					 (value >> 8) & 0xFF,
					 value & 0xFF);
		    }
		}
		this.output.push.apply(this.output, command);
		if (keepStack) {
		    this.stack.splice(start, howManyArgs);
		} else {
		    this.stack.length = 0;
		}
		return false;
	    }
	};

	return Type1CharString;
    })();


    function compileCharString(code, js) {
	var stack = [];
	var x = 0, y = 0;
	var stems = 0;

	function moveTo(x, y) {
	    js.push('c.moveTo(' + x + ',' + y + ');');
	}
	function lineTo(x, y) {
	    js.push('c.lineTo(' + x + ',' + y + ');');
	}
	function bezierCurveTo(x1, y1, x2, y2, x, y) {
	    js.push('c.bezierCurveTo(' + x1 + ',' + y1 + ',' + x2 + ',' + y2 + ',' +
		    x + ',' + y + ');');
	}

	function parse(code) {
	    var i = 0;
	    while (i < code.length) {
		var stackClean = false;
		var v = code[i++];
		var xa, xb, ya, yb, y1, y2, y3, n, subrCode;
		switch (v) {
		case 1: // hstem
		    stems += stack.length >> 1;
		    stackClean = true;
		    break;
		case 3: // vstem
		    stems += stack.length >> 1;
		    stackClean = true;
		    break;
		case 4: // vmoveto
		    y += stack.pop();
		    moveTo(x, y);
		    stackClean = true;
		    break;
		case 5: // rlineto
		    while (stack.length > 0) {
			x += stack.shift();
			y += stack.shift();
			lineTo(x, y);
		    }
		    break;
		case 6: // hlineto
		    while (stack.length > 0) {
			x += stack.shift();
			lineTo(x, y);
			if (stack.length === 0) {
			    break;
			}
			y += stack.shift();
			lineTo(x, y);
		    }
		    break;
		case 7: // vlineto
		    while (stack.length > 0) {
			y += stack.shift();
			lineTo(x, y);
			if (stack.length === 0) {
			    break;
			}
			x += stack.shift();
			lineTo(x, y);
		    }
		    break;
		case 8: // rrcurveto
		    while (stack.length > 0) {
			xa = x + stack.shift(); ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift(); y = yb + stack.shift();
			bezierCurveTo(xa, ya, xb, yb, x, y);
		    }
		    break;
		case 10: // callsubr
		    throw new TexRuntimeError ('callsubr not supported');
		case 11: // return
		    return;
		case 12:
		    v = code[i++];
		    switch (v) {
		    case 34: // flex
			xa = x + stack.shift();
			xb = xa + stack.shift(); y1 = y + stack.shift();
			x = xb + stack.shift();
			bezierCurveTo(xa, y, xb, y1, x, y1);
			xa = x + stack.shift();
			xb = xa + stack.shift();
			x = xb + stack.shift();
			bezierCurveTo(xa, y1, xb, y, x, y);
			break;
		    case 35: // flex
			xa = x + stack.shift(); ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift(); y = yb + stack.shift();
			bezierCurveTo(xa, ya, xb, yb, x, y);
			xa = x + stack.shift(); ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift(); y = yb + stack.shift();
			bezierCurveTo(xa, ya, xb, yb, x, y);
			stack.pop(); // fd
			break;
		    case 36: // hflex1
			xa = x + stack.shift(); y1 = y + stack.shift();
			xb = xa + stack.shift(); y2 = y1 + stack.shift();
			x = xb + stack.shift();
			bezierCurveTo(xa, y1, xb, y2, x, y2);
			xa = x + stack.shift();
			xb = xa + stack.shift(); y3 = y2 + stack.shift();
			x = xb + stack.shift();
			bezierCurveTo(xa, y2, xb, y3, x, y);
			break;
		    case 37: // flex1
			var x0 = x, y0 = y;
			xa = x + stack.shift(); ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift(); y = yb + stack.shift();
			bezierCurveTo(xa, ya, xb, yb, x, y);
			xa = x + stack.shift(); ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb; y = yb;
			if (Math.abs(x - x0) > Math.abs(y - y0)) {
			    x += stack.shift();
			} else  {
			    y += stack.shift();
			}
			bezierCurveTo(xa, ya, xb, yb, x, y);
			break;
		    default:
			error('unknown operator: 12 ' + v);
		    }
		    break;
		case 14: // endchar
		    if (stack.length >= 4)
			throw new TexRuntimeError ('endchar not supported');
		    return;
		case 18: // hstemhm
		    stems += stack.length >> 1;
		    stackClean = true;
		    break;
		case 19: // hintmask
		    stems += stack.length >> 1;
		    i += (stems + 7) >> 3;
		    stackClean = true;
		    break;
		case 20: // cntrmask
		    stems += stack.length >> 1;
		    i += (stems + 7) >> 3;
		    stackClean = true;
		    break;
		case 21: // rmoveto
		    y += stack.pop();
		    x += stack.pop();
		    moveTo(x, y);
		    stackClean = true;
		    break;
		case 22: // hmoveto
		    x += stack.pop();
		    moveTo(x, y);
		    stackClean = true;
		    break;
		case 23: // vstemhm
		    stems += stack.length >> 1;
		    stackClean = true;
		    break;
		case 24: // rcurveline
		    while (stack.length > 2) {
			xa = x + stack.shift(); ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift(); y = yb + stack.shift();
			bezierCurveTo(xa, ya, xb, yb, x, y);
		    }
		    x += stack.shift();
		    y += stack.shift();
		    lineTo(x, y);
		    break;
		case 25: // rlinecurve
		    while (stack.length > 6) {
			x += stack.shift();
			y += stack.shift();
			lineTo(x, y);
		    }
		    xa = x + stack.shift(); ya = y + stack.shift();
		    xb = xa + stack.shift(); yb = ya + stack.shift();
		    x = xb + stack.shift(); y = yb + stack.shift();
		    bezierCurveTo(xa, ya, xb, yb, x, y);
		    break;
		case 26: // vvcurveto
		    if (stack.length % 2) {
			x += stack.shift();
		    }
		    while (stack.length > 0) {
			xa = x; ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb; y = yb + stack.shift();
			bezierCurveTo(xa, ya, xb, yb, x, y);
		    }
		    break;
		case 27: // hhcurveto
		    if (stack.length % 2) {
			y += stack.shift();
		    }
		    while (stack.length > 0) {
			xa = x + stack.shift(); ya = y;
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift(); y = yb;
			bezierCurveTo(xa, ya, xb, yb, x, y);
		    }
		    break;
		case 28:
		    stack.push(((code[i] << 24) | (code[i + 1] << 16)) >> 16);
		    i += 2;
		    break;
		case 29: // callgsubr
		    throw new TexRuntimeError ('callgsubr not supported');
		    break;
		case 30: // vhcurveto
		    while (stack.length > 0) {
			xa = x; ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift();
			y = yb + (stack.length === 1 ? stack.shift() : 0);
			bezierCurveTo(xa, ya, xb, yb, x, y);
			if (stack.length === 0) {
			    break;
			}

			xa = x + stack.shift(); ya = y;
			xb = xa + stack.shift(); yb = ya + stack.shift();
			y = yb + stack.shift();
			x = xb + (stack.length === 1 ? stack.shift() : 0);
			bezierCurveTo(xa, ya, xb, yb, x, y);
		    }
		    break;
		case 31: // hvcurveto
		    while (stack.length > 0) {
			xa = x + stack.shift(); ya = y;
			xb = xa + stack.shift(); yb = ya + stack.shift();
			y = yb + stack.shift();
			x = xb + (stack.length === 1 ? stack.shift() : 0);
			bezierCurveTo(xa, ya, xb, yb, x, y);
			if (stack.length === 0) {
			    break;
			}

			xa = x; ya = y + stack.shift();
			xb = xa + stack.shift(); yb = ya + stack.shift();
			x = xb + stack.shift();
			y = yb + (stack.length === 1 ? stack.shift() : 0);
			bezierCurveTo(xa, ya, xb, yb, x, y);
		    }
		    break;
		default:
		    if (v < 32) {
			error('unknown operator: ' + v);
		    }
		    if (v < 247) {
			stack.push(v - 139);
		    } else if (v < 251) {
			stack.push((v - 247) * 256 + code[i++] + 108);
		    } else if (v < 255) {
			stack.push(-(v - 251) * 256 - code[i++] - 108);
		    } else {
			stack.push(((code[i] << 24) | (code[i + 1] << 16) |
				    (code[i + 2] << 8) | code[i + 3]) / 65536);
			i += 4;
		    }
		    break;
		}
		if (stackClean) {
		    stack.length = 0;
		}
	    }
	}
	parse(code);
    }


    // This Type1Font class is new and specific to Webtex, and doesn't have
    // anything in common with the Type1Font in pdf.js's fonts.js.

    var glyph_name_to_id = {};

    var Type1Font = (function Type1Font_closure () {
	function Type1Font (pfbname, data) {
	    this.pfbname = pfbname;
	    this.compiled = {};
	    this.ggid_to_cs = {};

	    // Build the global glyphname-to-ggid table if needed.
	    if (glyph_name_to_id['a'] == null) {
		var names = glyph_encoding_info.names;

		for (var i = 0; i < names.length; i++)
		    glyph_name_to_id[names[i]] = i;
	    }

	    var stream = new Stream (data, 0, data.byteLength, {});
	    var props = {
		loadedName: pfbname,
		type: 'Type1',
		differences: [],
		defaultEncoding: [],
		bbox: [0, 0, 1, 1], // arbitrary
	    };

	    var charstrings = parse_type1_charstrings (pfbname, stream, props);

	    for (var i = 0; i < charstrings.length; i++) {
		var gname = charstrings[i].glyphName;
		if (gname == '.notdef' || gname == '.null')
		    continue;

		var ggid = glyph_name_to_id[gname];
		if (ggid == null) {
		    global_warnf ('no global ID for glyph %o', gname);
		    continue;
		}

		this.ggid_to_cs[ggid] = charstrings[i].charstring;
	    }
	}

	var proto = Type1Font.prototype;

	proto.trace = function Type1Font_trace (context2d, gglyphid) {
	    var compiled = this.compiled[gglyphid];

	    if (compiled == null) {
		var cs = this.ggid_to_cs[gglyphid];
		if (cs == null) {
		    global_warnf ('font %s missing expected data for glyphid %o',
				  this.pfbname, gglyphid);
		    return;
		}

		var js = [];
		compileCharString (cs, js);
		js.unshift ('function render (c) {');
		js.push ('} ; render');
		compiled = eval (js.join ('\n'));
		this.compiled[gglyphid] = compiled;
	    }

	    compiled (context2d);
	};

	return Type1Font;
    }) ();

    return Type1Font;
}) ();
