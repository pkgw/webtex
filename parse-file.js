var console = require ('console');
var util = require ('util');

if (process.argv.length < 4) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <filename>');
    process.exit (1);
}

var webtex = require (process.argv[2]);

var inputpath = process.argv[3];
var bundlepath = 'build/latest.zip';
var debug_trace = true;
var debug_input_lines = true;

WEBTEX.test_drive_node ({
    jobname: inputpath,
    inputpath: inputpath,
    bundlepath: bundlepath,
    debug_trace: debug_trace,
    debug_input_lines: debug_input_lines,
    //shiptarget: new webtex.Node.ConsoleDumpTarget (),
});
