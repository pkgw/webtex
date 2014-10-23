var EquivTable = (function EquivTable_closure () {
    function EquivTable (parent) {
	this.parent = parent;

	if (parent == null) {
	    this.toplevel = this;
	    this.depth = 0;
	    this._catcodes = new Array (256);
	} else {
	    this.toplevel = parent.toplevel;
	    this.depth = parent.depth + 1;
	    this._catcodes = parent._catcodes.slice ();
	}

	engine_proto._call_state_funcs ('nested_init', this);

	this._codes = {};
	this._codes[CT_LOWERCASE] = {};
	this._codes[CT_UPPERCASE] = {};
	this._codes[CT_SPACEFAC] = {};
	this._codes[CT_MATH] = {};
	this._codes[CT_DELIM] = {};

	this._actives = {};
	this._cseqs = {};
	this._font_families = {};
	this._font_families[MS_TEXT] = {};
	this._font_families[MS_SCRIPT] = {};
	this._font_families[MS_SCRIPTSCRIPT] = {};
	this._misc = {};

	if (parent == null)
	    this._toplevel_init ();
    }

    var proto = EquivTable.prototype;

    proto.get_code = function EquivTable_get_code (codetype, ord) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number %d', ord);

	if (codetype == CT_CATEGORY)
	    return this._catcodes[ord];

	if (this._codes[codetype].hasOwnProperty (ord))
	    return this._codes[codetype][ord];
	return this.parent.get_code (codetype, ord);
    };

    proto.set_code = function EquivTable_set_code (codetype, ord, value, global) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number %d', ord);
	if ((value < 0 && codetype != CT_DELIM) || value > ct_maxvals[codetype])
	    throw new TexRuntimeError ('illegal %s value %o', ct_names[codetype], value);

	if (codetype == CT_CATEGORY)
	    this._catcodes[ord] = value;
	else
	    this._codes[codetype][ord] = value;

	if (global && this.parent != null)
	    this.parent.set_code (codetype, ord, value, global);
    };

    proto.get_active = function EquivTable_get_active (ord) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number %d', ord);

	if (this._actives.hasOwnProperty (ord))
	    return this._actives[ord];
	if (this.parent == null)
	    return null;
	return this.parent.get_active (ord);
    };

    proto.set_active = function EquivTable_set_active (ord, value, global) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number %d', ord);

	this._actives[ord] = value;

	if (global && this.parent != null)
	    this.parent.set_active (ord, value, global);
    };

    proto.get_cseq = function EquivTable_get_cseq (name) {
	if (this._cseqs.hasOwnProperty (name))
	    return this._cseqs[name];
	if (this.parent == null)
	    return null;
	return this.parent.get_cseq (name);
    };

    proto.set_cseq = function EquivTable_set_cseq (name, value, global) {
	this._cseqs[name] = value;

	if (global && this.parent != null)
	    this.parent.set_cseq (name, value, global);
    };

    proto.get_font_family = function EquivTable_get_font_family (style, index) {
	if (style < MS_TEXT || style > MS_SCRIPTSCRIPT)
	    throw new TexRuntimeError ('illegal font family style %d', style);
	if (index < 0 || index > 15)
	    throw new TexRuntimeError ('illegal font family number %d', index);

	if (this._font_families[style].hasOwnProperty (index))
	    return this._font_families[style][index];
	if (this.parent == null)
	    return null;
	return this.parent.get_font_family (style, index);
    };

    proto.set_font_family = function EquivTable_set_font_family (style, index, value, global) {
	if (style < MS_TEXT || style > MS_SCRIPTSCRIPT)
	    throw new TexRuntimeError ('illegal font family style %d', style);
	if (index < 0 || index > 15)
	    throw new TexRuntimeError ('illegal font family number %d', index);

	this._font_families[style][index] = value;

	if (global && this.parent != null)
	    this.parent.set_font_family (style, index, value, global);
    };

    proto.get_misc = function EquivTable_get_misc (name) {
	if (this._misc.hasOwnProperty (name))
	    return this._misc[name];
	if (this.parent == null)
	    return null;
	return this.parent.get_misc (name);
    };

    proto.set_misc = function EquivTable_set_misc (name, value) {
	this._misc[name] = value;
    };

    proto._toplevel_init = function EquivTable__toplevel_init () {
	engine_proto._call_state_funcs ('nested_toplevel_init', this);

	for (var i = 0; i < 256; i++) {
	    this._catcodes[i] = C_OTHER;
	    this._codes[CT_MATH][i] = i;
	    this._codes[CT_SPACEFAC][i] = 1000;
	    this._codes[CT_DELIM][i] = -1;
	    this._codes[CT_LOWERCASE][i] = 0;
	    this._codes[CT_UPPERCASE][i] = 0;
	}

	for (var i = 0; i < 26; i++) {
	    this._catcodes[O_LC_A + i] = C_LETTER;
	    this._catcodes[O_UC_A + i] = C_LETTER;
	    this._codes[CT_MATH][O_LC_A + i] = O_LC_A + i + 0x7100;
	    this._codes[CT_MATH][O_UC_A + i] = O_UC_A + i + 0x7100;
	    this._codes[CT_UPPERCASE][O_UC_A + i] = O_UC_A + i;
	    this._codes[CT_UPPERCASE][O_LC_A + i] = O_UC_A + i;
	    this._codes[CT_LOWERCASE][O_UC_A + i] = O_LC_A + i;
	    this._codes[CT_LOWERCASE][O_LC_A + i] = O_LC_A + i;
	    this._codes[CT_SPACEFAC][O_UC_A + i] = 999;
	}

	for (var i = 0; i < 10; i++)
	    this._codes[CT_MATH][O_ZERO + i] = O_ZERO + i + 0x7000;

	this._catcodes[O_NULL] = C_IGNORE;
	this._catcodes[O_BACKSPACE] = C_INVALID;
	this._catcodes[O_RETURN] = C_EOL;
	this._catcodes[O_SPACE] = C_SPACE;
	this._catcodes[O_PERCENT] = C_COMMENT;
	this._catcodes[O_BACKSLASH] = C_ESCAPE;
	this._codes[CT_DELIM][O_PERIOD] = 0;

	this._misc.cur_font = null;

	for (var i = 0; i < 16; i++) {
	    this._font_families[MS_TEXT][i] = null;
	    this._font_families[MS_SCRIPT][i] = null;
	    this._font_families[MS_SCRIPTSCRIPT][i] = null;
	}

    };

    // Serialization. Our equivalent of the \dump primitive.

    proto.serialize = function Eqtb_serialize (state, housekeeping) {
	var i = 0;
	var name = null;

	state.catcodes = this._catcodes;
	state.commands = {};
	state.actives = {};

	engine_proto._call_state_funcs ('nested_serialize', this, state, housekeeping);

	for (i = 0; i < 256; i++) {
	    if (this._actives.hasOwnProperty (i))
		state.actives[i] = this._actives[i].get_serialize_ident (state, housekeeping);
	}

	// Various other "codes".

	state.codes = {lower: [], upper: [], spacefac: [], math: [], delim: []};

	for (i = 0; i < 256; i++) {
	    state.codes.lower.push (this._codes[CT_LOWERCASE][i]);
	    state.codes.upper.push (this._codes[CT_UPPERCASE][i]);
	    state.codes.spacefac.push (this._codes[CT_SPACEFAC][i]);
	    state.codes.math.push (this._codes[CT_MATH][i]);
	    state.codes.delim.push (this._codes[CT_DELIM][i]);
	}

	// Control seqs.

	state.cseqs = {};

	for (name in this._cseqs) {
	    if (!this._cseqs.hasOwnProperty (name))
		continue;

	    state.cseqs[name] = this._cseqs[name].get_serialize_ident (state, housekeeping);
	}

	// Font families.

	state.font_families = {text: [], script: [], scriptscript: []};

	for (i = 0; i < 16; i++) {
	    var f = this._font_families[MS_TEXT][i];
	    if (f == null)
		state.font_families.text.push ('<null>');
	    else
		state.font_families.text.push (f.get_serialize_ident (state, housekeeping));

	    var f = this._font_families[MS_SCRIPT][i];
	    if (f == null)
		state.font_families.script.push ('<null>');
	    else
		state.font_families.script.push (f.get_serialize_ident (state, housekeeping));

	    var f = this._font_families[MS_SCRIPTSCRIPT][i];
	    if (f == null)
		state.font_families.scriptscript.push ('<null>');
	    else
		state.font_families.scriptscript.push (f.get_serialize_ident (state, housekeeping));
	}

	// Miscellaneous nestable parameters.

	state.misc = {};
	state.misc.cur_font = this._misc.cur_font.get_serialize_ident (state, housekeeping);

	return state;
    };

    engine_proto._apply_nesting_methods (proto);

    return EquivTable;
})();


