// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// A simple buffered reader for lines of text.

var LineBuffer = (function LineBuffer_closure () {
    function LineBuffer () {
	this.cachedlines = [];
	this.remainder = '';
	this.saw_eof = false;
    }

    var proto = LineBuffer.prototype;

    LineBuffer.new_static = function LineBuffer_new_static (staticlines) {
	var lb = new LineBuffer ();
	lb.cachedlines = staticlines;
	lb.saw_eof = true;
	return lb;
    };

    proto.feed_data = function LineBuffer_feed_data (chunk) {
	if (typeof chunk !== 'string')
	    throw new TexInternalError ('LineBuffers must be fed strings; got %o',
					chunk);
	chunk = this.remainder + chunk;
	this.cachedlines = this.cachedlines.concat (chunk.split ("\n"));
	this.remainder = this.cachedlines.pop ();
    };

    proto.end = function LineBuffer_end () {
	this.saw_eof = true;
    };

    proto.get = function LineBuffer_get () {
	if (this.cachedlines.length)
	    return this.cachedlines.shift ();

	if (this.saw_eof) {
	    if (!this.remainder.length)
		return EOF;

	    var ret = this.remainder;
	    this.remainder = '';
	    return ret;
	}

	// Every LineBuffer is currently completely filled upon creation, so
	// this is a can't-happen. In a better world we'd fetch data upon
	// request, in which case that's what'd happen here. Such an operation
	// must be synchronous in our current I/O model.
	throw new TexInternalError ('LineBuffer ran out of data');
    }

    return LineBuffer;
})();

webtex_export ('LineBuffer', LineBuffer);
