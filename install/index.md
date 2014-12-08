---
title: Installation
---

Installation
============

You can install a copy of Webtex on your own machine and run it on your own
documents. **The current version has been developed only for the “brockton”
demo and will probably fail on any other documents**, but maybe you’ll get
lucky!

The parser also **only works on Firefox** for now (see [the associated bug
report](https://github.com/pkgw/webtex/issues/1)). We hope to fix this soon,
of course. In the meantime, it’s not too hard to [install
Firefox](http://getfirefox.com/)!


Instructions
------------

* First you have to install [node.js](http://nodejs.org/download/). Their
  [download page](http://nodejs.org/download/) has packages for every major
  operating system if you’re not sure how to get it installed.

* Download the [version 0.0.1 release of
  Webtex](https://github.com/pkgw/webtex/releases/download/v0.0.1/distrib-tl2013-20141208.zip)
  and unzip it somewhere on your machine.

* Start up a local webserver by running the command `node local-server.js &`
  in the unzipped Webtex directory. It should print the message `listening on
  port 17395`.

* Test functionality by visiting the address
  [http://localhost:17395/render-preparsed.html?brockton.json](http://localhost:17395/render-preparsed.html?brockton.json).
  This should pop up the “brockton” demo pretty quickly. [Unless you’re using
  Safari, sorry](https://github.com/pkgw/webtex/issues/2).

* For a more in-depth test, exercise the parser by visiting
  [http://localhost:17395/parse-and-render.html?brockton.zip](http://localhost:17395/parse-and-render.html?brockton.zip).
  This will take about 10 minutes to run due to some serious inefficiencies in
  the current design ([bug report](https://github.com/pkgw/webtex/issues/3)).
  You can monitor progress by opening up the Firefox developer console in the
  `Tools → Web Developer → Web Console` menu.

* If you’re feeling really adventurous, you can zip up your favorite document
  and figures into a file `myfile.zip` and drop it into the unzipped Webtex
  directory, then visit
  [http://localhost:17395/parse-and-render.html?myfile.zip](http://localhost:17395/parse-and-render.html?myfile.zip).
  This will almost surely encounter an error since the preview release is only
  tested on “brockton”. The error will only be shown on the Web Console since
  that feature isn’t ready yet either ([bug
  report](https://github.com/pkgw/webtex/issues/4)).

* If you’re so adventurous and resourceful that you try compiling your own
  document and run into an error that you want to fix … well, first of all,
  wow! Second, you’ll need to [fork the code](https://github.com/pkgw/webtex)
  so that you can rebuild the distributed files and develop a solution.
