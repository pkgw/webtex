// "Render" a TeX ListBox to a flattened list of HTML tags, and send it off to
// the main thread to be built into the DOM. Note that we need to do the
// rendering here since we can't convey object-oriented-y data across the Web
// Worker message passing system.

workerShipTargets['html-render'] = (function HTMLRenderTarget_closure () {
    function HTMLRenderTarget (post_message) {
	this.post_message = post_message;
    }

    var proto = HTMLRenderTarget.prototype;

    proto.process = function HTMLRenderTarget_process (box) {
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

	    if (item instanceof CanvasBox) {
		// We have to handle this before ListBox because CanvasBoxes
		// are ListBoxes. Or we could, you know, use object
		// orientation.

		if (queued_text.length) {
		    rendered.push (queued_text);
		    queued_text = '';
		}

		var data = item.to_render_data ();
		data.kind = 'canvas';
		rendered.push (data);
	    } else if (item instanceof ListBox) {
		box_stack.push (item);
		j_stack.push (0);
		ibox++;
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
		queued_text += String.fromCharCode (item.ord);
	    } else if (item instanceof BoxGlue) {
		queued_text += ' ';
	    }
	}

	if (queued_text.length)
	    rendered.push (queued_text);

	this.post_message ('render', rendered);
    };

    return HTMLRenderTarget;
}) ();
