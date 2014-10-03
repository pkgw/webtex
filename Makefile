builddir = build
python = python
minify = java -jar yuicompressor-2.4.8.jar
texdist = tl2013

sharedjs = \
  src/inflate.js \
  src/jsonparse.js \
  src/preamble.js \
  src/constants.js \
  src/values.js \
  src/boxes.js \
  src/math.js \
  src/align.js \
  src/valrefs.js \
  src/util.js \
  src/token.js \
  src/linebuffer.js \
  src/ordsource.js \
  src/inputstack.js \
  src/iostack.js \
  src/command-classes.js \
  src/command-impls.js \
  $(builddir)/engine-helpers.js \
  src/engine.js \
  src/readzip.js \
  src/tfmreader.js \
  src/bundle.js

browserprejs = \
  src/promise-0.1.1.js \
  src/network.js \
  src/emulate-setimmediate.js

browserworkerjs = \
  src/html-render-target.js \
  src/worker-io.js \
  src/worker-api.js

browsermasterjs = \
  src/master-api.js

nodejs = \
  src/node-io.js \
  src/node-api.js

bundleextras = \
  $(builddir)/latex.dump.json

standard: \
  $(builddir)/browser-master-webtex.js \
  $(builddir)/browser-worker-webtex.js \
  $(builddir)/node-webtex.js

minified: \
  $(builddir)/browser-master-webtex.min.js \
  $(builddir)/browser-worker-webtex.min.js \
  $(builddir)/node-webtex.min.js

$(builddir)/browser-master-webtex.js: \
generate.py src/browser-master-wrapper.js $(browserprejs) $(sharedjs) $(browsermasterjs) \
| $(builddir)
	$(python) $^ $@

$(builddir)/browser-worker-webtex.js: \
generate.py src/worker-wrapper.js $(browserprejs) $(sharedjs) $(browserworkerjs) \
| $(builddir)
	$(python) $^ $@

$(builddir)/node-webtex.js: \
generate.py src/node-wrapper.js $(sharedjs) $(nodejs) \
| $(builddir)
	$(python) $^ $@

$(builddir)/%-helpers.js: \
generate.py src/%-helpers-tmpl.js \
| $(builddir)
	$(python) $^ $@

# We can't use $^ in the following rule because it converts "./build/..." to
# "build/...", which breaks Node.js's explicit-module-path system.
$(builddir)/latex.dump.json: \
dump-format.js $(builddir)/node-webtex.min.js \
| $(builddir)
	node $< ./$(builddir)/node-webtex.min.js texpatches/$(texdist)/ \
	  latex.ltx >$@.new && mv -f $@.new $@

$(builddir)/plain.dump.json: \
dump-format.js $(builddir)/node-webtex.min.js \
| $(builddir)
	node $< ./$(builddir)/node-webtex.min.js texpatches/$(texdist)/ \
	  plain.tex >$@.new && mv -f $@.new $@

$(builddir)/latest.zip: \
make-tex-bundle.py packages.txt $(bundleextras) \
| $(builddir)
	$(python) $< packages.txt texcache $(builddir) texpatches $(bundleextras)


%.min.js: %.js
	$(minify) $< >$@.new && mv -f $@.new $@

$(builddir):
	mkdir -p $(builddir)

clean:
	-rm -rf $(builddir)

test: $(builddir)/node-webtex.min.js
	@cd test && ./run-all-tests.sh ../$<

fattest: $(builddir)/node-webtex.js # actually debuggable
	@cd test && ./run-all-tests.sh ../$<

.PHONY: all clean fattest standard minified test
