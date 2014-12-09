# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT license. See LICENSE.md for details.

builddir = build
python = python
texdist = tl2013
pdfjsversion = 1.0.712
yuiversion = 2.4.8

default: all


# Source files for the main JavaScript apps.

genlists = \
  commands.txt \
  namedparams.txt

# Non-TeX-specific low-level utilities
sharedjs = \
  src/preamble.js \
  src/format.js \
  src/inflate.js \
  src/jsonparse.js \
  src/zipreader.js

# Basic classes, constants
sharedjs += \
  src/constants.js \
  src/str-utils.js \
  src/numerics.js \
  src/base-classes.js \
  src/values.js \
  src/valrefs.js \
  src/token.js

# I/O infrastructure
sharedjs += \
  src/linebuffer.js \
  src/ordsource.js \
  src/inputstack.js \
  src/iostack.js \
  src/bundle.js \
  src/document-archive.js

# High-level features
sharedjs += \
  src/modes.js \
  src/registers.js \
  src/parameters.js \
  src/conditionals.js \
  src/fonts.js \
  src/listables.js \
  src/boxes.js \
  src/paragraphs.js \
  src/inserts.js \
  src/math.js \
  src/align.js \
  src/page-builder.js \
  src/command-classes.js \
  src/command-impls.js \
  $(builddir)/intermediates/engine-helpers.js \
  src/engine.js \
  src/ship-target.js \
  src/html-translate-target.js

$(builddir)/intermediates/%-helpers.js: \
generate.py src/%-helpers-tmpl.js $(genlists) \
| $(builddir)/intermediates
	$(python) $< src/$*-helpers-tmpl.js $@


# The first version of Webtex that we build is the Node.js version. We require
# this to create the ".dump.json" files that will go into the bundle.

nodejs = \
  src/node-io.js \
  src/node-api.js

$(builddir)/node-webtex.js: \
generate.py src/node-wrapper.js $(preamble) $(sharedjs) $(nodejs) \
| $(builddir)/intermediates
	$(python) $^ $@

primaries += $(builddir)/node-webtex.js


# Here we build the bundle and those .dump.json files that it requires. TODO:
# Feeling dissatisfied with the naming scheme.

bundleextras = \
  $(builddir)/latex.dump.json

$(builddir)/latex.dump.json: \
dump-format.js $(builddir)/node-webtex.js texpatches/$(texdist)/latex.ltx.post \
| $(builddir)
	node $< $(builddir)/node-webtex.js texpatches/$(texdist)/ latex.ltx $@

$(builddir)/plain.dump.json: \
dump-format.js $(builddir)/node-webtex.js \
| $(builddir)
	node $< $(builddir)/node-webtex.js texpatches/$(texdist)/ plain.tex $@

$(builddir)/newest-bundle.zip $(builddir)/glyph-encoding.json: \
make-tex-bundle.py packages.txt mapfiles.txt $(bundleextras) \
| $(builddir)
	$(python) $< packages.txt mapfiles.txt texcache $(builddir) texpatches $(bundleextras)


# Next up is the "worker" version of Webtex, which is meant to be run inside a
# browser as a Web Worker thread. This and the Node.js version are 99% the
# same, just with different I/O backends (local files vs. web requests) and
# exposing their APIs in different ways.

workerjs = \
  src/worker-io.js \
  src/worker-api.js

$(builddir)/worker-webtex.js: \
generate.py src/worker-wrapper.js $(sharedjs) $(workerjs) \
| $(builddir)
	$(python) $^ $@

primaries += $(builddir)/worker-webtex.js


# The browser master, which drives the Web Worker engine and renders the
# output into the DOM. This can only be built after the bundle, because the
# master file embeds the list of glyph identifiers, which is generated as font
# files in the bundle are processed. The master does *not* include all of the
# code for the TeX engine; it only has code to display the intermediate
# ("chrome") data format generated by the worker.

masterjs = \
  src/preamble.js \
  src/format.js \
  src/master-object.js \
  $(builddir)/intermediates/master-glyph-helper.js \
  src/type1-font.js \
  src/dom-renderer.js

$(builddir)/browser-master-webtex.js: \
generate.py src/browser-master-wrapper.js $(masterjs) \
| $(builddir)
	$(python) $^ $@

