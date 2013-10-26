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
