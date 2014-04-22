'use strict';

WEBTEX.IOBackend.makeInflater = function (callback) {
    return new JSInflater (callback);
};

function stream_url_to_linebuffer (url, lb) {
    // XXXXXX Firefox-specific!!!
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', url, true);
    xhr.responseType = 'moz-chunked-arraybuffer';

    xhr.addEventListener ('progress', function (event) {
	var t = String.fromCharCode.apply (null, new Uint8Array (xhr.response));
	lb.feed_data (t);
    });

    xhr.addEventListener ('load', function (event) {
	lb.end ();
    });

    xhr.addEventListener ('error', function (event) {
	throw new TexRuntimeException ('no failure infrastructure! ' + event);
    });

    xhr.addEventListener ('abort', function (event) {
	throw new TexRuntimeException ('no failure infrastructure! ' + event);
    });

    xhr.send (null);
}


var RandomAccessURL = (function RandomAccessURL_closure () {
    function RandomAccessURL (url) {
	this.url = url;
	this.nm = new NetworkManager (url, {});
	this._size = null;
    }

    var proto = RandomAccessURL.prototype;

    proto.read_range = function RandomAccessURL_read_range (offset, length, callback) {
	this.nm.requestRange (offset, offset + length, {
	    onDone: function (args) {
		var chunk = args.chunk, begin = args.begin;
		var totlen = begin + chunk.byteLength;

		if (offset < begin)
		    throw new TexInternalException ('unexpectedly incomplete data');
		if (offset + length > totlen)
		    throw new TexInternalException ('too-short data');

		chunk = chunk.slice (offset - begin, offset - begin + length);
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
