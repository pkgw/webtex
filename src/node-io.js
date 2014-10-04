'use strict';

function buffer_to_arraybuffer (buf) {
    var ab = new ArrayBuffer (buf.length);
    var view = new Uint8Array (ab);

    // Apparently there's no better way to do this until Node 0.12.
    for (var i = 0; i < buf.length; i++)
        view[i] = buf[i];

    return ab;
}


function ab_to_str (arraybuf) {
    // A naive fromCharCode.apply() call can lead to exceptions about too many
    // arguments.
    //
    // XXX assuming no multi-byte/UTF8-type characters!!

    var s = '';
    var b = new Uint8Array (arraybuf);
    var nleft = b.byteLength;
    var nchunk = 4096;
    var ofs = 0;

    while (nleft > nchunk) {
	s += String.fromCharCode.apply (null, b.subarray (ofs, ofs + nchunk));
	ofs += nchunk;
	nleft -= nchunk;
    }

    s += String.fromCharCode.apply (null, b.subarray (ofs, ofs + nleft));
    return s;
}


function make_fs_linebuffer (path) {
    // XXX UTF-8 assumption of course not wise
    var fs = require ('fs');
    var data = fs.readFileSync (path, {encoding: 'utf-8'});
    return LineBuffer.new_static (data.split ('\n'));
}


var RandomAccessFile = (function RandomAccessFile_closure () {
    var fs = require ('fs');

    function RandomAccessFile (path) {
	this.fd = fs.openSync (path, 'r');
    }

    var proto = RandomAccessFile.prototype;

    proto.read_range_ab = function RandomAccessFile_read_range_ab (offset, length) {
	var buf = new Buffer (length);
	var nb = fs.readSync (this.fd, buf, 0, length, offset);

	if (nb != length)
	    throw new Error ('expected to read ' + length + ' bytes; got ' + nb);

	return buffer_to_arraybuffer (buf.slice (0, nb));
    };

    proto.read_range_str = function RandomAccessFile_read_range_str (offset, length) {
	// TODO: Buffer -> ArrayBuffer -> String is silly. We do this for now
	// to keep things simple.
	return ab_to_str (this.read_range_ab (offset, length));
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
    // This is needed for dump-format.js to gain access to the LaTeX patch files.
    // We need them to generate latex.dump.json, and we can't generate the bundle
    // Zip before we generate that.

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

	var p = this.fsprefix + texfn.slice (this.virtprefix.length);

	try {
	    return make_fs_linebuffer (p);
	} catch (e) {
	    return null; // assume ENOENT and not some other error ...
	}
    };

    proto.get_contents_ab = function FSIOLayer_get_contents_ab (texfn) {
	if (texfn.slice (0, this.virtprefix.length) != this.virtprefix)
	    // Not within our virtual filesystem prefix.
	    return null;

	var p = this.fsprefix + texfn.slice (this.virtprefix.length);

	try {
	    return buffer_to_arraybuffer (fs.readFileSync (p));
	} catch (e) {
	    return null; // assume ENOENT and not some other error ...
	}
    };

    return FSIOLayer;
}) ();

webtex_export ('FSIOLayer', FSIOLayer);


function get_fs_json (path) {
    var fs = require ('fs');

    var jp = new JSONStreamParser ();
    jp.onError = function (err) { throw err; };
    jp.onValue = function (value) { jp._last_value = value; };
    jp.write (fs.readFileSync (path, {encoding: 'utf-8'}));
    return jp._last_value;
}


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

webtex_export ('ConsoleDumpTarget', ConsoleDumpTarget);
