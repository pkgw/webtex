// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// This is a special bundle that contains some document that we should parse.
// Eventually it's important to handle .tar and .tar.gz archives, since those
// are what arxiv.org stores, but for now it's Zip files or bust.

var DocumentArchive = (function DocumentArchive_closure () {
    function DocumentArchive (zipreader) {
	Bundle.call (this, zipreader);
    }

    inherit (DocumentArchive, Bundle);
    var proto = DocumentArchive.prototype;

    proto.setup_initial_input = function DocumentArchive_setup_initial_input (data) {
	// XXX: shouldn't poke in zipreader innards.
	var filename = null;

	for (var entry in this.zipreader.dirinfo) {
	    if (!this.zipreader.dirinfo.hasOwnProperty (entry))
		continue;

	    if (entry == 'ms.tex') {
		filename = entry;
		break;
	    }

	    if (entry.slice (-4) == '.tex') {
		if (filename != null) {
		    // XXX handle this intelligently. Probably should look for
		    // \documentclass in first few lines; what does arxiv.org
		    // do?
		    throw new TexRuntimeError ('can currently only handle document ' +
					       'archives with one .tex file');
		}

		filename = entry;
	    }
	}

	if (filename == null)
	    throw new TexRuntimeError ('saw no .tex files in the document archive');

	var lb = this.try_open_linebuffer (filename);
	if (lb == null)
	    throw new TexInternalError ('should have file %s but can\'t open it', filename);

	data.initial_linebuf = lb;
	data.jobname = filename;
	if (filename.slice (-4) == '.tex')
	    data.jobname = filename.slice (0, -4);
    };

    return DocumentArchive;
}) ();

webtex_export ('DocumentArchive', DocumentArchive);
