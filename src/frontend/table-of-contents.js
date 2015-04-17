// Copyright 2015 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Automatic generation of table of contents. XXX: how will this look when a
// section name contains math?

(function table_of_contents_closure () {
    var toc_ol = null;

    function set_toc_state () {
	if (toc_ol.desire_expanded) {
	    toc_ol.style.opacity = 0.9;
	} else {
	    toc_ol.style.opacity = 0;
	}
    }

    function toggle_toc (event) {
	toc_ol.desire_expanded = !toc_ol.desire_expanded;
	set_toc_state ();
	event.preventDefault ();
    }

    function toc_link_clicked (event) {
	toc_ol.desire_expanded = false;
	set_toc_state ();
    }

    function build_toc (doc, container, elem) {
	if (elem.tagName[0] != 'H' || elem.tagName.length != 2)
	    return;

	var level = parseInt (elem.tagName.substr (1), 10);
	if (level == 1)
	    return;

	// Search for an <a name=''...> inside elem to find the anchor
	// name that we should point to.

	var dest = null;
	var atags = elem.getElementsByTagName ('a');
	for (var i = 0; i < atags.length; i++) {
	    var atag = atags[i];

	    if (atag.name != null && atag.name.length) {
		dest = atag.name;
		global_logf ('target: %s', dest);
		break;
	    }
	}

	if (toc_ol == null) {
	    var wrapper = doc.createElement ('div');
	    wrapper.className = 'wt-toc-wrapper';

	    var icon = doc.createElement ('a');
	    icon.className = 'wt-toc-icon';
	    icon.href = '#';
	    icon.addEventListener ('click', toggle_toc, false);

	    toc_ol = doc.createElement ('ol');
	    toc_ol.className = 'wt-toc';
	    toc_ol.desire_expanded = false;

	    wrapper.appendChild (icon);
	    wrapper.appendChild (toc_ol);
	    container.insertBefore (wrapper, container.firstChild);
	}

	var item = doc.createElement ('li');
	item.className = format ('wt-toc-level%d', level);

	if (dest == null)
	    item.textContent = elem.textContent;
	else {
	    var link = doc.createElement ('a');
	    link.href = '#' + dest;
	    link.textContent = elem.textContent;
	    link.addEventListener ('click', toc_link_clicked, false);
	    item.appendChild (link);
	}

	toc_ol.appendChild (item);
    }

    DOMRenderer.register_tag_callback (build_toc);
}) ();
