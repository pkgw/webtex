'use strict';

WEBTEX.IOBackend.makeInflater = function (callback) {
    return new JSInflater (callback);
};

function stream_url_to_linebuffer (url, lb) {
    // XXXXXX Firefox-specific!!!
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', url, true);
    xhr.responseType = 'moz-chunked-arraybuffer';

    xhr.addEventListener ('progress', function (event) {
	var t = String.fromCharCode.apply (null, new Uint8Array (xhr.response));
	lb.feed_data (t);
    });

    xhr.addEventListener ('load', function (event) {
	lb.end ();
    });

    xhr.addEventListener ('error', function (event) {
	throw new TexRuntimeError ('no failure infrastructure! ' + event);
    });

    xhr.addEventListener ('abort', function (event) {
	throw new TexRuntimeError ('no failure infrastructure! ' + event);
    });

    xhr.send (null);
}


var RandomAccessURL = (function RandomAccessURL_closure () {
    function RandomAccessURL (url) {
	this.url = url;
	this.nm = new NetworkManager (url, {});
	this._size = null;
    }

    var proto = RandomAccessURL.prototype;

    proto.read_range = function RandomAccessURL_read_range (offset, length, callback) {
	this.nm.requestRange (offset, offset + length, {
	    onDone: function (args) {
		var chunk = args.chunk, begin = args.begin;
		var totlen = begin + chunk.byteLength;

		if (offset < begin)
		    throw new TexInternalError ('unexpectedly incomplete data');
		if (offset + length > totlen)
		    throw new TexInternalError ('too-short data');

		chunk = chunk.slice (offset - begin, offset - begin + length);
		callback (null, chunk);
	    },
	    onError: function (status) {
		callback (status, null);
	    }
	});
    };

    proto.size = function RandomAccessURL_size () {
	if (this._size == null)
	    throw new TexInternalError ('make_random_access_url broke?')
	return this._size;
    };

    proto.close = function RandomAccessURL_close () {
	this.nm.abortAllRequests ();
    };

    return RandomAccessURL;
}) ();


function make_random_access_url (url) {
    // We have to use promises because we need to know the size of the target
    // but we can only determine it asynchronously.

    var rau = new RandomAccessURL (url);

    return new Promise (function (resolve, reject) {
	var xhr = new XMLHttpRequest ();
	xhr._need_headers = true;
	xhr.open ('HEAD', url, true);

	xhr.onreadystatechange = function (event) {
	    if (xhr.readyState >= 2 && xhr._need_headers) {
		// We have headers, which is all we need.
		rau._size = xhr.getResponseHeader ('Content-Length');
		xhr._need_headers = false;
		resolve (rau);
	    }
	};
	xhr.onerror = reject;
	xhr.send (null);
    });
}

WEBTEX.Web.make_random_access_url = make_random_access_url;


function promise_engine (args) {
    return make_random_access_url (args.bundleurl)
	.then (function (rau) {
	    var z = new ZipReader (rau.read_range.bind (rau), rau.size ());
	    return z.promise_ready ();
	}).then (function (z) {
	    var bundle = new Bundle (z);
	    delete args.bundleurl;
	    args.iostack = new IOStack ();
	    args.iostack.push (bundle);
	    args.initial_linebuf = new LineBuffer ();
	    stream_url_to_linebuffer (inputurl, args.initial_linebuf);
	    delete args.inputurl;
	    return bundle;
	}).then (function (bundle) {
	    var prom = bundle.promise_json (args.dump_bpath);
	    delete args.dump_bpath;
	    return prom;
	}).then (function (dumpjson) {
	    var eng = new Engine (args);
	    eng.restore_serialized_state (dumpjson);
	    return eng;
	});
};

WEBTEX.Web.promise_engine = promise_engine;


