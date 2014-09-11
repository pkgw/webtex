// Implementing \halign and \valign.
//
// "It's sort of a miracle whenever \halign and \valign work ..." -- T:TP 768.

'use strict';

var AlignState = (function AlignState_closure () {
    function AlignState () {
	this.preamble = [];
    }

    var proto = AlignState.prototype;

    return AlignState;
}) ();


var alignlib = (function alignlib_closure () {
    var al = {}

    al.get_preamble_token = function alignlib_get_preamble_token (engine) {
	while (true) {
	    var tok = engine.next_tok ();

	    while (tok.iscmd (this, 'span')) {
		// "When \span appears in a preamble, it causes the next token
		// to be expanded, i.e., 'ex-span-ded,' before TEX reads on."
		// - TeXBook p. 238.
		tok = engine.next_tok ();

		var cmd = tok.tocmd (engine);
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

	    // XXX: if iscmd ('endv') complain about interwoven preambles

	    if (!tok.iscmd (engine, 'tabskip'))
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
