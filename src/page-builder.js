// The page builder
//
// Even though the whole point of webtex is that we don't concern ourselves
// with sticking things on discrete pages, we still need a solid page-builder
// implementation because many packages use the page builder to achieve
// various complex effects that we need to support.

(function page_builder_closure () {

    engine_proto.register_method ('run_page_builder', function Engine_run_page_builder () {
	// Real TeX pays attention to the height of the page-in-progress and
	// decides to break with a bunch of complex logic. We don't need any
	// of that because the whole point is that computer monitors don't
	// need pagination! So in Webtex the page builder has to be explicitly
	// called.

	if (this.mode () != M_VERT)
	    throw new TexInternalError ('tried to build page outside of vertical mode');
	if (this.mode_stack.length != 1)
	    throw new TexInternalError ('vertical mode is not deepest?')

	if (this._running_output)
	    return; // TTP 994.

	// Hacky version of \outputpenalty setting -- TeXBook p. 125. We should
	// preserve the penalty for the next batch of output, but since (I think)
	// we don't need it for anything, we just pop it off the list.

	var list = this.get_cur_list ();
	var l = list.length;

	if (l > 0 && list[l-1].ltype == LT_PENALTY) {
	    this.set_parameter (T_INT, 'outputpenalty', list[l-1].amount);
	    list.pop ();
	} else {
	    this.set_parameter (T_INT, 'outputpenalty', 10000);
	}

	// See TeXBook p. 125.

	var vbox = new VBox ();
	vbox.list = list;
	vbox.set_glue__OOS (this, false, nlib.Zero_S);
	this.set_register (T_BOX, 255, vbox);
	this.reset_cur_list ();
	this._running_output = true;

	function finish_output (eng) {
	    this.end_graf ();
	    this.unnest_eqtb ();
	    this._running_output = false;
	    // TODO: deal with held-over insertions, etc. T:TP 1026.
	};

	var outtl = this.get_parameter (T_TOKLIST, 'output');
	this.trace ('*output -> %T', outtl);
	this.trace ('*box255 = %U', vbox);
	this.nest_eqtb ();
	this.enter_group ('output routine', finish_output.bind (this));
	this.push (Token.new_cmd (this.commands['<end-group>']));
	this.push_toks (outtl.toks);

	// Not happy about this recursion but other functions really want the
	// page builder to operate atomically.

	while (this._running_output) {
	    var rv = this.step ();
	    if (rv === EOF)
		throw new TexRuntimeError ('EOF inside output routine??');
	}
    });

    register_command ('shipout', function cmd_shipout (engine) {
	function ship_it_good (engine, box) {
	    // Note: any box type (void, hbox, vbox) is OK to ship out.
	    engine.trace ('shipping out');
	    engine.set_register (T_BOX, 255, new VoidBox ());
	    engine.shiptarget.process (engine, box);
	};

	engine.trace ('shipout');
	engine.scan_box (ship_it_good, false);
    });
}) ();
