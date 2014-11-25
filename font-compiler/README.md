The font compiler
=================

(Explain why we have to do this.)


Reference point
---------------

I've copied many files from Mozilla's pdf.js. In our design, this code runs in
a node.js environment as the distribution is being prepared, rather than live
in the browser, which requires various non-trivial modifications to the files.
Hopefully I will not come to completely regret forking this off and
maintaining a bunch of patched files. Here's the key info, where "Commit" is
the most recent pdf.js commit affecting the version of the file that I've
synced. Each file has a new header describing the relevant modifications.

Filename		Last synced	Commit
==============================================
font_renderer.js	2014/11/24	2e97c0
fonts.js		2014/11/24	df2a4a
glyphlist.js		2014/11/24	4bda6b
parser.js		2014/11/24	2003d8
stream.js		2014/11/24	2d7a34
util.js			2014/11/24	ed5fc4
