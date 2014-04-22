'use strict';

var bundleurl = 'texbundles/default.zip';
var inputurl = 'test/tex/plain.tex';

WEBTEX.Web.promise_engine ('plain', inputurl, bundleurl)
    .then (function (engine) {
	function iterate () {
	    var rv = engine.step ();

	    if (rv === true)
		setImmediate (iterate);
	    else if (rv === WEBTEX.NeedMoreData)
		setTimeout (iterate, 10);
	    // otherwise, EOF and we're done.
	}

	iterate ();
    });
