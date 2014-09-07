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
    }

    var proto = RandomAccessFile.prototype;

    proto.read_range = function RandomAccessFile_read_range (offset, length, callback) {
	// TODO: continually allocating buffers could get slow. You can't have
	// a single static buffer since multiple asynchronous read commands
	// might stomp on each other, but you could have a pool of buffers
	// with flags indicating which ones are available. I'll cross that
	// bridge when I get there.
	var buf = new Buffer (length);

	fs.read (this.fd, buf, 0, length, offset, function (err, nbytes, buf) {
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


var FSIOLayer = (function FSIOLayer_closure () {
    var fs = require ('fs');

    function FSIOLayer (virtprefix, fsprefix) {
	this.virtprefix = virtprefix;
	this.fsprefix = fsprefix;
    }

    var proto = FSIOLayer.prototype;

    proto.try_open_linebuffer = function FSIOLayer_try_open_linebuffer (texfn) {
	if (texfn.slice (0, this.virtprefix.length) != this.virtprefix)
	    // Not within our virtual filesystem prefix.
	    return null;

	// Once again async I/O issues rear their heads. Ideally we'd just
	// delegate to make_fs_linebuffer, but it throws an exception
	// asynchronously if the desired file doesn't exist. We'd like to know
	// that now so we can return `null`. We *could* queue some kind of
	// operation and return NeedMoreData but that is a pain. So we commit
	// a CLASSIC RACE CONDITION MISTAKE and see if we can open the file
	// synchronously before delegating to the async code. I should come
	// back and fix this.

	var p = this.fsprefix + texfn.slice (this.virtprefix.length);

	try {
	    var fd = fs.openSync (p, 'r');
	} catch (e) {
	    return null; // assume ENOENT and not some other error ...
	}

	fs.closeSync (fd);
	return make_fs_linebuffer (p);
    };

    proto.promise_contents = function FSIOLayer_promise_contents (texfn) {
	if (texfn.slice (0, this.virtprefix.length) != this.virtprefix)
	    // Not within our virtual filesystem prefix.
	    return null;

	// We do synchronous I/O here to avoid the race condition issue
	// present in try_open_linebuffer. In theory this is suboptimal
	// because we may block the thread on I/O, but ... whatever.

	var p = this.fsprefix + texfn.slice (this.virtprefix.length);

	try {
	    return buffer_to_arraybuffer (fs.readFileSync (p));
	} catch (e) {
	    return null; // assume ENOENT and not some other error ...
	}
    };

    return FSIOLayer;
}) ();

WEBTEX.Node.FSIOLayer = FSIOLayer;


WEBTEX.IOBackend.makeInflater = function (datacb) {
    // The "raw" zlib inflater is appropriate for Zip file contents; the
    // non-"raw" one expects a 2-byte header and 4-byte trailer that aren't
    // present in Zip streams.
    var zlib = require ('zlib');
    var inflate = zlib.createInflateRaw ();

    function wt_write (arrbuf) {
	// Need to convert ArrayBuffer to node.js Buffer.
	return inflate.write (new Buffer (new Uint8Array (arrbuf)));
    }

    inflate.on ('data', function (buf) { datacb (null, buffer_to_arraybuffer (buf)); });
    inflate.on ('end', function () { datacb (null, null); });
    inflate.on ('error', function (err) { datacb (err, null); });
    inflate.wt_write = wt_write;

    return inflate;
}


function promise_engine (args) {
    var f = new RandomAccessFile (args.bundlepath);
    var z = new ZipReader (f.read_range.bind (f), f.size ());

    return z.promise_ready ().then (function () {
	var bundle = new Bundle (z);
	delete args.bundlepath;
	args.iostack = new IOStack ();
	args.iostack.push (bundle);

	if (args.input_linebuf != null) {
	    args.initial_linebuf = args.input_linebuf;
	    delete args.input_linebuf;
	} else {
	    args.initial_linebuf = make_fs_linebuffer (args.inputpath);
	    delete args.inputpath;
	}

	return new Engine (args);
    });
};

WEBTEX.Node.promise_engine = promise_engine;


function promise_fs_json (path) {
    var fs = require ('fs');
    var rs = fs.createReadStream (path, {encoding: 'utf-8'});
    var jp = new JSONStreamParser ();

    return new Promise (function (resolve, reject) {
	jp.onError = reject;
	jp.onValue = function (value) {
	    jp._last_value = value;
	};

	rs.on ('data', function (chunk) {
	    jp.write (chunk);
	});

	rs.on ('end', function () {
	    resolve (jp._last_value);
	});

	rs.on ('error', reject);
    });
};

WEBTEX.Node.promise_fs_json = promise_fs_json;


var ConsoleDumpTarget = (function ConsoleDumpTarget_closure () {
    var console = require ('console');

    function ConsoleDumpTarget () {}

    var proto = ConsoleDumpTarget.prototype;

    proto.process = function ConsoleDumpTarget_process (box) {
	console.log ('==== shipped out: ====');
	box.traverse (0, 0, function (x, y, item) {
	    console.log ('x=' + x + ' y=' + y + ' ' + item);
	});
	console.log ('==== (end of shipout) ====');
    };

    return ConsoleDumpTarget;
}) ();

WEBTEX.Node.ConsoleDumpTarget = ConsoleDumpTarget;
