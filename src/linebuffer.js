var LineBuffer = WEBTEX.LineBuffer = (function LineBuffer_closure () {
    function LineBuffer () {
	this.cachedlines = [];
	this.remainder = '';
	this.saw_eof = false;
    }

    var proto = LineBuffer.prototype;

    proto.feed_data = function LineBuffer_feed_data (chunk) {
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
