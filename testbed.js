'use strict';

var targdiv = document.getElementById ('webtex');
var worker_url = 'build/browser-worker-webtex.js';
var inputurl = '../test/tex/latex-minimal.tex'; // note: relative to *worker's* URL

var dr = new Webtex.DOMRenderer (worker_url, targdiv);
dr.launch_parse ({
    jobname: 'plain',
    inputurl: inputurl,
    bundleurl: 'latest.zip', // note: relative to *worker's* URL
    dump_bpath: 'latex.dump.json',
    debug_trace: false,
    debug_input_lines: false,
});
