if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var WEBTEX = require (process.argv[2]).WEBTEX;

WEBTEX.Node.promise_engine (process.argv[3], process.argv[3], 'texbundles/default.zip')
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
