// Copyright 2015 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Resizable figures.

(function resizable_figures_closure () {
    interact ('.webtex figure')
	.resizable({
	    edges: {left: false, right: true, top: false, bottom: true,}
	})
	.on ('resizemove', function (event) {
	    var target = event.target;
	    target.style.width  = event.rect.width + 'px';
	    // We have the height adapt automatically based on the width.
	    //target.style.height = event.rect.height + 'px';
	});
}) ();
