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

    engine_proto.register_method ('init_align',
				  function Engine_init_align (is_valign) {
	// T:TP 774
	var astate = new AlignState ();
	this.align_stack.push (astate);
	this.align_state = -1000000;

	this.nest_eqtb ();

	switch (this.mode ()) {
	case M_DMATH:
	    if (this.get_last_listable () != null)
		// XXX todo: or if there is an incompleat_node
		throw new TexRuntimeError ('cannot use alignments in non-empty math displays');
	    this.enter_mode (M_IVERT);
	    // XXX: ignoring prev_depth
	    break;
	case M_VERT:
	    this.enter_mode (M_IVERT);
	    break;
	case M_HORZ:
	    this.enter_mode (M_RHORZ);
	    break;
	default:
	    this.enter_mode (this.mode ());
	    break;
	}

	// XXX this is scan_spec (TTP:645), which is duplicated in _handle_box.
	// XXXXXX is_exact and spec_S are unused!

	var is_exact, spec_S;

	if (this.scan_keyword ('to')) {
	    is_exact = true;
	    spec_S = this.scan_dimen__O_S (false);
	} else if (this.scan_keyword ('spread')) {
	    is_exact = false;
	    spec_S = this.scan_dimen__O_S (false);
	} else {
	    is_exact = false;
	    spec_S = nlib.Zero_S;
	}

	this.scan_left_brace ();

	// T:TP 777.
	this.align_state = -1000000; // seems redundant but who knows?
	var tok = null;

	while (true) {
	    astate.tabskips.push (this.get_parameter (T_GLUE, 'tabskip').clone ());

	    if (tok != null && (tok.is_cmd (this, 'cr') || tok.is_cmd (this, 'crcr')))
		break;

	    var col = new AlignColumn ();

	    while (true) {
		// T:TP 783
		tok = get_preamble_token (this);
		var cmd = tok.to_cmd (this);

		if (cmd instanceof MacroParameterCommand)
		    break;

		if (cmd instanceof AlignTabCommand ||
		    cmd.same_cmd (this.commands['cr']) ||
		    cmd.same_cmd (this.commands['crcr'])) {
		    if (col.u_tmpl.length == 0 &&
			astate.loop_idx == -1 &&
			cmd instanceof AlignTabCommand) {
			// This is where "&&" is indicating the beginning of a
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

	    this.trace ('align: u = %T', col.u_tmpl);

	    while (true) {
		// T:TP 783
		tok = get_preamble_token (this);
		var cmd = tok.to_cmd (this);

		if (cmd instanceof AlignTabCommand ||
		    cmd.same_cmd (this.commands['cr']) ||
		    cmd.same_cmd (this.commands['crcr']))
		    break;

		if (cmd instanceof MacroParameterCommand)
		    throw new TexRuntimeError ('only one # allowed between &s');

		col.v_tmpl.push (tok);
	    }

	    this.trace ('align: v = %T', col.v_tmpl);
	    astate.columns.push (col);
	}

	this.enter_group ('align', _end_align);

	this.maybe_push_toklist ('everycr');
	this.align_peek ();
    });

    engine_proto.register_method ('align_peek',
				  function Engine_align_peek () {
	while (true) {
	    this.align_state = 1000000;

	    var tok = this.chomp_spaces ();

	    if (tok.is_cmd (this, 'noalign')) {
		this.scan_left_brace ();
		this.enter_group ('noalign', function (eng) {
		    // TTP 1133
		    this.end_graf ();
		    this.align_peek ();
		}.bind (this));

		if (this.mode () == M_IVERT) {
		    // T:TP 1070: normal_paragraph
		    this.set_parameter (T_INT, 'looseness', 0);
		    this.set_parameter__OS ('hangindent', nlib.Zero_S);
		    this.set_parameter (T_INT, 'hangafter', 1);
		    // TODO: clear \parshape info, which nests in the EqTb.
		}
		return;
	    } else if (tok.to_cmd (this) instanceof EndGroupCommand) {
		this.finish_align ();
		return;
	    } else if (tok.is_cmd (this, 'crcr')) {
		continue; // \crcr after \cr ; -> ignore it
	    } else {
		this.align_begin_row ();
		this.align_begin_col (tok);
		return;
	    }
	}
    });

    engine_proto.register_method ('align_begin_row',
				  function Engine_align_begin_row () {
	this.trace ('align: begin row');
	this.nest_eqtb ();

	switch (this.mode ()) {
	case M_VERT: case M_IVERT:
	    this.enter_mode (M_RHORZ);
	    break;
	case M_HORZ: case M_RHORZ:
	    this.enter_mode (M_IVERT);
	    break;
	default:
	    throw new TexInternalError ('align row in math mode?');
	}

	this.set_special_value (T_INT, 'spacefactor', 0);
	// XXX: ignore prev_depth
	// XXX: stuff about inserting tabskip
	this.align_begin_span ();
    });

    engine_proto.register_method ('align_begin_span',
				  function Engine_align_begin_span () {
	this.trace ('align: begin span');
	this.nest_eqtb ();

	if (this.mode () == M_RHORZ)
	    this.set_special_value (T_INT, 'spacefactor', 1000);
	else {
	    // T:TP 1070: normal_paragraph
	    this.set_parameter (T_INT, 'looseness', 0);
	    this.set_parameter__OS ('hangindent', nlib.Zero_S);
	    this.set_parameter (T_INT, 'hangafter', 1);
	    // TODO: clear \parshape info, which nests in the EqTb.
	    // XXX: ignoring ignore_depth
	}

	var astate = this.align_stack[this.align_stack.length - 1];
	astate.cur_span_col = astate.cur_col;
    });

    engine_proto.register_method ('align_begin_col',
				  function Engine_align_begin_col (tok) {
	this.trace ('align: begin col');

	if (tok.is_cmd (this, 'omit')) {
	    this.align_state = 0;
	    this.col_is_omit = true;
	} else {
	    var astate = this.align_stack[this.align_stack.length - 1];
	    this.push_back (tok);
	    this.push_toks (astate.columns[astate.cur_col].u_tmpl, function () {
		// TTP 324, partially:
		if (this.align_state > 500000)
		    this.align_state = 0;
	    }.bind (this));
	    this.col_is_omit = false;
	}
    });

    engine_proto.register_method ('align_end_col',
				  function Engine_align_end_col () {
	// returns true if current row was also finished
	this.trace ('align: end col');

	var l = this.align_stack.length;
	if (l == 0)
	    throw new TexInternalError ('ending column outside of align');

	var astate = this.align_stack[l-1];
	var col = null;

	if (this.align_state < 500000)
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

	if (!(astate.col_ender.same_cmd (this.commands['span']))) {
	    // TTP 796 - package the current cell. XXX: I think TeX futzes
	    // with the current list being built without actually leaving the
	    // current mode. I'm doing the same for now, even though it feels
	    // gross.

	    var w, b;

	    if (this.mode () == M_RHORZ) {
		b = new HBox ();
		b.list = this.build_stack.pop ();
		this.build_stack.push ([]);
		b.set_glue__OOS (this, false, nlib.Zero_S);
		w = b.width_S;
	    } else {
		b = new VBox ();
		b.list = this.build_stack.pop ();
		this.build_stack.push ([]);
		b.set_glue__OOS (this, false, nlib.Zero_S);
		w = b.height_S;
	    }

	    var n = astate.cur_col - astate.cur_span_col + 1;
	    if (!col.span_widths.hasOwnProperty (n))
		col.span_widths[n] = w;
	    else
		col.span_widths[n] = Math.max (col.span_widths[n], w);

	    // XXX: TTP796 calculates glue order here. I don't think we need
	    // to?

	    this.unnest_eqtb ();
	    this.accum (b);

	    // TTP 795 appends tabskip glue, but we save that til later.

	    if (!(astate.col_ender instanceof AlignTabCommand)) {
		astate.cur_col = 0;
		return true;
	    }

	    this.align_begin_span ();
	}

	this.align_state = 1000000;
	var tok = this.chomp_spaces ();
	this.align_begin_col (tok);
	return false;
    });

    engine_proto.register_method ('align_end_row',
				  function Engine_align_end_row () {
	//TTP 799
	this.trace ('align: end row');

	var l = this.align_stack.length;
	if (l == 0)
	    throw new TexInternalError ('ending row outside of align');

	// XXX diverging somewhat significantly from TeX impl
	var astate = this.align_stack[l-1];
	this.accum (this.leave_mode ());
	this.unnest_eqtb ();

	if (this.mode () != M_RHORZ)
	    this.set_special_value (T_INT, 'spacefactor', 1000);

	this.maybe_push_toklist ('everycr');
	this.align_peek ();
    });

    engine_proto.register_method ('finish_align',
				  function Engine_finish_align () {
	// TTP 800
	this.trace ('align: finish whole thing');

	var info = this.group_exit_stack.pop (); // [name, callback, aftergroup-toklist]
	if (info[1].is_align !== true)
	    throw new TexRuntimeError ('ended alignment when should have ' +
				       'gotten other group-ender; depth=%d cb=%0',
				       this.group_exit_stack.length, info[1]);

	var list = this.leave_mode ();

	var o_S = nlib.Zero_S;
	if (this.mode () == M_DMATH)
	    o_S = this.get_parameter__O_S ('displayindent');

	// TTP 801
	// TTP 804
	// TTP 805

	this.align_stack.pop ();

	// TTP 812
	this.unnest_eqtb ();
    });

    engine_proto.register_method ('handle_endv',
				  function Engine_handle_endv () {
	// TTP 1131. XXX: various input stack munging that I don't understand.
	var l = this.group_exit_stack.length;
	if (!l)
	    throw new TexRuntimeError ('\\endv outside of alignment group (1)');

	if (this.group_exit_stack[l - 1][1].is_align !== true)
	    throw new TexRuntimeError ('\\endv outside of alignment group (2)');

	if (this.align_end_col ())
	    this.align_end_row ();
    });
}) ();
