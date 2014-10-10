// The Master object tells a Worker what to do and receives messages from it.

var Master = (function Master_closure () {
    function Master (worker_url) {
	this.worker = null;
	this.worker_url = worker_url;
    }

    var proto = Master.prototype;

    proto.onerror = function Master_onerror (errevent) {
	console.error ('worker error: ' + errevent.message + ' (' +
		       errevent.filename + ':' + errevent.lineno + ')');
    };

    proto.handle_echo = function Master_handle_echo (data) {
	console.log ('worker echo: ' + JSON.stringify (data));
    };

    proto.handle_parse_finish = function Master_handle_parse_finish (data) {
	console.log ('parse finished');
    };

    proto.onmessage = function Master_onmessage (msgevent) {
	var data = msgevent.data;

	if (typeof data != 'object')
	    throw new TexInternalError ('illegal message object %o', data);

	if (!data.hasOwnProperty ('_kind') || typeof data._kind != 'string')
	    throw new TexInternalError ('master: don\'t know how to handle message %j',
					data);

	var handler = this['handle_' + data._kind];

	if (typeof handler != 'function')
	    throw new TexInternalError ('master: no handler for event kind %o',
					data._kind);

	handler.bind (this) (data);
    };

    proto.launch = function Master_launch () {
	if (this.worker != null)
	    throw new TexInternalError ('worker already launched');

	this.worker = new Worker (this.worker_url);
	this.worker.onerror = this.onerror.bind (this);
	this.worker.onmessage = this.onmessage.bind (this);
    };

    proto.send_message = function Master_send_message (kind, data) {
	if (this.worker == null)
	    this.launch ();

	if (typeof kind != 'string')
	    throw new TexInternalError ('illegal message kind %o', kind);

	if (typeof data != 'object')
	    throw new TexInternalError ('illegal message object %o', data);

	data._kind = kind;
	this.worker.postMessage (data);
    }

    return Master;
}) ();
