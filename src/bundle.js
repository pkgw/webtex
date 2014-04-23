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

    return Bundle;
}) ();

WEBTEX.Bundle = Bundle;
