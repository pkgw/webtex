var EquivTable = (function EquivTable_closure () {
    function EquivTable (parent) {
	this.parent = parent;

	if (parent == null) {
	    this.toplevel = this;
	    this._catcodes = new Array (256);
	} else {
	    this.toplevel = parent.toplevel;
	    this._catcodes = parent._catcodes.slice ();
	}

	this._registers = {};
	this._registers[T_INT] = {};
	this._registers[T_DIMEN] = {};
	this._registers[T_GLUE] = {};
	this._registers[T_MUGLUE] = {};
	this._registers[T_TOKLIST] = {};
	this._registers[T_BOXLIST] = {};

	this._parameters = {};
	this._parameters[T_INT] = {};
	this._parameters[T_DIMEN] = {};
	this._parameters[T_GLUE] = {};
	this._parameters[T_MUGLUE] = {};
	this._parameters[T_TOKLIST] = {};

	this._codes = {};
	this._codes[CT_LOWERCASE] = {};
	this._codes[CT_UPPERCASE] = {};
	this._codes[CT_SPACEFAC] = {};
	this._codes[CT_MATH] = {};
	this._codes[CT_DELIM] = {};

	this._actives = {};
	this._cseqs = {};
	this._fonts = {};

	if (parent == null)
	    this._toplevel_init ();
    }

    var proto = EquivTable.prototype;

    proto.set_register = function EquivTable_set_register (valtype, reg, value) {
	if (!vt_ok_for_register[valtype])
	    throw new TexRuntimeError ('illegal value type for register: ' +
				       vt_names[valtype]);
	if (reg < 0 || reg > 255)
	    throw new TexRuntimeError ('illegal register number ' + reg);

	this._registers[valtype][reg] = Value.coerce (valtype, value);
    };

    proto.get_register = function EquivTable_get_register (valtype, reg) {
	if (!vt_ok_for_register[valtype])
	    throw new TexRuntimeError ('illegal value type for register: ' +
				       vt_names[valtype]);
	if (reg < 0 || reg > 255)
	    throw new TexRuntimeError ('illegal register number ' + reg);

	if (this._registers[valtype].hasOwnProperty (reg))
	    return this._registers[valtype][reg];
	return this.parent.get_register (valtype, reg);
    };

    proto.set_parameter = function EquivTable_set_parameter (valtype, name, value) {
	if (!vt_ok_for_parameter[valtype])
	    throw new TexRuntimeError ('illegal value type for parameter: ' +
				       vt_names[valtype]);

	this._parameters[valtype][name] = Value.coerce (valtype, value);
    };

    proto.get_parameter = function EquivTable_get_parameter (valtype, name) {
	if (!vt_ok_for_parameter[valtype])
	    throw new TexRuntimeError ('illegal value type for parameter: ' +
				       vt_names[valtype]);

	if (this._parameters[valtype].hasOwnProperty (name))
	    return this._parameters[valtype][name];
	if (this.parent == null)
	    throw new TexRuntimeError ('undefined named parameter ' + name);
	return this.parent.get_parameter (valtype, name);
    };

    proto.set_code = function EquivTable_set_code (codetype, ord, value) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number ' + ord);
	if (value < 0 || value > ct_maxvals[codetype])
	    throw new TexRuntimeError ('illegal ' + ct_names[codetype] +
				       ' value ' + value);

	if (codetype == CT_CATEGORY)
	    this._catcodes[ord] = value;
	else
	    this._codes[codetype][ord] = value;
    };

    proto.get_code = function EquivTable_get_code (codetype, ord) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number ' + ord);

	if (codetype == CT_CATEGORY)
	    return this._catcodes[ord];

	if (this._codes[codetype].hasOwnProperty (ord))
	    return this._codes[codetype][ord];
	return this.parent.get_code (codetype, ord);
    };

    proto.get_active = function EquivTable_get_active (ord) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number ' + ord);

	if (this._actives.hasOwnProperty (ord))
	    return this._actives[ord];
	if (this.parent == null)
	    return null;
	return this.parent.get_active (ord);
    };

    proto.set_active = function EquivTable_set_active (ord, value) {
	if (ord < 0 || ord > 255)
	    throw new TexRuntimeError ('illegal ordinal number ' + ord);

	this._actives[ord] = value;
    };

    proto.get_cseq = function EquivTable_get_cseq (name) {
	if (this._cseqs.hasOwnProperty (name))
	    return this._cseqs[name];
	if (this.parent == null)
	    return null;
	return this.parent.get_cseq (name);
    };

    proto.set_cseq = function EquivTable_set_cseq (name, value) {
	this._cseqs[name] = value;
    };

    proto.get_font = function EquivTable_get_font (name) {
	if (this._fonts.hasOwnProperty (name))
	    return this._fonts[name];
	if (this.parent == null)
	    return null;
	return this.parent.get_font (name);
    };

    proto.set_font = function EquivTable_set_font (name, value) {
	this._fonts[name] = value;
    };

    proto._toplevel_init = function EquivTable__toplevel_init () {
	for (var i = 0; i < 256; i++) {
	    this._catcodes[i] = C_OTHER;
	    this._codes[CT_MATH][i] = i;
	    this._codes[CT_SPACEFAC][i] = 1000;
	    this._codes[CT_DELIM][i] = -1;
	    this._codes[CT_LOWERCASE][i] = 0;
	    this._codes[CT_UPPERCASE][i] = 0;
	    this._registers[T_GLUE][i] = new Glue ();
	    this._registers[T_MUGLUE][i] = new Glue ();
	    this._registers[T_TOKLIST][i] = new Toklist ();
	    this._registers[T_BOXLIST][i] = new Box ();
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
    };

    // Serialization. Our equivalent of the \dump primitive.

    proto.serialize = function Eqtb_serialize () {
	var state = {};
	var housekeeping = {commands: {}};
	var i = 0;
	var name = null;

	state.catcodes = this._catcodes;
	state.registers = {ints: {}, dimens: {}, glues: {}, muglues: {},
			   toklists: {}, boxlists: {}};
	state.parameters = {ints: {}, dimens: {}, glues: {}, muglues: {},
			    toklists: {}};
	state.commands = {};

	for (i = 0; i < 256; i++) {
	    var r = this._registers[T_INT][i];
	    if (r != null && r.is_nonzero ())
		state.registers.ints[i] = r.as_serializable ();

	    r = this._registers[T_DIMEN][i];
	    if (r != null && r.is_nonzero ())
		state.registers.dimens[i] = r.as_serializable ();

	    r = this._registers[T_GLUE][i];
	    if (r != null && r.is_nonzero ())
		state.registers.glues[i] = r.as_serializable ();

	    r = this._registers[T_MUGLUE][i];
	    if (r != null && r.is_nonzero ())
		state.registers.muglues[i] = r.as_serializable ();

	    r = this._registers[T_TOKLIST][i];
	    if (r != null && r.is_nonzero ())
		state.registers.toklists[i] = r.as_serializable ();

	    r = this._registers[T_BOXLIST][i];
	    if (r != null && r.is_nonzero ())
		state.registers.boxlists[i] = r.as_serializable ();
	}

	// Parameters

	for (name in this._parameters[T_INT]) {
	    if (!this._parameters[T_INT].hasOwnProperty (name))
		continue;
	    state.parameters.ints[name] = this._parameters[T_INT][name].as_serializable ();
	}

	for (name in this._parameters[T_DIMEN]) {
	    if (!this._parameters[T_DIMEN].hasOwnProperty (name))
		continue;
	    state.parameters.dimens[name] = this._parameters[T_DIMEN][name].as_serializable ();
	}

	for (name in this._parameters[T_GLUE]) {
	    if (!this._parameters[T_GLUE].hasOwnProperty (name))
		continue;
	    state.parameters.glues[name] = this._parameters[T_GLUE][name].as_serializable ();
	}

	for (name in this._parameters[T_MUGLUE]) {
	    if (!this._parameters[T_MUGLUE].hasOwnProperty (name))
		continue;
	    state.parameters.muglues[name] = this._parameters[T_MUGLUE][name].as_serializable ();
	}

	for (name in this._parameters[T_TOKLIST]) {
	    if (!this._parameters[T_TOKLIST].hasOwnProperty (name))
		continue;
	    state.parameters.toklists[name] = this._parameters[T_TOKLIST][name].as_serializable ();
	}

	// Category codes.

	// Fonts -- need to set these up since given-font commands can delegate here.

	state.fonts = [];

	for (name in this._fonts) {
	    if (!this._fonts.hasOwnProperty (name))
		continue;

	    // Don't need to use the return value here.
	    this._fonts[name].get_serialize_ident (state, housekeeping);
	}

	// Control seqs.

	state.cseqs = {};

	for (name in this._cseqs) {
	    if (!this._cseqs.hasOwnProperty (name))
		continue;

	    state.cseqs[name] = this._cseqs[name].get_serialize_ident (state, housekeeping);
	}

	return state;
    };

    return EquivTable;
})();


