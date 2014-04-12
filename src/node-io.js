'use strict';

WEBTEX.Node.readFileLines = (function readFileLines (path, options, onLineReceived) {
    var fs = require ('fs');
    var rs = fs.createReadStream (path, options);
    var last = '';

    rs.on ('data', function (chunk) {
	var lines, i;

	lines = (last + chunk).split ("\n");
	for (i = 0; i < lines.length - 1; i++) {
	    onLineReceived (lines[i]);
	}
	last = lines[i];
    });

    rs.on ('end', function () {
	    onLineReceived (last);
    });

    rs.resume ();
});

WEBTEX.Node.FSLineSource = (function FSLineSource_closure () {
    var fs = require ('fs');

    function FSLineSource (path) {
	this.fd = fs.openSync (path, 'r');
	this.buf = new Buffer (2048);
	this.cachedlines = [];
	this.remainder = '';
    }

    var proto = FSLineSource.prototype;

    proto.get = function FSLineSource_get () {
	if (this.cachedlines.length)
	    return this.cachedlines.shift ();
	if (this.fd === null)
	    return null;

	while (1) {
	    var n = fs.readSync (this.fd, this.buf, 0, this.buf.length, null);
	    if (n == 0) {
		fs.close (this.fd);
		this.fd = null;
		return null;
	    }

	    var chunk = this.remainder + this.buf.asciiSlice (0, n);
	    var lines = chunk.split ("\n");
	    if (lines.length > 1)
		break;

	    this.remainder = chunk;
	}

	var ret = lines.shift ();
	this.remainder = lines.pop ();
	this.cachedlines = lines;
	return ret;
    }

    return FSLineSource;
})();
