var ToklistInput = (function ToklistInput_closure () {
    function ToklistInput (toks) {
	this.toks = toks;
    }

    var proto = ToklistInput.prototype;

    proto.get_tok = function ToklistInput_get_tok (toknum) {
	if (toknum < 0)
	    throw new TexInternalError ('negative toknum ' + toknum);
	if (toknum > this.toks.length)
	    throw new TexInternalError ('overlarge toknum ' + toknum);

	if (toknum == this.toks.length)
	    return EOF;
	return this.toks[toknum];
    };

    proto.checkpoint = function ToklistInput_checkpoint (toknum) {
    };

    return ToklistInput;
}) ();


var TokenizerInput = (function TokenizerInput_closure () {
    var TS_BEGINNING = 0, TS_MIDDLE = 1, TS_SKIPPING = 2;

    function TokenizerInput (ordsrc, engine) {
	this.ordsrc = ordsrc;
	this.engine = engine;
	this.first_saved_toknum = 0;
	this.saved_tokens = [];
	this.tokenizer_state = TS_BEGINNING;
    }

    var proto = TokenizerInput.prototype;

    proto.get_tok = function TokenizerInput_get_tok (toknum) {
	if (toknum < this.first_saved_toknum)
	    throw new TexInternalError ('trying to rewind too far; want ' +
					'toknum ' + toknum + ', but I ' +
					'only remember as early as ' +
					this.first_saved_toknum);

	var delta = toknum - this.first_saved_toknum;

	if (delta < this.saved_tokens.length)
	    return this.saved_tokens[delta];

	if (delta > this.saved_tokens.length)
	    throw new TexInternalError ('overlarge toknum ' + toknum);

	var tok = this.tokenize_next ();
	if (tok !== NeedMoreData && tok !== EOF)
	    this.saved_tokens.push (tok);
	return tok;
    };

    proto.checkpoint = function TokenizerInput_checkpoint (toknum) {
	if (toknum < this.first_saved_toknum)
	    throw new TexInternalError ('trying to checkpoint too early??');

	var delta = toknum - this.first_saved_toknum;

	if (delta > this.saved_tokens.length)
	    throw new TexInternalError ('overlarge toknum ' + toknum +
					'; delta ' + delta + '; stl ' +
					this.saved_tokens.length);

	this.saved_tokens = this.saved_tokens.slice (delta);
	this.first_saved_toknum = toknum;
    };

    proto.tokenize_next = function TokenizerInput_tokenize_next () {
	if (this.ordsrc == null)
	    return EOF;

	// XXX not so great re: encapsulation
	var catcodes = this.engine.eqtb._catcodes;
	var o = this.ordsrc.next (catcodes);

	if (o === NeedMoreData)
	    return o;

	if (o == EOF) {
	    this.ordsrc = null;
	    return o;
	}

	var cc = catcodes[o];

	if (cc == C_ESCAPE) {
	    if (this.ordsrc.iseol ())
		return Token.new_cseq ('');

	    o = this.ordsrc.next (catcodes);
	    if (o === EOF || o === NeedMoreData)
		// We buffer things line-by-line so these conditions should
		// never happen -- cseq's can't span between lines.
		throw new TexRuntimeError ('unexpectly ran out of data (1)');

	    cc = catcodes[o];
	    var csname = String.fromCharCode (o);

	    if (cc != C_LETTER) {
		if (cc == C_SPACE)
		    this.tokenizer_state = TS_SKIPPING;
		else
		    this.tokenizer_state = TS_MIDDLE;
		return Token.new_cseq (csname);
	    }

	    while (1) {
		o = this.ordsrc.next (catcodes);
		if (o === EOF || o === NeedMoreData)
		    throw new TexRuntimeError ('unexpectly ran out of data (1)');

		cc = catcodes[o];
		if (cc != C_LETTER) {
		    this.ordsrc.push_ord (o);
		    break;
		}

		csname += String.fromCharCode (o);
	    }

	    this.tokenizer_state = TS_SKIPPING;
	    return Token.new_cseq (csname);
	}

	if (cc_ischar[cc]) {
	    this.tokenizer_state = TS_MIDDLE;
	    return Token.new_char (cc, o);
	}

	if (cc == C_EOL) {
	    this.ordsrc.discard_line ();
	    var prev_ts = this.tokenizer_state;
	    this.tokenizer_state = TS_BEGINNING;

	    if (prev_ts == TS_BEGINNING)
		return Token.new_cseq ('par');
	    if (prev_ts == TS_MIDDLE)
		return Token.new_char (C_SPACE, O_SPACE);
	    // TS_SKIPPING:
	    return this.tokenize_next ();
	}

	if (cc == C_IGNORE)
	    return this.tokenize_next ();

	if (cc == C_SPACE) {
	    if (this.tokenizer_state == TS_MIDDLE) {
		this.tokenizer_state = TS_SKIPPING;
		return Token.new_char (C_SPACE, O_SPACE);
	    }
	    return this.tokenize_next ();
	}

	if (cc == C_COMMENT) {
	    this.ordsrc.discard_line ();
	    this.tokenizer_state = TS_SKIPPING;
	    return this.tokenize_next ();
	}

	if (cc == C_INVALID) {
	    this.engine.warn ('read invalid character ' + escchr (o));
	    return this.tokenize_next ();
	}

	throw new TexInternalError ('not reached');
    };

    return TokenizerInput;
}) ();


