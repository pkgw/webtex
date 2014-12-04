// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

var command_info = [
    $command_info
];

function fill_cseq_commands (engine) {
    var registry = register_command._registry;

    command_info.forEach (function (item) {
	var name = item[0], escname = item[1], expand = item[2],
	    cond = item[3], afm = item[4];
	var cmd = null;

	if (!registry.hasOwnProperty (escname))
	    cmd = new CommandUnimplPrimitive (name);
	else {
	    var val = registry[escname];

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
	var name = parameter_info[i][0], valtype = parameter_info[i][1];
	var cmd = new NamedParamCommand (name, valtype);
	engine.commands[name] = cmd;
	engine.set_cseq (name, cmd);
    }
}
