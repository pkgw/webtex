// "Render" a TeX ListBox to a flattened list of HTML tags, and send it off to
// the main thread to be built into the DOM. Note that we need to do the
// rendering here since we can't convey object-oriented-y data across the Web
// Worker message passing system.

worker_ship_targets['html-render'] = (function HTMLRenderTarget_closure () {
    function HTMLRenderTarget (post_message) {
	this.post_message = post_message;
    }

    var proto = HTMLRenderTarget.prototype;

    proto.process = function HTMLRenderTarget_process (engine, box) {
	var rendered = [];
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

	    if (item instanceof ListBox) {
		if (!item.render_as_canvas) {
		    box_stack.push (item);
		    j_stack.push (0);
		    ibox++;
		} else {
		    if (queued_text.length) {
			rendered.push (queued_text);
			queued_text = '';
		    }

		    item = new CanvasBox (item);
		    var data = item.to_render_data ();
		    data.kind = 'canvas';
		    rendered.push (data);
		}
	    } else if (item instanceof StartTag) {
		if (queued_text.length) {
		    rendered.push (queued_text);
		    queued_text = '';
		}

		rendered.push ({kind: 'starttag',
				name: item.name});
	    } else if (item instanceof EndTag) {
		if (queued_text.length) {
		    rendered.push (queued_text);
		    queued_text = '';
		}

		// XXX: check start and end tags agree.
		rendered.push ({kind: 'endtag'});
	    } else if (item instanceof Character) {
		if (item.font.enc_unicode == null)
		    throw new TexRuntimeError ('cannot ship out character in unsupported font %s',
					       item.font.ident);
		queued_text += item.font.enc_unicode[item.ord];
	    } else if (item instanceof BoxGlue) {
		queued_text += ' ';
	    }
	}

	if (queued_text.length)
	    rendered.push (queued_text);

	this.post_message ('render', {'items': rendered});
    };

    return HTMLRenderTarget;
}) ();
