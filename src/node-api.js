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

    var eng = new Engine (data);

    if (dumpjson != null)
	eng.restore_serialized_state (dumpjson);

    return eng;
}


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


webtex_export ('setup_process_basic', setup_process_basic);
webtex_export ('setup_process_format', setup_process_format);
