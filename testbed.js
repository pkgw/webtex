'use strict';

var targdiv = document.getElementById ('webtex');

//var bundleurl = 'latest.zip'; // note: relative to *worker's* URL
var bundleurl = '../packages.txt'; // XXX tmp
var inputurl = '../test/tex/latex-minimal.tex'; // ditto
var dump_bpath = 'latex.dump.json';
var worker_url = 'build/worker-webtex.js';

WEBTEX.Web.test (worker_url, 'test', {
    jobname: 'plain',
    inputurl: inputurl,
    bundleurl: bundleurl,
    dump_bpath: dump_bpath,
});
