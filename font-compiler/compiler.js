if (process.argv.length < 3) {
    console.log ('usage: node ' + process.argv[1] + ' <font.pfb>');
    process.exit (1);
}

var fontpath = process.argv[2];

var fonts = require ('./fonts.js');
