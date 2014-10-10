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

    function if_skip_until (engine, mode) {
	var depth = 0;

	while (true) {
	    var tok = engine.next_tok_throw ();

	    if (tok.is_cmd (engine, 'else')) {
		if (depth == 0) {
		    if (mode == CS_FI)
			throw new TexSyntaxError ('unexpected \\else');
		    engine.trace ('... skipped conditional ... %o', tok);
		    return 'else';
		}
	    } else if (tok.is_cmd (engine, 'fi')) {
		if (depth > 0)
		    depth -= 1;
		else {
		    engine.trace ('... skipped conditional ... %o', tok);
		    return 'fi';
		}
	    } else if (tok.is_cmd (engine, 'or')) {
		if (depth == 0) {
		    if (mode != CS_OR_ELSE_FI)
			throw new TexSyntaxError ('unexpected \\or');
		    engine.trace ('... skipped conditional ... %o', tok);
		    return 'or';
		}
	    } else if (tok.is_conditional (engine)) {
		depth += 1;
	    }
	}

	throw new TexInternalError ('not reached');
    }

    engine_proto.register_method (function Engine_handle_if (result) {
	// Assumes that some kind of conditional has just been read in and the
        // result of the test is `result`. We now prepare to handle the
        // outcome. We'll have to evaluate one branch and skip the other,
        // taking care to pay attention to nesting in the latter. We'll also
        // have to swallow \else and \fi tokens as appropriate.

	if (result) {
	    /* All we need to do now is mark that we're an expecting an \else
             * or \fi, and that the else-block should be skipped if
             * encountered. */
	    this.conditional_stack.push (CS_ELSE_FI);
	    return;
	}

	if (if_skip_until (this, CS_ELSE_FI) == 'else') {
	    /* Encountered the else-block. We evaluate this part, and expect
             * to eat a \fi. */
	    this.conditional_stack.push (CS_FI);
	    return;
	}

	/* The \if was false and there's no else. We've skipped and just eaten
         * the \fi. Nothing else to do. */
    });

    register_command ('else', function cmd_else (engine) {
	engine.trace ('else [non-eaten]');

	if (!engine.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\else');

	var mode = engine.conditional_stack.pop ();
	if (mode == CS_INCONDITION) {
	    // See comment in handle_or.
	    engine.push_toks ([Token.new_cmd (engine.commands['relax']),
			       Token.new_cmd (engine.commands['else'])]);
	    engine.conditional_stack.push (mode);
	    return;
	}

	if (mode == CS_FI)
	    throw new TexSyntaxError ('unexpected (duplicate?) \\else');

	if_skip_until (engine, CS_FI);
    });

    register_command ('fi', function cmd_fi (engine) {
	engine.trace ('fi [non-eaten]');

	if (!engine.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\fi');

	var mode = engine.conditional_stack.pop ();
	if (mode == CS_INCONDITION) {
	    // See comment in handle_or.
	    engine.push_toks ([Token.new_cmd (engine.commands['relax']),
			       Token.new_cmd (engine.commands['fi'])]);
	    engine.conditional_stack.push (mode);
	    return;
	}

	// Otherwise, we don't care and there's nothing more to do.
    });


    // \ifcase commands -- a related, but different branching structure.

    register_command ('ifcase', function cmd_ifcase (engine) {
	// \ifcase<num> can be interpreted as saying that we need to skip
	// <num> \or clauses. We want to evaluate the <num>'th case, or an
	// \else, or nothing.

	engine.start_parsing_condition ();
	var ntoskip = engine.scan_int ().value;
	engine.done_parsing_condition ();
	engine.trace ('ifcase %d', ntoskip);

	var ntoskip = value;

	while (ntoskip > 0) {
	    var found = if_skip_until (engine, CS_OR_ELSE_FI);
	    if (found == 'fi')
		// Nothing left and no \else. Nothing to do.
		return;

	    if (found == 'else') {
		// We hit the else without finding our target case. We
		// want to evaluate it and then eat a \fi.
		engine.conditional_stack.push (CS_FI);
		return;
	    }

	    // Hit an \or. Another case down the tubes.
	    ntoskip -= 1;
	}

	// If we're here, we must have hit our desired case! We'll have to
	// skip the rest of the cases later.
	engine.conditional_stack.push (CS_OR_ELSE_FI);
    });

    register_command ('or', function cmd_or (engine) {
	engine.trace ('or [non-eaten]');

	// We should only get here if we executed an \ifcase case and we need
	// to eat up alternate branches until the end.

	if (!engine.conditional_stack.length)
	    throw new TexSyntaxError ('stray \\or');

	var mode = engine.conditional_stack.pop (), skipmode = CS_OR_ELSE_FI;
	if (mode == CS_INCONDITION) {
	    // We were parsing the condition of the \ifcase and it involved
	    // some kind of open-ended expanding parsing that made it out to
	    // engine \or. TeX inserts a \relax in engine case to stop the
	    // expansion. T:TP 495.
	    engine.push_toks ([Token.new_cmd (engine.commands['relax']),
			       Token.new_cmd (engine.commands['or'])]);
	    engine.conditional_stack.push (mode);
	    return;
	}

	if (mode != CS_OR_ELSE_FI)
	    throw new TexSyntaxError ('unexpected \\or');

	while (true) {
	    var found = if_skip_until (engine, skipmode)
	    if (found == 'fi')
		break;
	    if (found == 'else')
		skipmode = CS_FI;
	}
    });


    // Now we can get to the basic conditional commands. These all
    // delegate to engine.handle_if().

    register_command ('if', function cmd_if (engine) {
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
	engine.trace ('if %o ~ %o => %b', t1, t2, result);
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
	engine.trace ('ifcat %o ~ %o => %b', t1, t2, result);
	engine.handle_if (result);
    });


    register_command ('ifx', function cmd_ifx (engine) {
	var t1 = engine.next_tok_throw (), t2 = engine.next_tok_throw (), result;
	var cmd1 = t1.to_cmd (engine), cmd2 = t2.to_cmd (engine);
	result = cmd1.same_cmd (cmd2);
	engine.trace ('ifx %o ~ %o => %b', t1, t2, result);
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

	engine.trace ('ifnum %d %o %d => %b', val1, tok, val2, result);
	engine.handle_if (result);
    });


    register_command ('ifodd', function cmd_ifodd (engine) {
	engine.start_parsing_condition ();
	var val = engine.scan_int ().value;
	engine.done_parsing_condition ();
	var result = (val % 2 == 1);
	engine.trace ('ifodd %d => %b', val, result);
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

	engine.trace ('ifdim %o %o %o => %b', val1, tok, val2, result);
	engine.handle_if (result);
    });


    register_command ('iffalse', function cmd_iffalse (engine) {
	engine.trace ('iffalse');
	engine.handle_if (false);
    });


    register_command ('iftrue', function cmd_iftrue (engine) {
	engine.trace ('iftrue');
	engine.handle_if (true);
    });


    register_command ('ifhmode', function cmd_ifhmode (engine) {
	engine.trace ('ifhmode');
	engine.handle_if (engine.mode () == M_HORZ || engine.mode () == M_RHORZ);
    });


    register_command ('ifvmode', function cmd_ifvmode (engine) {
	engine.trace ('ifvmode');
	engine.handle_if (engine.mode () == M_VERT || engine.mode () == M_IVERT);
    });


    register_command ('ifmmode', function cmd_ifmmode (engine) {
	engine.trace ('ifmmode');
	engine.handle_if (engine.mode () == M_MATH || engine.mode () == M_DMATH);
    });

}) ();
