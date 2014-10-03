var console = require ('console');
var util = require ('util');

if (process.argv.length < 5) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <patchdir> <fmtname>');
    process.exit (1);
}

var webtex = require (process.argv[2]);
var patchdir = process.argv[3];
var fmtname = process.argv[4];

// The way we set up initial_linebuf allows us to trigger patching of the
// format file.

var eng = webtex.setup_process_format ({
    jobname: fmtname,
    initial_linebuf: webtex.LineBuffer.new_static (['\\input ' + fmtname]),
    bundlepath: 'misc/minimal-bundle-tl2013.zip',
    debug_trace: false,
    debug_input_lines: false,
});

eng.iostack.push (new webtex.Node.FSIOLayer ('__wtpatches__/', patchdir));

while (eng.step () === true) {
}

var state = eng.serialize ();
console.log (JSON.stringify (state, null, 4));
