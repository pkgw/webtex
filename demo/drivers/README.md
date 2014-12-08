Webtex Demos
============

You can run a local copy of Webtex with these files. Because of the way that
the relevant technologies work, you need to access these files through a web
server even though they’re already on your computer. This can be done with a
temporary server on your machine, or by uploading to a real server on the
Internet.

**The demos that use the parser only work on Firefox right now**. This is
literally [issue #1](https://github.com/pkgw/webtex/issues/1) in Webtex right
now.


Local server with node.js
-------------------------

The easiest way to run a local Webtex copy is through
[node.js](http://nodejs.org/). If you need to, install Node through your
computer’s software manager or by [installing it
yourself](http://nodejs.org/download/). Then you should be able to start a
temporary local server with `node local-server.js &` in this directory. (This
command should print “listening on port 17395” and not give any error
messages.) You can then test out two versions of Webtex:

* Load up [http://localhost:17395/render-preparsed.html?brockton.json] to
  render a pre-parsed version of the “brockton” demo. If you get ahold of
  other pre-parsed `.json` files, you can view them by replacing the
  `brockton.json` part of that web address with something different as
  appropriate.

* Load up [http://localhost:17395/parse-and-render.html?brockton.zip] to parse
  the original LaTeX document stored in the `brockton.zip` archive and render
  it. This is *insanely* slow for several reasons, including the fact that the
  Webtex “bundle” is accessed over the internet in a super-slow way by
  default. This will be improved eventually. If you know what you’re doing,
  you can download a copy of this bundle and modify the
  `parse-and-render.html` file to use the local version. Webtex will then be
  merely excruciatingly slow.

* Take your favorite LaTeX document and its files and put them into a Zip file
  called `myfile.zip` in this directory, then load up
  [http://localhost:17395/parse-and-render.html?myfile.zip]. This will not
  only be insanely slow, it will probably not work, because Webtex still has
  many missing features.


Upload to the internet
----------------------

You can also upload these files to an internet web server and try the demos as
described above. If the files are accessible at `http://example.com/webtex/`,
you should load
`http://example.com/webtex/render-preparsed.html?brockton.json`, and so on.


More Information
================

See the [main Webtex site](http://pkgw.github.io/webtex/) for more
information. Webtex is licensed under a combination of open-source licenses;
see the headers in the included files and [the license
summary](https://github.com/pkgw/webtex/blob/master/LICENSE.md). The credits
for Webtex may be [found
here](https://github.com/pkgw/webtex/blob/master/CREDITS.md).
