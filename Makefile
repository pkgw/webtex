builddir = build
python = python
minify = java -jar yuicompressor-2.4.8.jar

sharedjs = \
  src/preamble.js \
  src/constants.js \
  src/types.js \
  src/util.js \
  src/token.js \
  src/ordsource.js \
  src/command.js \
  src/command-impls.js \
  $(builddir)/engine-helpers.js \
  src/engine.js

browserjs = \
  src/browser-api.js

nodejs = \
  src/node-io.js

all: \
  $(builddir)/browser-webtex.min.js \
  $(builddir)/node-webtex.min.js \
  $(builddir)/browser-autoload.min.js

$(builddir)/browser-webtex.js: \
generate.py src/browser-wrapper.js $(sharedjs) $(browserjs) \
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

$(builddir)/browser-autoload.min.js: src/browser-autoload.js | $(builddir)
	$(minify) $< >$@.new && mv -f $@.new $@

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

.PHONY: all clean test
