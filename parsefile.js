if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var WEBTEX = require (process.argv[2]).WEBTEX;

var f = new WEBTEX.Node.RandomAccessFile ('texbundles/default.zip');
var z = new WEBTEX.ZipReader (f.read_range.bind (f), f.size ());
var bundle = new WEBTEX.Bundle (z);

var linebuf = WEBTEX.Node.make_fs_linebuffer (process.argv[3]);
var ordsrc = new WEBTEX.OrdSource (linebuf, null);
var engine = new WEBTEX.Engine (process.argv[3], ordsrc, bundle);

function iterate () {
    var rv = engine.step ();

    if (rv === true)
	setImmediate (iterate);
    else if (rv === WEBTEX.NeedMoreData)
	setTimeout (iterate, 10);
    // otherwise, EOF and we're done.
}

iterate ();
