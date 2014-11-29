webtex
======

An essentially-complete LaTeX engine in JavaScript, rendered in your browser.
Revolutionizing scientific communication since 2014.

Requirements
------------

* node.js
* `curl`
* Python version 2.7
* the Node.js `yargs` module, for the `webtex` console program (optional)
* Java, for minification with YUI Compressor (optional)

The font compiler
-----------------

For reasons that you don't even want to know, we compile TeX's fonts to
snippets of JavaScript. This is done using large amounts of code copied from
Mozilla's pdf.js, which is licensed under the Apache License, Version 2.0. See
font-compiler/README.md for more details.
