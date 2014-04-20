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


function buffer_to_arraybuffer (buf) {
    var ab = new ArrayBuffer (buf.length);
    var view = new Uint8Array (ab);

    // Apparently there's no better way to do this until Node 0.12.
    for (var i = 0; i < buf.length; i++)
        view[i] = buf[i];

    return ab;
}

WEBTEX.IOBackend.try_open_linesource = function NodeIO_try_open_linesource (texfn) {
    var fs = require ('fs'), paths = [texfn + '.tex', texfn], ls = null;

    while (paths.length) {
	var path = paths.pop ();
	try {
	    path = 'deps/' + path; // XXX temporary!
	    ls = new WEBTEX.Node.FSLineSource (path);
	} catch (e) {
	    if (e.code != 'ENOENT')
		throw e;
	}
    }

    return ls;
};


WEBTEX.Node.RandomAccessFile = (function RandomAccessFile_closure () {
    var fs = require ('fs');

    function RandomAccessFile (path) {
	this.fd = fs.openSync (path, 'r');
	this.buf = new Buffer (2048);
    }

    var proto = RandomAccessFile.prototype;

    proto.read_range = function RandomAccessFile_read_range (offset, length, callback) {
	if (this.buf.length < length)
	    this.buf = new Buffer (length);

	fs.read (this.fd, this.buf, 0, length, offset, function (err, nbytes, buf) {
	    var ab = buffer_to_arraybuffer (buf.slice (0, nbytes));
	    callback (ab, err);
	});
    };

    proto.size = function RandomAccessFile_size () {
	return fs.fstatSync (this.fd).size;
    };

    proto.close = function RandomAccessFile_close () {
	fs.close (this.fd);
    };

    return RandomAccessFile;
}) ();
