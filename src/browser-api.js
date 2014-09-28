WEBTEX.Web.test = (function () {
    function test (worker_url, kind, data) {
	var worker = new Worker (worker_url);

	worker.onerror = function (errevent) {
	    console.error ('worker error: ' + errevent.message + ' (' +
			   errevent.filename + ':' + errevent.lineno + ')');
	};

	worker.onmessage = function (event) {
	    console.log ('worker event data: ' + JSON.stringify (event.data));
	};

	worker.post_webtex = function (kind, data) {
	    if (typeof data != 'object')
		throw new TexInternalError ('illegal message object ' + data);
	    data._kind = kind;
	    this.postMessage (data);
	}.bind (worker);

	worker.post_webtex (kind, data);
    }

    return test;
}) ();
