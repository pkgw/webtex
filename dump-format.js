if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var console = require ('console');
var util = require ('util');
var webtex = require (process.argv[2]);

webtex.Node.promise_engine ({
    jobname: process.argv[3],
    inputpath: process.argv[3],
    bundlepath: 'texbundles/default.zip',
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
