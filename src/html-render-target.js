// This "renders" a TeX ListBox to a flattened list of HTML tags.
//
// In the browser worker context, we can't pass DOM-type objects between a
// Worker and a main thread. So we have to convert things to a quickie
// JSON-type representation; in which case this class can also be used from
// Node.js to say precompile files.

var HTMLRenderTarget = (function HTMLRenderTarget_closure () {
    function HTMLRenderTarget (post_message) {
	this.post_message = post_message;

	// This is kind of a hack since all of this state is basically
	// internal to process(), but whatever.
    }

    var proto = HTMLRenderTarget.prototype;

    proto.clear_state = function HTMLRenderTarget_clear_state () {
	this.rendered = [];
	this.queued_text = '';
	this.suppression_level = 0;
    };

    proto.finish_text = function HTMLRenderTarget_finish_text () {
	if (this.queued_text.length) {
	    // I'd like to drop all-space strings, but we need them for
	    // constructions like "$x$ $y$".
	    if (this.suppression_level == 0)
		this.rendered.push (this.queued_text);
	    this.queued_text = '';
	}
    };

    proto.maybe_push = function HTMLRenderTarget_maybe_push (data) {
	this.finish_text ();

	if (this.suppression_level == 0)
	    this.rendered.push (data);
    };

    proto.process = function HTMLRenderTarget_process (engine, box) {
	this.clear_state ();

	var box_stack = [box];
	var j_stack = [0];

	while (box_stack.length) {
	    if (j_stack[0] >= box_stack[0].list.length) {
		box_stack.shift ();
		j_stack.shift ();
		continue;
	    }

	    var item = box_stack[0].list[j_stack[0]];
	    j_stack[0]++; // This item is dealt with.

	    if (item instanceof ListBox) {
		if (!item.render_as_canvas) {
		    box_stack.unshift (item);
		    j_stack.unshift (0);
		} else {
		    var data = new CanvasBox (item).to_render_data ();
		    data.kind = 'canvas';
		    this.maybe_push (data);
		}
	    } else if (item instanceof Character) {
		if (item.font.enc_unicode == null)
		    throw new TexRuntimeError ('cannot ship out character in unsupported font %s',
					       item.font.ident);
		this.queued_text += item.font.enc_unicode[item.ord];
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
	this.post_message ('render', {'items': this.rendered});
    };

    return HTMLRenderTarget;
}) ();

webtex_export ('HTMLRenderTarget', HTMLRenderTarget);
