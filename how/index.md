---
title: How It Works
---

How It Works
============

There are pretty much two goals to Webtex. The first is that you should be
able to compile complete LaTeX documents inside your browser, on the fly. The
other is that when you compile scientific articles, the result should be as
beautiful and readable and as screen-native as it can possibly be.

The whole motivation for Webtex is that good on-screen design and good print
design vary greatly. Therefore, we can’t just mimic the low-level TeX outputs:
“Draw this text with in a 12-point bold font”. Instead, the job of the Webtex
engine is to extract the *semantics* of a document: “This span of text is the
document title; start a new paragraph here.” Fortunately, both LaTeX and HTML5
follow exactly this philosophy! People will do all sorts of low-level hacks to
make things work on the printed page, but the hope is 99% of the time, you can
ignore them and the results make sense. Meanwhile, HTML5 has tags like
[`<figcaption>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/figcaption)
and
[`<aside>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside)
that similarly work on a semantic level. Making things look beautiful on the
screen is then a matter of careful Web design, which is, of course, [pretty
much totally
easy](https://medium.com/designing-medium/crafting-link-underlines-on-medium-7c03a9274f9).

The whole reason that this is a feasible project is that the design of
scientific papers is *very constrained*. For instance, look at [these amazing
examples of modern TeX
design](http://tex.stackexchange.com/questions/1319/showcase-of-beautiful-typography-done-in-tex-friends).
There’s no we we can build a generic system to turn all of these into HTML!
But scientific articles are pretty much all the same: Title. Abstract.
Sectioning. Footnotes. Figures. References. Tables. Equations. *Sometimes*
enumerated lists. There is a very finite set of features that we need to
support, which makes Webtex a tractable project.


The bundle
----------

The Webtex vision means that we need to embed a full LaTeX stack in the
browser JavaScript in some way, and that you can’t rely on things like `.aux`
files on disk for LaTeX’s multi-pass processing.

A standard LaTeX installation consists of thousands of support files. Webtex
stores them all in a “bundle”, which is just a single big Zip file. ([Here’s
the current deployed bundle](http://webtex.newton.cx/latest/latest.zip).) The
bundle is based on the [TeX Live 2013](https://www.tug.org/texlive/)
distribution, built by the [TeX user
groups](https://www.tug.org/usergroups.html). These distributions literally
*are* built by a cast of thousands and anyone who uses LaTeX today owes them a
debt of gratitude.


The patches
-----------

Along with the standard LaTeX files that come with TeX Live 2013, Webtex
includes [a series of patch
files](https://github.com/pkgw/webtex/tree/master/texpatches/tl2013). These
monkey with LaTeX’s internals to, essentially, translate LaTeX’s semantic
model to HTML’s. A typical operation is to add markers saying that a certain
span of text should be wrapped in HTML `<h1>` tags indicating that that text
is, in fact, the title of the document.

You could imagine a lot of different approaches to pulling out this
information, but this seems like the most robust to me. The core parts of
LaTeX evolve slowly enough that these patches shouldn’t need many, if any,
changes as new TeX Live releases come out, and it’s going to be a long long
time before any LaTeX authors are interested in patches to add built-in Webtex
support.


The canvas
----------

A modern browser can handle pretty much all aspects of layout needed for
scientific articles. Modern text renderers can do detailed kerning and
auto-hyphenation, which used to be some of TeX’s main claims to fame. (Don’t
fully justify your text unless you can auto-hyphenate!) But there’s one big
obvious example of what browsers still can’t do well: math.

Of course, there are tons of projects aimed at getting math to render well in
browsers: [MathJax](http://www.mathjax.org/),
[MathML](http://www.w3.org/Math/), and [KaTeX](https://khan.github.io/KaTeX/),
to name a few. These projects have generally pulled out the basic philosophy
of LaTeX math layout and implemented it, without implementing the rest of
LaTeX.

But the goal of Webtex is to render complete LaTeX documents, so we’ve already
got the full LaTeX engine ready to parse math. It wouldn’t make any sense to
then un-parse this into one of these other systems. Because the positioning of
characters and fonts gets *very* finicky (I’ve already encountered an issue
where things didn’t look right beause something was misplaced by ⅓ of a
pixel), in the case of math we do that low-level mimicry that I said before we
avoided (“Draw this text with in a 12-point bold font”). This is done with an
HTML5
[`<canvas>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas)
element, which is more than capable enough for the job.


The chrome
----------

Finally, good modern design for the Web consists not only of an HTML page, but
also [CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) style sheets and,
pretty much inevitably,
[JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) code
that glues things together and creates dynamic effects. This “chrome” is
integral to achieving the goals of Webtex: outputing a series of HTML tags is
*not* sufficient.

The Webtex chrome is currently the least-polished part of the system, but is
also the easiest to improve in some ways. The modern tech industry spends
billions of dollars a year on making polished websites happen. Not trying
brag, look at how nice this site looks — I put it together in two days using
[Bootstrap](http://getbootstrap.com/) and [Jekyll](http://jekyllrb.com/)! Pros
could do better, but I think the results are pretty good for an amateur.

That being said, the chrome can get non-trivial. Here’s a simple test case:
modern LaTeX documents have PDF figures, so you simply can’t do Webtex without
having some kind of PDF renderer that runs purely in the browser. Which is
nuts: the [PDF
Specification](https://wwwimages2.adobe.com/content/dam/Adobe/en/devnet/pdf/pdfs/pdf_reference_1-7.pdf)
is 1310 pages long. I’ve had ideas related to Webtex for years, but for
reasons like this, it seemed like it just wasn’t possible technologically.

Then in 2012 [Mozilla](http://mozilla.org/) came out with
[pdf.js](http://mozilla.github.io/pdf.js/), which is, in fact, a PDF renderer
that runs purely in the browser. And if you can do *that* in JavaScript,
implementing the TeX engine is pretty much a piece of cake. Webtex in fact
bundles a copy of pdf.js, and I’d like to thank the Mozilla team for inspiring
me to undertake this project.
