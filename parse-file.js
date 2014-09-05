if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var webtex = require (process.argv[2]);

webtex.Node.promise_engine ({
    jobname: process.argv[3],
    inputpath: process.argv[3],
    bundlepath: 'build/latest.zip',
    debug_input_lines: true,
    debug_trace: true,
}).then (function (engine) {
    function iterate () {
	try {
	    var rv = engine.step ();
	} catch (e) {
	    console.warn ('--- error encountered ---');
	    // The temporary variables make it so any input line logging that
	    // happens when we peek at the upcoming tokens is separated nicely
	    // from the recent/upcoming report instead of interleaved.
	    var recent = engine.inputstack.describe_recent ();
	    var upcoming = engine.inputstack.describe_upcoming ();
	    console.warn (recent);
	    console.warn (upcoming);
	    throw e;
	}

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
