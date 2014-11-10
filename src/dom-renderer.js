// A class that uses a Master object to drive a TeX engine that renders a
// given file to HTML and inserts the results into the specific DOM container.

var DOMRenderer = (function DOMRenderer_callback () {
    function DOMRenderer (worker_url, container) {
	this.worker_url = worker_url;
	this.container = container;
    }

    var proto = DOMRenderer.prototype;

    proto.fontmap = {
	lmmi10: '28px LMMathItalic10',
	lmr7: '19.6px LMRoman7',
	'rm-lmr7': '19.6px LMRoman7',
	'rm-lmr10': '28px LMRoman7',
    };

    proto.handle_render = function DOMRenderer_handle_render (data) {
	var doc = this.container.ownerDocument;
	var dom_stack = [this.container];
	var idom = 0;

	for (var i = 0; i < data.items.length; i++) {
	    var item = data.items[i];

	    if (typeof item == 'string') {
		dom_stack[idom].appendChild (doc.createTextNode (item));
	    } else if (item.kind === 'starttag') {
		// XXX: no attributes
		dom_stack.push (doc.createElement (item.name));
		idom++;
	    } else if (item.kind === 'endtag') {
		// XXX: check start and end tags agree.
		var e = dom_stack.pop ();
		idom--;
		dom_stack[idom].appendChild (e);
	    } else if (item.kind === 'canvas') {
		var scale = 0.000048; // XXX should not be hardcoded!!!!!!!!

		var e = doc.createElement ('canvas');
		e.class = 'cbox';

		// Note: widths and heights are integers, so for best results
		// with small boxes we need to nudge things and adjust
		// accordingly.
		e.width = Math.ceil (scale * item.w);
		e.height = Math.ceil (scale * (item.h + item.d));
		dom_stack[idom].appendChild (e);

		var ctx = e.getContext ('2d');
		ctx.fillStyle = 'rgba(0,0,0,0.8)';
		//ctx.strokeRect (0, 0, e.width, e.height); // XXX debugging

		for (var j = 0; j < item.gl.length; j++) {
		    var q = item.gl[j];
		    var x = scale * q.x;
		    var y = scale * q.y;

		    if (q.hasOwnProperty ('ord')) {
			// Character.
			var f = this.fontmap[q.font];
			if (f == null) {
			    global_warnf ('unmapped font ident %o', q.font);
			    f = '28px LMMathItalic10';
			}

			ctx.font = f;
			ctx.fillText (String.fromCharCode (q.ord), x, y);
		    } else if (q.hasOwnProperty ('w')) {
			// Rule.
			ctx.fillRect (x, y, scale * q.w, scale * q.h);
		    } else {
			global_warnf ('unhandled CanvasBox graphic %j', q);
		    }
		}
	    } else {
		global_warnf ('unhandled rendered-HTML item %j', item);
	    }
	}
    };

    proto.launch_parse = function DOMRenderer_launch_parse (data) {
	var master = new Master (this.worker_url);
	master.handle_render = this.handle_render.bind (this);

	data.jobname = data.jobname || 'texput';
	data.ship_target_name = data.ship_target_name || 'html-render';

	master.send_message ('parse', data);
    };

    return DOMRenderer;
}) ();

webtex_export ('DOMRenderer', DOMRenderer);
