builddir = build
python = python
minify = java -jar yuicompressor-2.4.8.jar

sharedjs = \
  src/preamble.js \
  src/constants.js \
  src/engine.js

nodejs = \
  src/node-io.js

all: $(builddir)/browser-webtex.min.js $(builddir)/node-webtex.min.js

$(builddir)/browser-webtex.js: generate.py src/browser-wrapper.js $(sharedjs) \
| $(builddir)
	$(python) $^ $@

$(builddir)/node-webtex.js: generate.py src/node-wrapper.js $(sharedjs) $(nodejs) \
| $(builddir)
	$(python) $^ $@

%.min.js: %.js
	$(minify) $< >$@.new && mv -f $@.new $@

$(builddir):
	mkdir -p $(builddir)

clean:
	-rm -rf $(builddir)

.PHONY: all clean
