if (process.argv.length < 5) {
    console.log ('usage: node ' + process.argv[1] + ' <webtex.js> <dumpfile> <filename>');
    process.exit (1);
}

var webtex = require (process.argv[2]);

var dumppath = process.argv[3];
var inputpath = process.argv[4];

var eng = webtex.setup_process_basic ({
    jobname: inputpath,
    inputpath: inputpath,
    dumppath: dumppath,
    bundlepath: 'build/latest.zip',
    debug_trace: false,
    debug_input_lines: true,
    shiptarget: new webtex.ConsoleFlatDumpTarget (),
});

while (eng.step () === true) {
}
