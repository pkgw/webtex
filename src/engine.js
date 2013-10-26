var Engine = (function Engine_closure () {
    var TS_BEGINNING = 0, TS_MIDDLE = 1, TS_SKIPPING = 2;

    function Engine (jobname) {
	this.jobname = jobname;

	this.tokenizer_state = TS_BEGINNING;
	this.pushed_tokens = [];

	this.eqtbs = [/*new ToplevelEquivTable ()*/];
	this.mode_stack = [M_VERT];
	this.build_stack = [[]];
	this.group_exit_stack = [];
	this.boxop_stack = [];

	this.assign_flags = 0;
	this.after_assign_token = undefined;
	// ...
    }

    Engine.prototype = {
	onLineReceived: function Engine_onLineReceived (line) {
	    console.log ("engine line: " + line);
	},
    };

    return Engine;
})();

WEBTEX.Engine = Engine;
