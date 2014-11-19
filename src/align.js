// Implementing \halign and \valign.
//
// "It's sort of a miracle whenever \halign and \valign work ..." -- T:TP 768.

(function align_closure () {
    // Magic sentinel value that makes linked list manipulations a lot easier.

    var EndSpan = { width_S: NaN,
		    nspanned: 257,
		    next: null };

    var SpanNode = (function SpanNode_closure () {
	function SpanNode () {
	    this.width_S = nlib.Zero_S; // "width" in TeX
	    this.nspanned = 0; // "link" in TeX
	    this.next = EndSpan; // "info" in TeX
	}

	var proto = SpanNode.prototype;

	return SpanNode;
    }) ();

    var AlignColumn = (function AlignColumn_closure () {
	function AlignColumn () {
	    this.u_tmpl = [];
	    this.v_tmpl = [];
	    this.span_nodes = EndSpan;
	    this.width_S = undefined;
	}

	var proto = AlignColumn.prototype;

	return AlignColumn;
    }) ();


    var AlignState = (function AlignState_closure () {
	function AlignState () {
	    this.is_valign = false;
	    this.tabskips = [];
	    this.columns = [];
	    this.rows = [];
	    this.loop_idx = -1;
	    this.cur_col = 0;
	    this.cur_span_col = 0;
	    this.col_is_omit = false;
	    this.col_ender = null;
	    this.pack_is_exact = false;
	    this.pack_spec_S = nlib.Zero_S;
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

	switch (engine.mode ()) {
	case M_DMATH:
	    if (engine.get_last_listable () != null || engine.get_unfinished_math_node () != null)
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

	astate.is_valign = is_valign;

	// XXX this is scan_spec (TTP:645), which is duplicated in _handle_box.

	if (engine.scan_keyword ('to')) {
	    astate.pack_is_exact = true;
	    astate.pack_spec_S = engine.scan_dimen__O_S (false);
	} else if (engine.scan_keyword ('spread')) {
	    astate.pack_is_exact = false;
	    astate.pack_spec_S = engine.scan_dimen__O_S (false);
	} else {
	    astate.pack_is_exact = false;
	    astate.pack_spec_S = nlib.Zero_S;
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

	// One of these is for the whole alignment (not obvious in the TeX
	// code since it's buried in scan_spec), one is for the current span.
	engine.nest_eqtb ();
	engine.nest_eqtb ();

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
		engine.nest_eqtb ();
		engine.enter_group ('noalign', function (eng) {
		    // TTP 1133
		    engine.end_graf ();
		    engine.unnest_eqtb ();
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

	engine.set_spacefactor (0);

	var astate = engine.align_stack[engine.align_stack.length - 1];
	engine.accum (new BoxGlue (astate.tabskips[0]));

	align_begin_span (engine);
    }

    function align_begin_span (engine) {
	engine.trace ('align: begin span');

	var mode = engine.mode ();
	engine.enter_mode (mode);

	if (mode == M_RHORZ)
	    engine.set_spacefactor (1000);
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

	var cur_col = astate.cur_col;
	col = astate.columns[cur_col];
	astate.cur_col++; // easiest to increment here, but then downstream stuff gets confusing

	if (!(astate.col_ender.same_cmd (engine.commands['span']))) {
	    engine.unnest_eqtb ();
	    engine.nest_eqtb ();

	    // TTP 796 - package the current cell.

	    var w_S, b;

	    if (astate.is_valign) {
		b = new VBox ();
		b.list = engine.leave_mode ();
		b.set_glue__OOS (engine, false, nlib.Zero_S);
		w_S = b.height_S;
	    } else {
		b = new HBox ();
		b.list = engine.leave_mode ();
		b.set_glue__OOS (engine, false, nlib.Zero_S);
		w_S = b.width_S;
	    }

	    engine.trace ('align: end col: packaging %U', b);

	    if (astate.cur_span_col == cur_col) {
		if (col.width_S == null)
		    // Note: TeX impl relies on end_span ~= -infinity
		    col.width_S = w_S;
		else
		    col.width_S = Math.max (col.width_S, w_S);

		b.nspanned = 1;
		engine.trace ('align: end col: no spanning: %d %d', cur_col, b.nspanned);
	    } else {
		var n = cur_col - astate.cur_span_col + 1;
		var snode = {next: col.span_nodes, dummy: true};

		b.nspanned = n;
		engine.trace ('align: end col: spanning!: %d %d', cur_col, b.nspanned);

		while (snode.next.nspanned < n)
		    // Note: if col.span_nodes is EndSpan, snode.next.nspanned
		    // is 257 and always bigger than n, so we don't exit
		    // immediately.
		    snode = snode.next;

		if (snode.next.nspanned == n)
		    snode.next.width_S = Math.max (snode.next.width_S, w_S);
		else {
		    // Need to splice in a new node.
		    var newnode = new SpanNode ();
		    newnode.width_S = w_S;
		    newnode.nspanned = n;

		    if (snode.dummy)
			// Here we have to make a concession to the fact that
			// we're not doing nasty dummy-head operations.
			col.span_nodes = newnode;
		    else {
			newnode.next = snode.next;
			snode.next = newnode;
		    }
		}
	    }

	    // TTP 796. I don't understand why things are done this way, but I
	    // presume there's a reason for not just calling hpack/vpack in
	    // fin_align ...
	    b.save_glue_info ();

	    engine.accum (b);
	    engine.accum (new BoxGlue (astate.tabskips[cur_col+1]));

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

	var astate = engine.align_stack[l-1];
	var items = engine.leave_mode ();
	var b = null;

	if (astate.is_valign) {
	    b = new VBox ();
	    b.list = items;
	    b.set_glue__OOS (engine, false, nlib.Zero_S);
	    engine.set_spacefactor (1000);
	} else {
	    b = new HBox ();
	    b.list = items;
	    b.set_glue__OOS (engine, false, nlib.Zero_S);
	    engine.accum_to_vlist (b);
	}

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

	engine.unnest_eqtb ();
	engine.unnest_eqtb ();

	var list = engine.leave_mode ();

	var o_S = nlib.Zero_S;
	if (engine.mode () == M_DMATH)
	    o_S = engine.get_parameter__O_S ('displayindent');

	// TTP 801

	var astate = engine.align_stack.pop ();

	for (var i = 0; i < astate.columns.length; i++) {
	    var col = astate.columns[i];
	    var nextcol = null;

	    if (i + 1 < astate.columns.length)
		nextcol = astate.columns[i+1];

	    if (col.width_S == null) {
		// This column was always spanned over -- nullify its width
		// and its tabskip glue (modifying the existing object, so the
		// BoxGlues that point to it will also be nullified).
		col.width_S = nlib.Zero_S;
		astate.tabskips[i+1].amount_S = nlib.Zero_S;
		astate.tabskips[i+1].stretch_S = nlib.Zero_S;
		astate.tabskips[i+1].stretch_order = 0;
		astate.tabskips[i+1].shrink_S = nlib.Zero_S;
		astate.tabskips[i+1].shrink_order = 0;
	    }

	    if (col.span_nodes !== EndSpan) {
		var totwidth_S = col.width_S + astate.tabskips[i+1].amount_S; // "t" in TeX
		var curcol_snode = col.span_nodes; // "r" in TeX
		var n = 1;
		var nextcol_snode = EndSpan; // "s" in TeX

		if (nextcol != null)
		    nextcol_snode = {next: nextcol.span_nodes, dummy: true};

		while (true) {
		    curcol_snode.width_S -= totwidth_S;
		    var tmpnext = curcol_snode.next; // "u" in TeX

		    if (nextcol != null) {
			// Find an "n" (= nextcol_snode.nspanned + 1) that's
			// at least as large as curcol_snode.nspanned.

			while (curcol_snode.nspanned > n) {
			    // Once again, the high nspanned value of EndSpan
			    // will make sure we exit in a good state.
			    nextcol_snode = nextcol_snode.next;
			    n = nextcol_snode.next.nspanned + 1; // since we're one col over
			}

			if (curcol_snode.nspanned < n) {
			    // This span-node fits between the active ones in the
			    // next column. Splice it in.
			    curcol_snode.next = nextcol_snode.next;

			    if (nextcol_snode.dummy)
				nextcol.span_nodes = curcol_snode;
			    else
				nextcol_snode.next = curcol_snode;
			    curcol_snode.nspanned--;
			    nextcol_snode = curcol_snode;
			} else if (curcol_snode.width_S > nextcol_snode.next.width_S) {
			    // This node spans as many or more columns than the current
			    // one in the next column. Boost its width.
			    nextcol_snode.next.width_S = curcol_snode.width_S;
			}
		    }

		    if (tmpnext === EndSpan)
			break;
		    curcol_snode = tmpnext;
		}
	    }

	    // TeX converts the column into an unset_node box, but that's not
	    // how we do things.
	}

	// TTP 804. Now, pack the preamble to its target width, so that we know
	// the settings for the tabskip glues.

	var tmpbox = new HBox ();

	for (var i = 0; i < astate.columns.length; i++) {
	    tmpbox.list.push (new BoxGlue (astate.tabskips[i]));

	    var tmprule = new Rule ();
	    tmprule.width_S = astate.columns[i].width_S;
	    tmpbox.list.push (tmprule);
	}

	tmpbox.list.push (new BoxGlue (astate.tabskips[astate.tabskips.length - 1]));
	tmpbox.set_glue__OOS (engine, astate.pack_is_exact, astate.pack_spec_S);

	// TTP 805. Go through the outer list, which is a set of row boxes and
	// arbitrary other things inserted via \noalign.

	for (var i = 0; i < list.length; i++) {
	    var item = list[i];
	    engine.trace ('align row thingie: %U', item);

	    if (item instanceof ListBox) {
		// TTP 807. This is a row. It has the same shape as tmpbox, so
		// we can just copy over its glue-set results. In fact, we
		// can't just call set_glue on it, since the widths of its
		// sub-items aren't yet set correctly.
		//
		// XXX: we need something like Tex's unset_node to distinguish
		// rows from miscellaneous \noalign material.
		item.glue_set = tmpbox.glue_set;
		item.glue_state = tmpbox.glue_state;
		item.shift_amount_S = o_S;

		if (astate.is_valign) {
		    item.height_S = tmpbox.width_S;
		} else {
		    item.width_S = tmpbox.width_S;
		}

		var col = 0;
		var newlist = [item.list[0]]; // Initial tabskip

		for (var j = 1; j < item.list.length; j += 2) {
		    // TTP 808. Set the properties of each cell within the row.
		    var subitem = item.list[j]; // 'r' in TeX
		    var t_S = astate.columns[col].width_S; // 't' in TeX
		    var w_S = t_S; // 'w' in TeX
		    var extra_items = []; // 'u' in TeX

		    for (var k = 1; k < subitem.nspanned; k++) {
			// Manually add the tabskip glue between current and next spanned col.

			var tabglue = astate.tabskips[col + k]
			extra_items.push (new BoxGlue (tabglue));
			t_S += tabglue.amount_S;

			if (tmpbox.glue_state > 0 && tabglue.stretch_order == tmpbox.glue_state - 1)
			    t_S += (tmpbox.glue_set * tabglue.stretch_S) | 0;
			else if (tmpbox.glue_state < 0 && tabglue.shrink_order == -(1 + tmpbox.glue_state))
			    t_S -= (tmpbox.glue_set * tabglue.shrink_S) | 0;

			// Manually add an empty box of the correct width.

			var padbox;

			if (astate.is_valign) {
			    padbox = new VBox ();
			    padbox.height_S = astate.columns[col + k].width_S;
			} else {
			    padbox = new HBox ();
			    padbox.width_S = astate.columns[col + k].width_S;
			}

			t_S += astate.columns[col + k].width_S;
			extra_items.push (padbox);
		    }

		    if (astate.is_valign) {
			// TTP 811. TODO: can we just call set_glue? We must
			// not be able to because TeX does all this junk
			// instead of just calling vpack, but I don't
			// understand why.
			subitem.width_S = item.width_S;

			if (subitem.height_S == t_S) {
			    subitem.glue_state = 1;
			    subitem.glue_set = 0.;
			} else if (t_S > subitem.height_S) {
			    subitem.glue_state = 1 + subitem._glue_stretch_order;
			    if (subitem._glue_stretch_S == 0)
				subitem.glue_set = 0.;
			    else
				subitem.glue_set = 1.0 * (t_S - subitem.height_S) / subitem._glue_stretch_S;
			} else {
			    subitem.glue_state = -1 - subitem._glue_shrink_order;
			    if (subitem._glue_shrink_S == 0)
				subitem.glue_set = 0.;
			    else if (subitem.glue_state == -1 && subitem.height_S - t_S > subitem._glue_shrink_S)
				subitem.glue_set = 1.;
			    else
				subitem.glue_set = 1.0 * (subitem.height_S - t_S) / subitem._glue_shrink_S;
			}

			subitem.height_S = w_S;
		    } else {
			// TTP 810
			subitem.height_S = item.height_S;
			subitem.depth_S = item.depth_S;

			if (subitem.width_S == t_S) {
			    subitem.glue_state = 1;
			    subitem.glue_set = 0.;
			} else if (t_S > subitem.width_S) {
			    subitem.glue_state = 1 + subitem._glue_stretch_order;
			    if (subitem._glue_stretch_S == 0)
				subitem.glue_set = 0.;
			    else
				subitem.glue_set = 1.0 * (t_S - subitem.width_S) / subitem._glue_stretch_S;
			} else {
			    subitem.glue_state = -1 - subitem._glue_shrink_order;
			    if (subitem._glue_shrink_S == 0)
				subitem.glue_set = 0.;
			    else if (subitem.glue_state == -1 && subitem.width_S - t_S > subitem._glue_shrink_S)
				subitem.glue_set = 1.;
			    else
				subitem.glue_set = 1.0 * (subitem.width_S - t_S) / subitem._glue_shrink_S;
			}

			subitem.width_S = w_S;
		    }

		    subitem.shift_amount_S = nlib.Zero_S;
		    newlist.push (subitem);
		    newlist.push (item.list[j+1]); // next tabskip glue; unsure about correctness with \spans
		    newlist = newlist.concat (extra_items);
		    col += subitem.nspanned;
		}

		item.list = newlist;
		engine.trace ('align row after adjustment: %U', item);
	    } else if (item instanceof Rule) {
		// TTP 806. Make the rule full-width if it has "running"
		// dimensions.
		engine.trace ('XXX TODO: running rule widths');
	    }
	}

	// TTP 812
	if (engine.mode () == M_DMATH) {
	    throw new TexInternalError ('not implemented: math displays');
	} else {
	    // TeX effectively does "engine.accum_list (list)". We instead generate
	    // a CanvasBox.
	    var b;

	    if (astate.is_valign)
		b = new HBox ();
	    else
		b = new VBox ();

	    b.list = list;
	    b.set_glue__OOS (engine, false, nlib.Zero_S);
	    engine.accum (new CanvasBox (b));

	    if (engine.mode () == M_VERT || engine.mode () == M_IVERT)
		engine.run_page_builder ();
	}
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

    register_command ('<endv>', (function EndvCommand_closure () {
	// This is kind of lame -- we need to implement a whole EndvCommand
	// class so that we can instantiate a command for the Engine.

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
