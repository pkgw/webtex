'use strict';

var bundleurl = 'texbundles/default.zip';
var inputurl = 'test/tex/plain.tex';

WEBTEX.Web.promise_engine ({
    jobname: 'plain',
    inputurl: inputurl,
    bundleurl: bundleurl,
}).then (function (engine) {
    function iterate () {
	var rv = engine.step ();

	if (rv === true)
	    setImmediate (iterate);
	else if (rv === WEBTEX.NeedMoreData)
	    setTimeout (iterate, 10);
	else // EOF
	    console.log ('testbed: done parsing');
    }

    iterate ();
}).catch (function (err) {
    console.log (err.stack);
});
