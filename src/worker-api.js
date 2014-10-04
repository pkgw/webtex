// Communication between us, the Web Worker, and the main browser thread. In
// particular, this file defines the "onmessage" handler.
//
// If we raise an exception, the parent's "onerror" handler will be called.

function post_message (kind, data) {
    // Obviously this function doesn't do a whole lot right now, but I want to
    // have a central dispatcher in case our API gets more elaborate. Also,
    // the type-checking of the "data" argument is important.

    if (typeof kind != 'string')
	throw new TexInternalError ('illegal message kind ' + kind);
    if (typeof data != 'object')
	throw new TexInternalError ('illegal message object ' + data);

    data._kind = kind;
    postMessage (data);
}


worker_api_endpoints.echo = function webtex_worker_echo (data) {
    post_message ('echo', data);
};


worker_api_endpoints.parse = function webtex_worker_parse (data) {
    var rau = new RandomAccessURL (data.bundleurl);
    var z = new ZipReader (rau.read_range_ab.bind (rau), rau.size ());
    var bundle = new Bundle (z);
    delete data.bundleurl;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);
    var inp = fetch_url_str (data.inputurl);
    data.initial_linebuf = LineBuffer.new_static (inp.split ('\n'));
    delete data.inputurl;

    var dumpjson = bundle.get_contents_json (data.dump_bpath);
    delete data.dump_bpath;

    var target_name = data.ship_target_name || null;
    if (target_name !== null)
	data.shiptarget = new worker_ship_targets[target_name] (post_message);

    var eng = new Engine (data);
    eng.restore_serialized_state (dumpjson);

    while (eng.step () === true) {
    }

    post_message ('parse_finish', {});
};


onmessage = function webtex_worker_onmessage (event) {
    var data = event.data;

    if (!data.hasOwnProperty ('_kind'))
	throw new TexInternalError ('worker: don\'t know how to handle event ' + event);

    if (typeof data._kind !== 'string')
	throw new TexInternalError ('worker: don\'t know how to handle event ' + event);

    if (!worker_api_endpoints.hasOwnProperty (data._kind))
	throw new TexInternalError ('worker: unrecognized API endpoint ' + data._kind);

    worker_api_endpoints[data._kind] (data);
};
