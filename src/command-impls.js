'use strict;'

var commands = WEBTEX.commands = {};

commands.par = function cmd_par (engine) {
    engine.debug ('par');
};


// Setting categories: \catcode, \mathcode, etc.

commands.catcode = (function CatcodeCommand_closure () {
    function CatcodeCommand () { Command.call (this); }
    inherit (CatcodeCommand, Command);
    var proto = CatcodeCommand.prototype;

    proto.invoke = function CatcodeCommand_invoke (engine) {
	var ord = engine.scan_char_code ();
	engine.scan_optional_equals ();
	var ccode = engine.scan_int_4bit ();
	engine.debug ('catcode ' + escchr (ord) + '=' + ord + ' -> '
		      + ccode + '=' + cc_abbrev[ccode]);
	engine.set_catcode (ord, ccode);
    };

    proto.asvalue = function CatcodeCommand_asvalue (engine) {
	var ord = engine.scan_char_code ();
	return ConstantIntValue (engine.catcode (ord));
    };

    return CatcodeCommand;
})();