var DOMTarget = (function DOMTarget_closure () {
    function DOMTarget (top_element) {
	this.top_element = top_element;
    }

    var proto = DOMTarget.prototype;

    var fontmap = {
	lmmi10: '28px LMMathItalic10',
	lmr7: '19.6px LMRoman7',
	'rm-lmr7': '19.6px LMRoman7',
    };

    proto.process = function DOMTarget_process (box) {
	var doc = this.top_element.ownerDocument;
	var dom_stack = [this.top_element];
	var idom = 0;
	var queued_text = '';

	var box_stack = [box];
	var j_stack = [0];
	var ibox = 0;

	while (box_stack.length) {
	    if (j_stack[ibox] >= box_stack[ibox].list.length) {
		box_stack.pop ();
		j_stack.pop ();
		ibox--;
		continue;
	    }

	    var item = box_stack[ibox].list[j_stack[ibox]];
	    j_stack[ibox]++; // This item is dealt with.

	    if (item instanceof CanvasBox) {
		// We have to handle this before ListBox because CanvasBoxes
		// are ListBoxes. Or we could, you know, use object
		// orientation.

		if (queued_text.length) {
		    dom_stack[idom].appendChild (doc.createTextNode (queued_text));
		    queued_text = '';
		}

		var scale = 0.000048; // XXX should not be hardcoded!!!!!!!!

		var e = doc.createElement ('canvas');
		e.class = 'cbox';
		// Note: widths and heights are integers, so for best results
		// with small boxes we're going to need to nudge things and
		// adjust accordingly.
		e.width = Math.ceil (scale * item.width.sp.value);
		e.height = Math.ceil (scale * (item.height.sp.value + item.depth.sp.value));
		dom_stack[idom].appendChild (e);

		var ctx = e.getContext ('2d');
		ctx.fillStyle = 'rgba(0,0,0,0.8)';
		//ctx.strokeRect (0, 0, e.width, e.height); // XXX debugging

		for (var i = 0; i < item.graphics.length; i++) {
		    var q = item.graphics[i];
		    var x = scale * q[0];
		    var y = scale * (item.height.sp.value + q[1]);
		    var subitem = q[2];

		    if (subitem instanceof Character) {
			var f = fontmap[subitem.font.ident];
			if (f == null) {
			    console.warn ('unmapped font ident ' + subitem.font.ident);
			    f = '28px LMMathItalic10';
			}

			console.log ('CB chr "' + String.fromCharCode (subitem.ord) +
				     '" font=' + f + ' x=' + x + ' y=' + y);
			ctx.font = f;
			ctx.fillText (String.fromCharCode (subitem.ord), x, y);
		    } else if (subitem instanceof Rule) {
			y -= scale * subitem.height.sp.value;
			ctx.fillRect (x, y, scale * subitem.width.sp.value,
				      scale * (subitem.height.sp.value + subitem.depth.sp.value));
		    } else {
			console.log ('unhandled CanvasBox graphic ' + subitem);
		    }
		}
	    } else if (item instanceof ListBox) {
		box_stack.push (item);
		j_stack.push (0);
		ibox++;
	    } else if (item instanceof StartTag) {
		if (queued_text.length) {
		    dom_stack[idom].appendChild (doc.createTextNode (queued_text));
		    queued_text = '';
		}

		var e = doc.createElement (item.name);
		// XXX: no attributes
		dom_stack.push (e);
		idom++;
	    } else if (item instanceof EndTag) {
		if (queued_text.length) {
		    dom_stack[idom].appendChild (doc.createTextNode (queued_text));
		    queued_text = '';
		}

		// XXX: check start and end tags agree.
		var e = dom_stack.pop ();
		idom--;
		dom_stack[idom].appendChild (e);
	    } else if (item instanceof Character) {
		queued_text += String.fromCharCode (item.ord);
	    } else if (item instanceof BoxGlue) {
		queued_text += ' ';
	    }
	}

	if (queued_text.length)
	    this.top_element.appendChild (doc.createTextNode (queued_text));
    };

    return DOMTarget;
}) ();

WEBTEX.Web.DOMTarget = DOMTarget;
