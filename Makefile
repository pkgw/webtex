builddir = build
python = python

jscomponents = \
  src/preamble.js

all: $(builddir)/webtex.js | $(builddir)

$(builddir)/webtex.js: generate.py src/wrapper.js $(jscomponents) | $(builddir)
	$(python) $^ $@

$(builddir):
	mkdir -p $(builddir)

clean:
	-rm -rf $(builddir)

.PHONY: all clean
