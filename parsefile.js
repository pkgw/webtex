if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var WEBTEX = require (process.argv[2]).WEBTEX;

var linesrc = new WEBTEX.Node.FSLineSource (process.argv[3]);
var ordsrc = new WEBTEX.OrdSource (linesrc, null);
var engine = new WEBTEX.Engine (process.argv[3], ordsrc);

function iterate () {
    if (engine.step ())
	setImmediate (iterate);
}

iterate ();
