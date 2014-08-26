'use strict';

var Bundle = (function Bundle_closure () {
    function Bundle (zipreader) {
	this.zipreader = zipreader;
    }

    var proto = Bundle.prototype;

    function texpaths (texfn) {
	return [texfn, texfn + '.tex'];
    }

    proto.try_open_linebuffer = function Bundle_try_open_linebuffer (texfn) {
	var paths = texpaths (texfn);

	while (paths.length) {
	    var path = paths.shift ();

	    var rv = this.zipreader.has_entry (path);
	    if (rv === NeedMoreData)
		throw rv;
	    if (rv == false)
		continue;

	    var lb = new LineBuffer ();
	    this.zipreader.stream_entry (path, function (err, buf) {
		if (err != null)
		    throw new TexRuntimeError ('quasi-unhandled I/O error: ' + err);

		if (buf == null) {
		    lb.end ();
		    return;
		}

		var arr = new Uint8Array (buf);
		lb.feed_data (String.fromCharCode.apply (null, arr));
	    });
	    return lb;
	}

	return null;
    };

    proto.promise_contents = function Bundle_promise_contents (path) {
	// Use of this function is generally discouraged since it builds up a
	// big buffer all in one go, but sometimes that approach is the most
	// sensible.

	// Existence check not racy since the zip reader is immutable.
	var stat = this.zipreader.has_entry (path);
	if (stat == false)
	    return null;
	if (stat === NeedMoreData)
	    return stat;

	return new Promise (function (resolve, reject) {
	    var state = {};
	    state.prev = new ArrayBuffer (0);

	    this.zipreader.stream_entry (path, function (err, buf) {
		if (err != null) {
		    reject (err);
		    return;
		}

		if (buf == null) {
		    resolve (state.prev);
		    return;
		}

		var tmp = new Uint8Array (state.prev.byteLength + buf.byteLength);
		tmp.set (new Uint8Array (state.prev, 0));
		tmp.set (new Uint8Array (buf), state.prev.byteLength)
		state.prev = tmp.buffer;
	    });
	}.bind (this));
    };

    proto.promise_json = function Bundle_promise_json (path) {
	return new Promise (function (resolve, reject) {
	    var jp = new JSONStreamParser ();
	    jp.onError = reject;
	    jp.onValue = function (value) {
		jp._last_value = value;
	    };

	    this.zipreader.stream_entry (path, function (err, buf) {
		if (err != null) {
		    reject (err);
		} else if (buf == null) {
		    resolve (jp._last_value);
		} else {
		    var arr = new Uint8Array (buf);
		    jp.write (String.fromCharCode.apply (null, arr));
		}
	    });
	}.bind (this));
    };

    return Bundle;
}) ();

WEBTEX.Bundle = Bundle;
