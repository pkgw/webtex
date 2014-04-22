'use strict';

WEBTEX.IOBackend.makeInflater = function (callback) {
    return new JSInflater (callback);
};

var RandomAccessURL = (function RandomAccessURL_closure () {
    function RandomAccessURL (url) {
	this.url = url;
	this.nm = new NetworkManager (url, {});
	this._size = null;
    }

    var proto = RandomAccessURL.prototype;

    proto.read_range = function RandomAccessURL_read_range (offset, length, callback) {
	this.nm.requestRange (offset, offset + length, {
	    onDone: function (begin, chunk) {
		callback (null, chunk);
	    },
	    onError: function (status) {
		callback (status, null);
	    }
	});
    };

    proto.size = function RandomAccessURL_size () {
	if (this._size == null)
	    throw new TexInternalException ('make_random_access_url broke?')
	return this._size;
    };

    proto.close = function RandomAccessURL_close () {
	this.nm.abortAllRequests ();
    };

    return RandomAccessURL;
}) ();


function make_random_access_url (url) {
    // We have to use promises because we need to know the size of the target
    // but we can only determine it asynchronously.

    var rau = new RandomAccessURL (url);

    return new Promise (function (resolve, reject) {
	var xhr = new XMLHttpRequest ();
	xhr._need_headers = true;
	xhr.open ('HEAD', url, true);

	xhr.onreadystatechange = function (event) {
	    if (xhr.readyState >= 2 && xhr._need_headers) {
		// We have headers, which is all we need.
		rau._size = xhr.getResponseHeader ('Content-Length');
		xhr._need_headers = false;
		resolve (rau);
	    }
	};
	xhr.onerror = reject;
	xhr.send (null);
    });
}

WEBTEX.Web.make_random_access_url = make_random_access_url;
