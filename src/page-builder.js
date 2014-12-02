// The page builder
//
// We "defuse" it and just ship out the main vertical list as it gets built.
// This means that we need to hack the internals of LaTeX to output floats
// directly, since it only puts them into the MVL in the output routine by
// default, but I think that's better than trying to emulate the page builder,
// since there are a bunch of finicky height calculations to determine when
// and where to output floats.

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

	this.trace ('@@ defused page builder @@');
	var vbox = new VBox ();
	vbox.list = this.get_cur_list ();
	vbox.expand_adjustments ();
	vbox.set_glue__OOS (this, false, nlib.Zero_S);
	this.reset_cur_list ();
	this.shiptarget.process (this, vbox);
    });

    register_command ('shipout', function cmd_shipout (engine) {
	throw new TexRuntimeError ('\\shipout shouldn\'t be called with defused page builder');
    });
}) ();
