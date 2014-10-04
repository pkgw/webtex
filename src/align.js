// Implementing \halign and \valign.
//
// "It's sort of a miracle whenever \halign and \valign work ..." -- T:TP 768.

'use strict';

var AlignColumn = (function AlignColumn_closure () {
    function AlignColumn () {
	this.u_tmpl = [];
	this.v_tmpl = [];
	this.span_widths = {};
    }

    var proto = AlignColumn.prototype;

    return AlignColumn;
}) ();


var AlignState = (function AlignState_closure () {
    function AlignState () {
	this.tabskips = [];
	this.columns = [];
	this.rows = [];
	this.loop_idx = -1;
	this.cur_col = 0;
	this.cur_span_col = 0;
	this.col_is_omit = false;
	this.col_ender = null;
    }

    var proto = AlignState.prototype;

    return AlignState;
}) ();


var alignlib = (function alignlib_closure () {
    var al = {}

    al.get_preamble_token = function alignlib_get_preamble_token (engine) {
	while (true) {
	    var tok = engine.next_tok ();

	    while (tok.is_cmd (engine, 'span')) {
		// "When \span appears in a preamble, it causes the next token
		// to be expanded, i.e., 'ex-span-ded,' before TEX reads on."
		// - TeXBook p. 238.
		tok = engine.next_tok ();

		var cmd = tok.to_cmd (engine);
		if (cmd.expandable) {
		    // I guess \noexpand makes no sense here, but who knows?
		    if (cmd.samecmd (engine.commands['noexpand'])) {
			tok = engine.next_tok ();
			engine.trace ('noexpand in align: ' + tok);
		    } else {
			cmd.invoke (engine);
			tok = engine.next_tok ();
		    }
		}
	    }

	    // XXX: if is_cmd ('endv') complain about interwoven preambles

	    if (!tok.is_cmd (engine, 'tabskip'))
		return tok;

	    engine.scan_optional_equals ();
	    var glue = engine.scan_glue (false);
	    // will honor \globaldefs appropriately:
	    engine.set_parameter (T_GLUE, 'tabskip', glue);
	    // loop, equivalent to "goto restart"
	}
    };

    return al;
}) ();
