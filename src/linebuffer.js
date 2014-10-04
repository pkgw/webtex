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
	    throw new TexInternalError ('LineBuffers must be fed strings; got' + chunk);
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

	return NeedMoreData;
    }

    return LineBuffer;
})();

webtex_export ('LineBuffer', LineBuffer);
