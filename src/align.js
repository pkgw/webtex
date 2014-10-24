// Implementing \halign and \valign.
//
// "It's sort of a miracle whenever \halign and \valign work ..." -- T:TP 768.

(function align_closure () {
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


    engine_proto.register_state ({
	engine_init: function (engine) {
	    engine.align_stack = [];
	    engine.align_state = 1000000;
	},
    });


    function get_preamble_token (engine) {
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
		    if (cmd.same_cmd (engine.commands['noexpand'])) {
			tok = engine.next_tok ();
			engine.trace ('noexpand in align: %o', tok);
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


    function _end_align (eng) {
	throw new TexInternalError ('expected end of alignment');
    }
    _end_align.is_align = true;

    function init_align (engine, is_valign) {
	// T:TP 774
	var astate = new AlignState ();
	engine.align_stack.push (astate);
	engine.align_state = -1000000;

	engine.nest_eqtb ();

	switch (engine.mode ()) {
	case M_DMATH:
	    if (engine.get_last_listable () != null)
		// XXX todo: or if there is an incompleat_node
		throw new TexRuntimeError ('cannot use alignments in non-empty math displays');
	    engine.enter_mode (M_IVERT);
	    // XXX: ignoring prev_depth
	    break;
	case M_VERT:
	    engine.enter_mode (M_IVERT);
	    break;
	case M_HORZ:
	    engine.enter_mode (M_RHORZ);
	    break;
	default:
	    engine.enter_mode (engine.mode ());
	    break;
	}

	// XXX this is scan_spec (TTP:645), which is duplicated in _handle_box.
	// XXXXXX is_exact and spec_S are unused!

	var is_exact, spec_S;

	if (engine.scan_keyword ('to')) {
	    is_exact = true;
	    spec_S = engine.scan_dimen__O_S (false);
	} else if (engine.scan_keyword ('spread')) {
	    is_exact = false;
	    spec_S = engine.scan_dimen__O_S (false);
	} else {
	    is_exact = false;
	    spec_S = nlib.Zero_S;
	}

	engine.scan_left_brace ();

	// T:TP 777.
	engine.align_state = -1000000; // seems redundant but who knows?
	var tok = null;

	while (true) {
	    astate.tabskips.push (engine.get_parameter (T_GLUE, 'tabskip').clone ());

	    if (tok != null && (tok.is_cmd (engine, 'cr') || tok.is_cmd (engine, 'crcr')))
		break;

	    var col = new AlignColumn ();

	    while (true) {
		// T:TP 783
		tok = get_preamble_token (engine);
		var cmd = tok.to_cmd (engine);

		if (cmd instanceof MacroParameterCommand)
		    break;

		if (cmd instanceof AlignTabCommand ||
		    cmd.same_cmd (engine.commands['cr']) ||
		    cmd.same_cmd (engine.commands['crcr'])) {
		    if (col.u_tmpl.length == 0 &&
			astate.loop_idx == -1 &&
			cmd instanceof AlignTabCommand) {
			// Engine is where "&&" is indicating the beginning of a
			// loop in the column specifications.
			astate.loop_idx = astate.columns.length;
		    } else {
			throw new TexRuntimeError ('need a # between &s in alignment');
		    }

		    continue;
		}

		if (col.u_tmpl.length == 0 && cmd instanceof SpacerCommand)
		    continue;

		col.u_tmpl.push (tok);
	    }

	    engine.trace ('align: u = %T', col.u_tmpl);

	    while (true) {
		// T:TP 783
		tok = get_preamble_token (engine);
		var cmd = tok.to_cmd (engine);

		if (cmd instanceof AlignTabCommand ||
		    cmd.same_cmd (engine.commands['cr']) ||
		    cmd.same_cmd (engine.commands['crcr']))
		    break;

		if (cmd instanceof MacroParameterCommand)
		    throw new TexRuntimeError ('only one # allowed between &s');

		col.v_tmpl.push (tok);
	    }

	    engine.trace ('align: v = %T', col.v_tmpl);
	    astate.columns.push (col);
	}

	engine.enter_group ('align', _end_align);

	engine.maybe_push_toklist ('everycr');
	align_peek (engine);
    }

    register_command ('halign', function cmd_halign (engine) {
	engine.trace ('halign');
	init_align (engine, false);
    });

    register_command ('valign', function cmd_valign (engine) {
	engine.trace ('valign');
	init_align (engine, true);
    });

    function align_peek (engine) {
	while (true) {
	    engine.align_state = 1000000;

	    var tok = engine.chomp_spaces ();

	    if (tok.is_cmd (engine, 'noalign')) {
		engine.scan_left_brace ();
		engine.enter_group ('noalign', function (eng) {
		    // TTP 1133
		    engine.end_graf ();
		    align_peek (engine);
		}.bind (engine));

		if (engine.mode () == M_IVERT) {
		    // T:TP 1070: normal_paragraph
		    engine.set_parameter (T_INT, 'looseness', 0);
		    engine.set_parameter__OS ('hangindent', nlib.Zero_S);
		    engine.set_parameter (T_INT, 'hangafter', 1);
		    // TODO: clear \parshape info, which nests in the EqTb.
		}
		return;
	    } else if (tok.to_cmd (engine) instanceof EndGroupCommand) {
		finish_align (engine);
		return;
	    } else if (tok.is_cmd (engine, 'crcr')) {
		continue; // \crcr after \cr ; -> ignore it
	    } else {
		align_begin_row (engine);
		align_begin_col (engine, tok);
		return;
	    }
	}
    }

    function align_begin_row (engine) {
	engine.trace ('align: begin row');
	engine.nest_eqtb ();

	switch (engine.mode ()) {
	case M_VERT: case M_IVERT:
	    engine.enter_mode (M_RHORZ);
	    break;
	case M_HORZ: case M_RHORZ:
	    engine.enter_mode (M_IVERT);
	    break;
	default:
	    throw new TexInternalError ('align row in math mode?');
	}

	engine.set_special_value (T_INT, 'spacefactor', 0);
	// XXX: ignore prev_depth
	// XXX: stuff about inserting tabskip
	align_begin_span (engine);
    }

    function align_begin_span (engine) {
	engine.trace ('align: begin span');
	engine.nest_eqtb ();

	if (engine.mode () == M_RHORZ)
	    engine.set_special_value (T_INT, 'spacefactor', 1000);
	else {
	    // T:TP 1070: normal_paragraph
	    engine.set_parameter (T_INT, 'looseness', 0);
	    engine.set_parameter__OS ('hangindent', nlib.Zero_S);
	    engine.set_parameter (T_INT, 'hangafter', 1);
	    // TODO: clear \parshape info, which nests in the EqTb.
	    // XXX: ignoring ignore_depth
	}

	var astate = engine.align_stack[engine.align_stack.length - 1];
	astate.cur_span_col = astate.cur_col;
    }

    function align_begin_col (engine, tok) {
	engine.trace ('align: begin col');

	if (tok.is_cmd (engine, 'omit')) {
	    engine.align_state = 0;
	    engine.col_is_omit = true;
	} else {
	    var astate = engine.align_stack[engine.align_stack.length - 1];
	    engine.push_back (tok);
	    engine.push_toks (astate.columns[astate.cur_col].u_tmpl, function () {
		// TTP 324, partially:
		if (engine.align_state > 500000)
		    engine.align_state = 0;
	    });
	    engine.col_is_omit = false;
	}
    }

    function align_end_col (engine) {
	// returns true if current row was also finished
	engine.trace ('align: end col');

	var l = engine.align_stack.length;
	if (l == 0)
	    throw new TexInternalError ('ending column outside of align');

	var astate = engine.align_stack[l-1];
	var col = null;

	if (engine.align_state < 500000)
	    throw new TexRuntimeError ('interwoven align preambles are not allowed');

	if (astate.cur_col == astate.columns.length - 1 &&
	    astate.col_ender instanceof AlignTabCommand) {
	    if (astate.loop_idx < 0)
		throw new TexRuntimeError ('too many &s in alignment row');

	    // XXX: T:TP 793. various tokens created and inserted right here
	    throw new TexInternalError ('alignment loops not implemented');
	}

	col = astate.columns[astate.cur_col];
	astate.cur_col++;

	if (!(astate.col_ender.same_cmd (engine.commands['span']))) {
	    // TTP 796 - package the current cell. XXX: I think TeX futzes
	    // with the current list being built without actually leaving the
	    // current mode. I'm doing the same for now, even though it feels
	    // gross.

	    var w, b;

	    if (engine.mode () == M_RHORZ) {
		b = new HBox ();
		b.list = engine.build_stack.pop ();
		engine.build_stack.push ([]);
		b.set_glue__OOS (engine, false, nlib.Zero_S);
		w = b.width_S;
	    } else {
		b = new VBox ();
		b.list = engine.build_stack.pop ();
		engine.build_stack.push ([]);
		b.set_glue__OOS (engine, false, nlib.Zero_S);
		w = b.height_S;
	    }

	    var n = astate.cur_col - astate.cur_span_col + 1;
	    if (!col.span_widths.hasOwnProperty (n))
		col.span_widths[n] = w;
	    else
		col.span_widths[n] = Math.max (col.span_widths[n], w);

	    // XXX: TTP796 calculates glue order here. I don't think we need
	    // to?

	    engine.unnest_eqtb ();
	    engine.accum (b);

	    // TTP 795 appends tabskip glue, but we save that til later.

	    if (!(astate.col_ender instanceof AlignTabCommand)) {
		astate.cur_col = 0;
		return true;
	    }

	    align_begin_span (engine);
	}

	engine.align_state = 1000000;
	var tok = engine.chomp_spaces ();
	align_begin_col (engine, tok);
	return false;
    }

    function align_end_row (engine) {
	//TTP 799
	engine.trace ('align: end row');

	var l = engine.align_stack.length;
	if (l == 0)
	    throw new TexInternalError ('ending row outside of align');

	// XXX diverging somewhat significantly from TeX impl
	var astate = engine.align_stack[l-1];
	engine.accum (engine.leave_mode ());
	engine.unnest_eqtb ();

	if (engine.mode () != M_RHORZ)
	    engine.set_special_value (T_INT, 'spacefactor', 1000);

	engine.maybe_push_toklist ('everycr');
	align_peek (engine);
    }

    function finish_align (engine) {
	// TTP 800
	engine.trace ('align: finish whole thing');

	var info = engine.group_exit_stack.pop (); // [name, callback, aftergroup-toklist]
	if (info[1].is_align !== true)
	    throw new TexRuntimeError ('ended alignment when should have ' +
				       'gotten other group-ender; depth=%d cb=%0',
				       engine.group_exit_stack.length, info[1]);

	var list = engine.leave_mode ();

	var o_S = nlib.Zero_S;
	if (engine.mode () == M_DMATH)
	    o_S = engine.get_parameter__O_S ('displayindent');

	// TTP 801
	// TTP 804
	// TTP 805

	engine.align_stack.pop ();

	// TTP 812
	engine.unnest_eqtb ();
    }


    register_command ('cr', function cmd_cr (engine) {
	throw new TexRuntimeError ('\\cr may only be used inside alignments');
    });

    register_command ('crcr', function cmd_crcr (engine) {
	throw new TexRuntimeError ('\\crcr may only be used inside alignments');
    });

    register_command ('omit', function cmd_omit (engine) {
	throw new TexRuntimeError ('\\omit may only be used inside alignments');
    });

    register_command ('span', function cmd_span (engine) {
	throw new TexRuntimeError ('\\span may only be used inside alignments');
    });

    register_command ('noalign', function cmd_noalign (engine) {
	throw new TexRuntimeError ('\\noalign may only be used inside alignments');
    });

    register_command ('_endv_', (function EndvCommand_closure () {
	function EndvCommand () { Command.call (this); }
	inherit (EndvCommand, Command);
	var proto = EndvCommand.prototype;
	proto.name = '<endv>';

	proto.invoke = function EndvCommand_invoke (engine) {
	    if (engine.mode () == M_MATH || engine.mode () == M_DMATH)
		throw new TexRuntimeError ('\\endv may not be used in math mode');

	    // TTP 1131. XXX: various input stack munging that I don't understand.
	    var l = engine.group_exit_stack.length;
	    if (!l)
		throw new TexRuntimeError ('\\endv outside of alignment group (1)');

	    if (engine.group_exit_stack[l - 1][1].is_align !== true)
		throw new TexRuntimeError ('\\endv outside of alignment group (2)');

	    if (align_end_col (engine))
		align_end_row (engine);
	};

	return EndvCommand;
    }) ());
}) ();
