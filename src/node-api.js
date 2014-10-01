// Node-based API endpoints -- we take paths to data files rather than
// URLs (as used in the browser).

WEBTEX.test_drive_node = function webtex_node_test_drive_node (data) {
    // Arguments:
    // - bundlepath
    // - inputpath
    // - dumppath
    //
    // Rest are passed to Engine. (Include: jobname, debug_trace,
    // debug_input_lines.)

    var raf = new RandomAccessFile (data.bundlepath);
    var z = new ZipReader (raf.read_range_ab.bind (raf), raf.size ());
    var bundle = new Bundle (z);
    delete data.bundlepath;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);
    data.initial_linebuf = make_fs_linebuffer (data.inputpath);
    delete data.inputpath;

    var dumpjson = null;
    var dumppath = data.dumppath || null;

    if (dumppath != null) {
	dumpjson = get_fs_json (data.dumppath);
	delete data.dumppath;
    }

    var eng = new Engine (data);

    if (dumpjson != null)
	eng.restore_serialized_state (dumpjson);

    while (eng.step () === true) {
    }
};
