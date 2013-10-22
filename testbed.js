if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var WEBTEX = require (process.argv[2]).WEBTEX;

console.log ('huzzah: ' + process.argv[3]);

