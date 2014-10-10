// Basic conditionals. Some of the more specialized ones are implemented
// closer to their respective subsystems.

(function conditional_wrapper () {
    var CS_FI = 0, CS_ELSE_FI = 1, CS_OR_ELSE_FI = 2, CS_INCONDITION = 3;

    engine_proto.register_state ({
	init: function (engine) {
	    engine.conditional_stack = [];
	},
	is_clean: function (engine) {
	    return engine.conditional_stack.length == 0;
	}
    });

    engine_proto.register_method (function Engine_start_parsing_condition () {
	this.conditional_stack.push (CS_INCONDITION);
    });

    engine_proto.register_method (function Engine_done_parsing_condition () {
	while (this.conditional_stack.length) {
	    var mode = this.conditional_stack.pop ();
	    if (mode == CS_INCONDITION)
		return;

	    // This can legally happen if there was an \if inside the
	    // condition that hasn't wrapped up, e.g.:
	    //    \ifcase \iftrue1 \else blah \fi \else ... \fi
	    // parse_int will stop before the \fi, so that a CS_ELSE_FI will
	    // still be on conditional_stack.
	    //
	    // We need to just eat up any \ifs that are above us on the stack.
	    // I'm a little scared by this but it seems to be what we're supposed
	    // to do: T:TP 500.

	    var depth = 0;

	    while (true) {
		var tok = this.next_tok_throw ();

		if (tok.is_cmd (this, 'fi')) {
		    if (depth > 0)
			depth -= 1;
		    else
			break;
		} else if (tok.is_conditional (this)) {
		    depth += 1;
		}
	    }
	}
    });

    engine_proto.register_method (function Engine_handle_if (result) {
	// Assumes that an \if has just been read in and the result of the
        // test is `result`. We now prepare to handle the outcome. We'll have
        // to evaluate one branch and skip the other, taking care to pay
        // attention to nesting in the latter. We'll also have to swallow
        // \else and \fi tokens as appropriate.

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
    });

    engine_proto.register_method (function Engine_handle_if_case (value) {
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
    });

    engine_proto.register_method (function Engine__if_skip_until (mode) {
	var depth = 0;

	while (true) {
	    var tok = this.next_tok_throw ();

	    if (tok.is_cmd (this, 'else')) {
		if (depth == 0) {
		    if (mode == CS_FI)
			throw new TexSyntaxError ('unexpected \\else');
		    this.Ntrace ('... skipped conditional ... %o', tok);
		    return 'else';
		}
	    } else if (tok.is_cmd (this, 'fi')) {
		if (depth > 0)
		    depth -= 1;
		else {
		    this.Ntrace ('... skipped conditional ... %o', tok);
		    return 'fi';
		}
	    } else if (tok.is_cmd (this, 'or')) {
		if (depth == 0) {
		    if (mode != CS_OR_ELSE_FI)
			throw new TexSyntaxError ('unexpected \\or');
		    this.Ntrace ('... skipped conditional ... %o', tok);
		    return 'or';
		}
	    } else if (tok.is_conditional (this)) {
		depth += 1;
	    }
	}

	throw new TexInternalError ('not reached');
    });

    engine_proto.register_method (function Engine_handle_or () {
	// We should only get here if we executed an \ifcase case and we need
	// to eat up alternate branches until the end.

	if (!this.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\or');

	var mode = this.conditional_stack.pop (), skipmode = CS_OR_ELSE_FI;
	if (mode == CS_INCONDITION) {
	    // We were parsing the condition of the \ifcase and it involved
	    // some kind of open-ended expanding parsing that made it out to
	    // this \or. TeX inserts a \relax in this case to stop the
	    // expansion. T:TP 495.
	    this.push_toks ([Token.new_cmd (this.commands['relax']),
			     Token.new_cmd (this.commands['or'])]);
	    this.conditional_stack.push (mode);
	    return;
	}

	if (mode != CS_OR_ELSE_FI)
	    throw new TexSyntaxError ('unexpected \\or');

	while (true) {
	    var found = this._if_skip_until (skipmode)
	    if (found == 'fi')
		break;
	    if (found == 'else')
		skipmode = CS_FI;
	}
    });

    engine_proto.register_method (function Engine_handle_else () {
	if (!this.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\else');

	var mode = this.conditional_stack.pop ();
	if (mode == CS_INCONDITION) {
	    // See comment in handle_or.
	    this.push_toks ([Token.new_cmd (this.commands['relax']),
			     Token.new_cmd (this.commands['else'])]);
	    this.conditional_stack.push (mode);
	    return;
	}

	if (mode == CS_FI)
	    throw new TexSyntaxError ('unexpected (duplicate?) \\else');

	this._if_skip_until (CS_FI);
    });

    engine_proto.register_method (function Engine_handle_fi () {
	if (!this.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\fi');

	var mode = this.conditional_stack.pop ();
	if (mode == CS_INCONDITION) {
	    // See comment in handle_or.
	    this.push_toks ([Token.new_cmd (this.commands['relax']),
			     Token.new_cmd (this.commands['fi'])]);
	    this.conditional_stack.push (mode);
	    return;
	}

	// Otherwise, we don't care and there's nothing more to do.
    });

    register_command ('_if', function cmd_if (engine) {
	engine.start_parsing_condition ();
	var t1 = engine.next_x_tok (), t2 = engine.next_x_tok ();
	engine.done_parsing_condition ();

	// The comparison rules here are a bit funky.

	function key (tok) {
	    if (tok.is_char ())
		return tok.catcode * 1000 + tok.ord;
	    if (tok.is_cslike ()) { // active chars will be caught by above
		var cmd = tok.to_cmd (engine);
		if (cmd instanceof GivenCharCommand)
		    throw new TexInternalError ('not implemented');
		return 16 * 1000 + 256;
	    }
	    throw new TexRuntimeError ('illegal comparison subject %o', tok);
	}

	var result = (key (t1) == key (t2));
	engine.Ntrace ('if %o ~ %o => %b', t1, t2, result);
	engine.handle_if (result);
    });


    register_command ('ifcat', function cmd_ifcat (engine) {
	engine.start_parsing_condition ();
	var t1 = engine.next_x_tok (), t2 = engine.next_x_tok ();
	engine.done_parsing_condition ();

	// The comparison rules here are a bit funky.

	function key (tok) {
	    if (tok.is_char ())
		return tok.catcode;
	    if (tok.is_cslike ()) { // active chars will be caught by above
		var cmd = tok.to_cmd (engine);
		if (cmd instanceof GivenCharCommand)
		    throw new TexInternalError ('not implemented');
		return 16;
	    }
	    throw new TexRuntimeError ('illegal comparison subject %o', tok);
	}

	var result = (key (t1) == key (t2));
	engine.Ntrace ('ifcat %o ~ %o => %b', t1, t2, result);
	engine.handle_if (result);
    });


    register_command ('ifx', function cmd_ifx (engine) {
	var t1 = engine.next_tok_throw (), t2 = engine.next_tok_throw (), result;
	var cmd1 = t1.to_cmd (engine), cmd2 = t2.to_cmd (engine);
	result = cmd1.same_cmd (cmd2);
	engine.Ntrace ('ifx %o ~ %o => %b', t1, t2, result);
	engine.handle_if (result);
    });


    register_command ('ifnum', function cmd_ifnum (engine) {
	engine.start_parsing_condition ();
	var val1 = engine.scan_int ().value;

	while (true) {
	    var tok = engine.next_x_tok ();
	    if (tok == null)
		throw new TexSyntaxError ('EOF inside \\ifnum');
	    if (!tok.is_space (engine))
		break;
	}

	// It's a little futzy to not check the validity of tok before
	// reading val2.
	var val2 = engine.scan_int ().value, result;
	engine.done_parsing_condition ();

	if (tok.is_other_char (O_LESS))
	    result = (val1 < val2);
	else if (tok.is_other_char (O_GREATER))
	    result = (val1 > val2);
	else if (tok.is_other_char (O_EQUALS))
	    result = (val1 == val2);
	else
	    throw new TexSyntaxError ('expected <,=,> in \\ifnum but got %o', tok);

	engine.Ntrace ('ifnum %d %o %d => %b', val1, tok, val2, result);
	engine.handle_if (result);
    });


    register_command ('ifodd', function cmd_ifodd (engine) {
	engine.start_parsing_condition ();
	var val = engine.scan_int ().value;
	engine.done_parsing_condition ();
	var result = (val % 2 == 1);
	engine.Ntrace ('ifodd %d => %b', val, result);
	engine.handle_if (result);
    });


    register_command ('ifdim', function cmd_ifdim (engine) {
	engine.start_parsing_condition ();
	var val1 = engine.scan_dimen ();

	while (1) {
	    var tok = engine.next_x_tok ();
	    if (tok == null)
		throw new TexSyntaxError ('EOF inside \\ifdim');
	    if (!tok.is_space (engine))
		break;
	}

	var val2 = engine.scan_dimen (), result;
	engine.done_parsing_condition ();

	if (tok.is_other_char (O_LESS))
	    result = (val1.sp.value < val2.sp.value);
	else if (tok.is_other_char (O_GREATER))
	    result = (val1.sp.value > val2.sp.value);
	else if (tok.is_other_char (O_EQUALS))
	    result = (val1.sp.value == val2.sp.value);
	else
	    throw new TexSyntaxError ('expected <,=,> in \\ifdim but got %o', tok);

	engine.Ntrace ('ifdim %o %o %o => %b', val1, tok, val2, result);
	engine.handle_if (result);
    });


    register_command ('iffalse', function cmd_iffalse (engine) {
	engine.Ntrace ('iffalse');
	engine.handle_if (false);
    });


    register_command ('iftrue', function cmd_iftrue (engine) {
	engine.Ntrace ('iftrue');
	engine.handle_if (true);
    });


    register_command ('ifcase', function cmd_ifcase (engine) {
	engine.start_parsing_condition ();
	var val = engine.scan_int ().value;
	engine.done_parsing_condition ();
	engine.Ntrace ('ifcase %d', val);
	engine.handle_if_case (val);
    });

    register_command ('_else', function cmd_else (engine) {
	engine.Ntrace ('else [non-eaten]');
	engine.handle_else ();
    });


    register_command ('or', function cmd_or (engine) {
	engine.Ntrace ('or [non-eaten]');
	engine.handle_or ();
    });


    register_command ('fi', function cmd_fi (engine) {
	engine.Ntrace ('fi [non-eaten]');
	engine.handle_fi ();
    });


    register_command ('ifhmode', function cmd_ifhmode (engine) {
	engine.Ntrace ('ifhmode');
	engine.handle_if (engine.mode () == M_HORZ || engine.mode () == M_RHORZ);
    });


    register_command ('ifvmode', function cmd_ifvmode (engine) {
	engine.Ntrace ('ifvmode');
	engine.handle_if (engine.mode () == M_VERT || engine.mode () == M_IVERT);
    });


    register_command ('ifmmode', function cmd_ifmmode (engine) {
	engine.Ntrace ('ifmmode');
	engine.handle_if (engine.mode () == M_MATH || engine.mode () == M_DMATH);
    });

}) ();
