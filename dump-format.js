if (process.argv.length < 5) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <patchdir> <fmtname>');
    process.exit (1);
}

var console = require ('console');
var util = require ('util');
var webtex = require (process.argv[2]);
var patchdir = process.argv[3];

var lb = webtex.LineBuffer.new_static (['\\input ' + process.argv[4]]);

webtex.Node.promise_engine ({
    jobname: process.argv[3],
    input_linebuf: lb,
    shiptarget: null,
    bundlepath: 'misc/minimal-bundle-tl2013.zip',
    //debug_input_lines: true,
    //debug_trace: true,
}).then (function (engine) {
    engine.iostack.push (new webtex.Node.FSIOLayer ('__wtpatches__/', patchdir));

    function iterate () {
	var rv = engine.step ();

	if (rv === true)
	    setImmediate (iterate);
	else if (rv === webtex.NeedMoreData)
	    setTimeout (iterate, 10);
	else {
	    // EOF: wrap up.
	    var state = engine.serialize ();
	    console.log (JSON.stringify (state, null, 4));
	}
    }

    iterate ();
}).catch (function (err) {
    console.log (err.stack);
});
