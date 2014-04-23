function init_generic_eqtb (obj) {
    var i = 0, t = null;

    // Makes more sense to special-case this here than the generator.
    t = obj._catcodes = {};
    for (i = 0; i < 256; i++)
	t[i] = obj.parent._catcodes[i];

    $eqtb_generic_init
}

function fill_generic_eqtb_accessors (proto) {
    $eqtb_generic_accessors
}

function init_top_eqtb (obj) {
    var i = 0, t = null;

    $eqtb_toplevel_init
}

function fill_top_eqtb_accessors (proto) {
    $eqtb_toplevel_accessors
}


function fill_engine_eqtb_wrappers (proto, AF_GLOBAL) {
    $eqtb_engine_wrappers
}

var command_info = [
    $command_info
];

function fill_cseq_commands (engine) {
    command_info.forEach (function (item) {
	var name = item[0], escname = item[1], expand = item[2],
	    cond = item[3], afm = item[4];
	var cmd = null;

	if (!WEBTEX.commands.hasOwnProperty (escname))
	    cmd = new CommandUnimplPrimitive (name);
	else {
	    var val = WEBTEX.commands[escname];

	    if (val.prototype instanceof Command)
		cmd = new val ();
	    else if (val instanceof Command)
		cmd = val;
	    else {
		cmd = new Command ();
		cmd.invoke = val;
	    }
	}

	cmd.name = name;
	cmd.expandable = expand;
	cmd.conditional = cond;
	cmd.assign_flag_mode = afm;
	engine.commands[name] = cmd;
	engine.set_cseq (name, cmd);
    });
}


function engine_init_parameters (engine) {
    $init_parameters
}


var parameter_info = [
    $parameter_info
];


function engine_init_param_cseqs (engine) {
    for (var i = 0; i < parameter_info.length; i++) {
	var name = parameter_info[i][0], ctor = parameter_info[i][1];
	var cmd = new ctor (name);
	engine.commands[name] = cmd;
	engine.set_cseq (name, cmd);
    }
}
