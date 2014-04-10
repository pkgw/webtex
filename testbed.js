if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var WEBTEX = require (process.argv[2]).WEBTEX;
var e = new WEBTEX.Engine ('awesomejob');
console.log ('test: ' + e.eqtbs[0].catcode (0));
console.log ('huzzah: ' + process.argv[3]);

