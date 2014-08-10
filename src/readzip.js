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
 * NOTE: I'm completely cavalier about CRC checks, file format sanity, etc.,
 * here. I don't think this will come back to bite me in the ass but we'll
 * see ...
 */

'use strict';

var ZipReader = WEBTEX.ZipReader = (function ZipReader_closure () {
    var ZIP_EOCDR_MAGIC = 0x06054b50;
    var ZIP_DIREC_MAGIC = 0x02014b50;
    var ZIP_ENTRY_MAGIC = 0x03044b50;

    function ZipReader (readfunc, zipsize) {
	if (zipsize < 22)
	    throw new TexRuntimeError ('ill-formed Zip stream: only ' +
				       zipsize + ' bytes');

	this.readfunc = readfunc;
	this.zipsize = zipsize;
	this.error_state = null;
	this.dirinfo = null;
    }

    var proto = ZipReader.prototype;

    proto._promise_data = function ZipReader__promise_data (ofs, len) {
	return new Promise (function (resolve, reject) {
	    this.readfunc (ofs, len, function (err, buf) {
		if (err != null) {
		    reject (err);
		} else {
		    resolve (buf);
		}
	    });
	}.bind (this));
    };

    proto.promise_ready = function ZipReader_promise_ready () {
	return this._promise_data (this.zipsize - 22, 22).then (function (buf) {
	    var dv = new DataView (buf);

	    if (dv.getUint32 (0, true) != ZIP_EOCDR_MAGIC) {
		this.error_state = 'EOCDR wrong magic';
		throw new Error (this.error_state);
	    }

	    this._nfiles = dv.getUint16 (8, true);
	    this._cdofs = dv.getUint32 (16, true);

	    if (this._cdofs > this.zipsize - 22) {
		this.error_state = 'EOCDR directory offset invalid: ofs ' +
		    this._cdofs + '; total size ' + this.zipsize;
		throw new Error (this.error_state);
	    }

	    return this._promise_data (this._cdofs,
				       this.zipsize - 22 - this._cdofs);
	}.bind (this)).then (function (buf) {
	    var dv = new DataView (buf);
	    var dirinfo = {};
	    var offset = 0;

	    for (var i = 0; i < this._nfiles; i++) {
		var magic = dv.getUint32 (offset, true);
		if (magic != ZIP_DIREC_MAGIC) {
		    this.error_state = 'bad Zip: wrong magic number in entry';
		    throw new Error (this.error_state);
		}

		var flags = dv.getUint16 (offset + 8, true);
		if (flags & 0x1) {
		    this.error_state = 'bad Zip: encrypted entries';
		    throw new Error (this.error_state);
		}

		if (offset + 46 > buf.byteLength) {
		    this.error_state = 'bad Zip: overlarge central directory';
		    throw new Error (this.error_state);
		}

		var compression = dv.getUint16 (offset + 10, true),
	            csize = dv.getUint32 (offset + 20, true),
	            ucsize = dv.getUint32 (offset + 24, true),
	            fnlen = dv.getUint16 (offset + 28, true),
	            extralen = dv.getUint16 (offset + 30, true),
	            cmntlen = dv.getUint16 (offset + 32, true),
	            recofs = dv.getUint32 (offset + 42, true);

		var dataofs = recofs + 30 + fnlen + extralen;

		if (dataofs + csize > this.zipsize) {
		    this.error_state = 'bad Zip: bad data size/offset';
		    throw new Error (this.error_state);
		}

		if (csize == 0xFFFFFFFF || ucsize == 0xFFFFFFFF) {
		    this.error_state = 'bad Zip: I can\'t handle ZIP64';
		    throw new Error (this.error_state);
		}

		if (offset + 46 + fnlen + extralen + cmntlen > buf.byteLength) {
		    this.error_state = 'bad Zip: overlarge central directory (2)';
		    throw new Error (this.error_state);
		}

		if (compression && compression != 8) {
		    this.error_state = 'bad Zip: I can only handle DEFLATE compression';
		    throw new Error (this.error_state);
		}

		var fnslice = new Uint8Array (buf, offset + 46, fnlen);
		var fn = String.fromCharCode.apply (null, fnslice);

		dirinfo[fn] = {'csize': csize,
			       'ucsize': ucsize,
			       'compression': compression,
			       'dataofs': dataofs};
		offset += 46 + fnlen + extralen + cmntlen;
	    }

	    this.dirinfo = dirinfo;
	    return this;
	}.bind (this));
    };

    proto.has_entry = function ZipReader_has_entry (entname) {
	if (this.error_state != null)
	    throw new TexRuntimeError ('previous Zip error: ' + this.error_state);
	if (this.dirinfo == null)
	    return NeedMoreData;

	return this.dirinfo.hasOwnProperty (entname);
    };

    proto.stream_entry = function ZipReader_stream_entry (entname, callback) {
	if (this.error_state != null)
	    throw new TexRuntimeError ('previous Zip error: ' + this.error_state);
	if (this.dirinfo == null)
	    throw NeedMoreData;
	if (!this.dirinfo.hasOwnProperty (entname))
	    throw new TexRuntimeError ('no such Zip entry ' + entname);

	var info = this.dirinfo[entname];
	var state = {'info': info, 'cb': callback};
	state.entname = entname;
	state.nleft = info.csize;
	state.curofs = info.dataofs;
	// The buffer must be at least 32k for zlib to work since it uses a
	// lookback buffer of that size.
	state.buflen = 32768;

	if (info.compression) {
	    var inflate = WEBTEX.IOBackend.makeInflater (callback);
	    state.cb = function (err, buf) {
		if (err != null) {
		    callback (err, null);
		    return;
		}

		if (buf == null)
		    inflate.end ();
		else
		    inflate.wt_write (buf);
	    };
	}

	this.readfunc (state.curofs,
		       Math.min (state.nleft, state.buflen),
		       function (err, buf) {
			   this._cb_do_stream (err, buf, state);
		       }.bind (this));
    };

    proto._cb_do_stream = function ZipReader__cb_do_stream (err, buf, state) {
	if (this.error_state != null) {
	    state.cb (this.error_state, null);
	    return;
	}

	if (err != null) {
	    this.error_state = 'Zip entry read error: ' + err;
	    state.cb (err, null);
	    return;
	}

	state.cb (err, buf);
	state.nleft -= buf.byteLength;
	state.curofs += buf.byteLength;

	if (state.nleft <= 0)
	    state.cb (null, null) // XXX better convention?
	else {
	    this.readfunc (state.curofs,
			   Math.min (state.nleft, state.buflen),
			   function (err, buf) {
			       this._cb_do_stream (err, buf, state)
			   }.bind (this));
	}
    };

    return ZipReader;

}) ();
