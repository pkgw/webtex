var EquivTable = (function EquivTable_closure () {
    function EquivTable (parent) {
	this.toplevel = parent.toplevel;
	this._parent = parent;
	init_generic_eqtb (this);
    }

    fill_generic_eqtb_accessors (EquivTable.prototype);

    return EquivTable;
})();


var TopEquivTable = (function TopEquivTable_closure () {
    function TopEquivTable () {
	this.toplevel = this;
	this._parent = null;

	init_top_eqtb (this);

	var i = 0;
	var t = this._catcodes = {};
	for (i = 0; i < 256; i++)
	    t[i] = C_OTHER;
	t[O_NULL] = C_IGNORE;
	t[O_BACKSPACE] = C_INVALID;
	t[O_RETURN] = C_EOL;
	t[O_SPACE] = C_SPACE;
	t[O_PERCENT] = C_COMMENT;
	t[O_BACKSLASH] = C_ESCAPE;
	for (var i = O_UC_A; i < O_UC_A + 26; i++)
	    t[i] = C_LETTER;
	for (var i = O_LC_A; i < O_LC_A + 26; i++)
	    t[i] = C_LETTER;

	t = this._mathcodes = {};
	for (var i = 0; i < 256; i++)
	    t[i] = i;
	for (var i = O_UC_A; i < O_UC_A + 26; i++)
	    t[i] = i + 0x7100;
	for (var i = O_LC_A; i < O_LC_A + 26; i++)
	    t[i] = i + 0x7100;
	for (var i = O_ZERO; i < O_ZERO + 10; i++)
	    t[i] = i + 0x7000;

	t = this._uccodes = {};
	for (var i = 0; i < 26; i++) {
	    t[O_UC_A + i] = O_UC_A + i;
	    t[O_LC_A + i] = O_UC_A + i;
	}

	t = this._lccodes = {};
	for (var i = 0; i < 26; i++) {
	    t[O_UC_A + i] = O_LC_A + i;
	    t[O_LC_A + i] = O_LC_A + i;
	}

	t = this._sfcodes = {};
	for (var i = 0; i < 256; i++)
	    t[i] = 1000;
	for (var i = O_UC_A; i < O_UC_A + 26; i++)
	    t[i] = 999;

	t = this._delcodes = {};
	for (var i = 0; i < 256; i++)
	    t[i] = -1;
	t[O_PERIOD] = 0;

	t = this._glueregs = {};
	for (var i = 0; i < 256; i++)
	    t[i] = new Glue ();

	t = this._tokregs = {};
	for (var i = 0; i < 256; i++)
	    t[i] = [];

	t = this._boxregs = {};
	for (var i = 0; i < 256; i++)
	    t[i] = new Box ();
    }

    inherit (TopEquivTable, EquivTable);

    fill_top_eqtb_accessors (TopEquivTable.prototype);

    return TopEquivTable;
})();


var Engine = (function Engine_closure () {
    var TS_BEGINNING = 0, TS_MIDDLE = 1, TS_SKIPPING = 2;

    function Engine (jobname, initial_ordsrc) {
	this.jobname = jobname;

	this.ordsrc = initial_ordsrc;
	this.tokenizer_state = TS_BEGINNING;
	this.pushed_tokens = [];

	this.eqtb = new TopEquivTable ();
	this.mode_stack = [M_VERT];
	this.build_stack = [[]];
	this.group_exit_stack = [];
	this.boxop_stack = [];

	this.assign_flags = 0;
	this.after_assign_token = null;
	// ...
    }

    var proto = Engine.prototype;

    // Tokenization. I'd like to separate this out into its own class,
    // but there are just too many interactions between this subsystem and
    // the rest of the engine.

    proto.push = function Engine_push (tok) {
	this.pushed_tokens.push (tok);
    };

    proto._tokenize_next_tok = function Engine__tokenize_next_tok () {
	if (this.pushed_tokens.length)
	    return this.pushed_tokens.pop ();

	var catcodes = this.eqtb._catcodes;
	var o = this.ordsrc.next (catcodes);

	if (o === null) {
	    this.ordsrc = this.ordsrc.parent;
	    if (this.ordsrc === null)
		return null;
	    return this._tokenize_next_tok ();
	}

	var cc = catcodes[o];

	if (cc == C_ESCAPE) {
	    if (this.ordsrc.iseol ())
		return Token.new_cseq ('');

	    o = this.ordsrc.next (catcodes);
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
		if (o === null)
		    break;

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
	    return this._tokenize_next_tok ();
	}

	if (cc == C_IGNORE)
	    return this._tokenize_next_tok ();

	if (cc == C_SPACE) {
	    if (this.tokenizer_state == TS_MIDDLE) {
		this.tokenizer_state = TS_SKIPPING;
		return Token.new_char (C_SPACE, O_SPACE);
	    }
	    return this._tokenize_next_tok ();
	}

	if (cc == C_COMMENT) {
	    this.ordsrc.discard_line ();
	    this.tokenizer_state = TS_SKIPPING;
	    return this._tokenize_next_tok ();
	}

	if (cc == C_INVALID) {
	    log ('read invalid character ' + escchr (o));
	    return this._tokenize_next_tok ();
	}

	// TODO: endinput
	throw new TexInternalError ('not reached');
    };

    proto.next_tok = proto._tokenize_next_tok; // may diverge in the future

    return Engine;
})();

WEBTEX.Engine = Engine;
