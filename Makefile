# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT license. See LICENSE.md for details.

builddir = build
python = python
texdist = tl2013
pdfjsversion = 1.0.712
yuiversion = 2.4.8

default: all

# The engine implementations: Web Worker and Node.js backends

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
  src/bundle.js

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
  $(builddir)/engine-helpers.js \
  src/engine.js \
  src/html-translate-target.js

workerjs = \
  src/worker-io.js \
  src/worker-api.js

nodejs = \
  src/node-io.js \
  src/node-api.js


$(builddir)/worker-webtex.js: \
generate.py src/worker-wrapper.js $(sharedjs) $(workerjs) \
| $(builddir)
	$(python) $^ $@

$(builddir)/node-webtex.js: \
generate.py src/node-wrapper.js $(preamble) $(sharedjs) $(nodejs) \
| $(builddir)
	$(python) $^ $@

$(builddir)/%-helpers.js: \
generate.py src/%-helpers-tmpl.js $(genlists) \
| $(builddir)
	$(python) $< src/$*-helpers-tmpl.js $@

primaries += $(builddir)/worker-webtex.js $(builddir)/node-webtex.js


# The browser master, which drives the Web Worker engine and renders the
# output into the DOM.

masterjs = \
  src/preamble.js \
  src/format.js \
  src/master-object.js \
  $(builddir)/master-glyph-helper.js \
  src/type1-font.js \
  src/dom-renderer.js


$(builddir)/browser-master-webtex.js: \
generate.py src/browser-master-wrapper.js $(masterjs) \
| $(builddir)
	$(python) $^ $@

primaries += $(builddir)/browser-master-webtex.js

$(builddir)/master-glyph-helper.js: \
generate.py src/master-glyph-helper-tmpl.js $(builddir)/glyph-encoding.json \
| $(builddir)
	$(python) $^ $@


# Generating the "bundle" Zip file. TODO: Feeling indecisive about the naming
# scheme and whatnot.

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

$(builddir)/latest.zip $(builddir)/glyph-encoding.json: \
make-tex-bundle.py packages.txt mapfiles.txt $(bundleextras) \
| $(builddir)
	$(python) $< packages.txt mapfiles.txt texcache $(builddir) texpatches $(bundleextras)


# Our internal copy of PDF.js. TODO: figure out if we can avoid bundling this
# or what.

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


# A distribution. This is a zip file of everything that you need to upload to
# a server to enable a site with Webtex parsing and display. This kind of rule
# is where Make reeeeallly gets limited.

$(builddir)/distrib.zip: \
$(builddir)/worker-webtex.js \
$(builddir)/browser-master-webtex.js \
$(pdfjs_unzip_stamp) \
$(builddir)/latest.zip \
Makefile \
| $(builddir)
	@w=`mktemp -d $(builddir)/distrib.XXXXXXXX`; \
	dstem=distrib-$(texdist)-`date +%Y%m%d`.zip ; \
	rm -f $(builddir)/$$dstem $@ ; \
	cp $(builddir)/worker-webtex.js $(builddir)/browser-master-webtex.js \
	   chrome/* $(builddir)/pdfjs/build/pdf*.js \
	   $(builddir)/pdfjs/web/compatibility.js $$w ; \
	cp build/latest.zip $$w/bundle.zip ; \
	(cd $$w && zip ../$$dstem *) ; \
	(cd $(builddir) && ln -s $$dstem `basename $@`) ; \
	rm -rf $$w ; \
	echo Created $(builddir)/$$dstem

distrib: $(builddir)/distrib.zip


# Files for the demos in the release

$(builddir)/brockton.zip: \
| $(builddir)
	zip -j $@ demo/brockton/*

$(builddir)/brockton.json: \
webtex \
$(builddir)/node-webtex.js \
| $(builddir)
	./webtex -n3 -T chrome demo/brockton/paper.tex >$@.new && mv -f $@.new $@

# Minifying. Not something I've explored much so far.

minify = java -jar build/yuicompressor-$(yuiversion).jar

$(builddir)/yuicompressor-$(yuiversion).jar: \
| $(builddir)
	curl -L https://github.com/yui/yuicompressor/releases/download/v$(yuiversion)/yuicompressor-$(yuiversion).jar >$@

%.min.js: %.js build/yuicompressor-$(yuiversion).jar
	$(minify) $< >$@.new && mv -f $@.new $@


# Testing
#
# TODO: :-(

test:
	@echo I am a bad person and there are no tests.


# Utility

server:
	node misc/testing-server.js &


# Generic helpers

all: $(primaries)

$(builddir):
	mkdir -p $(builddir)

clean:
	-rm -rf $(builddir)

.PHONY: all clean default distrib server test
