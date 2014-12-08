// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// This "translates" a TeX ListBox to a flattened JSON-type representation of
// HTML tags and some higher-level constructs.
//
// When run inside the browser, this code runs inside the web worker, and the
// master thread then uses the JSON to build actual DOM objects using the
// DOMRenderer.
//
// But we can also run in the Node.js version, in which case the flattened
// representation can just be saved as JSON. Precisely this is done by the
// ChromeJsonDumpTarget in node-io.js. There is, however, some awkward
// encapsulation-breaking in this object's API that needs to be worked around
// in this situation.

var HTMLTranslateTarget = (function HTMLTranslateTarget_closure () {
    function HTMLTranslateTarget (post_message) {
	this.post_message = post_message;
	this.shipped_fonts = {};
    }

    inherit (HTMLTranslateTarget, ShipTarget);
    var proto = HTMLTranslateTarget.prototype;

    proto.process_font = function HTMLTranslateTarget_process_font (engine, font) {
	if (this.suppression_level != 0)
	    // Don't register and ship out fonts that we might not actually
	    // need.
	    return -1;

	var id = this.shipped_fonts[font.pfbname];
	if (id != null)
	    return id;

	// We're using a font that the recipient hasn't been told about yet.
	// Give it an ID number and ship out the font data. If something
	// busted has happened, data will be null! That's for the chrome to
	// deal with.

	id = Object.keys (this.shipped_fonts).length;
	this.shipped_fonts[font.pfbname] = id;
	this.translated.push ({
	    kind: 'fontdata',
	    ident: id,
	    pfbname: font.pfbname,
	    data: engine.iostack.get_contents_ab (font.pfbname),
	});
	return id;
    }

    proto.render_box_as_canvas =
	function HTMLTranslateTarget_render_box_as_canvas (engine, srcbox, last_font)
    {
	if (!(srcbox instanceof HBox || srcbox instanceof VBox))
	    throw new TexInternalError ('canvas source should be HBox or ' +
					'VBox; got %o', srcbox);

	// TODO, I think: record true width/height/depth of subcomponents.
	// Otherwise we might overflow our <canvas> element.

	var gl = []; // "graphics list"
	var data = {
	    kind: 'canvas',
	    w: srcbox.width_S,
	    h: srcbox.height_S,
	    d: srcbox.depth_S,
	    gl: gl
	};

	// We need to export this information so that the HTML and
	// LaTeX font sizes agree.

	if (last_font == null)
	    data.mw = 655200; // ~10pt
	else
	    data.mw = last_font.get_dimen__N_S (6); // em width

	// nonzero initial Y makes coordinates relative to box's top-left.
	srcbox.traverse__SSO (nlib.Zero_S, srcbox.height_S, function (x_S, y_S, item) {
	    if (item instanceof Character) {
		if (item.font.enc_idents == null)
		    throw new TexRuntimeError ('cannot draw character in unsupported font %s',
					       item.font.ident);

		gl.push ({x: x_S,
			  y: y_S,
			  fid: this.process_font (engine, item.font),
			  es: item.font.metrics.effective_size,
			  ggid: item.font.enc_idents[item.ord]});
	    } else if (item instanceof Rule) {
		y_S -= item.height_S; // output coordinates are rulebox's top-left too.
		gl.push ({x: x_S,
			  y: y_S,
			  w: item.width_S,
			  h: item.height_S + item.depth_S});
	    }
	}.bind (this));

	return data;
    }

    proto.clear_state = function HTMLTranslateTarget_clear_state () {
	this.translated = [];
	this.queued_text = '';
	this.suppression_level = 0;
    };

    proto.finish_text = function HTMLTranslateTarget_finish_text () {
	if (this.queued_text.length) {
	    // I'd like to drop all-space strings, but we need them for
	    // constructions like "$x$ $y$".
	    if (this.suppression_level == 0)
		this.translated.push (this.queued_text);
	    this.queued_text = '';
	}
    };

    proto.maybe_push = function HTMLTranslateTarget_maybe_push (data) {
	this.finish_text ();

	if (this.suppression_level == 0)
	    this.translated.push (data);
    };

    proto.process = function HTMLTranslateTarget_process (engine, box) {
	this.clear_state ();

	var box_stack = [box];
	var j_stack = [0];
	var last_font = null;

	while (box_stack.length) {
	    if (j_stack[0] >= box_stack[0].list.length) {
		box_stack.shift ();
		j_stack.shift ();
		continue;
	    }

	    var item = box_stack[0].list[j_stack[0]];
	    j_stack[0]++; // This item is dealt with.

	    if (item instanceof ListBox) {
		if (item.render_as_canvas) {
		    this.maybe_push (this.render_box_as_canvas (engine, item, last_font));
		} else {
		    // Recurse into this box.
		    box_stack.unshift (item);
		    j_stack.unshift (0);
		}
	    } else if (item instanceof Character) {
		if (item.font.enc_unicode == null)
		    throw new TexRuntimeError ('cannot ship out character in unsupported font %s',
					       item.font.ident);
		this.queued_text += item.font.enc_unicode[item.ord];
		last_font = item.font;
	    } else if (item instanceof BoxGlue) {
		if (item.amount.is_nonzero ())
		    this.queued_text += ' ';
	    } else if (item instanceof StartTag) {
		this.maybe_push ({
		    kind: 'starttag',
		    name: item.name,
		    attrs: item.attrs,
		});
	    } else if (item instanceof EndTag) {
		// XXX: check start and end tags agree.
		this.maybe_push ({kind: 'endtag'});
	    } else if (item instanceof SuppressionControl) {
		this.finish_text ();

		if (item.is_pop)
		    this.suppression_level--;
		else
		    this.suppression_level++;
	    } else if (item instanceof CanvasControl) {
		this.finish_text ();

		if (item.is_pop) {
		    engine.warn ('unmatched CanvasControl (1)');
		    continue;
		}

		// Coast through items in the current box until we find the
		// paired CanvasControl-pop. We ignore suppression_level here.
		// Right thing to do??

		var canvas_level = 1;
		var list = box_stack[0].list;
		var j_start = j_stack[0] + 1;
		var j_end = j_start;

		while (canvas_level > 0 && j_end < list.length) {
		    if (list[j_end] instanceof CanvasControl) {
			if (list[j_end].is_pop)
			    canvas_level--;
			else
			    canvas_level++;
		    }

		    j_end++;
		}

		if (canvas_level > 0)
		    engine.warn ('unmatched CanvasControl (2)');

		j_stack[0] = j_end;

		// XXX: we're losing the glue setting of the outer box. We
		// could preserve it with clone(), but then we'd need to go
		// through and recalculate the width and height correctly,
		// which seems like a hassle. And I have trouble seeing when
		// it'd matter.

		var subbox = ListBox.create (box_stack[0].btype);
		subbox.list = list.slice (j_start, j_end - 1);
		subbox.set_glue__OOS (engine, false, nlib.Zero_S);
		this.maybe_push (this.render_box_as_canvas (engine, subbox, last_font));
	    } else if (item instanceof Image) {
		// Because the image may be sitting in a source Zip file and
		// may be something that needs fancy handling (e.g. a PDF), we
		// have the chrome deal with all of that. We just send it a
		// binary blob. It'd be appealing to support a case where we
		// can point to a URL, but that will almost never happen in
		// the wild where we'll be processing tarballs.
		//
		// XXX Big images will result in large data copies unless we're
		// careful with how we do the Worker data passing stuff.

		var data = engine.iostack.get_contents_ab (item.src);
		if (data == null) {
		    // Shouldn't happen, but you never know ... XXX should
		    // have some kind of something-went-wrong-here item we
		    // can send.
		} else {
		    this.maybe_push ({
			kind: 'image',
			name: item.src,
			data: data,
		    });
		}
	    }
	}

	this.finish_text ();
	this.post_message ('render', {'items': this.translated});
    };

    return HTMLTranslateTarget;
}) ();

webtex_export ('HTMLTranslateTarget', HTMLTranslateTarget);
