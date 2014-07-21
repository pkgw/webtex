var console = require ('console');
var util = require ('util');

if (process.argv.length < 5) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <dumpfile> <filename>');
    process.exit (1);
}

var webtex = require (process.argv[2]);

var pjson = webtex.Node.promise_fs_json (process.argv[3]);
var pengine = webtex.Node.promise_engine ({
    jobname: process.argv[4],
    inputpath: process.argv[4],
    bundlepath: 'texbundles/default.zip',
    debug_input_lines: true,
    debug_trace: true,
});

webtex.Promise.all ([pjson, pengine]).then (function (stuff) {
    var json = stuff[0];
    var engine = stuff[1];

    engine.restore_serialized_state (json);

    function iterate () {
        var rv = engine.step ();

        if (rv === true)
            setImmediate (iterate);
        else if (rv === webtex.NeedMoreData)
            setTimeout (iterate, 10);
        else {
	    /* EOF. Nothing special to do here. */
        }
    }

    iterate ();
}).catch (function (err) {
    console.log (err.stack);
});
