'use strict';

WEBTEX.Node.make_fs_linebuffer = (function make_fs_linebuffer (path) {
    var fs = require ('fs');
    var rs = fs.createReadStream (path, {encoding: 'ascii'});
    var lb = new LineBuffer ();

    rs.on ('data', function (chunk) {
	lb.feed_data (chunk);
    });

    rs.on ('end', function () {
	lb.end ();
    });

    rs.on ('error', function (err) {
	throw err;
    });

    return lb;
});


WEBTEX.IOBackend.try_open_linebuffer = function NodeIO_try_open_linebuffer (texfn) {
    // XXX temporary hack for trying restart-based parsing. We need to move to
    // fetching the data from a bundle on-demand. In the meantime, we're
    // performing a racy check for file existence because createReadStream throws
    // its exception asynchronously.
    var fs = require ('fs');
    var paths = [texfn + '.tex', texfn];

    while (paths.length) {
	var path = paths.pop ();
	path = 'deps/' + path; // XXX temporary!

	try {
	    fs.statSync (path);
	    return WEBTEX.Node.make_fs_linebuffer (path);
	} catch (e) {
	    if (e.code != 'ENOENT')
		throw e;
	}
    }
};


function buffer_to_arraybuffer (buf) {
    var ab = new ArrayBuffer (buf.length);
    var view = new Uint8Array (ab);

    // Apparently there's no better way to do this until Node 0.12.
    for (var i = 0; i < buf.length; i++)
        view[i] = buf[i];

    return ab;
}

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
	    callback (err, ab);
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


WEBTEX.IOBackend.makeInflater = function (datacb) {
    var zlib = require ('zlib');
    var inflate = zlib.createInflate ();

    function wt_write (arrbuf) {
	// Need to convert ArrayBuffer to node.js Buffer.
	return inflate.write (new Buffer (new Uint8Array (arrbuf)));
    }

    inflate.on ('data', function (buf) { datacb (null, buffer_to_arraybuffer (buf)); });
    inflate.on ('end', function () { datacb (null, null); });
    inflate.on ('error', function (err) { datacb (err, null); });
    inflate.wt_write = wt_write;

    // zlib expects this header, but the underlying Zip inflated stream
    // doesn't contain it. Zlib also expects a 4-byte CRC trailer that isn't
    // in the Zip file stream, but doesn't seem to care if we don't provide
    // it.
    var header = new Buffer (2);
    header.writeUInt8 (0x78, 0);
    header.writeUInt8 (0x9c, 1);
    inflate.write (header);

    return inflate;
}