var Engine = (function Engine_closure () {
    var AF_GLOBAL = 1 << 0;
    var BO_SETBOX = 0;

    function Engine (args) {
	/* Possible properties of args:
	 *
	 * iostack - an IOStack with TeX files (required)
	 * debug_input_lines - print lines of input as they're read
	 * debug_trace - print commands as they're executed
	 * initial_linebuf - LineBuffer of the initial input (required)
	 * jobname - the TeX job name
	 * shiptarget - target that will receive \shipout{} data.
	 */

	this.jobname = args.jobname || 'texput';
	this.iostack = args.iostack;
	this.shiptarget = args.shiptarget;

	this.inputstack = new InputStack (args.initial_linebuf, this, args);
	this._force_end = false;

	this.eqtb = new EquivTable (null);

	// See TeXBook p. 271. These are global.
	this.special_values = {};
	this.special_values[T_INT] = {};
	this.special_values[T_DIMEN] = {};
	this.set_special_value (T_INT, 'spacefactor', 1000);
	this.set_special_value (T_INT, 'prevgraf', 0);
	this.set_special_value (T_INT, 'deadcycles', 0);
	this.set_special_value (T_INT, 'insertpenalties', 0);
	this.set_special_value (T_DIMEN, 'prevdepth', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagegoal', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagetotal', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagestretch', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagefilstretch', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagefillstretch', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagefilllstretch', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pageshrink', nlib.Zero_S);
	this.set_special_value (T_DIMEN, 'pagedepth', nlib.Zero_S);

	this._fonts = {};

	this.mode_stack = [M_VERT];
	this.build_stack = [[]];
	this.group_exit_stack = [];
	this.boxop_stack = [];

	this.assign_flags = 0;
	this.after_assign_token = null;

	this.infiles = [];
	this.outfiles = [];
	for (var i = 0; i < 16; i++) {
	    this.infiles[i] = null;
	    this.outfiles[i] = null;
	}

	this.commands = {};
	fill_cseq_commands (this);
	engine_init_parameters (this);
	engine_init_param_cseqs (this);
	this.commands['<space>'] = new Command.catcode_commands[C_SPACE] (O_SPACE);
	this.commands['<end-group>'] = new Command.catcode_commands[C_EGROUP] (O_LEFT_BRACE);
	this.commands['<endv>'] = new register_command._registry._endv_ ();

	engine_proto._call_state_funcs ('engine_init', this);

	var nf = new Font (this, 'nullfont', -1000);
	this._fonts['<null>'] = this._fonts['nullfont'];
	this.set_misc ('cur_font', nf);
	for (var i = 0; i < 16; i++) {
	    this.set_font_family (MS_TEXT, i, nf);
	    this.set_font_family (MS_SCRIPT, i, nf);
	    this.set_font_family (MS_SCRIPTSCRIPT, i, nf);
	}

	if (args.debug_trace)
	    this.trace = this._trace;
	else
	    this.trace = function (t) {};
    }

    var proto = Engine.prototype;

    proto._trace = function Engine__trace (/*implicit*/) {
	arguments[0] = '{' + arguments[0] + '}';
	global_log (format.apply (null, arguments));
    };

    proto.warn = function Engine_warn (text) {
	arguments[0] = '!! ' + arguments[0];
	global_warn (format.apply (null, arguments));
    };


    // Wrappers for the EquivTable.

    proto._global_flag = function Engine__global_flag () {
	// TeXBook p. 275
	var gd = this.get_parameter__O_I ('globaldefs');
	if (gd > 0)
	    return true;
	if (gd < 0)
	    return false;
	return this.assign_flags & AF_GLOBAL;
    };

    proto.get_code = function Engine_get_code (valtype, ord) {
	return this.eqtb.get_code (valtype, ord);
    };

    proto.set_code = function Engine_get_code (valtype, ord, value) {
	this.eqtb.set_code (valtype, ord, value, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    };

    proto.get_active = function Engine_get_active (ord) {
	return this.eqtb.get_active (ord);
    };

    proto.set_active = function Engine_get_active (ord, value) {
	this.eqtb.set_active (ord, value, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    };

    proto.get_cseq = function Engine_get_cseq (name) {
	return this.eqtb.get_cseq (name);
    };

    proto.set_cseq = function Engine_get_cseq (name, cmd) {
	this.eqtb.set_cseq (name, cmd, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    };

    proto.get_font_family = function Engine_get_font_family (style, index) {
	return this.eqtb.get_font_family (style, index);
    };

    proto.set_font_family = function Engine_set_font_family (style, index, value) {
	this.eqtb.set_font_family (style, index, value, this._global_flag ());
	this.maybe_insert_after_assign_token ();
    };

    proto.get_misc = function Engine_get_misc (name) {
	return this.eqtb.get_misc (name);
    };

    proto.set_misc = function Engine_set_misc (name, value) {
	// XXX: track whether any of the miscellaneous parameters allow
	// \global assignments. So far, none do.
	this.eqtb.set_misc (name, value);
	this.maybe_insert_after_assign_token ();
    };

    proto.get_special_value = function Engine_get_special_value (valtype, name) {
	return this.special_values[valtype][name];
    };

    proto.get_special_value__O_I = function Engine_get_special_value__O_I (name) {
	// Alias to help with naming-convention consistency.
	return this.special_values[T_INT][name];
    };

    proto.set_special_value = function Engine_set_special_value (valtype, name, value) {
	this.special_values[valtype][name] = Value.ensure_unboxed (valtype, value);
    };

    proto.get_font = function Engine_get_font (name) {
	return this._fonts[name];
    };

    proto.set_font = function Engine_set_font (name, value) {
	this._fonts[name] = value;
    };

    // Driving everything

    proto.step = function Engine_step () {
	var tok = this.next_x_tok ();
	if (tok === EOF)
	    return tok;

	try {
	    var cmd = tok.to_cmd (this);
	    cmd.invoke (this);
	} catch (e) {
	    if (e === EOF)
		throw new TexRuntimeError ('unexpected EOF while parsing');
	    throw e;
	}

	if (cmd.assign_flag_mode == AFM_INVALID && this.assign_flags)
	    this.warn ('assignment flags applied to inapplicable command %o', cmd);
	else if (cmd.assign_flag_mode != AFM_CONTINUE)
	    this.assign_flags = 0;

	// We successfully completed this step, so we can throw away any old
	// tokens we were holding on to. This is a hangover from the days of
	// the async I/O model; if we eliminated caching of old tokens in the
	// TokenizerInput, we wouldn't need this call.
	this.inputstack.checkpoint ();
	return true;
    };

    // Mode and grouping stuff.

    proto.nest_eqtb = function Engine_nest_eqtb () {
	this.eqtb = new EquivTable (this.eqtb);
    };

    proto.unnest_eqtb = function Engine_unnest_eqtb () {
	if (this.eqtb.parent == null)
	    // if we check after the fact, our standard error-printing mechanism fails.
	    throw new TexInternalError ('unnested eqtb too far');
	this.eqtb = this.eqtb.parent;
    };

    proto.mode = function Engine_mode () {
	return this.mode_stack[this.mode_stack.length - 1];
    };

    proto.enter_mode = function Engine_enter_mode (mode) {
	this.trace ('<enter %s mode>', mode_abbrev[mode]);
	this.mode_stack.push (mode);
	this.build_stack.push ([]);
    };

    proto.leave_mode = function Engine_leave_mode () {
	var oldmode = this.mode_stack.pop ();
	var list = this.build_stack.pop ();
	this.trace ('<leave %s mode: %d items>', mode_abbrev[oldmode], list.length);
	return list;
    };

    proto.ensure_horizontal = function Engine_ensure_horizontal (cmd) {
	// If we must start a new paragraph, we have to push the command back
	// onto the input stack (T:TP back_input) before doing so, because the
	// output routine must execute and may insert tokens between this
	// command and any arguments it may have.
	var m = this.mode ();

	if (m == M_VERT || m == M_IVERT) {
	    this.push_back (Token.new_cmd (cmd));
	    this.begin_graf (true);
	    return true; // command will be rerun
	}

	return false;
    };

    proto.ensure_vertical = function Engine_ensure_vertical (cmd) {
	// Here, we want to escape to vmode. If we're in horizontal mode,
	// insert a \par then reread the current command.
	var m = this.mode ();

	if (m == M_VERT || m == M_IVERT)
	    return false;

	if (m == M_HORZ) {
	    this.push_back (Token.new_cmd (cmd));
	    this.push (Token.new_cmd (this.commands['par']));
	    return true;
	}

	throw new TexRuntimeError ('need to, but cannot, escape to vertical mode');
    };

    proto.enter_group = function Engine_enter_group (groupname, callback) {
	this.trace ('< ---> %d %s>', this.group_exit_stack.length, groupname);
	this.group_exit_stack.push ([groupname, callback, []]);
    };

    proto.handle_bgroup = function Engine_handle_bgroup () {
	this.nest_eqtb ();
	this.enter_group ('simple', function (eng) {
	    this.unnest_eqtb ();
	}.bind (this));
    };

    proto.handle_egroup = function Engine_handle_egroup () {
	if (!this.group_exit_stack.length)
	    throw new TexRuntimeError ('ending a group that wasn\'t started');

	var info = this.group_exit_stack.pop (); // [name, callback, aftergroup-toklist]
	this.trace ('< <--- %d %s>', this.group_exit_stack.length, info[0]);
	info[1] (this);
	this.push_toks (info[2]);
    };

    function _end_semisimple (eng) {
	throw new TexRuntimeError ('expected \\endgroup but got something ' +
				   'else');
    }
    _end_semisimple.is_semisimple = true;

    proto.handle_begingroup = function Engine_handle_begingroup () {
	this.nest_eqtb ();
	this.enter_group ('semi-simple', _end_semisimple);
    };

    proto.handle_endgroup = function Engine_handle_endgroup () {
	if (!this.group_exit_stack.length)
	    throw new TexRuntimeError ('stray \\endgroup');

	var info = this.group_exit_stack.pop (); // [name, callback, aftergroup-toklist]
	if (info[1].is_semisimple !== true)
	    throw new TexRuntimeError ('got \\endgroup when should have ' +
				       'gotten other group-ender; depth=%d cb=%0',
				       this.group_exit_stack.length, info[1]);

	this.trace ('< <--- %d %s>', this.group_exit_stack.length, info[0]);
	this.unnest_eqtb ();
	this.push_toks (info[2]);
    };

    proto.handle_aftergroup = function Engine_handle_aftergroup (tok) {
	var l = this.group_exit_stack.length;
	if (l == 0)
	    throw new TexRuntimeError ('cannot call \\aftergroup outside of a group');

	this.group_exit_stack[l - 1][2].push (tok);
    };

    proto.begin_graf = function Engine_begin_graf (indent) {
	// T:TP 1091. Due to our different page-builder approach,
	// we run it unconditionally at the top of the function,
	// before doing the stuff to start the next paragraph.
	this.trace ('@ new paragraph - maybe run page builder');
	if (this.mode () == M_VERT)
	    this.run_page_builder ();

	this.set_special_value (T_INT, 'prevgraf', 0);

	if (this.mode () == M_VERT || this.build_stack[this.build_stack.length-1].length)
	    this.accum (new BoxGlue (this.get_parameter (T_GLUE, 'parskip')));

	this.enter_mode (M_HORZ);
	this.set_special_value (T_INT, 'spacefactor', 1000);

	this.accum (new StartTag ('p', {})); // webtex special!

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
    };

    proto.end_graf = function Engine_end_graf () {
	// T:TP 1070, 1096.
	if (this.mode () != M_HORZ)
	    return;

	this.handle_un_listify (LT_GLUE);
	var list = this.leave_mode ();
	if (!list.length)
	    return;

	list.push (new Penalty (10000));
	list.push (new BoxGlue (this.get_parameter (T_GLUE, 'parfillskip')));
	// We don't run the linebreaking algorithm. Instead we think of this
	// "paragraph" as one giant wide line. That makes it appropriate to
	// insert a \rightskip at the end of the line.
	list.push (new BoxGlue (this.get_parameter (T_GLUE, 'rightskip')));
	list.push (new EndTag ('p')); // webtex special!
	var hbox = new HBox ();
	hbox.list = list;
	hbox.set_glue__OOS (this, false, nlib.Zero_S);
	// skip: interline glue and penalties
	this.accum (hbox);
	if (this.mode () == M_VERT)
	    this.run_page_builder ();

	this.set_parameter (T_INT, 'looseness', 0);
	this.set_parameter__OS ('hangindent', nlib.Zero_S);
	this.set_parameter (T_INT, 'hangafter', 1);
	// TODO: clear \parshape info, which nests in the EqTb.
    };

    // List-building.

    proto.accum = function Engine_accum (item) {
	this.build_stack[this.build_stack.length - 1].push (item);

	// spacefactor management. TeXBook p. 76.

	if (item.ltype == LT_CHARACTER) {
	    var prevsf = this.get_special_value (T_INT, 'spacefactor');
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
		this.set_special_value (T_INT, 'spacefactor', newsf);
	} else if (item instanceof Boxlike) {
	    this.set_special_value (T_INT, 'spacefactor', 1000);
	}
    };

    proto.accum_list = function Engine_accum_list (list) {
	// unhbox and friends do not cause \prevdepth etc. to be computed, so we don't
	// process individual items.
	Array.prototype.push.apply (this.build_stack[this.build_stack.length - 1],
				    list);
    };

    proto.run_page_builder = function Engine_run_page_builder () {
	// Real TeX pays attention to the height of the page-in-progress and
	// decides to break with a bunch of complex logic. We don't need any
	// of that because the whole point is that computer monitors don't
	// need pagination! So in Webtex the page builder has to be explicitly
	// called.
	if (this.mode () != M_VERT)
	    throw new TexInternalError ('tried to build page outside of vertical mode');
	if (this.build_stack.length != 1)
	    throw new TexInternalError ('vertical mode is not deepest?')

	if (this._running_output)
	    return; // T:TP 994.

	// Hacky version of \outputpenalty setting -- TeXBook p. 125. We should
	// preserve the penalty for the next batch of output, but since (I think)
	// we don't need it for anything, we just pop it off the list.

	var list = this.build_stack[0];
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
	this.build_stack[0] = [];
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
    };

    proto.ship_it = function Engine_ship_it (box) {
	this.trace ('shipping out');
	this.shiptarget.process (box);
    };

    proto.handle_un_listify = function Engine_handle_un_listify (targtype) {
	// TODO?: TeXBook p. 280: not allowed in vmode if main vertical list
	// has been entirely contributed to current page.

	var l = this.build_stack.length;
	if (l == 0)
	    return;

	var list = this.build_stack[l - 1];
	l = list.length;
	if (l == 0)
	    return;

	if (list[l - 1].ltype == targtype)
	    list.pop ();
    };


    // Input nesting and other I/O

    proto.handle_input = function Engine_handle_input (texfn) {
	var lb = this.iostack.try_open_linebuffer (texfn);
	if (lb == null)
	    throw new TexRuntimeError ('can\'t find any matching files for "%s"',
				       texfn);

	this.inputstack.push_linebuf (lb, function patchit () {
	    var p ='__wtpatches__/' + texfn + '.post';
	    var lb = this.iostack.try_open_linebuffer (p);
	    if (lb != null) {
		this.trace ('@ auto-inputting patch file %s', p);
		this.inputstack.push_linebuf (lb, null);
	    }
	}.bind (this));
    };

    proto.handle_endinput = function Engine_handle_endinput () {
	this.inputstack.pop_current_linebuf ();
    };

    proto.handle_end = function Engine_handle_end () {
	// See the TeXBook end of Ch. 23 (p. 264). Terminate if main vertical
	// list is empty and \deadcycles=0. Otherwise insert '\line{} \vfill
	// \penalty-'10000000000' into the main vertical list and reread the
	// \end. \line{} is \hbox to\hsize{}.

	if (this.build_stack[0].length == 0 &&
	    this.get_special_value (T_INT, 'deadcycles') == 0) {
	    this.trace ('... completely done');
	    this._force_end = true;
	} else {
	    this.trace ('... forcing page build');

	    var hb = new HBox ();
	    hb.width_S = this.get_parameter__O_S ('hsize');
	    this.accum (hb);

	    var g = new Glue ();
	    g.stretch_S = nlib.scale__I_S (1);
	    g.stretch_order = 2;
	    this.accum (new BoxGlue (g));

	    this.accum (new Penalty (-1073741824));

	    this.push (Token.new_cmd (this.commands['end']));
	    this.run_page_builder ();
	}
    };

    proto.infile = function Engine_infile (num) {
	if (num < 0 || num > 15)
	    throw new TexRuntimeError ('illegal input file number %d', num);
	return this.infiles[num];
    };

    proto.set_infile = function Engine_set_infile (num, value) {
	if (num < 0 || num > 15)
	    throw new TexRuntimeError ('illegal input file number %d', num);
	this.infiles[num] = value;
    };

    proto.outfile = function Engine_outfile (num) {
	if (num < 0 || num > 15)
	    throw new TexRuntimeError ('illegal output file number %d', num);
	return this.outfiles[num];
    };

    proto.set_outfile = function Engine_set_outfile (num, value) {
	if (num < 0 || num > 15)
	    throw new TexRuntimeError ('illegal output file number %d', num);
	this.outfiles[num] = value;
    };


    // Serialization. Our equivalent of the \dump primitive.

    proto._check_clean = function Engine__check_clean () {
	// For now (?), we're very restrictive about what state we can be in
	// when (de)serializing engine state.

	if (this.inputstack.inputs.length > 1)
	    throw new TexRuntimeError ('can only serialize Engine at topmost input');
	if (this.eqtb.parent !== null)
	    throw new TexRuntimeError ('can only serialize Engine in topmost eqtb');
	if (this.mode_stack.length > 1)
	    throw new TexRuntimeError ('can only serialize Engine in topmost mode');
	if (this.build_stack.length > 1 || this.build_stack[0].length > 0)
	    throw new TexRuntimeError ('cannot serialize Engine with queued build items');
	if (this.group_exit_stack.length > 0)
	    throw new TexRuntimeError ('can only serialize Engine without open groups');
	if (this.boxop_stack.length > 0)
	    throw new TexRuntimeError ('can only serialize Engine without open boxops');
	if (this.assign_flags != 0)
	    throw new TexRuntimeError ('cannot serialize Engine with active assignment flags');
	if (this.after_assign_token != null)
	    throw new TexRuntimeError ('cannot serialize Engine with active ' +
				       'after_assign_token');

	for (var i = 0; i < 16; i++)
	    if (this.infiles[i] != null)
		throw new TexRuntimeError ('cannot serialize Engine with open input files');
	if (!engine_proto._is_clean (this))
	    // XXX terrible message.
	    throw new TexRuntimeError ('cannot serialize Engine with unclean state');
    };

    proto.serialize = function Engine_serialize () {
	this._check_clean ();

	var state = {fonts: []};
	var housekeeping = {commands: {}};

	for (var name in this._fonts)
	    // Don't need to use return value here.
	    this._fonts[name].get_serialize_ident (state, housekeeping);

	return this.eqtb.serialize (state, housekeeping);
    };

    register_command_deserializer ('<begin-group>', BeginGroupCommand.deserialize);
    register_command_deserializer ('<end-group>', EndGroupCommand.deserialize);
    register_command_deserializer ('<given-char>', GivenCharCommand.deserialize);
    register_command_deserializer ('<given-mathchar>', GivenMathcharCommand.deserialize);
    register_command_deserializer ('<macro>', MacroCommand.deserialize);
    register_command_deserializer ('<space>', SpacerCommand.deserialize);
    register_command_deserializer ('<subscript>', SubCommand.deserialize);
    register_command_deserializer ('<superscript>', SuperCommand.deserialize);
    register_command_deserializer ('undefined', UndefinedCommand.deserialize);
    register_command_deserializer ('<given-font>', function deserialize_font (data, hk) {
	return new GivenFontCommand (hk.fonts[data]);
    });

    proto.restore_serialized_state = function Engine_restore_serialized_state (json) {
	this._check_clean ();

	var command_ctors = register_command_deserializer._registry;
	var housekeeping = {fonts: {}};
	var i = 0;

	// First step is to rebuild saved fonts.

	housekeeping.fonts['<null>'] = this._fonts['<null>'];

	for (i = 0; i < json.fonts.length; i++)
	    housekeeping.fonts[i] = Font.deserialize (this, json.fonts[i]);

	// Next step is to rebuild all of the saved commands.

	var cmdids = housekeeping.commands = {};

	for (var kind in json.commands) {
	    var list = json.commands[kind];
	    var n = list.length;
	    var cmd = null;
	    var ctor = command_ctors[kind];

	    if (ctor == null)
		throw new TexRuntimeError ('unhandled stored command kind %o', kind);

	    for (i = 0; i < n; i++)
		cmdids[kind + '/' + i] = ctor (list[i], housekeeping);
	}

	var getcmd = function _getcmd (s) {
	    var c = this.commands[s];
	    if (c == null)
		c = cmdids[s];
	    if (c == null)
		throw new TexRuntimeError ('unresolvable command name %s', s);
	    return c;
	}.bind (this);

	// The rest we can do in about any order. We try to mirror Eqtb.serialize
	// -- it's a little bit sketchy that this function is so far from that,
	// but it seems good to take advantage of our wrapper setter functions.

	engine_proto._call_state_funcs ('deserialize', this, json, housekeeping);

	for (i = 0; i < 255; i++) {
	    this.set_code (CT_CATEGORY, i, json.catcodes[i]);
	    this.set_code (CT_LOWERCASE, i, json.codes.lower[i]);
	    this.set_code (CT_UPPERCASE, i, json.codes.upper[i]);
	    this.set_code (CT_SPACEFAC, i, json.codes.spacefac[i]);
	    this.set_code (CT_MATH, i, json.codes.math[i]);
	    this.set_code (CT_DELIM, i, json.codes.delim[i]);
	}

	for (var ord in json.actives)
	    this.set_active (nlib.parse__O_I (ord), getcmd (json.actives[ord]));

	for (var cseq in json.cseqs)
	    this.set_cseq (cseq, getcmd (json.cseqs[cseq]));

	for (i = 0; i < 16; i++) {
	    this.set_font_family (MS_TEXT, housekeeping.fonts[json.font_families.text[i]]);
	    this.set_font_family (MS_SCRIPT, housekeeping.fonts[json.font_families.script[i]]);
	    this.set_font_family (MS_SCRIPTSCRIPT, housekeeping.fonts[json.font_families.scriptscript[i]]);
	}

	this.set_misc ('cur_font', housekeeping.fonts[json.misc.cur_font]);
    };

    // Tokenization. I'd like to separate this out into its own class,
    // but there are just too many interactions between this subsystem and
    // the rest of the engine.

    proto.push = function Engine_push (tok) {
	this.inputstack.push_toklist ([tok]);
    };

    proto.push_back = function Engine_push_back (tok) {
	// This is a special version of push() that is to be used when the most
	// recently-read token is being returned to the input stream. It
	// un-does changes to align_state that will have just happened.
	this.inputstack.push_toklist ([tok]);

	if (tok.is_cat (C_BGROUP))
	    this.align_state -= 1;
	else if (tok.is_cat (C_EGROUP))
	    this.align_state += 1;
    };

    proto.push_toks = function Engine_push_toks (toks, callback) {
	if (toks instanceof Toklist)
	    toks = toks.toks; // convenience.
	if (!(toks instanceof Array))
	    throw new TexInternalError ('illegal push_toks argument: %o', toks);
	this.inputstack.push_toklist (toks, callback);
    };

    proto.maybe_push_toklist = function Engine_maybe_push_toklist (name) {
	var tl = this.get_parameter (T_TOKLIST, name);
	if (!tl.toks.length)
	    this.trace ('@ %s: empty', name);
	else {
	    this.trace ('@ %s: %T', name, tl);
	    this.push_toks (tl.toks);
	}
    };

    proto.push_string = function Engine_push_string (text) {
	var toks = [].map.call (text, function (c) {
	    if (c == ' ')
		return Token.new_char (C_SPACE, O_SPACE);
	    return Token.new_char (C_OTHER, c.charCodeAt (0));
	});
	this.inputstack.push_toklist (toks);
    };

    proto.next_tok = function Engine_next_tok () {
	if (this._force_end)
	    return EOF;

	var tok = this.inputstack.next_tok ();
	if (tok === EOF)
	    return tok;

	if (tok.is_cat (C_BGROUP)) {
	    this.align_state += 1;
	} else if (tok.is_cat (C_EGROUP)) {
	    this.align_state -= 1;
	} else if (tok.to_cmd (this) instanceof AlignTabCommand ||
		   tok.is_cmd (this, 'span') ||
		   tok.is_cmd (this, 'cr') ||
		   tok.is_cmd (this, 'crcr')) {
	    this.trace ('next_tok aligney: %o as=%d', tok, this.align_state);

	    if (this.align_state == 0) {
		// T:TP 789 -- insert "v" part of align statement
		var l = this.align_stack.length;
		if (l == 0)
		    throw new TexRuntimeError ('interwoven align preambles are not allowed');

		// TeX inserts \endtemplate; however, \endtemplate just gets
		// transformed to \endv; \endtemplate has some semi-magical
		// error checking properties. We're not interested in that.
		this.push (Token.new_cmd (this.commands['<endv>']));

		var astate = this.align_stack[l-1];
		if (!astate.col_is_omit) {
		    this.push_toks (astate.columns[astate.cur_col].v_tmpl);
		}

		this.align_state = 1000000;
		astate.col_ender = tok.to_cmd (this);
		return this.next_tok ();
	    }
	}

	return tok;
    };

    proto.next_x_tok = function Engine_next_x_tok () {
	while (1) {
	    var tok = this.next_tok ();
	    if (tok === EOF)
		return tok;

	    var cmd = tok.to_cmd (this);
	    if (!cmd.expandable)
		return tok;

	    if (cmd.same_cmd (this.commands['noexpand'])) {
		tok = this.next_tok ();
		this.trace ('noexpand: %o', tok);
		return tok;
	    }

	    // The core source of recursion:
	    cmd.invoke (this);
	}
    };

    proto.next_tok_throw = function Engine_next_tok_throw () {
	var tok = this.next_tok ();
	if (tok === EOF)
	    throw tok;
	return tok;
    };

    proto.next_x_tok_throw = function Engine_next_x_tok_throw () {
	var tok = this.next_x_tok ();
	if (tok === EOF)
	    throw tok;
	return tok;
    };

    // "Scanning" -- this is slightly higher-level than tokenization, and
    // can usually end up kicking off recursive parsing and evaluation.

    proto.scan_one_optional_space = function Engine_scan_one_optional_space () {
	var tok = this.next_tok ();
	if (tok === EOF || tok.is_space (this))
	    return;
	this.push_back (tok);
    };

    proto.chomp_spaces = function Engine_chomp_spaces () {
	// T:TP sec. 406.
	while (1) {
	    var tok = this.next_x_tok ();
	    if (!tok.is_space (this))
		return tok;
	}
    };

    proto.scan_left_brace = function Engine_scan_left_brace () {
	while (1) {
	    var tok = this.next_x_tok_throw ();

	    if (tok == null)
		throw new TexSyntaxError ('EOF when expected left brace');
	    if (tok.is_space (this))
		continue;
	    if (tok.is_cmd (this, 'relax'))
		continue;
	    if (tok.to_cmd (this) instanceof BeginGroupCommand)
		// We can't use is_cmd() here because it calls same_cmd(), which
		// cares about the ordinal associated with the command,
		// whereas here we don't. same_cmd() needs to care about the
		// ordinal for \ifx to work as desired.
		return;

	    throw new TexSyntaxError ('expected left brace but found %o', tok);
	}
    };

    proto.scan_optional_equals = function Engine_scan_optional_equals () {
	while (1) {
	    var tok = this.next_x_tok_throw ();

	    if (tok.is_space (this))
		continue;
	    if (tok.is_other_char (O_EQUALS))
		return true;

	    // Found a non-space, non-equals.
	    this.push_back (tok);
	    return false;
	}
    };

    proto.scan_keyword = function Engine_scan_keyword (keyword) {
	var toupper = O_UC_A - O_LC_A, n = keyword.length;
	var i = 0, scanned = [];

	while (i < n) {
	    var tok = this.next_x_tok ();
	    if (tok === EOF)
		break;

	    scanned.push (tok);

	    if (i == 0 && tok.is_space (this))
		continue; // my best interpretation of scan_keyword ...
	    else if (!tok.is_char ())
		break;

	    var o = keyword.charCodeAt (i);
	    if (tok.ord != o && tok.ord != o + toupper)
		break;
	    i += 1;
	}

	if (i == n)
	    return true; // got it

	// optional keyword not found; push back scanned tokens
	this.push_toks (scanned);
	return false;
    };

    proto._scan_signs = function Engine__scan_signs () {
	var negfactor = 1;

	while (1) {
	    var tok = this.next_x_tok_throw ();

	    if (tok.is_space (this)) {
	    } else if (tok.is_other_char (O_PLUS)) {
	    } else if (tok.is_other_char (O_MINUS)) {
		negfactor = -negfactor;
	    } else {
		return [negfactor, tok];
	    }
	}
    };

    proto.scan_int__I = function Engine_scan_int__I () {
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1];

	if (tok.is_other_char (O_BACKTICK)) {
	    tok = this.next_tok ();

	    if (tok.is_char ()) {
		// Undo align-state shift that we don't want here.
		if (tok.is_cat (C_BGROUP))
		    this.align_state--;
		else if (tok.is_cat (C_EGROUP))
		    this.align_state++;
		return negfactor * tok.ord;
	    }

	    var csname = tok.name;
	    if (csname.length == 1)
		return negfactor * csname.charCodeAt (0);

	    throw new TexSyntaxError ('unhandled alpha number token %o', tok);
	}

	var v = tok.to_cmd (this).as_int__I (this);
	if (v != null)
	    return v * negfactor;

	// Looks like we have a literal integer

	var val = 0, sawany = false;

	if (tok.is_other_char (O_SQUOTE)) {
	    // Octal.
	    tok = this.next_x_tok ();
	    while (true) {
		if (tok === EOF)
		    break;
		var v = tok.maybe_octal_value ();
		if (v < 0) {
		    this.push_back (tok);
		    break;
		}
		sawany = true;
		val = val * 8 + v;
		tok = this.next_x_tok ();
	    }
	} else if (tok.is_other_char (O_DQUOTE)) {
	    // Hexadecimal
	    tok = this.next_x_tok ();
	    while (true) {
		if (tok === EOF)
		    break;
		var v = tok.maybe_hex_value ();
		if (v < 0) {
		    this.push_back (tok);
		    break;
		}
		sawany = true;
		val = val * 16 + v;
		tok = this.next_x_tok ();
	    }
	} else {
	    // Decimal
	    while (true) {
		if (tok === EOF)
		    break;
		var v = tok.maybe_decimal_value ();
		if (v < 0) {
		    this.push_back (tok);
		    break;
		}
		sawany = true;
		val = val * 10 + v;
		tok = this.next_x_tok ();
	    }
	}

	if (!sawany)
	    throw new TexSyntaxError ('expected to see integer expression but ' +
				      'got the token %o', tok);

	if (val > 0x7FFFFFFF) {
	    this.warn ('found integer %d greater than 2^32-1; ' +
		       'replace with that value', val);
	    val = 0x7FFFFFFF;
	}

	this.scan_one_optional_space ();
	return negfactor * val;
    };


    proto.rangecheck__III_I = function Engine_rangecheck__III_I (value_I, min_I, max_I) {
	if (value_I >= min_I && value_I <= max_I)
	    return value_I;

	this.warn ('expected integer in [%d,%d]; got %d; using 0',
		   min_I, max_I, value_I);
	return 0;
    };

    proto.scan_char_code__I = function Engine_scan_char_code__I () {
	return this.rangecheck__III_I (this.scan_int__I (), 0, 255);
    };

    proto.scan_int_4bit__I = function Engine_scan_int_4bit__I () {
	return this.rangecheck__III_I (this.scan_int__I (), 0, 0xF);
    };

    proto.scan_int_15bit__I = function Engine_scan_int_15bit__I () {
	return this.rangecheck__III_I (this.scan_int__I (), 0, 0x7FFF);
    };

    proto.scan_int_27bit__I = function Engine_scan_int_27bit__I () {
	return this.rangecheck__III_I (this.scan_int__I (), 0, 0x7FFFFFF);
    };

    proto._scan_dimen__OO_SX = function Engine__scan_dimen__OO_SX (mumode, infmode) {
	// `infmode` says whether infinities are allowed. If true, the return
	// value is [dimen, infinity_order] rather than just the dimension.

	var tmp = this._scan_signs ();
	var negfactor_I = tmp[0];
	var tok = tmp[1];
	var inf_order = 0;
	var val = null;
	var frac_I = 0;
	var nonfrac_I = null;

	var vt = tok.to_cmd (this).get_valtype ();

	if (vt == T_DIMEN || vt == T_GLUE) {
	    var result_S = tok.to_cmd (this).as_scaled__S (this);

	    if (mumode) {
		throw new TexRuntimeError ('not implemented');
	    } else {
		if (infmode)
		    return [negfactor_I * result_S, 0];
		return negfactor_I * result_S;
	    }
	} else if (vt == T_INT) {
	    nonfrac_I = tok.to_cmd (this).as_int__I (this);
	} else if (vt != null) {
	    throw new TexRuntimeError ('expected dimen value; got %o (valtype=%d)', tok, vt);
	}

	if (nonfrac_I == null) {
	    // We need to scan a literal number.
	    if (tok.is_other_char (O_PERIOD) || tok.is_other_char (O_COMMA)) {
		nonfrac_I = 0;
	    } else {
		this.push_back (tok);
		nonfrac_I = this.scan_int__I ();
		if (nonfrac_I < 0) {
		    negfactor_I = -negfactor_I;
		    nonfrac_I = -nonfrac_I;
		}
		tok = this.next_x_tok ();
	    }

	    if (tok === EOF) {
		/* nothing */
	    } else if (!tok.is_other_char (O_PERIOD) && !tok.is_other_char (O_COMMA)) {
		this.push_back (tok)
	    } else {
		// We have a fractional part to deal with.
		var digits = [];
		while (true) {
		    tok = this.next_tok ();
		    if (tok === EOF)
			break;

		    var v = tok.maybe_decimal_value ();
		    if (v < 0) {
			if (!tok.is_space (this))
			    this.push_back (tok);
			break;
		    }
		    digits.push (v);
		}
		frac_I = nlib.from_decimals__O_S (digits); // Yes, this is correct.
	    }
	}

	if (nonfrac_I < 0) {
	    negfactor_I = -negfactor_I;
	    nonfrac_I = -nonfrac_I;
	}

	if (this.scan_keyword ('true'))
	    throw new TexRuntimeError ('not implemented true-dimens');

	tok = this.chomp_spaces ();
	var val_S = tok.to_cmd (this).as_scaled__S (this);
	var result_S = null;

	if (val_S != null) {
	    result_S = nlib.times_parts__SII_S (val_S, nonfrac_I, frac_I);
	} else {
	    this.push_back (tok);

	    if (infmode && this.scan_keyword ('fil')) {
		inf_order = 1;
		while (this.scan_keyword ('l')) {
		    inf_order += 1;
		    if (inf_order > 3)
			throw new TexSyntaxError ('illegal infinity value ' +
						  '"fillll" or higher');
		}
		result_S = nlib.from_parts__II_S (nonfrac_I, frac_I);
	    } else if (mumode) {
		if (this.scan_keyword ('mu'))
		    result_S = nlib.from_parts__II_S (nonfrac_I, frac_I);
		else
		    throw new TexRuntimeError ('this quantity must have ' +
					       'dimensions of "mu"');
	    } else if (this.scan_keyword ('em')) {
		result_S = nlib.times_parts__SII_S (this.get_misc ('cur_font').get_dimen__N_S (6),
						    nonfrac_I, frac_I);
	    } else if (this.scan_keyword ('ex')) {
		result_S = nlib.times_parts__SII_S (this.get_misc ('cur_font').get_dimen__N_S (5),
						    nonfrac_I, frac_I);
	    } else if (this.scan_keyword ('sp')) {
		result_S = nlib.from_raw__I_S (nonfrac_I);
	    } else if (this.scan_keyword ('pt')) {
		result_S = nlib.from_parts__II_S (nonfrac_I, frac_I);
	    } else {
		var num, denom;

		// Copied from T:TP sec. 458.
                if (this.scan_keyword ('in')) {
                    num = 7227;
		    denom = 100;
                } else if (this.scan_keyword ('pc')) {
                    num = 12;
		    denom = 1;
                } else if (this.scan_keyword ('cm')) {
                    num = 7227;
		    denom = 254;
                } else if (this.scan_keyword ('mm')) {
                    num = 7227;
		    denom = 2540;
                } else if (this.scan_keyword ('bp')) {
                    num = 7227;
		    denom = 7200;
                } else if (this.scan_keyword ('dd')) {
                    num = 1238;
		    denom = 1157;
                } else if (this.scan_keyword ('cc')) {
                    num = 14856;
		    denom = 1157;
                } else {
                    throw new TexSyntaxError ('expected a dimen unit but ' +
					      'didn\'t find it; next is %o', tok);
		}

		result_S = nlib.from_parts_product__IIII_S (num, denom, nonfrac_I, frac_I);
	    }
	}

	// TODO this isn't always done.
	this.scan_one_optional_space ();

	if (infmode)
	    return [negfactor_I * result_S, inf_order];
	return negfactor_I * result_S;
    };

    proto.scan_dimen__O_S = function Engine_scan_dimen__O_S (mumode) {
	return this._scan_dimen__OO_SX (mumode, false);
    };

    proto.scan_infdimen__O_SO = function Engine_scan_infdimen__O_SO (mumode) {
	return this._scan_dimen__OO_SX (mumode, true);
    };

    proto.scan_glue = function Engine_scan_glue (mumode) {
	var tmp = this._scan_signs ();
	var negfactor = tmp[0], tok = tmp[1];

	// Here's another case where we need to use get_valtype() because if
	// we get the valref instance, we may eat upcoming tokens that will
	// then be needed when scan_dimen__O_S() also tries to examine the value
	// type.
	var cmd = tok.to_cmd (this);
	if (cmd.get_valtype () == T_GLUE)
	    return tok.to_cmd (this).as_glue (this).product__I_O (negfactor);

	var g = new Glue ();
	this.push_back (tok);
	g.amount_S = negfactor * this.scan_dimen__O_S (mumode);

	if (this.scan_keyword ('plus')) {
	    tmp = this.scan_infdimen__O_SO (mumode);
	    g.stretch_S = tmp[0];
	    g.stretch_order = tmp[1];
	}

	if (this.scan_keyword ('minus')) {
	    tmp = this.scan_infdimen__O_SO (mumode);
	    g.shrink_S = tmp[0];
	    g.shrink_order = tmp[1];
	}

	return g;
    };

    proto.scan_toks_value = function Engine_scan_toks_value () {
	this.scan_one_optional_space ();

	var tok = this.next_tok ();
	if (tok === EOF)
	    throw tok;

	var cmd = tok.to_cmd (this);
	if (cmd.get_valtype () == T_TOKLIST)
	    return cmd.as_valref (this).get (this);

	// TODO: \tokpar=<toklist register or toklist param>
	if (!tok.is_cat (C_BGROUP))
	    throw new TexSyntaxError ('expected { in toklist assignment; got %o', tok);

	return this.scan_tok_group (false);
    };

    proto.scan_font_value = function Engine_scan_font_value () {
	var tok = this.next_x_tok_throw ();
	var val = tok.to_cmd (this).as_valref (this);
	if (val == null || val.valtype != T_FONT)
	    throw new TexRuntimeError ('expected a font value, but got %o', tok);
	return val.get (this);
    };

    proto.scan_valtype = function Engine_scan_valtype (valtype) {
	// Always returns a boxed value.

	if (valtype == T_INT)
	    return new TexInt (this.scan_int__I ());
	if (valtype == T_DIMEN)
	    return new Dimen (this.scan_dimen__O_S (false));
	if (valtype == T_GLUE)
	    return this.scan_glue (false);
	if (valtype == T_MUGLUE)
	    return this.scan_glue (true);
	if (valtype == T_TOKLIST)
	    return this.scan_toks_value ();
	if (valtype == T_FONT)
	    return this.scan_font_value ();
	throw new TexInternalError ('can\'t generically scan value type %o', valtype);
    };

    proto.scan_r_token = function Engine_scan_r_token () {
	var tok = null;

	while (true) {
	    tok = this.next_tok ();
	    if (tok == null)
		throw new TexRuntimeError ('EOF when expected cseq name');
	    if (!tok.is_cat (C_SPACE))
		// note: here we do NOT want tok.is_space()
		break;
	}

	if (!tok.is_cslike ())
	    throw new TexRuntimeError ('expected control seq or active char;' +
				       'got %o', tok);

	if (tok.is_frozen_cs ())
	    throw new TexRuntimeError ('cannot redefined control seq %o', tok);

	return tok;
    };

    proto.scan_tok_group = function Engine_scan_tok_group (expand) {
	/* Assumes that a BGROUP has just been read in. Generates a list of
	 * tokens, possibly with expansion, until an EGROUP is encountered,
	 * accounting for nested groups of course. */

	var depth = 1, toks = [], getter = null;

	if (expand)
	    getter = this.next_x_tok.bind (this);
	else
	    getter = this.next_tok.bind (this);

	while (true) {
	    var tok = getter ();
	    if (tok === EOF)
		throw tok;

	    if (tok.is_cat (C_BGROUP))
		depth += 1;
	    else if (tok.is_cat (C_EGROUP)) {
		depth -= 1;
		if (depth == 0)
		    break;
	    }

	    toks.push (tok);
	}

	return new Toklist (toks);
    };

    proto.scan_file_name = function Engine_scan_file_name () {
	var name = '';
	var tok = this.chomp_spaces ();

	while (true) {
	    if (tok === EOF)
		break;

	    if (!tok.is_char ()) {
		this.push_back (tok);
		break;
	    }

	    if (tok.is_space (this))
		break;

	    name += String.fromCharCode (tok.ord);
	    tok = this.next_x_tok ();
	}

	return name;
    };


    proto.scan_streamnum = function Engine_scan_streamnum () {
	var snum = this.scan_int__I ();
	if (snum < 0 || snum > 15)
	    return 16; // NOTE: our little convention
	return snum;
    };


    // Text box construction

    proto.scan_box = function Engine_scan_box (callback, is_assignment) {
	var tok = null; // T:TP 404 -- next non-blank non-relax non-call token:

	while (true) {
	    tok = this.next_x_tok_throw ();
	    if (!tok.is_space (this) && !tok.is_cmd (this, 'relax'))
		break;
	}

	// TODO: deal with leader_flag and hrule stuff; should accept:
	// \box, \copy, \lastbox, \vsplit, \hbox, \vbox, \vtop

	var cmd = tok.to_cmd (this);
	if (!cmd.boxlike)
	    throw new TexRuntimeError ('expected boxlike command but got %o', tok);

        this.boxop_stack.push ([callback, is_assignment]);
	cmd.start_box (this);
    };

    proto.scan_box_for_accum = function Engine_scan_box_for_accum (cmd) {
	function accum_box (engine, box) {
	    if (engine.mode () == M_MATH || engine.mode () == M_DMATH) {
		engine.trace ('... accumulate the finished box (math)');
		var ord = new AtomNode (MT_ORD);
		ord.nuc = box;
		engine.accum (ord);
	    } else {
		engine.trace ('... accumulate the finished box (non-math)');
		engine.accum (box);
	    }
	}

	this.boxop_stack.push ([accum_box, false]);
	cmd.start_box (this);
    };

    proto.handle_setbox = function Engine_handle_setbox (reg) {
        // We just scanned "\setbox NN =". We'll now expect a box-construction
        // expression. The TeX design is such that rather than trying to read
        // in the whole box at once, we instead remember that we were doing a
        // setbox operation.

        function set_the_box (engine, box) {
            engine.trace ('... finish setbox: #%d = %U', reg, box);
            engine.set_register (T_BOX, reg, box);
	}

        this.scan_box (set_the_box.bind (this), true);
    };

    proto.handle_finished_box = function Engine_handle_finished_box (box) {
	var t = this.boxop_stack.pop ();
	var boxop = t[0], isassignment = t[1];

	if (isassignment && this.after_assign_token != null) {
	    // This is an assignment expression. TODO: afterassign token
	    // in boxes gets inserted at beginning of box token list,
	    // before every[hv]box token lists (TeXbook p. 279)
	    throw new TexRuntimeError ('afterassignment for boxes');
	}

	this.trace ('finished: %U', box);

	if (box.btype == BT_VBOX)
	    this.end_graf (); // in case we were in the middle of one. Noop if not.
	boxop (this, box);
    };

    proto._handle_box = function Engine__handle_box (boxtype, newmode, is_vtop) {
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

	function finish_box (engine) {
	    this.trace ('finish_box is_exact=%b spec=%S', is_exact, spec_S);
	    this.unnest_eqtb ();
	    var box = ListBox.create (boxtype);
	    box.list = this.leave_mode ();
	    box.set_glue__OOS (this, is_exact, spec_S);
	    if (is_vtop)
		box.adjust_as_vtop ();
	    engine.handle_finished_box (box);
	}

	this.scan_left_brace ();
	this.enter_mode (newmode);
	this.nest_eqtb ();
	this.enter_group (bt_names[boxtype], finish_box.bind (this));
    };

    proto.handle_hbox = function Engine_handle_hbox () {
	this._handle_box (BT_HBOX, M_RHORZ, false);
    };

    proto.handle_vbox = function Engine_handle_vbox (is_vtop) {
	this._handle_box (BT_VBOX, M_IVERT, is_vtop);
    };


    proto.get_last_listable = function Engine_get_last_listable () {
	var l = this.build_stack.length;
	if (l == 0)
	    return null;
	var c = this.build_stack[l - 1];
	l = c.length;
	if (l == 0)
	    return null;
	return c[l - 1];
    };

    proto.pop_last_listable = function Engine_pop_last_listable () {
	var l = this.build_stack.length;
	if (l == 0)
	    throw new TexInternalError ('no build_stack to pop from');
	var c = this.build_stack[l - 1];
	l = c.length;
	if (l == 0)
	    throw new TexInternalError ('build_stack empty');
	return c.pop ();
    };


    // Math box construction

    proto.enter_math = function Engine_enter_math (mode, is_outer) {
	this.enter_mode (mode);
	this.trace ('<is_outer=%b>', is_outer);
	this.nest_eqtb ();

	if (is_outer)
	    this.set_parameter (T_INT, 'fam', -1);
    };

    // Miscellaneous

    proto.set_global_assign_mode = function Engine_set_global_assign_mode () {
	this.assign_flags |= AF_GLOBAL;
    };

    proto.set_after_assign_token =
	function Engine_set_after_assign_token (tok) {
	    this.after_assign_token = tok;
	};

    proto.maybe_insert_after_assign_token =
	function Engine_maybe_insert_after_assign_token () {
	    if (this.after_assign_token !== null) {
		this.push (this.after_assign_token);
		this.after_assign_token = null;
	    }
	};

    proto.escapechar__I = function Engine_escapechar__I () {
	return this.get_parameter__O_I ('escapechar');
    };

    // Apply all of extensions registered by the various subsystems.
    engine_proto._apply_methods (proto);

    return Engine;
})();

webtex_export ('Engine', Engine);
