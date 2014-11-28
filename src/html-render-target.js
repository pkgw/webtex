// "Render" a TeX ListBox to a flattened list of HTML tags, and send it off to
// the main thread to be built into the DOM. Note that we need to do the
// rendering here since we can't convey object-oriented-y data across the Web
// Worker message passing system.

worker_ship_targets['html-render'] = (function HTMLRenderTarget_closure () {
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

	    if (item instanceof ListBox) {
		if (!item.render_as_canvas) {
		    box_stack.push (item);
		    j_stack.push (0);
		    ibox++;
		} else {
		    var data = new CanvasBox (item).to_render_data ();
		    data.kind = 'canvas';
		    this.maybe_push (data);
		}
	    } else if (item instanceof StartTag) {
		this.maybe_push ({kind: 'starttag', name: item.name});
	    } else if (item instanceof EndTag) {
		// XXX: check start and end tags agree.
		this.maybe_push ({kind: 'endtag'});
	    } else if (item instanceof SuppressionControl) {
		this.finish_text ();

		if (item.is_pop)
		    this.suppression_level--;
		else
		    this.suppression_level++;
	    } else if (item instanceof Character) {
		if (item.font.enc_unicode == null)
		    throw new TexRuntimeError ('cannot ship out character in unsupported font %s',
					       item.font.ident);
		this.queued_text += item.font.enc_unicode[item.ord];
	    } else if (item instanceof BoxGlue) {
		if (item.amount.is_nonzero ())
		    this.queued_text += ' ';
	    }
	}

	this.finish_text ();
	this.post_message ('render', {'items': this.rendered});
    };

    return HTMLRenderTarget;
}) ();
