builddir = build
python = python

jscomponents = \
  src/preamble.js

all: $(builddir)/browser-webtex.js $(builddir)/node-webtex.js

$(builddir)/browser-webtex.js: generate.py src/browser-wrapper.js $(jscomponents) \
| $(builddir)
	$(python) $^ $@

$(builddir)/node-webtex.js: generate.py src/node-wrapper.js $(jscomponents) \
| $(builddir)
	$(python) $^ $@

$(builddir):
	mkdir -p $(builddir)

clean:
	-rm -rf $(builddir)

.PHONY: all clean
