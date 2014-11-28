// I/O for the Worker thread. The whole reason that we use Web Workers is that
// this needs to be synchronous; I've convinced myself that it's the only way
// to successfully implement the engine.

function fetch_url_str (url) {
    var req = new XMLHttpRequest ();
    req.open ('GET', url, false);
    req.send (null);

    if (req.status !== 200)
	throw new TexRuntimeError ('cannot fetch URL %s: got status %o',
				   url, req.status);

    return req.responseText;
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
	    throw new TexRuntimeError ('cannot fetch URL %s (ofs=%d len=%d): ' +
				       'got status %o', offset, length, req.status);
	}

	if (resp_ofs > offset)
	    throw new TexRuntimeError ('URL read_range failed: returned offset ' +
				       '%d > desired offset %d', resp_ofs, offset);

	if (resp_ofs + data.byteLength < offset + length)
	    throw new TexRuntimeError ('URL read_range failed: returned end-byte ' +
				       '%d < desired end-byte %d',
				       resp_ofs + data.byteLength, offset + length);

	var j = offset - resp_ofs;
	return data.slice (j, j + length);
    };

    proto.read_range_str = function RandomAccessURL_read_range_str (offset, length) {
	// TODO: just get the response as text directly, rather than
	// double-converting. We do this for now to keep things simple.
	return arraybuffer_to_str (this.read_range_ab (offset, length));
    };

    proto._get_size = function RandomAccessURL__get_size () {
	var req = new XMLHttpRequest ();
	req.open ('HEAD', this.url, false);
	req.send (null);

	if (req.status !== 200)
	    throw new TexRuntimeError ('cannot fetch URL %s: got status %o',
				       this.url, req.status);

	this._size = req.getResponseHeader ('Content-Length');
    };

    proto.size = function RandomAccessURL_size () {
	if (this._size == null)
	    this._get_size ();
	return this._size;
    };

    return RandomAccessURL;
}) ();


var URLHierarchyIOLayer = (function URLHierarchyIOLayer_closure () {
    // This should not be used in production conditions, since ever attempt to
    // open a file will require an HTTP request. And a standard TeX run
    // involves *many* attempts to open files. But this class can be useful in
    // development.

    function URLHierarchyIOLayer (virtprefix, urlprefix) {
	this.virtprefix = virtprefix;
	this.urlprefix = urlprefix;
    }

    var proto = URLHierarchyIOLayer.prototype;

    proto.try_open_linebuffer = function URLHierarchyIOLayer_try_open_linebuffer (texfn) {
	if (texfn.slice (0, this.virtprefix.length) != this.virtprefix)
	    // Not within our virtual filesystem prefix.
	    return null;

	var url = this.urlprefix + texfn.slice (this.virtprefix.length);

	try {
	    // XXX: Do better. File-existence tests shouldn't load everything
	    // in, especially when we're testing for the existence of embedded
	    // PDFS ...
	    var inp = fetch_url_str (url);
	    return LineBuffer.new_static (inp.split ('\n'));
	} catch (e) {
	    return null; // assume nonexistent, and not some other error ...
	}
    };

    proto.get_contents_ab = function URLHierarchyIOLayer_get_contents_ab (texfn) {
	if (texfn.slice (0, this.virtprefix.length) != this.virtprefix)
	    // Not within our virtual filesystem prefix.
	    return null;

	var url = this.urlprefix + texfn.slice (this.virtprefix.length);

	try {
	    var rau = new RandomAccessURL (url);
	    return rau.read_range_ab (0, rau.size ());
	} catch (e) {
	    return null; // assume nonexistent, and not some other error ...
	}
    };

    return URLHierarchyIOLayer;
}) ();

webtex_export ('URLHierarchyIOLayer', URLHierarchyIOLayer);
