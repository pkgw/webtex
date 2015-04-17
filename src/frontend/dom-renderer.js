// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// A class that uses a Master object to drive a TeX engine that renders a
// given file to HTML and inserts the results into the specified DOM
// container.

var DOMRenderer = (function DOMRenderer_callback () {
    function DOMRenderer (worker_url, container) {
	this.worker_url = worker_url;
	this.container = container;

	this.dom_stack = [this.container];
	this.fonts = {};

	// pdf.js seems to only be able to handle one simultaneous
	// page.render() call, perhaps because that goes to a single worker
	// object that gets confused. So we have to add some structure to
	// serialize our render() calls.

	this.queued_pdf_renders = [];
	this.pdf_render_interval_id = null;
	this.pdf_render_is_waiting = false;
	this.max_img_width = 700; // XXX total hack hardcoding

	this._initialize_container ();
    }

    var proto = DOMRenderer.prototype;

    proto._initialize_container = function DOMRenderer__initialize_container () {
	// Clear out the container contents and insert a loading animation
	// ASAP. The default contents should be an error message; it will
	// only appear if Webtex fails badly.
	while (this.container.firstChild)
	    this.container.removeChild (this.container.firstChild);

	var div = this.container.ownerDocument.createElement ('div');
	div.className = 'wt-loading-spinner';
	this.container.appendChild (div);
    };

    proto.process_fontdata = function DOMRenderer_process_fontdata (item) {
	if (this.fonts[item.ident] != null) {
	    global_warnf ('backend trying to re-register font ID %o (%o)',
			  item.ident, item.pfbname);
	    return;
	}

	if (item.data == null) {
	    global_warnf ('font %o needed but data not available', item.pfbname);
	    // TODO: register a null noop font so that we don't crash.
	    return;
	}

	this.fonts[item.ident] = new Type1Font (item.pfbname, item.data);
    };

    var extension_to_mime = {
	// texpatches/*/dvips.def.post also needs to be updated to support new
	// image formats.
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
    };

    function check_pdf_rendering () {
	if (this.pdf_render_is_waiting)
	    return;

	if (!this.queued_pdf_renders.length) {
	    window.clearInterval (this.pdf_render_interval_id);
	    this.pdf_render_interval_id = null;
	    return;
	}

	var info = this.queued_pdf_renders.shift ();
	var page = info.page, canvas = info.canvas;

	// Samples all seem to use a scale of 1.5; I have no idea where it
	// comes from, but it does seem to generally give good results.

	var scale = 1.5;
	var viewport = page.getViewport (scale);

	if (viewport.width > this.max_img_width) {
	    scale *= (1.0 * this.max_img_width / viewport.width);
	    viewport = page.getViewport (scale);
	}

	var context = canvas.getContext ('2d');
	canvas.height = viewport.height;
	canvas.width = viewport.width;

	var hack = page.render ({canvasContext: context, viewport: viewport});
	var old_callback = hack.internalRenderTask.callback;
	var js_is_lame = this;

	this.pdf_render_is_waiting = true;

	hack.internalRenderTask.callback = function (err) {
	    js_is_lame.pdf_render_is_waiting = false;
	    old_callback.call (this, err);
	};
    };

    proto.create_pdf_image = function DOMRenderer_create_pdf_image (doc, item) {
	var bytes = new Uint8Array (item.data);
	var canvas = doc.createElement ('canvas');
	canvas.height = canvas.width = 200; // arbitrary non-zero default
	canvas.className = 'wt-pdf-canvas';

	var js_is_lame = this;

	PDFJS.getDocument (bytes).then (function (pdf) {
	    return pdf.getPage (1);
	}).then (function (page) {
	    js_is_lame.queued_pdf_renders.push ({
		page: page,
		canvas: canvas
	    });

	    if (js_is_lame.pdf_render_interval_id === null)
		js_is_lame.pdf_render_interval_id =
		   window.setInterval (check_pdf_rendering.bind (js_is_lame), 250);
	});

	return canvas;
    };

    proto.create_image = function DOMRenderer_create_image (doc, item) {
	// This "image" may be a PS, PDF, PNG, JPG, or whatever, so we can't
	// just blindly make an <img> tag for it.

	var ext = item.name.split ('.').pop ();

	if (ext == 'pdf') {
	    var elem = this.create_pdf_image (doc, item);
	    elem.className += ' wt-image';
	    return elem;
	}

	if (ext == 'ps' || ext == 'eps') {
	    // TODO.
	    var elem = doc.createElement ('p');
	    elem.appendChild (doc.createTextNode ('[PostScript images not yet supported]'));
	    elem.className = 'wt-alert';
	    return elem;
	}

	// Default case for images that we actually can make an <img> tag for.

	var elem = doc.createElement ('img');
	elem.src = ['data:', extension_to_mime[ext], ';base64,',
		    arraybuffer_to_base64 (item.data)].join ('');
	elem.className = 'wt-image';
	return elem;
    };

    proto.create_canvas = function DOMRenderer_create_canvas (doc, item) {
	if (item.gl.length < 1 || item.w == 0 || item.h == 0)
	    // Zero-area canvases are invalid.
	    return null;

	var e = doc.createElement ('canvas');
	e.className = 'wt-cbox';

	// XXX assuming a universal 20px font size. It looks like we should be
	// able to use getComputedStyle to get the actual font size of the
	// canvas' container, but when I try this I get "16px" back, not 20px,
	// and 20px is definitely closer to what we want. To be investigated.
	var html_m_width = 20;
	var scale = 1.0 * html_m_width / item.mw;
	var fontscale = 625.; // XXX I don't know where this comes from!

	// Note: widths and heights are integers, so for best results with
	// small boxes we need to nudge things and adjust accordingly.
	e.width = Math.ceil (scale * item.w);
	e.height = Math.ceil (scale * (item.h + item.d));

	// If we have a depth, must offset relative to the text baseline. Note
	// that you can actually perceive the difference if you don't round
	// the pixel offsets (e.g., -1.666px becomes -1 rather than -2 in
	// $1\pm2$, and this is noticeable). We should increase the size by
	// another CSS pixel and offset the coordinate system by the
	// difference.
	if (item.d != 0) {
	    e.style.position = 'relative';
	    e.style.bottom = Math.round (-scale * item.d).toFixed () + 'px';
	}

	var ctx = e.getContext ('2d');
	ctx.fillStyle = '#000';
	//ctx.strokeRect (0, 0, e.width, e.height); // XXX debugging

	for (var j = 0; j < item.gl.length; j++) {
	    var q = item.gl[j];
	    var x = scale * q.x;
	    var y = scale * q.y;

	    if (q.hasOwnProperty ('ggid')) {
		// Character.
		var f = this.fonts[q.fid];
		var s = scale * fontscale * q.es / 655360.;

		if (f == null) {
		    global_warnf ('missing fontid %o', q.fid);
		} else {
		    ctx.beginPath ();
		    ctx.save ();
		    ctx.translate (x, y);
		    ctx.scale (s, -s);
		    f.trace (ctx, q.ggid);
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

	return e;
    };

    proto.handle_render = function DOMRenderer_handle_render (data) {
	var doc = this.container.ownerDocument;
	var dom_stack = this.dom_stack;

	for (var i = 0; i < data.items.length; i++) {
	    var item = data.items[i];

	    if (typeof item == 'string') {
		dom_stack[0].appendChild (doc.createTextNode (item));
	    } else if (item.kind === 'starttag') {
		var elem = doc.createElement (item.name);

		for (var aname in item.attrs) {
		    if (!item.attrs.hasOwnProperty (aname))
			continue;
		    elem.setAttribute (aname, item.attrs[aname]);
		}

		dom_stack.unshift (elem);
	    } else if (item.kind === 'endtag') {
		// XXX: check start and end tags agree.
		if (dom_stack.length < 2)
		    global_warnf ('unbalanced end tag in HTML output')
		else {
		    var e = dom_stack.shift ();
		    dom_stack[0].appendChild (e);
		    for (var j = 0; j < DOMRenderer._tag_callbacks.length; j++)
			DOMRenderer._tag_callbacks[j] (doc, this.container, e);
		}
	    } else if (item.kind === 'canvas') {
		var c = this.create_canvas (doc, item);
		if (c != null)
		    dom_stack[0].appendChild (c);
	    } else if (item.kind === 'image') {
		dom_stack[0].appendChild (this.create_image (doc, item));
	    } else if (item.kind === 'fontdata') {
		this.process_fontdata (item);
	    } else {
		global_warnf ('unhandled rendered-HTML item %j', item);
	    }
	}
    };

    proto._try_remove_spinner = function DOMRenderer__try_remove_spinner () {
	for (var i = 0; i < this.container.childNodes.length; i++) {
	    var node = this.container.childNodes[i];

	    if (node.className == 'wt-loading-spinner') {
		this.container.removeChild (node);
		return;
	    }
	}
    };

    proto.handle_parse_finish = function DOMRenderer_handle_parse_finish (data) {
	console.log ('parse finished');
	this._try_remove_spinner ();
    };

    proto.handle_worker_error = function DOMRenderer_handle_worker_error (errevent) {
	// XXX do better! Collect/report information about where crashes were
	// triggered, tell the user what to do, implement error recovery, ...
	console.error ('DOM renderer notified of uncaught worker error');
	console.error ('Partial info: ' + errevent.message + ' (' +
		       errevent.filename + ':' + errevent.lineno + ')');

	this._try_remove_spinner ();

	var err = this.container.ownerDocument.createElement ('div');
	err.className = 'wt-internal-error';
	err.textContent = 'Webtex crashed :-( The ' +
	    'JavaScript console has technical details.';
	this.container.appendChild (err);
    };

    proto._make_master = function DOMRenderer__make_master () {
	var master = new Master (this.worker_url);
	master.handle_render = this.handle_render.bind (this);
	master.handle_parse_finish = this.handle_parse_finish.bind (this);
	master.onerror = this.handle_worker_error.bind (this);
	return master;
    };

    proto.launch_parse = function DOMRenderer_launch_parse (data) {
	data.jobname = data.jobname || 'texput';
	data.ship_target_name = data.ship_target_name || 'html';

	this._make_master ().send_message ('parse_loop', data);
    };

    proto.launch_parse_archive = function DOMRenderer_launch_parse_archive (data) {
	data.jobname = data.jobname || 'texput';
	data.ship_target_name = data.ship_target_name || 'html';

	this._make_master ().send_message ('parse_archive_loop', data);
    };

    proto.launch_feed_pre_parsed = function DOMRenderer_launch_feed_pre_parsed (data) {
	this._make_master ().send_message ('feed_pre_parsed', data);
    };

    // API for adding functionality onto DOMRenderer for chrome effects, e.g.
    // pop-up references. This is similar to the way in which the Engine is
    // extensible.

    DOMRenderer._tag_callbacks = [];

    DOMRenderer.register_tag_callback = function DOMRenderer_register_tag_callback (func) {
	// Called as func (doc, container, newly_added_element).
	DOMRenderer._tag_callbacks.push (func);
    }

    return DOMRenderer;
}) ();

webtex_export ('DOMRenderer', DOMRenderer);
