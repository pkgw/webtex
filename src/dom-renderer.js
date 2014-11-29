// A class that uses a Master object to drive a TeX engine that renders a
// given file to HTML and inserts the results into the specific DOM container.

var DOMRenderer = (function DOMRenderer_callback () {
    function DOMRenderer (worker_url, container) {
	this.worker_url = worker_url;
	this.container = container;
    }

    var proto = DOMRenderer.prototype;

    var extension_to_mime = {
	// texpatches/*/dvips.def.post also needs to be updated to support new
	// image formats.
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
    };

    function create_pdf_image (doc, item) {
	var bytes = new Uint8Array (item.data);
	var canvas = doc.createElement ('canvas');

	PDFJS.getDocument (bytes).then (function (pdf) {
	    pdf.getPage (1).then (function (page) {
		var scale = 1.5;
		var viewport = page.getViewport (scale);

		var context = canvas.getContext ('2d');
		canvas.height = viewport.height;
		canvas.width = viewport.width;

		page.render ({canvasContext: context, viewport: viewport});
	    });
	});

	return canvas;
    }

    function create_image (doc, item) {
	// This "image" may be a PS, PDF, PNG, JPG, or whatever, so we can't
	// just blindly make an <img> tag for it.

	var ext = item.name.split ('.').pop ();

	if (ext == 'pdf')
	    return create_pdf_image (doc, item);

	if (ext == 'ps' || ext == 'eps') {
	    // TODO.
	    var elem = doc.createElement ('p');
	    elem.appendChild (doc.createTextNode ('[PostScript images not yet supported]'));
	    elem.className = 'wt-alert';
	    return elem;
	}

	// Default case for images that we actually can make an <img> tag for.
	// ArrayBuffer-to-string code from
	// http://jsperf.com/tobase64-implementations ; join('')-based
	// approaches are faster in some browsers (this is all very
	// Google-able).

	var elem = doc.createElement ('img');

	var bytes = new Uint8Array (item.data);
	var binary = '';
	var len = item.data.byteLength;
	for (var i = 0; i < len; i++)
	    binary += String.fromCharCode (bytes[i]);

	elem.src = 'data:' + extension_to_mime[ext] + ';base64,' + window.btoa (binary);
	return elem;
    }

    proto.handle_render = function DOMRenderer_handle_render (data) {
	var doc = this.container.ownerDocument;
	var dom_stack = [this.container];
	var idom = 0;

	for (var i = 0; i < data.items.length; i++) {
	    var item = data.items[i];

	    if (typeof item == 'string') {
		dom_stack[idom].appendChild (doc.createTextNode (item));
	    } else if (item.kind === 'starttag') {
		var elem = doc.createElement (item.name);

		for (var aname in item.attrs) {
		    if (!item.attrs.hasOwnProperty (aname))
			continue;
		    elem.setAttribute (aname, item.attrs[aname]);
		}

		dom_stack.push (elem);
		idom++;
	    } else if (item.kind === 'endtag') {
		// XXX: check start and end tags agree.
		var e = dom_stack.pop ();
		idom--;
		dom_stack[idom].appendChild (e);
	    } else if (item.kind === 'canvas') {
		var scale = 0.000034; // XXX should not be hardcoded!!!!!!!!
		var fontscale = 625.; // XXX ditto!

		var e = doc.createElement ('canvas');
		e.class = 'cbox';

		// Note: widths and heights are integers, so for best results
		// with small boxes we need to nudge things and adjust
		// accordingly.
		e.width = Math.ceil (scale * item.w);
		e.height = Math.ceil (scale * (item.h + item.d));
		dom_stack[idom].appendChild (e);

		// If we have a depth, must offset relative to the text baseline.
		if (item.d != 0) {
		    e.style.position = 'relative';
		    e.style.bottom = (-scale * item.d).toFixed (3) + 'px';
		}

		var ctx = e.getContext ('2d');
		ctx.fillStyle = 'rgba(0,0,0,0.8)';
		//ctx.strokeRect (0, 0, e.width, e.height); // XXX debugging

		for (var j = 0; j < item.gl.length; j++) {
		    var q = item.gl[j];
		    var x = scale * q.x;
		    var y = scale * q.y;

		    if (q.hasOwnProperty ('ggid')) {
			// Character.
			var f = compiled_fonts[q.pfb];
			var s = scale * fontscale * q.es / 655360.
			if (f == null) {
			    global_warnf ('missing compiled font %o', q.pfb);
			} else if (!f.hasOwnProperty (q.ggid)) {
			    global_warnf ('missing compiled GGID %d in font %o', q.ggid, q.pfb);
			} else {
			    ctx.beginPath ();
			    ctx.save ();
			    ctx.translate (x, y);
			    ctx.scale (s, -s);
			    f[q.ggid] (ctx);
			    ctx.fill ();
			    ctx.restore ();
			}
		    } else if (q.hasOwnProperty ('w')) {
			// Rule.
			ctx.fillRect (x, y, scale * q.w, scale * q.h);
		    } else {
			global_warnf ('unhandled CanvasBox graphic %j', q);
		    }
		}
	    } else if (item.kind === 'image') {
		dom_stack[idom].appendChild (create_image (doc, item));
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

	master.send_message ('parse_loop', data);
    };

    return DOMRenderer;
}) ();

webtex_export ('DOMRenderer', DOMRenderer);
