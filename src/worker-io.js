'use strict';

WEBTEX.IOBackend.makeInflater = function (callback) {
    return new JSInflater (callback);
};

var RandomAccessURL = (function RandomAccessURL_closure () {
    function RandomAccessURL (url) {
	this.url = url;
	this._size = null;
    }

    var proto = RandomAccessURL.prototype;

    proto.read_range = function RandomAccessURL_read_range (offset, length) {
	throw new TexInternalError ('not impl');
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
