// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

var console = require ('console');
var fs = require ('fs');
var path = require ('path');
var util = require ('util');

if (process.argv.length < 6) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <patchdir> <fmtname> <outpath>');
    process.exit (1);
}

var webtex = require (path.resolve (process.argv[2]));
var patchdir = process.argv[3];
var fmtname = process.argv[4];
var outpath = process.argv[5];

// The way we set up initial_linebuf allows us to trigger patching of the
// format file.

var eng = webtex.setup_process_format ({
    jobname: fmtname,
    initial_linebuf: webtex.LineBuffer.new_static (['\\input ' + fmtname]),
    bundlepath: 'data/minimal-bundle-tl2013.zip',
    debug_trace: false,
    debug_input_lines: false,
    fontdata: {
	font2enc: {},
	encinfo: {},
    },
});

eng.iostack.push (new webtex.FSIOLayer ('__wtpatches__/', patchdir));

while (eng.step () === true) {
}

// I used to just print the format JSON to stdout, but that was fragile
// because the JSON output would break whenever I inserted any debugging
// logging that got triggered.

var state = eng.serialize ();
fs.writeFileSync (outpath, JSON.stringify (state, null, 4), {
    encoding: 'utf8',
    flag: 'w',
});
