if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var WEBTEX = require (process.argv[2]).WEBTEX;

var engine = new WEBTEX.Engine ('jobname');
WEBTEX.Node.readFileLines (process.argv[3],
			   {encoding: 'ascii'},
			   engine.onLineReceived);
