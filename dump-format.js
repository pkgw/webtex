var console = require ('console');
var util = require ('util');

if (process.argv.length < 5) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <patchdir> <fmtname>');
    process.exit (1);
}

var webtex = require (process.argv[2]);

var patchdir = process.argv[3];
var lb = webtex.LineBuffer.new_static (['\\input ' + process.argv[4]]);
var bundlepath = 'misc/minimal-bundle-tl2013.zip';
var debug_trace = false;
var debug_input_lines = false;

var eng = WEBTEX.setup_process_format ({
    jobname: process.argv[4],
    initial_linebuf: lb,
    bundlepath: bundlepath,
    debug_trace: debug_trace,
    debug_input_lines: debug_input_lines,
});

eng.iostack.push (new webtex.Node.FSIOLayer ('__wtpatches__/', patchdir));

while (eng.step () === true) {
}

var state = eng.serialize ();
console.log (JSON.stringify (state, null, 4));
