if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var webtex = require (process.argv[2]);

webtex.Node.promise_engine ({
    jobname: process.argv[3],
    inputpath: process.argv[3],
    bundlepath: 'texbundles/default.zip',
    debug_input_lines: true,
    debug_trace: true,
}).then (function (engine) {
    function iterate () {
	var rv = engine.step ();

	if (rv === true)
	    setImmediate (iterate);
	else if (rv === webtex.NeedMoreData)
	    setTimeout (iterate, 10);
	// otherwise, EOF and we're done.
    }

    iterate ();
}).catch (function (err) {
    console.log (err.stack);
});
