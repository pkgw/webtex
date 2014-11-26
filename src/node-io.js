// I/O backend for the Node.js version. **Everything is synchronous**, because
// that's the only way I can figure out how to get the TeX engine to run
// reliably. Trust me, I'm not happy about it either, but there really seems
// to be no other way.

function buffer_to_arraybuffer (buf) {
    var ab = new ArrayBuffer (buf.length);
    var view = new Uint8Array (ab);

    // Apparently there's no better way to do this until Node 0.12.
    for (var i = 0; i < buf.length; i++)
        view[i] = buf[i];

    return ab;
}


function make_fs_linebuffer (path) {
    // XXX UTF-8 assumption of course not wise
    var fs = require ('fs');
    var data = fs.readFileSync (path, {encoding: 'utf-8'});
    return LineBuffer.new_static (data.split ('\n'));
}


function get_fs_json (path) {
    var fs = require ('fs');

    var jp = new JSONStreamParser ();
    jp.onError = function (err) { throw err; };
    jp.onValue = function (value) { jp._last_value = value; };
    jp.write (fs.readFileSync (path, {encoding: 'utf-8'}));
    return jp._last_value;
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
	return arraybuffer_to_str (this.read_range_ab (offset, length));
    };

    proto.size = function RandomAccessFile_size () {
	return fs.fstatSync (this.fd).size;
    };

    proto.close = function RandomAccessFile_close () {
	fs.close (this.fd);
    };

    return RandomAccessFile;
}) ();

webtex_export ('RandomAccessFile', RandomAccessFile);


var FSIOLayer = (function FSIOLayer_closure () {
    // This is needed for dump-format.js to gain access to the LaTeX patch
    // files. We need them to generate latex.dump.json, and we can't generate
    // the bundle Zip before we generate that.

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


var ConsoleDumpTarget = (function ConsoleDumpTarget_closure () {
    function ConsoleDumpTarget () {}

    var proto = ConsoleDumpTarget.prototype;

    proto.process = function ConsoleDumpTarget_process (engine, box) {
	global_logf ('==== shipped out: ====');
	box.traverse__SSO (nlib.Zero_S, nlib.Zero_S, function (x, y, item) {
	    global_logf ('x=%o y=%o %o', x, y, item);
	});
	global_logf ('==== (end of shipout) ====');
    };

    return ConsoleDumpTarget;
}) ();

webtex_export ('ConsoleDumpTarget', ConsoleDumpTarget);
