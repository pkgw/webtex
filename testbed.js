'use strict';

var targdiv = document.getElementById ('webtex');

var bundleurl = 'latest.zip'; // note: relative to *worker's* URL
var inputurl = '../test/tex/latex-minimal.tex'; // ditto
var dump_bpath = 'latex.dump.json';
var worker_url = 'build/worker-webtex.js';
var debug_trace = true;
var debug_input_lines = true;

WEBTEX.Web.test (worker_url, 'test', {
    jobname: 'plain',
    inputurl: inputurl,
    bundleurl: bundleurl,
    dump_bpath: dump_bpath,
    debug_trace: debug_trace,
    debug_input_lines: debug_input_lines,
});
