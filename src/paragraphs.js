// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Paragraphs -- essentially, constructing vertical lists from horizontal
// lists. This is a lot easier than what TeX has to do since we don't need to
// linebreak!

(function paragraphs_closure () {
    engine_proto.register_state ({
	engine_init: function (engine) {
	    // This is TeX's adjust_{head,tail}, which are used to pull
	    // inserts, marks, and vadjusts out of hlists. I'm not at all
	    // happy about using a global for this but it's not very obvious
	    // how all of the pieces fit together within TeX.
	    engine.pending_adjustments = [];
	    engine.partag_settings = [true]; // controls automatic insertion of <p> tags
	    engine.partag_inserted_stack = [];
	},
	is_clean: function (engine) {
	    return engine.pending_adjustments.length == 0 && engine.partag_settings.length == 1;
	},
    });

    engine_proto.register_method ('normal_paragraph', function Engine_normal_paragraph () {
	// TTP 1070, "normal_paragraph"
	this.set_parameter (T_INT, 'looseness', 0);
	this.set_parameter__OS ('hangindent', nlib.Zero_S);
	this.set_parameter (T_INT, 'hangafter', 1);
	// XXX: ignoring \parshape settings
    });

    engine_proto.register_method ('begin_graf', function Engine_begin_graf (indent) {
	// TTP 1091. Due to our different page-builder approach, we run it
	// unconditionally at the top of the function, before doing the stuff
	// to start the next paragraph.
	this.trace ('@ new paragraph - maybe run page builder');
	if (this.mode () == M_VERT)
	    this.run_page_builder ();

	this.set_prevgraf (0);

	if (this.mode () == M_VERT || this.get_cur_list ().length)
	    this.accum (new BoxGlue (this.get_parameter (T_GLUE, 'parskip')));

	this.enter_mode (M_HORZ);
	this.set_spacefactor (1000);

	// webtex special!
	this.partag_inserted_stack.push (this.partag_settings[0]);
	if (this.partag_settings[0])
	    this.accum (new StartTag ('p', 'par', {})); // XXX pursue delimgroup applicability...

	// We don't run the linebreaking algorithm so we should insert
	// \leftskip manually. TeX doesn't bother to insert it if it's zero.
	var ls = this.get_parameter (T_GLUE, 'leftskip');
	if (ls.is_nonzero ())
	    this.accum (new BoxGlue (ls));

	if (indent) {
	    var b = new HBox ();
	    b.width_S = this.get_parameter__O_S ('parindent');
	    b.set_glue__OOS (this, false, nlib.Zero_S);
	    this.accum (b);
	}

	this.maybe_push_toklist ('everypar');
    });

    engine_proto.register_method ('line_break', function Engine_line_break (list) {
	// We don't run the linebreaking algorithm. Instead we think of this
	// "paragraph" as one giant wide line. That makes it appropriate to
	// insert a \rightskip at the end of the line.

	list.push (new Penalty (10000));
	list.push (new BoxGlue (this.get_parameter (T_GLUE, 'parfillskip')));
	list.push (new BoxGlue (this.get_parameter (T_GLUE, 'rightskip')));

	if (this.partag_inserted_stack.pop ()) // webtex special!
	    list.push (new EndTag ('p', 'par'));

	var hbox = new HBox ();
	hbox.list = list;
	hbox.set_glue__OOS (this, false, nlib.Zero_S, this.pending_adjustments);
	// skip: interline glue and penalties
	// Pretend that linebreaking was just fine:
	hbox.width_S = this.get_parameter__O_S ('hsize');

	// TTP 888:
	this.accum_to_vlist (hbox);

	if (this.pending_adjustments.length) {
	    this.accum_list (this.pending_adjustments);
	    this.pending_adjustments = [];
	}
    });

    engine_proto.register_method ('end_graf', function Engine_end_graf () {
	// TTP 1096.
	if (this.mode () != M_HORZ)
	    return;

	var list = this.leave_mode ();
	if (!list.length)
	    return;

	this.line_break (list);
	this.normal_paragraph ();

	if (this.mode () == M_VERT)
	    this.run_page_builder (); // webtex special
    });

    register_command ('par', function cmd_par (engine) {
	var m = engine.mode ();

	if (m == M_VERT || m == M_IVERT) {
	    // TTP 1070
	    engine.trace ('par: vertical -> reset params');
	    engine.normal_paragraph ();
	} else if (m == M_RHORZ) {
	    engine.trace ('par: rhorz -> noop');
	} else if (m == M_HORZ) {
	    // TeXBook p. 286:
	    engine.trace ('par: horz -> endgraf');
	    engine.end_graf ();
	} else {
	    throw new TexRuntimeError ('illegal use of \\par in math mode');
	}
    });

    register_command ('indent', function cmd_indent (engine) {
	engine.begin_graf (true);
    });

    register_command ('noindent', function cmd_noindent (engine) {
	engine.begin_graf (false);
    });

    register_command ('parshape', function cmd_parshape (engine) {
	// TTP 1248, "set_shape"
	engine.scan_optional_equals ();
	var n = engine.scan_int__I ();
	engine.trace ('parshape: scanning dimens for %d lines', n);

	for (var i = 0; i < n; i++) { // note: does right thing if n <= 0
	    var indent_S = engine.scan_dimen__O_S (false);
	    var width_S = engine.scan_dimen__O_S (false);
	    engine.trace ('parshape: line %d: indent=%S width=%S', i + 1, indent_S, width_S);
	}

	engine.trace ('parshape: ignoring results');
    });

    register_command ('WEBTEXpushparon', function cmd_webtex_pushparon (engine) {
	engine.trace ('WEBTEX pushparon');
	engine.partag_settings.unshift (true);
    });

    register_command ('WEBTEXpushparoff', function cmd_webtex_pushparoff (engine) {
	engine.trace ('WEBTEX pushparoff');
	engine.partag_settings.unshift (false);
    });

    register_command ('WEBTEXpopparctl', function cmd_webtex_popparctl (engine) {
	if (engine.partag_settings.length < 2)
	    throw new TexRuntimeError ('cannot \\WEBTEXpopparctl: at bottom of stack');

	engine.partag_settings.shift ();
	engine.trace ('WEBTEX popparctl: now partags = %b', engine.partag_settings[0]);
    });
}) ();
