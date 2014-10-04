'use strict';

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
	throw new TexRuntimeError ('no failure infrastructure! ' + event);
    });

    xhr.addEventListener ('abort', function (event) {
	throw new TexRuntimeError ('no failure infrastructure! ' + event);
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
		    throw new TexInternalError ('unexpectedly incomplete data');
		if (offset + length > totlen)
		    throw new TexInternalError ('too-short data');

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
	    throw new TexInternalError ('make_random_access_url broke?')
	return this._size;
    };

    proto.close = function RandomAccessURL_close () {
	this.nm.abortAllRequests ();
    };

    return RandomAccessURL;
}) ();
