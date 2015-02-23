// Copyright 2015 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Macros!

(function macros_wrapper () {
    var MacroCommand = (function MacroCommand_closure () {
	function MacroCommand (flags, origcs, tmpl, repl) {
	    Command.call (this);
	    this.flags = flags;
	    this.origcs = origcs;
	    this.tmpl = tmpl;
	    this.repl = repl;
	}

	inherit (MacroCommand, Command);
	var proto = MacroCommand.prototype;
	proto.name = '<macro>';
	proto.expandable = true;
	proto.multi_instanced = true;

	proto._serialize_data = function MacroCommand__serialize_data (state, housekeeping) {
	    return [this.flags,
		    this.origcs.to_serialize_str (),
		    (new Toklist (this.tmpl)).as_serializable (),
		    (new Toklist (this.repl)).as_serializable ()];
	};

	MacroCommand.deserialize = function MacroCommand_deserialize (data, housekeeping) {
	    var flags = data[0];
	    var origcs = Toklist.deserialize (data[1]).toks[0];
	    var tmpl = Toklist.deserialize (data[2]).toks;
	    var repl = Toklist.deserialize (data[3]).toks;
	    return new MacroCommand (flags, origcs, tmpl, repl);
	};

	proto.same_cmd = function MacroCommand_same_cmd (other) {
	    if (other == null)
		return false;
	    if (this.name != other.name)
		return false;
	    if (this.flags != other.flags)
		return false;
	    if (this.tmpl.length != other.tmpl.length)
		return false;
	    if (this.repl.length != other.repl.length)
		return false;

	    for (var i = 0; i < this.tmpl.length; i++)
		if (!this.tmpl[i].equals (other.tmpl[i]))
		    return false;

	    for (var i = 0; i < this.repl.length; i++)
		if (!this.repl[i].equals (other.repl[i]))
		    return false;

	    return true;
	};

	proto.invoke = function MacroCommand_invoke (engine) {
	    if (!this.tmpl.length) {
		engine.trace ('*macro %o -> %T', this.origcs, this.repl);
		engine.push_toks (this.repl);
		return;
	    }

	    var tidx = 0, ntmpl = this.tmpl.length, param_vals = {};

	    while (tidx < ntmpl) {
		var ttok = this.tmpl[tidx];

		if (!ttok.is_param ()) {
		    // span of nonparameter tokens in template -- eat and make
		    // sure that the actual token stream matches.
		    var atok = engine.next_tok_throw ();
		    if (!atok.equals (ttok))
			throw new TexRuntimeError ('macro invocation doesn\'t match ' +
						   'template: expected %o, got %o',
						   ttok, atok);
		    tidx += 1;
		    continue;
		}

		if (tidx == ntmpl - 1 || this.tmpl[tidx+1].is_param ()) {
		    // Undelimited parameter. Either a single token, or a group.
		    var tok = engine.next_tok_throw ();

		    if (tok.is_cat (C_BGROUP))
			param_vals[ttok.pnum] = engine.scan_tok_group (false).toks;
		    else if (tok.is_cat (C_SPACE))
			// TexBook pg 201: spaces are not used as undelimited args;
			// here we intentionally do not use is_space() (T:TP 393).
			continue;
		    else
			param_vals[ttok.pnum] = [tok];

		    tidx += 1;
		    continue;
		}

		// Delimited parameter -- scan until we match the trailing
		// non-parameter tokens. Brace stripping is tricky: given
		// X#1Y -> #1,
		//  XabY     -> ab, and
		//  X{ab}Y   -> ab, but
		//  X{a}{b}Y -> {a}{b}, since otherwise you'd get "a}{b".

		var expansion = [], match_start = tidx + 1, match_end = tidx + 2;

		while (match_end < ntmpl && !this.tmpl[match_end].is_param ())
		    match_end += 1;

		var n_to_match = match_end - match_start, cur_match_idx = 0;

		while (cur_match_idx < n_to_match) {
		    var tok = engine.next_tok_throw ();

		    if (tok.equals (this.tmpl[match_start + cur_match_idx])) {
			// We're making progress on matching the delimeters.
			cur_match_idx += 1;
			continue;
		    }

		    // We're not matching the template. We need to accumulate
		    // something into the expansion.

		    if (cur_match_idx == 0) {
			// We weren't matching at all; straightforward.
			expansion.push (tok);
		    } else {
			// More complicated situation. If a macro's template is
			// #1xxy and the pattern fed into it is abcxxxy, #1 should
			// map to abcx. For this to work, we need to start
			// rescanning for a pattern match at the second x, which
			// will have already been thrown away (but can be
			// recovered since it is precisely a token in this.tmpl).
			// We also need to add the first x to the expansion since
			// we now know that it isn't matching the template.
			expansion.push (this.tmpl[match_start]);
			engine.push_back (tok);
			engine.push_toks (this.tmpl.slice (match_start + 1,
							   match_start + cur_match_idx));
			cur_match_idx = 0;
			tok = this.tmpl[match_start];
		    }

		    if (tok.is_cat (C_BGROUP)) {
			// If the expansion accumulated an open-group, we need to
			// contribute at least the whole group. This inner loop is
			// the best implementation I could devise; there are
			// several corner cases that make things quite tricky.
			var depth = 1;

			while (depth > 0) {
			    tok = engine.next_tok_throw ();

			    if (tok.is_cat (C_BGROUP))
				depth += 1;
			    else if (tok.is_cat (C_EGROUP))
				depth -= 1;

			    expansion.push (tok);
			}
		    }
		}

		if (expansion.length > 1 && expansion[0].is_cat (C_BGROUP) &&
		    expansion[expansion.length - 1].is_cat (C_EGROUP)) {
		    // Check if we can strip off these braces.
		    var canstrip = true, depth = 1;

		    for (var i = 1; i < expansion.length - 1; i++) {
			var tok = expansion[i];
			if (tok.is_cat (C_BGROUP))
			    depth += 1;
			else if (tok.is_cat (C_EGROUP)) {
			    depth -= 1;
			    if (depth == 0) {
				canstrip = false;
				break;
			    }
			}
		    }

		    if (canstrip)
			expansion = expansion.slice (1, expansion.length - 1);
		}

		param_vals[ttok.pnum] = expansion; // note: don't update ttok!
		tidx = match_end;
	    }

	    // OK, we've finally accumulated all of the parameter values! We
	    // can now build the replacement.

	    var fullrepl = [];

	    for (var i = 0; i < this.repl.length; i++) {
		var rtok = this.repl[i];

		if (!rtok.is_param ()) {
		    fullrepl.push (rtok);
		} else {
		    var ptoks = param_vals[rtok.pnum];
		    for (var j = 0; j < ptoks.length; j++) {
			fullrepl.push (ptoks[j]);
		    }
		}
	    }

	    engine.trace ('*macro %o ...', this.origcs);
	    for (var i = 1; i < 10; i++)
		if (param_vals.hasOwnProperty (i))
		    engine.trace ('   #%d = %T', i, param_vals[i]);
	    engine.trace (' -> %T', fullrepl);
	    engine.push_toks (fullrepl);
	};

	proto.texmeaning = function MacroCommand_texmeaning (engine) {
	    var s = 'macro:';
	    function tt (t) {return t.textext (engine, true); }
	    s += [].map.call (this.tmpl, tt).join ('');
	    s += '->';
	    s += [].map.call (this.repl, tt).join ('');
	    return s;
	};

	return MacroCommand;
    })();

    register_command_deserializer ('<macro>', MacroCommand.deserialize);

    function do_def (engine, cname, expand_replacement) {
	var cstok = engine.scan_r_token ();

	var tmpl_toks = [], repl_toks = [], last_was_param = false,
            end_with_lbrace = false, next_pnum = 1;

	while (true) {
	    var tok = engine.next_tok_throw ();

	    if (last_was_param) {
		if (tok.to_cmd (engine) instanceof BeginGroupCommand) {
		    tmpl_toks.push (tok);
		    end_with_lbrace = true;
		    engine.align_state--; // TTP 394 ... I think??
		    break;
		}

		if (tok.is_other_char (O_ZERO + next_pnum)) {
		    if (next_pnum > 9)
			throw new TexRuntimeError ('macros may only have 9 parameters');

		    tmpl_toks.push (Token.new_param (next_pnum));
		    next_pnum += 1;
		    last_was_param = false;
		    continue;
		}

		throw new TexSyntaxError ('unexpected token %o following ' +
					  'parameter token', tok);
	    }

	    if (tok.is_cat (C_PARAM)) {
		last_was_param = true;
		continue;
	    }

	    if (tok.is_cat (C_BGROUP))
		break;

	    tmpl_toks.push (tok);
	    last_was_param = false;
	}

	// We've just read in the param template and the left brace of
	// the replacement. Now read that in.

	var depth = 1;
	last_was_param = false;

	while (true) {
	    var tok = engine.next_tok_throw ();

	    if (expand_replacement) {
		// We can't just use next_x_tok because \the{toklist} is
		// not supposed to be sub-expanded (TeXBook p. 216). Yargh.
		if (tok.is_cmd (engine, 'noexpand')) {
		    tok = engine.next_tok_throw ();
		} else if (tok.is_expandable (engine)) {
		    if (tok.is_cmd (engine, 'the')) {
			var next = engine.next_tok_throw ();
			var ncmd = next.to_cmd (engine);

			if (ncmd.get_valtype () == T_TOKLIST) {
			    var nv = ncmd.as_valref (engine);
			    repl_toks = repl_toks.concat (nv.get (engine).toks);
			    continue;
			} else {
			    engine.push_back (next);
			}
		    }

		    // e-TeX: \protected macros aren't expanded here.
		    var cmd = tok.to_cmd (engine);
		    if (!(cmd instanceof MacroCommand) || !(cmd.flags & Prefixing.FLAG_PROTECTED)) {
			cmd.invoke (engine);
			continue;
		    }
		}
	    }

	    if (last_was_param) {
		if (tok.is_cat (C_PARAM)) {
		    repl_toks.push (tok);
		    last_was_param = false;
		    continue;
		}

		if (tok.is_cat (C_OTHER) && tok.ord > O_ZERO &&
		    tok.ord < O_ZERO + next_pnum) {
		    repl_toks.push (Token.new_param (tok.ord - O_ZERO));
		    last_was_param = false;
		    continue;
		}

		throw new TexSyntaxError ('unexpected token %o following ' +
					  'parameter token', tok);
	    }

	    if (tok.is_cat (C_PARAM)) {
		last_was_param = true;
		continue;
	    }

	    if (tok.is_cat (C_BGROUP))
		depth += 1;
	    else if (tok.is_cat (C_EGROUP)) {
		depth -= 1;
		if (depth == 0)
		    break;
	    }

	    repl_toks.push (tok);
	    last_was_param = false;
	}

	if (end_with_lbrace)
	    repl_toks.push (tmpl_toks[tmpl_toks.length - 1]);

	var flags = engine.get_prefix_flags ();
	flags &= (~Prefixing.FLAG_GLOBAL);

	engine.trace ('%s (%x) %o: %T -> %T', cname, flags, cstok, tmpl_toks, repl_toks);
	cstok.assign_cmd (engine, new MacroCommand (flags, cstok, tmpl_toks, repl_toks));
    }


    register_command ('def', function cmd_def (engine) {
	return do_def (engine, 'def', false);
    });

    register_command ('gdef', function cmd_gdef (engine) {
	return engine.with_global_prefix (function () {
	    return do_def (engine, 'gdef', false);
	});
    });

    register_command ('edef', function cmd_edef (engine) {
	return do_def (engine, 'edef', true);
    });

    register_command ('xdef', function cmd_xdef (engine) {
	return engine.with_global_prefix (function () {
	    return do_def (engine, 'xdef', true);
	});
    });

}) ();
