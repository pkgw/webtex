if (process.argv.length < 5) {
    console.log ('usage: node ' + process.argv[1] + ' <glyph-enc.json> debug <font.pfb>');
    process.exit (1);
}

var glyphpath = process.argv[2];
var output_kind = process.argv[3];
var fontpath = process.argv[4];

var fs = require ('fs');
var util = require ('util');

var fonts = require ('./fonts.js');
var rend = require ('./font_renderer.js');
var stream = require ('./stream.js');


// Load the information for encoding glyphs

var jdata = fs.readFileSync (glyphpath);
var glyphenc = JSON.parse (jdata);
var glyph_name_to_id = {};

for (var i = 0; i < glyphenc.names.length; i++)
    glyph_name_to_id[glyphenc.names[i]] = i;


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

var thefont = new fonts.Type1Font (fontpath, fontdata, props);
console.log ('CSL:' + thefont.charstrings.length);
//console.log (util.inspect (thefont.charstrings));

function compile (charstring) {
    var js = [];
    rend.FontRendererFactory.compileCharString (charstring, js, thefont)
    return js;
}

function for_each_glyph (callback) {
    for (var i = 0; i < thefont.charstrings.length; i++) {
	var gname = thefont.charstrings[i].glyphName;
	if (gname == '.notdef')
	    continue;

	var gid = glyph_name_to_id[gname];
	if (typeof gid !== 'number')
	    throw new Error ('no registered ID number for glyph name ' + gname);

	callback (gname, gid, compile (thefont.charstrings[i].charstring));
    }
}

if (output_kind == 'debug') {
    console.log ('var the_font = {');
    for_each_glyph (function (gname, gid, lines) {
	console.log (gid + ': function (c) { // ' + gname);
	console.log (lines.join ('\n'));
	console.log ('},');
    });
    console.log ('};');
} else {
    console.error ('unrecognized output kind: ' + output_kind);
}
