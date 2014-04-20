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
	    throw new TexRuntimeException ('ill-formed Zip stream: only ' +
					   zipsize + ' bytes');

	this.readfunc = readfunc;
	this.zipsize = zipsize;
	this.error_state = null;
	this.dirinfo = null;

	// TODO: read header, check Zip-ness, check for ZIP64.
	readfunc (zipsize - 22, 22, this._cb_read_EOCDR.bind (this));
    }

    var proto = ZipReader.prototype;

    proto._cb_read_EOCDR = function ZipReader__cb_read_EOCDR (buf, err) {
	if (err != null) {
	    this.error_state = 'EOCDR read error: ' + err;
	    return;
	}

	var dv = new DataView (buf);

	if (dv.getUint32 (0, true) != ZIP_EOCDR_MAGIC) {
	    this.error_state = 'EOCDR wrong magic';
	    return;
	}

	this._nfiles = dv.getUint16 (8, true);
	this._cdofs = dv.getUint32 (16, true);

	if (this._cdofs > this.zipsize - 22) {
	    this.error_state = 'EOCDR directory offset invalid: ofs ' +
		this._cdofs + '; total size ' + this.zipsize;
	    return;
	}

	this.readfunc (this._cdofs,
		       this.zipsize - 22 - this._cdofs,
		       this._cb_read_directory.bind (this));
    };

    proto._cb_read_directory = function ZipReader__cb_read_directory (buf, err) {
	if (this.error_state != null)
	    return;

	if (err != null) {
	    this.error_state = 'Zip directory read error: ' + err;
	    return;
	}

	var dv = new DataView (buf);
	var dirinfo = {};
	var offset = 0;

	for (var i = 0; i < this._nfiles; i++) {
	    var magic = dv.getUint32 (offset, true);
	    if (magic != ZIP_DIREC_MAGIC) {
		this.error_state = 'bad Zip: wrong magic number in entry';
		return;
	    }

	    var flags = dv.getUint16 (offset + 8, true);
	    if (flags & 0x1) {
		this.error_state = 'bad Zip: encrypted entries';
		return;
	    }

	    if (offset + 46 > buf.byteLength) {
		this.error_state = 'bad Zip: overlarge central directory';
		return;
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
		return;
	    }

	    if (csize == 0xFFFFFFFF || ucsize == 0xFFFFFFFF) {
		this.error_state = 'bad Zip: I can\'t handle ZIP64';
		return;
	    }

	    if (offset + 46 + fnlen + extralen + cmntlen > buf.byteLength) {
		this.error_state = 'bad Zip: overlarge central directory (2)';
		return;
	    }

	    if (compression && compression != 8) {
		this.error_state = 'bad Zip: I can only handle DEFLATE compression';
		return;
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
    };

    proto.stream_entry = function ZipReader_stream_entry (entname, callback) {
	if (this.error_state != null)
	    throw new TexRuntimeException ('previous Zip error: ' + this.error_state);
	if (this.dirinfo == null)
	    // XXX ugggh not sure how we deal with these issues without descending
	    // into nested callback hell.
	    throw new TexRuntimeException ('eek haven\'t yet read in Zip info');

	if (!this.dirinfo.hasOwnProperty (entname))
	    // XXX tell this to the callback?
	    throw new TexRuntimeException ('no such Zip entry ' + entname);

	var info = this.dirinfo[entname];
	var state = {'info': info, 'cb': callback};
	state.nleft = info.csize;
	state.curofs = info.dataofs;
	// The buffer must be at least 32k for zlib to work since it uses a
	// lookback buffer of that size.
	state.buflen = 32768;

	if (info.compression) {
	    var inflate = WEBTEX.IOBackend.makeInflater (callback);
	    state.cb = function (buf) {
		if (buf == null)
		    inflate.end ();
		else
		    inflate.wt_write (buf);
	    };
	}

	this.readfunc (state.curofs,
		       Math.min (state.nleft, state.buflen),
		       function (buf, err) {
			   this._cb_do_stream (buf, err, state);
		       }.bind (this));
    };

    proto._cb_do_stream = function ZipReader__cb_do_stream (buf, err, state) {
	if (this.error_state != null)
	    // XXX tell the callback there was an error!
	    return;

	if (err != null) {
	    this.error_state = 'Zip entry read error: ' + err;
	    return;
	}

	state.cb (buf);
	state.nleft -= buf.byteLength;
	state.curofs += buf.byteLength;

	if (state.nleft <= 0)
	    state.cb (null) // XXX better covention
	else {
	    this.readfunc (state.curofs,
			   Math.min (state.nleft, state.buflen),
			   function (buf, err) {
			       this._cb_do_stream (buf, err, state)
			   }.bind (this));
	}
    };

    return ZipReader;

}) ();
