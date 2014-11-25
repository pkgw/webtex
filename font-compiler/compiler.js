if (process.argv.length < 3) {
    console.log ('usage: node ' + process.argv[1] + ' <font.pfb>');
    process.exit (1);
}

var fontpath = process.argv[2];

var fs = require ('fs');
var fonts = require ('./fonts.js');
var stream = require ('./stream.js');

// Load the font data.

function make_file_stream (path) {
    // note: clone of src/node-io.js
    var data = fs.readFileSync (path);
    var ab = new ArrayBuffer (data.length);
    var view = new Uint8Array (ab);

    for (var i = 0; i < data.length; i++)
	view[i] = data[i];

    return new stream.Stream (ab, 0, data.length, {});
}

var fontdata = make_file_stream (fontpath);

var props = {
    loadedName: fontpath,
    type: 'Type1',
    differences: [],
    defaultEncoding: [],
    bbox: [0, 0, 1, 1], // Seems to be needed, but doesn't matter for us
};

var thefont = new fonts.Font (fontpath, fontdata, props);
var rend = thefont.renderer;
