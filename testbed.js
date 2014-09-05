'use strict';

var targdiv = document.getElementById ('webtex');

var bundleurl = 'build/latest.zip';
var inputurl = 'test/tex/latex-minimal.tex';
var dump_bpath = 'latex.dump.json';

WEBTEX.Web.promise_engine ({
    jobname: 'plain',
    inputurl: inputurl,
    bundleurl: bundleurl,
    dump_bpath: dump_bpath,
    shiptarget: new WEBTEX.Web.DOMTarget (targdiv),
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
    console.log (err);
});