var InputStack = (function InputStack_closure () {
    function InputStack (initial_linebuf, engine, args) {
	this.engine = engine;
	this.misc_args = args;
	this.recent_toks = new Array (64);
	this.next_recent_tok = 0;

	if (initial_linebuf == null) {
	    this.next_toknums = [];
	    this.inputs = [];
	} else {
	    this.next_toknums = [0];
	    var ordsrc = new OrdSource (initial_linebuf, args);
	    this.inputs = [new TokenizerInput (ordsrc, engine)];
	}
    }

    var proto = InputStack.prototype;

    proto.clone = function InputStack_clone () {
	var c = new InputStack (null, this.engine, this.misc_args)
	c.recent_toks = this.recent_toks.slice ();
	c.next_recent_tok = this.next_recent_tok;
	c.next_toknums = this.next_toknums.slice ();
	c.inputs = this.inputs.slice ();
	return c;
    };

    proto.checkpoint = function InputStack_checkpoint () {
	for (var i = 0; i < this.inputs.length; i++) {
	    this.inputs[i].checkpoint (this.next_toknums[i]);
	}
    };

    proto.next_tok = function InputStack_next_tok () {
	var i = this.inputs.length - 1;
	if (i < 0)
	    return EOF;

	var tok = this.inputs[i].get_tok (this.next_toknums[i]);

	if (tok === NeedMoreData)
	    return tok;

	if (tok !== EOF) {
	    this.next_toknums[i]++;
	    this.recent_toks[this.next_recent_tok] = tok;
	    this.next_recent_tok = (this.next_recent_tok + 1) % this.recent_toks.length;
	    return tok;
	}

	if (i == 0)
	    return EOF;

	this.inputs.pop ();
	this.next_toknums.pop ();
	return this.next_tok ();
    };

    proto.push_toklist = function InputStack_push_toklist (toks) {
	this.inputs.push (new ToklistInput (toks));
	this.next_toknums.push (0);
    };

    proto.push_linebuf = function InputStack_push_linebuf (lb) {
	var ordsrc = new OrdSource (lb, this.misc_args);
	this.inputs.push (new TokenizerInput (ordsrc, this.engine));
	this.next_toknums.push (0);
    };

    proto.pop_current_linebuf = function InputStack_pop_current_linebuf () {
	// XXX I think we should dig as far down in the input stack as we need
	// to, but I don't feel 100% confident in that.

	var i = this.inputs.length - 1;

	while (i >= 0 && !(this.inputs[i] instanceof TokenizerInput))
	    i--;

	if (i <= 0) { // We're all done.
	    this.inputs = [];
	    this.next_toknums = [];
	    return;
	}

	this.inputs = this.inputs.slice (0, i);
	this.next_toknums = this.next_toknums.slice (0, i);
    };

    proto.describe_recent = function InputStack_describe_recent () {
	var list = [];

	for (var i = 0; i < this.recent_toks.length; i++) {
	    var t = this.recent_toks[(this.next_recent_tok + i) % this.recent_toks.length];
	    if (t != null)
		list.push (t);
	}

	return 'Recent tokens (including expansions): '
	    + (new Toklist (list).as_serializable ());
    };

    proto.describe_upcoming = function InputStack_describe_upcoming () {
	// This function eats the upcoming tokens. It is assumed that it will
	// only be called in error conditions where we're giving up.
	// describe_recent() should be called before this function since the
	// tokens we fetch will get logged as recent ones!

	var list = [];
	var t = null;

	while (list.length < 64) {
	    t = this.next_tok ();
	    if (t === EOF || t === NeedMoreData)
		break;
	    list.push (t);
	}

	var s = 'Upcoming tokens (ignoring expansions): '
	    + (new Toklist (list).as_serializable ());

	if (t === EOF)
	    s += ' <EOF>';
	else
	    s += ' ...';

	return s;
    };

    return InputStack;
}) ();
