if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' debug <font.pfb>');
    process.exit (1);
}

var output_kind = process.argv[2];
var fontpath = process.argv[3];

var fs = require ('fs');
var util = require ('util');

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

function for_each_glyph (callback) {
    var delta = 2;

    for (var i = 2; i < rend.glyphs.length - 1; i++) {
	var lines = rend.getPathJsFromGlyphId (i).split ('\n');
	lines = lines.slice (3, -1); // skip boilerplate
	callback (i - delta, lines);
    }
}

if (output_kind == 'debug') {
    console.log ('var the_font = {');
    for_each_glyph (function (index, lines) {
	console.log (index + ': function (c) {');
	console.log (lines.join ('\n'));
	console.log ('},');
    });
    console.log ('};');
} else {
    console.error ('unrecognized output kind: ' + output_kind);
}
