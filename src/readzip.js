/* Streaming random access to the zip file format. Based on previous work
 *
 *   - zip.js by Gildas Lormeau (BSD license)
 *   - node-zipfile by Dane Springmeyer (BSD license)
 *   - jszip by Stuart Knightley (MIT license)
 *
 * The problem with all of these is that they don't stream data in or out --
 * they want the zip entries, or even the whole zip file, to be in a giant
 * buffer in memory. Actually, as far as I can tell, zip.js essentially can do
 * that, but the code style is very different from mine and it's very hard for
 * me to make sense of the structure. My needs are simple enough that I think
 * it'll be easier just to write a new implementation in a familiar style.
 *
 * NOTE: until revision f5a498, this file was implemented asynchronously. I've
 * convinced myself that we need to use synchronous I/O throughout webtex, so
 * I've gone and reorganized things. Check out the older version to see how I
 * made things work in an async style.
 *
 * NOTE: I'm completely cavalier about CRC checks, file format sanity, etc.,
 * here. I don't think this will come back to bite me in the ass but we'll
 * see ...
 */

'use strict';

var ZipReader = (function ZipReader_closure () {
    var ZIP_EOCDR_MAGIC = 0x06054b50;
    var ZIP_DIREC_MAGIC = 0x02014b50;
    var ZIP_ENTRY_MAGIC = 0x04034b50;

    function ZipReader (readfunc, zipsize) {
	if (zipsize < 22)
	    throw new TexRuntimeError ('ill-formed Zip stream: only ' +
				       zipsize + ' bytes');

	this.readfunc = readfunc;
	this.zipsize = zipsize;

	// Check end-of-central-directory record.

	var buf = readfunc (this.zipsize - 22, 22);
	var dv = new DataView (buf);

	if (dv.getUint32 (0, true) != ZIP_EOCDR_MAGIC)
	    throw new Error ('EOCDR wrong magic');

	this._nfiles = dv.getUint16 (8, true);
	this._cdofs = dv.getUint32 (16, true);

	if (this._cdofs > this.zipsize - 22)
	    throw new Error ('EOCDR directory offset invalid: ofs ' +
		this._cdofs + '; total size ' + this.zipsize);

	// Read central directory records.

	buf = readfunc (this._cdofs, this.zipsize - 22 - this._cdofs);
	dv = new DataView (buf);
	var dirinfo = {};
	var offset = 0;

	for (var i = 0; i < this._nfiles; i++) {
	    var magic = dv.getUint32 (offset, true);
	    if (magic != ZIP_DIREC_MAGIC)
		throw new Error ('bad Zip: wrong magic number in entry');

	    var flags = dv.getUint16 (offset + 8, true);
	    if (flags & 0x1)
		throw new Error ('bad Zip: encrypted entries');

	    if (offset + 46 > buf.byteLength)
		throw new Error ('bad Zip: overlarge central directory');

	    var compression = dv.getUint16 (offset + 10, true),
	        csize = dv.getUint32 (offset + 20, true),
	        ucsize = dv.getUint32 (offset + 24, true),
	        fnlen = dv.getUint16 (offset + 28, true),
	        extralen = dv.getUint16 (offset + 30, true),
	        cmntlen = dv.getUint16 (offset + 32, true),
	        recofs = dv.getUint32 (offset + 42, true);

	    if (recofs + csize > this.zipsize)
		throw new Error ('bad Zip: bad data size/offset');

	    if (csize == 0xFFFFFFFF || ucsize == 0xFFFFFFFF)
		throw new Error ('bad Zip: I can\'t handle ZIP64');

	    if (offset + 46 + fnlen + extralen + cmntlen > buf.byteLength)
		throw new Error ('bad Zip: overlarge central directory (2)');

	    if (compression && compression != 8)
		throw new Error ('bad Zip: I can only handle DEFLATE compression');

	    var fnslice = new Uint8Array (buf, offset + 46, fnlen);
	    var fn = String.fromCharCode.apply (null, fnslice);

	    dirinfo[fn] = {'csize': csize,
			   'ucsize': ucsize,
			   'compression': compression,
			   'recofs': recofs};
	    offset += 46 + fnlen + extralen + cmntlen;
	}

	this.dirinfo = dirinfo;
    }

    var proto = ZipReader.prototype;

    proto.has_entry = function ZipReader_has_entry (entname) {
	return this.dirinfo.hasOwnProperty (entname);
    };

    proto.get_entry_ab = function ZipReader_get_entry_ab (entname) {
	if (!this.dirinfo.hasOwnProperty (entname))
	    throw new TexRuntimeError ('no such Zip entry ' + entname);

	var info = this.dirinfo[entname];

	// We need to read the pre-entry record to know where the data
	// actually start -- the lengths of the comment/extra fields are *not*
	// guaranteed to be the same as in the central directory, so having
	// read the latter is not enough.

	var buf = this.readfunc (info.recofs, 30);
	var dv = new DataView (buf);
	var magic = dv.getUint32 (0, true);
	if (magic != ZIP_ENTRY_MAGIC)
	    throw new Error ('bad Zip: wrong magic number in entry');

	var csize = dv.getUint32 (18, true),
	    fnlen = dv.getUint16 (26, true),
	    extralen = dv.getUint16 (28, true);
	var dataofs = info.recofs + 30 + fnlen + extralen;

	if (dataofs + csize > this.zipsize)
	    throw new Error ('bad Zip: bad entry data size/offset');

	// OK, now we can read the actual data.

	var buf = this.readfunc (dataofs, csize);

	if (!info.compression)
	    return buf;

	// We need to decompress.

	var state = {buf: new ArrayBuffer (0), err: null};

	var inflate = new JSInflater (function (err, data) {
	    if (state.err != null)
		return;

	    if (err != null) {
		state.err = err;
		return;
	    }

	    if (data == null)
		// Indicates EOF, but not relevant in our synchronous model.
		return;

	    var tmp = new Uint8Array (state.buf.byteLength + data.byteLength);
	    tmp.set (new Uint8Array (state.buf), 0);
	    tmp.set (new Uint8Array (data), state.buf.byteLength);
	    state.buf = tmp.buffer;
	});

	inflate.wt_write (buf);
	inflate.end ();

	if (state.err)
	    throw state.err;

	return state.buf;
    };

    proto.get_entry_str = function ZipReader_get_entry_str (entname) {
	return ab_to_str (this.get_entry_ab (entname));
    };

    return ZipReader;
}) ();
