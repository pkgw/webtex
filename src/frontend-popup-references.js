// Copyright 2015 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Implementing references that pop up on mouseover. We wire up links to
// #cite.XXXX, causing them to run the pop-up logic on the first div with the
// class wt-refident-XXXX.

(function popup_references_closure () {
    function wire_ref_link (doc, container, elem) {
	if (elem.tagName != 'A')
	    return;

	var href = elem.getAttribute ('href');
	if (href == null || href.indexOf ('#cite.') != 0)
	    return;

	var refident = href.substr (6);

	elem._mouseout_cleanup = null;

	elem.addEventListener ("mouseenter", function (event) {
	    // Search for the appropriate reference text element
	    var hits = container.getElementsByClassName ('wt-refident-' + refident);
	    if (hits.length == 0) {
		global_warnf ('no reference text element for identifier %s', refident);
		return;
	    }
	    var refelem = hits[0];

	    // do stuff
	    var blockelem = elem.parentNode;
	    while (true) {
		var cs = blockelem.currentStyle || window.getComputedStyle (blockelem, '');
		if (cs.display == 'block' || blockelem.parentNode == null)
		    break;
		blockelem = blockelem.parentNode;
	    }

	    var placeholder = doc.createElement ('div');
	    refelem.parentNode.insertBefore (placeholder, refelem);

	    var prev_classname = refelem.className;
	    var prev_pos = refelem.style.position;
	    var prev_mt = refelem.style.marginTop;

	    refelem.className += ' wt-popup-ref';
	    refelem.style.position = 'absolute';
	    var dt = elem.getBoundingClientRect ().top - blockelem.getBoundingClientRect ().top;
	    refelem.style.marginTop = dt + 'px';

	    blockelem.parentNode.insertBefore (refelem, blockelem);

	    elem._mouseout_cleanup = function (event) {
		placeholder.parentNode.replaceChild (refelem, placeholder);
		refelem.className = prev_classname;
		refelem.style.position = prev_pos;
		refelem.style.marginTop = prev_mt;
	    };
	});

	elem.addEventListener ("mouseleave", function (event) {
	    if (elem._mouseout_cleanup != null) {
		elem._mouseout_cleanup (event);
		elem._mouseout_cleanup = null;
	    }
	});
    }

    DOMRenderer.register_tag_callback (wire_ref_link);
}) ();
