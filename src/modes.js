// TeX's stack of modes or its "semantic nest". This mainly contains the
// current mode setting (vertical, horizontal, math) and the current "list"
// that is being built.
//
// We copy TeX's semantics of mode < 0 implying the "restricted" modes and
// -mode being the restricted version of mode. modes > 0 are the "privileged"
// modes.
//
// Because we're almost always interested in the current mode, the mode stack
// stores the current mode in [0] and goes deeper with higher indices; so we
// use shift() and unshift() rather than push() and pop() to manipulate the
// stack.

var M_VERT = 1,  // standard vertical mode
    M_IVERT = -1, // internal vertical mode
    M_HORZ = 2,  // standard horizontal mode
    M_RHORZ = -2, // restricted horizontal mode
    M_DMATH = 3,  // display math mode
    M_MATH = -3, // standard math mode
    M_WRITE_IN_SHIPOUT = 0;

(function modes_wrapper () {
    var _mode_abbrev = [
	'math', 'rhorz', 'ivert', 'write-in-shipout', 'vert', 'horz', 'dmath'
    ];

    function mode_name (mode) {
	return _mode_abbrev[mode + 3];
    }

    var ignore_depth_S = nlib.from_raw__I_S (-65536000); // TTP 212


    var ModeState = (function ModeState_wrapper () {
	function ModeState (mode) {
	    this.mode = mode;
	    this.list = [];
	    this.prev_graf = 0;
	    this.prev_depth_S = nlib.Zero_S;
	    this.spacefactor = 0;
	    this.clang = 0;
	    this.unfinished_math_node = null; // "incompleat_noad"
	    // TeX also maintains "mode_line", the source line where this mode
	    // was entered, but we're not there yet.
	}

	var proto = ModeState.prototype;

	return ModeState;
    }) ();

    engine_proto.register_state ({
	engine_init: function (engine) {
	    engine.mode_stack = [new ModeState (M_VERT)];
	    engine.mode_stack[0].prev_depth_S = ignore_depth_S;
	},

	is_clean: function (engine) {
	    return engine.mode_stack.length == 1;
	}
    });


    // General interrogation of the mode state.

    engine_proto.register_method ('mode', function Engine_mode () {
	return this.mode_stack[0].mode;
    });

    engine_proto.register_method ('absmode', function Engine_absmode () {
	// By virtue of how the mode constants are defined, this eliminates
	// the restrictedness information.
	return Math.abs (this.mode_stack[0].mode);
    });

    engine_proto.register_method ('get_cur_list', function Engine_get_cur_list () {
	return this.mode_stack[0].list;
    });


    // Mode changes.

    engine_proto.register_method ('enter_mode', function Engine_enter_mode (mode) {
	this.trace ('<enter %s mode>', mode_name (mode));
	this.mode_stack.unshift (new ModeState (mode));
    });

    engine_proto.register_method ('leave_mode', function Engine_leave_mode (mode) {
	if (this.mode_stack.length == 1)
	    throw new TexInternalError ('cannot leave the outer vertical mode');

	var old_state = this.mode_stack.shift ();
	this.trace ('<leave %s mode: %d items>',
		    mode_name (old_state.mode),
		    old_state.list.length);
	return old_state.list;
    });

    engine_proto.register_method ('ensure_horizontal', function Engine_ensure_horizontal (cmd) {
	// If we must start a new paragraph, we have to push the command back
	// onto the input stack (TTP back_input) before doing so, because the
	// output routine might execute and may insert tokens between this
	// command and any arguments it may have.

	if (this.absmode () == M_VERT) {
	    this.push_back (Token.new_cmd (cmd)); // could this mess up align_state maintenance?
	    this.begin_graf (true);
	    return true; // command will be rerun
	}

	return false;
    });

    engine_proto.register_method ('ensure_vertical', function Engine_ensure_vertical (cmd) {
	// Here, we want to escape to vmode. If we're in horizontal mode,
	// insert a \par then reread the current command.
	var m = this.mode ();

	if (m == M_VERT || m == M_IVERT)
	    return false;

	if (m == M_HORZ) {
	    this.push_back (Token.new_cmd (cmd)); // could this mess up align_state maintenance?
	    this.push (Token.new_cmd (this.commands['par']));
	    return true;
	}

	throw new TexRuntimeError ('need to, but cannot, escape to vertical mode');
    });


    // Manipulation and interrogation of the current list.

    engine_proto.register_method ('accum', function Engine_accum (item) {
	var ms = this.mode_stack[0];
	ms.list.push (item);

	// spacefactor management. TeXBook p. 76.

	if (item.ltype == LT_CHARACTER) {
	    var prevsf = ms.spacefactor;
	    var thissf = this.get_code (CT_SPACEFAC, item.ord);
	    var newsf = null;

	    if (thissf == 1000) {
		newsf = 1000;
	    } else if (thissf < 1000) {
		if (thissf > 0)
		    newsf = thissf;
	    } else if (prevsf < 1000) {
		newsf = 1000;
	    } else {
		newsf = thissf;
	    }

	    if (newsf != null)
		ms.spacefactor = newsf;
	} else if (item instanceof Boxlike) {
	    ms.spacefactor = 1000;
	}
    });

    engine_proto.register_method ('accum_list', function Engine_accum_list (list) {
	// unhbox and friends do not cause \prevdepth etc. to be computed, so we don't
	// process individual items.
	Array.prototype.push.apply (this.mode_stack[0].list, list);
    });

    engine_proto.register_method ('accum_to_vlist', function Engine_accum_to_vlist (item) {
	// TTP 679 "append_to_vlist". This function is needed to add the
	// baselineskip glue, which we need for things like alignments and
	// some aspects of equations.

	var ms = this.mode_stack[0];

	if (ms.prev_depth_S > ignore_depth_S) {
	    var bs = this.get_parameter (T_GLUE, 'baselineskip');
	    var d_S = bs.amount_S - ms.prev_depth_S - item.height_S;
	    var g;

	    if (d_S < this.get_parameter (T_DIMEN, 'lineskiplimit'))
		g = this.get_parameter (T_GLUE, 'lineskip');
	    else {
		var g = this.get_parameter (T_GLUE, 'baselineskip').clone ();
		g.amount_S = d_S;
	    }

	    ms.list.push (new BoxGlue (g));
	}

	ms.list.push (item);
	ms.prev_depth_S = item.depth_S;
    });

    engine_proto.register_method ('get_last_listable', function Engine_get_last_listable () {
	var list = this.get_cur_list ();
	var l = list.length;

	if (l == 0)
	    return null;
	return list[l - 1];
    });

    engine_proto.register_method ('pop_last_listable', function Engine_pop_last_listable () {
	var list = this.get_cur_list ();
	var l = list.length;

	if (l == 0)
	    throw new TexInternalError ('build_stack empty');
	return list.pop ();
    });

    engine_proto.register_method ('handle_un_listify',
				  function Engine_handle_un_listify (targtype) {
	// TODO?: TeXBook p. 280: not allowed in vmode if main vertical list
	// has been entirely contributed to current page.

	var list = this.get_cur_list ();
	var l = list.length;

	if (l == 0)
	    return;

	if (list[l - 1].ltype == targtype)
	    list.pop ();
    });

    engine_proto.register_method ('reset_cur_list', function Engine_reset_cur_list () {
	// This is needed to support handle_math_fraction().
	this.mode_stack[0].list = [];
    });


    // Mode variables: spacefactor

    engine_proto.register_method ('get_spacefactor', function Engine_get_spacefactor () {
	var ms = this.mode_stack[0];
	if (Math.abs (ms.mode) != M_HORZ)
	    throw new TexInternalError ('cannot get spacefactor in %s mode',
				       mode_name (ms.mode));
	return ms.spacefactor;
    });

    engine_proto.register_method ('set_spacefactor', function Engine_set_spacefactor (val) {
	var ms = this.mode_stack[0];
	if (Math.abs (ms.mode) != M_HORZ)
	    throw new TexInternalError ('cannot set spacefactor in %s mode',
				       mode_name (ms.mode));
	ms.spacefactor = val;
    });

    var SpacefactorValref = (function SpacefactorValref_closure () {
	function SpacefactorValref () {
	    Valref.call (this, T_INT);
	}

	inherit (SpacefactorValref, Valref);
	var proto = SpacefactorValref.prototype;

	proto.get = function SpacefactorValref_get (engine) {
	    return Value.ensure_boxed (this.valtype, engine.get_spacefactor ());
	};

	proto.set = function SpacefactorValref_set (engine, value) {
	    engine.set_spacefactor (Value.ensure_unboxed (this.valtype, value));
	};

	return SpacefactorValref;
    }) ();

    register_assignment_command ('spacefactor', T_INT, function spacefactor_as_valref () {
	return new SpacefactorValref ();
    });


    // Mode variables: prevgraf

    engine_proto.register_method ('get_prevgraf', function Engine_get_prevgraf () {
	return this.mode_stack[0].prevgraf;
    });

    engine_proto.register_method ('set_prevgraf', function Engine_set_prevgraf (val) {
	this.mode_stack[0].prevgraf = val;
    });

    var PrevgrafValref = (function PrevgrafValref_closure () {
	function PrevgrafValref () {
	    Valref.call (this, T_INT);
	}

	inherit (PrevgrafValref, Valref);
	var proto = PrevgrafValref.prototype;

	proto.get = function PrevgrafValref_get (engine) {
	    return Value.ensure_boxed (this.valtype, engine.get_prevgraf ());
	};

	proto.set = function PrevgrafValref_set (engine, value) {
	    engine.set_prevgraf (Value.ensure_unboxed (this.valtype, value));
	};

	return PrevgrafValref;
    }) ();

    register_assignment_command ('prevgraf', T_INT, function prevgraf_as_valref () {
	return new PrevgrafValref ();
    });


    // Mode variables: prevdepth

    engine_proto.register_method ('get_prevdepth__S', function Engine_get_prevdepth__S () {
	var ms = this.mode_stack[0];
	if (Math.abs (ms.mode) != M_VERT)
	    throw new TexInternalError ('cannot get prevdepth in %s mode',
					mode_name (ms.mode));
	return ms.prev_depth_S;
    });

    engine_proto.register_method ('set_prevdepth__S', function Engine_set_prevdepth__S (val_S) {
	var ms = this.mode_stack[0];
	if (Math.abs (ms.mode) != M_VERT)
	    throw new TexInternalError ('cannot set prevdepth in %s mode',
					mode_name (ms.mode));
	ms.prev_depth_S = val_S;
    });

    engine_proto.register_method ('set_prev_depth_to_ignore',
				  function Engine_set_prev_depth_to_ignore () {
	var ms = this.mode_stack[0];

	if (Math.abs (ms.mode) != M_VERT)
	    throw new TexInternalError ('cannot alter prev_depth in %s mode',
					mode_name (ms.mode));

	ms.prev_depth_S = ignore_depth_S;
    });

    var PrevdepthValref = (function PrevdepthValref_closure () {
	function PrevdepthValref () {
	    Valref.call (this, T_DIMEN);
	}

	inherit (PrevdepthValref, Valref);
	var proto = PrevdepthValref.prototype;

	proto.get = function PrevdepthValref_get (engine) {
	    return Value.ensure_boxed (this.valtype, engine.get_prevdepth__S ());
	};

	proto.set = function PrevdepthValref_set (engine, value_S) {
	    engine.set_prevdepth__S (Value.ensure_unboxed (this.valtype, value_S));
	};

	return PrevdepthValref;
    }) ();

    register_assignment_command ('prevdepth', T_DIMEN, function prevdepth_as_valref () {
	return new PrevdepthValref ();
    });


    // Mode variables: unfinished_math_node ("incompleat_noad")

    engine_proto.register_method ('get_unfinished_math_node',
				  function Engine_get_unfinished_math_node () {
	var ms = this.mode_stack[0];
	if (Math.abs (ms.mode) != M_DMATH)
	    throw new TexInternalError ('cannot get unfinished_math_node in %s mode',
					mode_name (ms.mode));
	return ms.unfinished_math_node;
    });

    engine_proto.register_method ('set_unfinished_math_node',
				  function Engine_set_unfinished_math_node (val) {
	var ms = this.mode_stack[0];
	if (Math.abs (ms.mode) != M_DMATH)
	    throw new TexInternalError ('cannot set unfinished_math_node in %s mode',
				       mode_name (ms.mode));
	ms.unfinished_math_node = val;
    });
}) ();