primaries += $(builddir)/browser-master-webtex.js

$(builddir)/intermediates/master-glyph-helper.js: \
generate.py src/master-glyph-helper-tmpl.js $(builddir)/glyph-encoding.json \
| $(builddir)/intermediates
	$(python) $^ $@


# We use an internal copy of PDF.js to render PDF figures. These rules
# download and unpack it.

pdfjs_unzip_stamp = $(builddir)/pdfjs/build/pdf.js

$(builddir)/pdfjs-$(pdfjsversion)-dist.zip: \
| $(builddir)
	curl -L https://github.com/mozilla/pdf.js/releases/download/v$(pdfjsversion)/pdfjs-$(pdfjsversion)-dist.zip >$@

$(pdfjs_unzip_stamp): \
$(builddir)/pdfjs-$(pdfjsversion)-dist.zip \
| $(builddir)
	rm -rf $(builddir)/pdfjs
	mkdir -p $(builddir)/pdfjs
	cd $(builddir)/pdfjs && unzip -q -DD ../pdfjs-$(pdfjsversion)-dist.zip

primaries += $(pdfjs_unzip_stamp)


# These rules produce demo files for the installable distribution.

$(builddir)/brockton.zip: \
| $(builddir)
	zip -j $@ demo/brockton/*

$(builddir)/brockton.json: \
webtex \
$(builddir)/node-webtex.js \
| $(builddir)
	./webtex -n3 -T chrome demo/brockton/paper.tex >$@.new && mv -f $@.new $@

$(builddir)/%.html: \
demo/drivers/%.html.in \
$(builddir)/newest-bundle.zip \
| $(builddir)
	sed -e "s/@BUNDLE@/`readlink $(builddir)/newest-bundle.zip`/g" $< >$@.new \
	 && mv -f $@.new $@


# Finally, the rule to generate an installable distribution. You can unzip
# this and run your own copy of Webtex, either on a local machine with a
# localhost HTTP server, or by copying to your own server. The demo files
# reference a bundle on webtex.newton.cx rather than including their own copy.

$(builddir)/distrib.zip: \
$(builddir)/worker-webtex.js \
$(builddir)/browser-master-webtex.js \
$(pdfjs_unzip_stamp) \
$(builddir)/brockton.zip \
$(builddir)/brockton.json \
demo/drivers/local-server.js \
$(builddir)/render-preparsed.html \
$(builddir)/parse-and-render.html \
Makefile \
| $(builddir)
	@w=`mktemp -d $(builddir)/distrib.XXXXXXXX`; \
	dstem=distrib-$(texdist)-`date +%Y%m%d`.zip ; \
	rm -f $(builddir)/$$dstem $@ ; \
	cp $(builddir)/worker-webtex.js $(builddir)/browser-master-webtex.js \
	   $(builddir)/pdfjs/build/pdf*.js $(builddir)/pdfjs/web/compatibility.js \
	   $(builddir)/brockton.zip $(builddir)/brockton.json \
	   $(builddir)/render-preparsed.html $(builddir)/parse-and-render.html \
	   demo/drivers/local-server.js demo/drivers/README.md $$w ; \
	(cd $$w && zip ../$$dstem *) ; \
	(cd $(builddir) && ln -s $$dstem `basename $@`) ; \
	rm -rf $$w ; \
	echo Created $(builddir)/$$dstem

distrib: $(builddir)/distrib.zip


# Minifying. Not something I've explored much so far.

minify = java -jar build/yuicompressor-$(yuiversion).jar

$(builddir)/yuicompressor-$(yuiversion).jar: \
| $(builddir)
	curl -L https://github.com/yui/yuicompressor/releases/download/v$(yuiversion)/yuicompressor-$(yuiversion).jar >$@

%.min.js: %.js build/yuicompressor-$(yuiversion).jar
	$(minify) $< >$@.new && mv -f $@.new $@


# Testing. TODO: :-(

test:
	@echo I am a bad person and there are no tests.


# Utility

server:
	node misc/testing-server.js &


# Generic helpers

all: $(primaries)

$(builddir):
	mkdir -p $@

$(builddir)/intermediates:
	mkdir -p $@

clean:
	-rm -rf $(builddir)

.PHONY: all clean default distrib server test
