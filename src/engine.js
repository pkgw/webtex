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

    function Engine (jobname) {
	this.jobname = jobname;

	this.tokenizer_state = TS_BEGINNING;
	this.pushed_tokens = [];

	this.eqtbs = [new TopEquivTable ()];
	this.mode_stack = [M_VERT];
	this.build_stack = [[]];
	this.group_exit_stack = [];
	this.boxop_stack = [];

	this.assign_flags = 0;
	this.after_assign_token = null;
	// ...
    }

    return Engine;
})();

WEBTEX.Engine = Engine;
