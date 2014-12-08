// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Node-based API endpoints -- we take paths to data files rather than
// URLs (as used in the browser).

function setup_process_basic (data) {
    // Arguments:
    // - bundlepath
    // - inputpath
    // - dumppath
    //
    // Rest are passed to Engine. (Include: jobname, debug_trace,
    // debug_input_lines.)
    //
    // We extract the dirname of inputpath and set up an FSIOLayer to load
    // auxiliary files from that location. XXX: we override jobname.

    var raf = new RandomAccessFile (data.bundlepath);
    var z = new ZipReader (raf.read_range_ab.bind (raf), raf.size ());
    var bundle = new Bundle (z);
    delete data.bundlepath;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);

    var path = require ('path');
    var inputbase = path.basename (data.inputpath);
    var inputdir = path.dirname (data.inputpath);
    data.initial_linebuf = make_fs_linebuffer (data.inputpath);
    data.jobname = inputbase;
    data.iostack.push (new FSIOLayer ('', inputdir + '/'));
    delete data.inputpath;

    var dumpjson = null;
    var dumppath = data.dumppath || null;

    if (dumppath != null) {
	dumpjson = get_fs_json (data.dumppath);
	delete data.dumppath;
    }

    data.fontdata = bundle.get_contents_json ('wtfontdata.json');

    var eng = new Engine (data);

    if (dumpjson != null)
	eng.restore_serialized_state (dumpjson);

    return eng;
}
webtex_export ('setup_process_basic', setup_process_basic);


function setup_process_format (data) {
    // Arguments:
    // - bundlepath
    // - initial_linebuf
    //
    // Rest are passed to Engine. (Include: jobname, debug_trace,
    // debug_input_lines.)

    var raf = new RandomAccessFile (data.bundlepath);
    var z = new ZipReader (raf.read_range_ab.bind (raf), raf.size ());
    var bundle = new Bundle (z);
    delete data.bundlepath;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);

    return new Engine (data);
}
webtex_export ('setup_process_format', setup_process_format);


function process_loop (data) {
    var raf = new RandomAccessFile (data.bundlepath);
    var z = new ZipReader (raf.read_range_ab.bind (raf), raf.size ());
    var bundle = new Bundle (z);
    delete data.bundlepath;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);

    var path = require ('path');
    data.jobname = path.basename (data.inputpath);
    if (data.jobname.indexOf ('.tex', data.jobname.length - 4) !== -1)
	data.jobname = data.jobname.slice (0, -4);

    var inputdir = path.dirname (data.inputpath);
    data.iostack.push (new FSIOLayer ('', inputdir + '/'));

    var dumpjson = null;
    if (data.dumpfile != null) {
	dumpjson = bundle.get_contents_json (data.dumpfile);
	delete data.dumpfile;
    }

    data.fontdata = bundle.get_contents_json ('wtfontdata.json');

    var niters = data.niters || 1;
    var orig_shiptarget = data.shiptarget;

    for (var i = 0; i < niters; i++) {
	data.initial_linebuf = make_fs_linebuffer (data.inputpath);

	// For now, only ship out the results of the final iteration. You
	// could imagine shipping out as we go and replacing preliminary
	// output on subsequent passes.
	if (i == niters - 1)
	    data.shiptarget = orig_shiptarget;
	else
	    data.shiptarget = new ShipTarget (); // noop

	var eng = new Engine (data);
	if (dumpjson != null)
	    eng.restore_serialized_state (dumpjson);

	eng.trace ('****** processing iteration #%d ******', i + 1);

	while (eng.step () === true) {
	}
    }
}
webtex_export ('process_loop', process_loop);