var Engine = (function Engine_closure () {
    var AF_GLOBAL = 1 << 0;
    var CS_FI = 0, CS_ELSE_FI = 1, CS_OR_ELSE_FI = 2;
    var BO_SETBOX = 0;

    function Engine (args) {
	/* Possible properties of args:
	 *
	 * bundle - the Bundle with TeX files (required)
	 * debug_input_lines - print lines of input as they're read
	 * debug_trace - print commands as they're executed
	 * initial_linebuf - LineBuffer of the initial input (required)
	 * jobname - the TeX job name
	 */

	this.jobname = args.jobname || 'texput';
	this.bundle = args.bundle;

	this.inputstack = new InputStack (args.initial_linebuf, this, args);

	this.eqtb = new EquivTable (null);
	this.mode_stack = [M_VERT];
	this.build_stack = [[]];
	this.group_exit_stack = [];
	this.boxop_stack = [];

	this.assign_flags = 0;
	this.after_assign_token = null;

	this.conditional_stack = [];

	this.infiles = [];
	for (var i = 0; i < 16; i++)
	    this.infiles[i] = null;

	this.commands = {};
	fill_cseq_commands (this);
	engine_init_parameters (this);
	engine_init_param_cseqs (this);
	this.commands['<space>'] = new Command.catcode_commands[C_SPACE] (O_SPACE);

	// T:TP sec 240; has to go after $init_parameters
	this.set_parameter (T_INT, 'mag', 1000);
	this.set_parameter (T_INT, 'tolerance', 1000);
	this.set_parameter (T_INT, 'hangafter', 1);
	this.set_parameter (T_INT, 'maxdeadcycles', 25);
	this.set_parameter (T_INT, 'escapechar', O_BACKSLASH);
	this.set_parameter (T_INT, 'endlinechar', O_RETURN);

	var d = new Date ();
	this.set_parameter (T_INT, 'year', d.getYear ());
	this.set_parameter (T_INT, 'month', d.getMonth ());
	this.set_parameter (T_INT, 'day', d.getDay ());
	this.set_parameter (T_INT, 'time', d.getHours () * 60 + d.getMinutes ());

	var nf = new Font ('nullfont', -1000);
	this.set_font ('<null>', nf);
	this.set_font ('<current>', nf);

	if (args.debug_trace)
	    this.trace = function (t) { global_log ('{' + t + '}'); };
	else
	    this.trace = function (t) {};
    }

    var proto = Engine.prototype;

    // Wrappers for the EquivTable.

    proto.get_register = function Engine_get_register (valtype, reg) {
	return this.eqtb.get_register (valtype, reg);
    };

    proto.set_register = function Engine_get_register (valtype, reg, value) {
	if (this.assign_flags & AF_GLOBAL)
	    this.eqtb.toplevel.set_register (valtype, reg, value);
	else
	    this.eqtb.set_register (valtype, reg, value);
	this.maybe_insert_after_assign_token ();
    };

    proto.get_parameter = function Engine_get_parameter (valtype, name) {
	return this.eqtb.get_parameter (valtype, name);
    };

    proto.set_parameter = function Engine_get_parameter (valtype, name, value) {
	if (this.assign_flags & AF_GLOBAL)
	    this.eqtb.toplevel.set_parameter (valtype, name, value);
	else
	    this.eqtb.set_parameter (valtype, name, value);
	this.maybe_insert_after_assign_token ();
    };

    proto.get_code = function Engine_get_code (valtype, ord) {
	return this.eqtb.get_code (valtype, ord);
    };

    proto.set_code = function Engine_get_code (valtype, ord, value) {
	if (this.assign_flags & AF_GLOBAL)
	    this.eqtb.toplevel.set_code (valtype, ord, value);
	else
	    this.eqtb.set_code (valtype, ord, value);
	this.maybe_insert_after_assign_token ();
    };

    proto.get_active = function Engine_get_active (ord) {
	return this.eqtb.get_active (ord);
    };

    proto.set_active = function Engine_get_active (ord, value) {
	if (this.assign_flags & AF_GLOBAL)
	    this.eqtb.toplevel.set_active (ord, value);
	else
	    this.eqtb.set_active (ord, value);
	this.maybe_insert_after_assign_token ();
    };

    proto.get_cseq = function Engine_get_cseq (name) {
	return this.eqtb.get_cseq (name);
    };

    proto.set_cseq = function Engine_get_cseq (name, cmd) {
	if (this.assign_flags & AF_GLOBAL)
	    this.eqtb.toplevel.set_cseq (name, cmd);
	else
	    this.eqtb.set_cseq (name, cmd);
	this.maybe_insert_after_assign_token ();
    };

    proto.get_font = function Engine_get_font (name) {
	return this.eqtb.get_font (name);
    };

    proto.set_font = function Engine_get_font (name, value) {
	if (this.assign_flags & AF_GLOBAL)
	    this.eqtb.toplevel.set_font (name, value);
	else
	    this.eqtb.set_font (name, value);
	this.maybe_insert_after_assign_token ();
    };

    // Infrastructure.

    proto.warn = function Engine_warn (text) {
	global_log ('!! ' + text);
    };

    // Driving everything

    proto.step = function Engine_step () {
	var initial_is = this.inputstack.clone ();

	var tok = this.next_x_tok ();
	if (tok === EOF)
	    return tok;

	if (tok === NeedMoreData) {
	    // Reset to where we were at the beginning of the step.
	    this.inputstack = initial_is;
	    return tok;
	}

	try {
	    var cmd = tok.tocmd (this);
	    var result = cmd.invoke (this);
	    if (result != null)
		this.mode_accum (result);
	} catch (e) {
	    if (e === NeedMoreData) {
		this.inputstack = initial_is;
		return NeedMoreData;
	    }
	    if (e === EOF)
		throw new TexRuntimeError ('unexpected EOF while parsing');
	    throw e;
	}

	if (cmd.assign_flag_mode == AFM_INVALID && this.assign_flags)
	    this.warn ('assignment flags applied to inapplicable command ' + cmd);
	else if (cmd.assign_flag_mode != AFM_CONTINUE)
	    this.assign_flags = 0;

	// We successfully completed this step, so we can throw away any old
	// tokens we were holding on to. We also throw away the saved
	// initial_is since we don't need to go back to it.
	this.inputstack.checkpoint ();
	return true;
    };

    // Mode and grouping stuff.

    proto.nest_eqtb = function Engine_nest_eqtb () {
	this.eqtb = new EquivTable (this.eqtb);
    };

    proto.unnest_eqtb = function Engine_unnest_eqtb () {
	this.eqtb = this.eqtb.parent;
	if (this.eqtb == null)
	    throw new TexInternalError ('unnested eqtb too far');
    };

    proto.mode = function Engine_mode () {
	return this.mode_stack[this.mode_stack.length - 1];
    };

    proto.enter_mode = function Engine_enter_mode (mode) {
	this.trace ('<enter ' + mode_abbrev[mode] + ' mode>');
	this.mode_stack.push (mode);
	this.build_stack.push ([]);
    };

    proto.leave_mode = function Engine_leave_mode () {
	var oldmode = this.mode_stack.pop ();
	var tlist = this.build_stack.pop ();
	this.trace ('<leave ' + mode_abbrev[oldmode] + ' mode: ' +
		    tlist.length + ' items>');
	return tlist;
    };

    proto.ensure_horizontal = function Engine_ensure_horizontal () {
	if (this.mode () == M_VERT)
	    this.enter_mode (M_HORZ);
	else if (this.mode () == M_IVERT)
	    this.enter_mode (M_RHORZ);
    };

    proto.mode_accum = function Engine_mode_accum (item) {
	this.build_stack[this.build_stack.length - 1].push (item);
    };

    proto.handle_bgroup = function Engine_handle_bgroup () {
	this.trace ('< --> simple>');
	this.nest_eqtb ();
	this.group_exit_stack.push (this.unnest_eqtb.bind (this));
    };

    proto.handle_egroup = function Engine_handle_egroup () {
	if (!this.group_exit_stack.length)
	    throw new TexRuntimeError ('ending a group that wasn\'t started');
	return (this.group_exit_stack.pop ()) (this);
    };

    proto.handle_begingroup = function Engine_handle_begingroup () {
	this.trace ('< --> semi-simple>');
	this.nest_eqtb ();

	function end_semisimple (eng) {
	    throw new TexRuntimeError ('expected \\endgroup but got something ' +
				       'else');
	}
	end_semisimple.is_semisimple = true;

	this.group_exit_stack.push (end_semisimple);
    };

    proto.handle_endgroup = function Engine_handle_endgroup () {
	if (!this.group_exit_stack.length)
	    throw new TexRuntimeError ('stray \\endgroup');

	var ender = this.group_exit_stack.pop ();
	if (ender.is_semisimple !== true)
	    throw new TexRuntimeError ('got \\endgroup when should have ' +
					   'gotten other group-ender');

	this.trace ('< <-- semi-simple>');
	this.unnest_eqtb ();
    };

    // Input nesting and other I/O

    proto.handle_input = function Engine_handle_input (texfn) {
	var lb = this.bundle.try_open_linebuffer (texfn);
	if (lb == null)
	    throw new TexRuntimeError ('can\'t find any matching files for "' +
				       texfn + '"');
	this.inputstack.push_linebuf (lb);
    };

    proto.handle_endinput = function Engine_handle_endinput () {
	this.inputstack.pop_current_linebuf ();
    };

    proto.infile = function Engine_infile (num) {
	if (num < 0 || num > 15)
	    throw new TexRuntimeError ('illegal input file number ' + num);
	return this.infiles[num];
    };

    proto.set_infile = function Engine_set_infile (num, value) {
	if (num < 0 || num > 15)
	    throw new TexRuntimeError ('illegal input file number ' + num);
	this.infiles[num] = value;
    };


    // Serialization. Our equivalent of the \dump primitive.

    proto.serialize = function Engine_serialize () {
	// We only allow serialization in a clean global state:

	if (this.inputstack.inputs.length > 1) {
	    console.log (this.inputstack.inputs[1]);
	    throw new TexRuntimeError ('can only serialize Engine at topmost input');
}
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
	if (this.conditional_stack.length > 0)
	    throw new TexRuntimeError ('can only serialize Engine without open conditionals');
	for (var i = 0; i < 16; i++)
	    if (this.infiles[i] != null)
		throw new TexRuntimeError ('cannot serialize Engine with open input files');

	// OK, we're clear.

	var state = this.eqtb.serialize ();

	return state;
    };

    // Tokenization. I'd like to separate this out into its own class,
    // but there are just too many interactions between this subsystem and
    // the rest of the engine.

    proto.push = function Engine_push (tok) {
	this.inputstack.push_toklist ([tok]);
    };

    proto.push_toks = function Engine_push_toks (toks) {
	if (toks instanceof Toklist)
	    toks = toks.toks; // convenience.
	if (!(toks instanceof Array))
	    throw new TexInternalError ('illegal push_toks argument: ' + toks);
	this.inputstack.push_toklist (toks);
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
	return this.inputstack.next_tok ();
    };

    proto.next_x_tok = function Engine_next_x_tok () {
	while (1) {
	    var tok = this.next_tok ();
	    if (tok === NeedMoreData || tok === EOF)
		return tok;

	    var cmd = tok.tocmd (this);
	    if (!cmd.expandable)
		return tok;

	    if (cmd.samecmd (this.commands['noexpand'])) {
		tok = this.next_tok ();
		this.trace ('noexpand: ' + tok);
		return tok;
	    }

	    // The core source of recursion:
	    cmd.invoke (this);
	}
    };

    proto.next_tok_throw = function Engine_next_tok_throw () {
	var tok = this.next_tok ();
	if (tok === NeedMoreData || tok === EOF)
	    throw tok;
	return tok;
    };

    proto.next_x_tok_throw = function Engine_next_x_tok_throw () {
	var tok = this.next_x_tok ();
	if (tok === NeedMoreData || tok === EOF)
	    throw tok;
	return tok;
    };

    // "Scanning" -- this is slightly higher-level than tokenization, and
    // can usually end up kicking off recursive parsing and evaluation. If
    // more data are needed, this functions throw exceptions rather than
    // returning NeedMoreData.

    proto.scan_one_optional_space = function Engine_scan_one_optional_space () {
	var tok = this.next_tok ();
	if (tok === NeedMoreData)
	    throw tok;
	if (tok == EOF || tok.iscat (C_SPACE))
	    return;
	this.push (tok);
    };

    proto.chomp_spaces = function Engine_chomp_spaces () {
	// T:TP sec. 406.
	while (1) {
	    var tok = this.next_x_tok ();
	    if (tok === NeedMoreData)
		throw tok;
	    if (!tok.iscmd (this, '<space>'))
		return tok;
	}
    };

    proto.scan_left_brace = function Engine_scan_left_brace () {
	while (1) {
	    var tok = this.next_x_tok_throw ();

	    if (tok.iscat (C_SPACE))
		continue;
	    if (tok.iscmd (this, 'relax'))
		continue;
	    if (tok.iscat (C_BGROUP))
		return;

	    throw new TexSyntaxError ('expected left brace but found ' + tok);
	}
    };

    proto.scan_optional_equals = function Engine_scan_optional_equals () {
	while (1) {
	    var tok = this.next_x_tok_throw ();

	    if (tok.iscat (C_SPACE))
		continue;
	    if (tok.isotherchar (O_EQUALS))
		return true;

	    // Found a non-space, non-equals.
	    this.push (tok);
	    return false;
	}
    };

    proto.scan_keyword = function Engine_scan_keyword (keyword) {
	var toupper = O_UC_A - O_LC_A, n = keyword.length;
	var i = 0, scanned = [];

	while (i < n) {
	    var tok = this.next_x_tok ();
	    if (tok === NeedMoreData)
		throw tok;
	    if (tok === EOF)
		break;

	    scanned.push (tok);

	    if (i == 0 && tok.iscat (C_SPACE))
		continue; // my best interpretation of scan_keyword ...
	    else if (!tok.ischar ())
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

	    if (tok.iscat (C_SPACE)) {
	    } else if (tok.isotherchar (O_PLUS)) {
	    } else if (tok.isotherchar (O_MINUS)) {
		negfactor = -negfactor;
	    } else {
		return [negfactor, tok];
	    }
	}
    };

    proto.scan_int = function Engine_scan_int () {
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1];

	if (tok.isotherchar (O_BACKTICK)) {
	    tok = this.next_tok ();
	    if (tok === NeedMoreData)
		throw tok;

	    if (tok.ischar ())
		// FIXME: possible align_state futzing
		return new TexInt (negfactor * tok.ord);

	    var csname = tok.name;
	    if (csname.length == 1)
		return new TexInt (negfactor * csname.charCodeAt (0));

	    throw new TexSyntaxError ('unhandled alpha number token ' + tok);
	}

	var v = tok.tocmd (this).as_int (this);
	if (v != null)
	    return v.intproduct (negfactor);

	// Looks like we have a literal integer

	var val = 0, sawany = false;

	if (tok.isotherchar (O_SQUOTE)) {
	    // Octal.
	    tok = this.next_x_tok ();
	    while (true) {
		if (tok === NeedMoreData)
		    throw tok;
		if (tok === EOF)
		    break;
		var v = tok.maybe_octal_value ();
		if (v < 0) {
		    this.push (tok);
		    break;
		}
		sawany = true;
		val = val * 8 + v;
		tok = this.next_x_tok ();
	    }
	} else if (tok.isotherchar (O_DQUOTE)) {
	    // Hexadecimal
	    tok = this.next_x_tok ();
	    while (true) {
		if (tok === NeedMoreData)
		    throw tok;
		if (tok === EOF)
		    break;
		var v = tok.maybe_hex_value ();
		if (v < 0) {
		    this.push (tok);
		    break;
		}
		sawany = true;
		val = val * 16 + v;
		tok = this.next_x_tok ();
	    }
	} else {
	    // Decimal
	    while (true) {
		if (tok === NeedMoreData)
		    throw tok;
		if (tok === EOF)
		    break;
		var v = tok.maybe_decimal_value ();
		if (v < 0) {
		    this.push (tok);
		    break;
		}
		sawany = true;
		val = val * 10 + v;
		tok = this.next_x_tok ();
	    }
	}

	if (!sawany)
	    throw new TexSyntaxError ('expected to see integer expression but ' +
				      'got the token ' + tok);

	if (val > 0x7FFFFFFF) {
	    this.warn ('found integer ' + val + ' greater than 2^32-1; ' +
		       'replace with that value');
	    val = 0x7FFFFFFF;
	}

	this.scan_one_optional_space ();
	return new TexInt (negfactor * val);
    };

    proto.scan_char_code = function Engine_scan_char_code () {
	// note: returns JS integer, not TexInt.
	return this.scan_int ().rangecheck (this, 0, 255).value;
    };

    proto.scan_register_num = function Engine_scan_register () {
	// note: returns JS integer, not TexInt.
	var v = this.scan_int ().value;
	if (v < 0 || v > 255)
	    throw new TexRuntimeError ('illegal register number ' + v);
	return v;
    };

    proto.scan_int_4bit = function Engine_scan_int_4bit () {
	// note: returns JS integer, not TexInt.
	return this.scan_int ().rangecheck (this, 0, 15).value;
    };

    proto.scan_dimen = function Engine_scan_dimen (mumode, infmode) {
	/* `infmode` says whether infinities are allowed. If true, the return
	 * value is [dimen, infinity_order] rather than just the dimension. */
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1], inf_order = 0, val = null,
	    frac = 0, nonfrac = null;

	var v = tok.tocmd (this).asvalref (this);
	if (v != null) {
	    v = v.get (this);

	    if (mumode)
		throw new TexRuntimeError ('not implemented');
	    else {
		var u = v.as_dimen ();
		if (u != null)
		    // We got a full-on dimen value; return it
		    return Dimen.new_product (negfactor, u.as_scaled ());
		// We got an int.
		nonfrac = v.as_int ();
	    }
	}

	if (nonfrac == null) {
	    // We need to scan a literal number.
	    if (tok.isotherchar (O_PERIOD) || tok.isotherchar (O_COMMA)) {
		nonfrac = 0;
	    } else {
		this.push (tok);
		nonfrac = this.scan_int ().value;
		if (nonfrac < 0) {
		    negfactor = -negfactor;
		    nonfrac = -nonfrac;
		}
		tok = this.next_x_tok ();
	    }

	    if (tok == NeedMoreData) {
		throw tok;
	    } else if (tok == EOF) {
		/* nothing */
	    } else if (!tok.isotherchar (O_PERIOD) && !tok.isotherchar (O_COMMA)) {
		this.push (tok)
	    } else {
		// We have a fractional part to deal with.
		var digits = [];
		while (true) {
		    tok = this.next_tok ();
		    if (tok === NeedMoreData)
			throw tok;
		    if (tok === EOF)
			break;

		    var v = tok.maybe_decimal_value ();
		    if (v < 0) {
			if (!tok.iscat (C_SPACE))
			    this.push (tok);
			break;
		    }
		    digits.push (v);
		}
		frac = Scaled.new_from_decimals (digits);
	    }
	}

	if (nonfrac < 0) {
	    negfactor = -negfactor;
	    nonfrac = -nonfrac;
	}

	if (this.scan_keyword ('true'))
	    throw new TexRuntimeError ('not implemented true-dimens');

	tok = this.chomp_spaces ();
	var val = tok.tocmd (this).as_scaled (this);
	var result = null;

	if (val != null) {
	    result = val.times_parts (nonfrac, frac);
	} else {
	    this.push (tok);

	    if (infmode && this.scan_keyword ('fil')) {
		inf_order = 1;
		while (this.scan_keyword ('l')) {
		    inf_order += 1;
		    if (inf_order > 3)
			throw new TexSyntaxError ('illegal infinity value ' +
						  '"fillll" or higher');
		}
		result = Scaled.new_from_parts (nonfrac, frac);
	    } else if (mumode) {
		if (this.scan_keyword ('mu'))
		    result = Scaled.new_from_parts (nonfrac, frac);
		else
		    throw new TexRuntimeError ('this quantity must have ' +
					       'dimensions of "mu"');
	    } else if (this.scan_keyword ('em')) {
		this.warn ('faking font em-width');
		v = Scaled.new_from_parts (18, 0);
		result = v.times_parts (nonfrac, frac);
	    } else if (this.scan_keyword ('ex')) {
		this.warn ('faking font ex-width');
		v = Scaled.new_from_parts (12, 0);
		result = v.times_parts (nonfrac, frac);
	    } else if (this.scan_keyword ('sp')) {
		result = new Scaled (nonfrac);
	    } else if (this.scan_keyword ('pt')) {
		result = Scaled.new_from_parts (nonfrac, frac);
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
					      'didn\'t find it; next is ' + tok);
		}

		result = Scaled.new_parts_product (num, denom, nonfrac, frac);
	    }
	}

	// TODO this isn't always done.
	this.scan_one_optional_space ();

	result = Dimen.new_product (negfactor, result);
	if (infmode)
	    return [result, inf_order];
	return result;
    };

    proto.scan_glue = function Engine_scan_glue (mumode) {
	var t = this._scan_signs ();
	var negfactor = t[0], tok = t[1];

	var v = tok.tocmd (this).as_glue (this);
	if (v != null)
	    return v.intproduct (negfactor);

	var g = new Glue ();
	this.push (tok);
	g.width = this.scan_dimen (mumode, false).intproduct (negfactor);

	if (this.scan_keyword ('plus')) {
	    t = this.scan_dimen (mumode, true);
	    g.stretch = t[0];
	    g.stretch_order = t[1];
	}

	if (this.scan_keyword ('minus')) {
	    t = this.scan_dimen (mumode, true);
	    g.shrink = t[0];
	    g.shrink_order = t[1];
	}

	return g;
    };

    proto.scan_toks_value = function Engine_scan_toks_value () {
	this.scan_one_optional_space ();

	var tok = this.next_tok ();
	if (tok === NeedMoreData || tok === EOF)
	    throw tok;

	// TODO: \tokpar=<toklist register or toklist param>
	if (!tok.iscat (C_BGROUP))
	    throw new TexSyntaxError ('expected { in toklist assignment; got ' + tok);

	return this.scan_tok_group (false);
    };

    proto.scan_valtype = function Engine_scan_valtype (valtype) {
	if (valtype == T_INT)
	    return this.scan_int ();
	if (valtype == T_DIMEN)
	    // XXX we don't know what to put for infmode.
	    return this.scan_dimen (false, false);
	if (valtype == T_GLUE)
	    return this.scan_glue (false);
	if (valtype == T_MUGLUE)
	    return this.scan_glue (true);
	if (valtype == T_TOKLIST)
	    return this.scan_toks_value ();
	throw new TexInternalError ('can\'t generically scan value type ' + valtype);
    };

    proto.scan_r_token = function Engine_scan_r_token () {
	var tok = null;

	while (true) {
	    tok = this.next_tok ();
	    if (tok == null)
		throw new TexRuntimeError ('EOF when expected cseq name');
	    if (!tok.iscat (C_SPACE))
		break;
	}

	if (!tok.iscslike ())
	    throw new TexRuntimeError ('expected control seq or active char;' +
				       'got ' + tok);

	if (tok.is_frozen_cs ())
	    throw new TexRuntimeError ('cannot redefined control seq ' + tok);

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
	    if (tok === NeedMoreData || tok === EOF)
		throw tok;

	    if (tok.iscat (C_BGROUP))
		depth += 1;
	    else if (tok.iscat (C_EGROUP)) {
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

	while (1) {
	    if (tok === NeedMoreData)
		throw tok;
	    if (tok === EOF)
		break;

	    if (!tok.ischar ()) {
		this.push (tok);
		break;
	    }

	    if (tok.iscat (C_SPACE))
		break;

	    name += String.fromCharCode (tok.ord);
	    tok = this.next_x_tok ();
	}

	return name;
    };


    proto.scan_streamnum = function Engine_scan_streamnum () {
	var snum = this.scan_int ().value;
	if (snum < 0 || snum > 15)
	    return 16; // NOTE: our little convention
	return snum;
    };


    // Conditionals

    proto.handle_if = function Engine_handle_if (result) {
	/* Assumes that an \if has just been read in and the result of the
         * test is `result`. We now prepare to handle the outcome. We'll have
         * to evaluate one branch and skip the other, taking care to pay
         * attention to nesting in the latter. We'll also have to swallow
         * \else and \fi tokens as appropriate. */

	if (result) {
	    /* All we need to do now is mark that we're an expecting an \else
             * or \fi, and that the else-block should be skipped if
             * encountered. */
	    this.conditional_stack.push (CS_ELSE_FI);
	    return;
	}

	if (this._if_skip_until (CS_ELSE_FI) == 'else') {
	    /* Encountered the else-block. We evaluate this part, and expect
             * to eat a \fi. */
	    this.conditional_stack.push (CS_FI);
	    return;
	}

	/* The \if was false and there's no else. We've skipped and just eaten
         * the \fi. Nothing else to do. */
    }


    proto.handle_if_case = function Engine_handle_if_case (value) {
	/* \ifcase<num> has just been read in and evaluated to `value`. We
         * want to evaluate the value'th case, or an \else, or nothing. */
	var ntoskip = value;

	while (ntoskip > 0) {
	    var found = this._if_skip_until (CS_OR_ELSE_FI);
	    if (found == 'fi')
		// Nothing left and no \else. Nothing to do.
		return;

	    if (found == 'else') {
		// We hit the else without finding our target case. We
		// want to evaluate it and then eat a \fi.
		this.conditional_stack.push (CS_FI);
		return;
	    }

	    // Hit an \or. Another case down the tubes.
	    ntoskip -= 1;
	}

	// If we're here, we must have hit our desired case! We'll have to
	// skip the rest of the cases later.
	this.conditional_stack.push (CS_OR_ELSE_FI);
    };


    proto._if_skip_until = function Engine__if_skip_until (mode) {
	var depth = 0;

	while (true) {
	    var tok = this.next_tok_throw ();

	    if (tok.iscmd (this, 'else')) {
		if (depth == 0) {
		    if (mode == CS_FI)
			throw new TexSyntaxError ('unexpected \\else');
		    this.trace ('... skipped conditional ... ' + tok);
		    return 'else';
		}
	    } else if (tok.iscmd (this, 'fi')) {
		if (depth > 0)
		    depth -= 1;
		else {
		    this.trace ('... skipped conditional ... ' + tok);
		    return 'fi';
		}
	    } else if (tok.iscmd (this, 'or')) {
		if (depth == 0) {
		    if (mode != CS_OR_ELSE_FI)
			throw new TexSyntaxError ('unexpected \\or');
		    this.trace ('... skipped conditional ... ' + tok);
		    return 'or';
		}
	    } else if (tok.isconditional (this)) {
		depth += 1;
	    }
	}

	throw new TexInternalError ('not reached');
    };


    proto.handle_or = function Engine_handle_or () {
	// We should only get here if we executed an \ifcase case and we need
	// to eat up alternate branches until the end.

	if (!this.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\or');

	var mode = this.conditional_stack.pop (), skipmode = CS_OR_ELSE_FI;
	if (mode != CS_OR_ELSE_FI)
	    throw new TexSyntaxError ('unexpected \\or');

	while (true) {
	    var found = this._if_skip_until (skipmode)
	    if (found == 'fi')
		break;
	    if (found == 'else')
		skipmode = CS_FI;
	}
    };


    proto.handle_else = function Engine_handle_else () {
	if (!this.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\else');

	var mode = this.conditional_stack.pop ();
	if (mode == CS_FI)
	    throw new TexSyntaxError ('unexpected (duplicate?) \\else');

	this._if_skip_until (CS_FI);
    };

    proto.handle_fi = function Engine_handle_fi () {
	if (!this.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\fi');

	// Don't care about mode, and nothing more to do.
	this.conditional_stack.pop ();
    };


    // Box construction

    proto.scan_box = function Engine_scan_box () {
	var tok = null;

	while (true) {
	    tok = this.next_x_tok_throw ();
	    if (!tok.iscat (C_SPACE) && !tok.iscmd (this, 'relax'))
		break;
	}

	// TODO: deal with leader_flag and hrule stuff; should accept:
	// \box, \copy, \lastbox, \vsplit, \hbox, \vbox, \vtop

	if (!tok.tocmd (this).boxlike)
	    throw new TexRuntimeError ('expected boxlike command but got ' + tok);
	this.push (tok);
    };


    proto.handle_setbox = function Engine_handle_setbox (reg) {
        // We just scanned "\setbox NN =". We'll now expect a box-construction
        // expression. The TeX design is such that rather than trying to read
        // in the whole box at once, we instead remember that we were doing a
        // setbox operation.

        function set_the_box (engine, box) {
            this.trace ('... finish setbox: #' + reg + ' = ' + box);
            engine.set_register (T_BOXLIST, reg, box)
	}

        this.boxop_stack.push ([set_the_box, true]);
        this.scan_box (); // check that we're being followed by a box.
    };

    proto.handle_hbox = function Engine_handle_hbox () {
	var is_exact, spec;

	if (this.scan_keyword ('to')) {
	    is_exact = true;
	    spec = this.scan_dimen ();
	} else if (this.scan_keyword ('spread')) {
	    is_exact = false;
	    spec = this.scan_dimen ();
	} else {
	    is_exact = false;
	    spec = new Dimen ();
	}

	function finish_box (engine) {
	    if (!this.boxop_stack.length)
		throw new TexRuntimeError ('what to do with bare box?');

	    this.trace ('<--- hbox');
	    this.unnest_eqtb ();
	    var box = new Box ();
	    box.tlist = this.leave_mode ();
	    var t = this.boxop_stack.pop ();
	    var boxop = t[0], isassignment = t[1];
	};

	this.scan_left_brace ();

	if (this.boxop_stack && this.boxop_stack.length)
	    // This is an assignment expression.
	    this.maybe_insert_after_assign_token ();

	this.trace ('--> hbox');
	this.enter_mode (M_RHORZ);
	this.nest_eqtb ();
	this.group_exit_stack.push (finish_box.bind (this));
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

    proto.escapechar = function Engine_escapechar () {
	return this.get_parameter (T_INT, 'escapechar').value;
    };

    return Engine;
})();

WEBTEX.Engine = Engine;
