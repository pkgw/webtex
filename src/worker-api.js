// Communication between us, the Web Worker, and the main browser thread. In
// particular, this file defines the "onmessage" handler.
//
// If we raise an exception, the parent's "onerror" handler will be called.

// This hasn't been registered since it's in the generic part of the codebase:
worker_ship_targets['html'] = HTMLTranslateTarget;


function post_message (kind, data) {
    // Obviously this function doesn't do a whole lot right now, but I want to
    // have a central dispatcher in case our API gets more elaborate. Also,
    // the type-checking of the "data" argument is important.

    if (typeof kind != 'string')
	throw new TexInternalError ('illegal message kind %o', kind);
    if (typeof data != 'object')
	throw new TexInternalError ('illegal message object %o', data);

    data._kind = kind;
    postMessage (data);
}


worker_api_endpoints.echo = function webtex_worker_echo (data) {
    post_message ('echo', data);
};


worker_api_endpoints.parse_once = function webtex_worker_parse_once (data) {
    var rau = new RandomAccessURL (data.bundleurl);
    var z = new ZipReader (rau.read_range_ab.bind (rau), rau.size ());
    var bundle = new Bundle (z);
    delete data.bundleurl;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);

    if (data.allow_input_hierarchy) {
	var i = data.inputurl.lastIndexOf ('/');
	var pfx = data.inputurl.slice (0, i + 1);
	data.iostack.push (new URLHierarchyIOLayer ('', pfx));
    }

    var inp = fetch_url_str (data.inputurl);
    data.initial_linebuf = LineBuffer.new_static (inp.split ('\n'));
    delete data.inputurl;

    var dumpjson = bundle.get_contents_json (data.dump_bpath);
    delete data.dump_bpath;

    var target_name = data.ship_target_name || null;
    if (target_name !== null)
	data.shiptarget = new worker_ship_targets[target_name] (post_message);

    data.fontdata = bundle.get_contents_json ('wtfontdata.json');

    var eng = new Engine (data);
    eng.restore_serialized_state (dumpjson);

    while (eng.step () === true) {
    }

    post_message ('parse_finish', {});
};


worker_api_endpoints.parse_loop = function webtex_worker_parse_loop (data) {
    var rau = new RandomAccessURL (data.bundleurl);
    var z = new ZipReader (rau.read_range_ab.bind (rau), rau.size ());
    var bundle = new Bundle (z);
    delete data.bundleurl;

    data.iostack = new IOStack ();
    data.iostack.push (bundle);

    if (data.allow_input_hierarchy) {
	var i = data.inputurl.lastIndexOf ('/');
	var pfx = data.inputurl.slice (0, i + 1);
	data.iostack.push (new URLHierarchyIOLayer ('', pfx));
    }

    var target_name = data.ship_target_name || null;
    var inp = fetch_url_str (data.inputurl);
    var dumpjson = bundle.get_contents_json (data.dump_bpath);
    delete data.inputurl;
    delete data.dump_bpath;
    data.fontdata = bundle.get_contents_json ('wtfontdata.json');

    for (var i = 0; i < 3; i++) {
	data.initial_linebuf = LineBuffer.new_static (inp.split ('\n'));

	if (target_name !== null && i > 1)
	    data.shiptarget = new worker_ship_targets[target_name] (post_message);
	else
	    data.shiptarget = {process: function () {}};

	var eng = new Engine (data);
	eng.restore_serialized_state (dumpjson);

	while (eng.step () === true) {
	}
    }

    post_message ('parse_finish', {});
};


worker_api_endpoints.feed_pre_parsed = function webtex_worker_feed_pre_parsed (data) {
    if (typeof data.jsonurl != 'string')
	throw new TexInternalError ('need a string "jsonurl" parameter');

    // I want to send the data incrementally, but we need to be careful about
    // working in groups without trailing open tags or anything. To be dealt
    // with later.

    var data = fetch_url_json_with_enc (data.jsonurl);
    post_message ('render', {'items': data});
    post_message ('parse_finish', {});
};


onmessage = function webtex_worker_onmessage (event) {
    var data = event.data;

    if (!data.hasOwnProperty ('_kind'))
	throw new TexInternalError ('worker: don\'t know how to handle event %o', event);

    if (typeof data._kind !== 'string')
	throw new TexInternalError ('worker: don\'t know how to handle event %o', event);

    if (!worker_api_endpoints.hasOwnProperty (data._kind))
	throw new TexInternalError ('worker: unrecognized API endpoint %o', data._kind);

    try {
	worker_api_endpoints[data._kind] (data);
    } catch (e) {
	// onerror() in master doesn't provide the stack trace.
	global_warnf ('uncaught worker exception: %o', e);
	global_warnf (e.stack);
	throw e;
    }
};
