if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <fmtname>');
    process.exit (1);
}

var console = require ('console');
var util = require ('util');
var webtex = require (process.argv[2]);

var lb = webtex.LineBuffer.new_static (['\\input ' + process.argv[3]]);

webtex.Node.promise_engine ({
    jobname: process.argv[3],
    input_linebuf: lb,
    shiptarget: null,
    bundlepath: 'misc/minimal-bundle-tl2013.zip',
    //debug_input_lines: true,
    //debug_trace: true,
}).then (function (engine) {
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
