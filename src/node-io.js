'use strict';

function buffer_to_arraybuffer (buf) {
    var ab = new ArrayBuffer (buf.length);
    var view = new Uint8Array (ab);

    // Apparently there's no better way to do this until Node 0.12.
    for (var i = 0; i < buf.length; i++)
        view[i] = buf[i];

    return ab;
}


function make_fs_linebuffer (path) {
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
}


var RandomAccessFile = (function RandomAccessFile_closure () {
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


function promise_engine (args) {
    var f = new RandomAccessFile (args.bundlepath);
    var z = new ZipReader (f.read_range.bind (f), f.size ());
    args.bundle = new Bundle (z);
    delete args.bundlepath;

    args.initial_linebuf = make_fs_linebuffer (args.inputpath);
    delete args.inputpath;

    return new Promise (function (resolve, reject) {
	// Make sure that the bundle's zip reader is ready to go before
	// handing off control.
	function iterate () {
	    if (args.bundle.zipreader.dirinfo == null)
		setTimeout (iterate, 10);
	    else
		resolve (new Engine (args));
	}

	iterate ();
    });
};


WEBTEX.Node.promise_engine = promise_engine;
