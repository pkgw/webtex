'use strict';

webtexApiObject.IOBackend.makeInflater = function (callback) {
    return new JSInflater (callback);
};

function ab_to_str (arraybuf) {
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

var RandomAccessURL = (function RandomAccessURL_closure () {
    function RandomAccessURL (url) {
	this.url = url;
	this._size = null;
    }

    var proto = RandomAccessURL.prototype;

    function req_data_as_arraybuffer (req) {
	// Copy of getArrayBuffer() from pdf.js's NetworkManager.
	var data = (req.mozResponseArrayBuffer || req.mozResponse ||
		    req.responseArrayBuffer || req.response);

	if (typeof data !== 'string')
	    return data;

	var length = data.length;
	var buffer = new Uint8Array (length);

	for (var i = 0; i < length; i++)
	    buffer[i] = data.charCodeAt (i) & 0xFF;

	return buffer;
    }

    proto.read_range_ab = function RandomAccessURL_read_range_ab (offset, length) {
	// Returns an ArrayBuffer.
	// Substantially copied from pdf.js's NetworkManager.
	var req = new XMLHttpRequest ();
	req.open ('GET', this.url, false);
	var end = offset + length - 1;
	var r = offset + '-' + end;
	req.setRequestHeader ('Range', 'bytes=' + r);
	req.mozResponseType = req.responseType = 'arraybuffer';

	req.send (null);

	// note: servers may ignore Range header => 200 status can also
	// happen. FTP urls, etc, can succeed with status = 0, apparently: we
	// don't handle that.

	var resp_ofs = null;
	var data = null;

	if (req.status === 200) {
	    resp_ofs = 0;
	    data = req_data_as_arraybuffer (req);
	} else if (req.status === 206) {
	    var range_header = req.getResponseHeader ('Content-Range');
            var matches = /bytes (\d+)-(\d+)\/(\d+)/.exec (range_header);
            resp_ofs = parseInt (matches[1], 10);
	    data = req_data_as_arraybuffer (req);
	} else {
	    throw new TexRuntimeError ('cannot fetch URL ' + this.url + ' ofs='
				       + offset + ' len=' + length +
				       ': got status ' + req.status);
	}

	if (resp_ofs > offset)
	    throw new TexRuntimeError ('URL read_range failed: returned offset ' +
				       resp_ofs + ' > desired offset ' + offset);

	if (resp_ofs + data.byteLength < offset + length)
	    throw new TexRuntimeError ('URL read_range failed: returned end-byte ' +
				       (resp_ofs + data.byteLength) +
				       ' < desired end-byte ' + (offset + length));

	var j = offset - resp_ofs;
	return data.slice (j, j + length);
    };

    proto.read_range_str = function RandomAccessURL_read_range_str (offset, length) {
	// TODO: just get the response as text directly, rather than
	// double-converting. We do this for now to keep things simple.
	return ab_to_str (this.read_range_ab (offset, length));
    };

    proto._get_size = function RandomAccessURL__get_size () {
	var req = new XMLHttpRequest ();
	req.open ('HEAD', this.url, false);
	req.send (null);

	if (req.status !== 200)
	    throw new TexRuntimeError ('cannot fetch URL ' + this.url +
				       ': got status ' + req.status);

	this._size = req.getResponseHeader ('Content-Length');
    };

    proto.size = function RandomAccessURL_size () {
	if (this._size == null)
	    this._get_size ();
	return this._size;
    };

    return RandomAccessURL;
}) ();

function fetch_url_str (url) {
    var req = new XMLHttpRequest ();
    req.open ('GET', url, false);
    req.send (null);

    if (req.status !== 200)
	throw new TexRuntimeError ('cannot fetch URL ' + url +
				   ': got status ' + req.status);

    return req.responseText;
};
