// An individual token manipulated in the TeX engine. These may be generated
// directly by parsing an input file, or synthesized for various reasons as
// the engine runs.
//
// The representation of tokens is kind of awkward. I think it's better to
// have a single class with an internal "kind" rather than subclasses, but
// maybe that's wrong.

var Token = (function Token_closure () {
    var TK_CHAR = 0, TK_CSEQ = 1, TK_PARAM = 2, TK_PURECMD = 3;
    var frozen_cs_names = { cr: 1,
			    endgroup: 1,
			    endtemplate: 1,
			    endwrite: 1,
			    fi: 1,
			    'notexpanded:': 1,
			    nullfont: 1,
                            relax: 1,
			    right: 1 };

    function escape (esc_func, text) {
	return [].map.call (text, ord).map (esc_func).join ('');
    }

    function Token () {};

    var proto = Token.prototype;

    proto.toString = function Token_toString () {
	if (this.kind == TK_CHAR)
	    return escchr (this.ord) + ':' + cc_abbrev[this.catcode];
	if (this.kind == TK_CSEQ)
	    return '<' + escape (escchr, this.name) + '>';
	if (this.kind == TK_PARAM)
	    return '#' + this.pnum;
	if (this.kind == TK_PURECMD)
	    return '!' + this.cmd;
	throw new TexInternalError ('not reached');
    };


    proto.uitext = function Token_uitext () {
	if (this.kind == TK_CHAR)
	    return escchr (this.ord);
	if (this.kind == TK_CSEQ)
	    return '\\' + escape (escchr, this.name) + ' ';
	if (this.kind == TK_PARAM)

	    return '#' + this.pnum;
	if (this.kind == TK_PURECMD)
	    return '!' + this.cmd;
	throw new TexInternalError ('not reached');
    };


    proto.textext = function Token_textext (engine, ismacro) {
	if (this.kind == TK_CHAR) {
	    if (ismacro && this.ord == O_HASH)
		return '##';
	    return texchr (this.ord);
	}

	if (this.kind == TK_CSEQ)
	    return (texchr (engine.escapechar ()) +
		    escape (texchr, this.name) + ' ');

	if (this.kind == TK_PARAM)
	    return '#' + this.pnum

	if (this.kind == TK_PURECMD)
	    throw new TexInternalError ('sholdn\'t TeXify a pure-command token');

	throw new TexInternalError ('not reached');
    };


    proto.equals = function Token_equals (other) {
	if (other === null)
	    return false;
	if (!(other instanceof Token))
	    throw new TexInternalError ('Tokens can only be ' +
					'compared to Tokens');
	if (other.kind != this.kind)
	    return false;

	if (this.kind == TK_CHAR)
	    return this.ord == other.ord && this.catcode == other.catcode;
	if (this.kind == TK_CSEQ)
	    return this.name == other.name;
	if (this.kind == TK_PARAM)
	    return this.pnum == other.pnum;
	if (this.kind == TK_PURECMD)
	    throw new TexInternalError ('cannot test equality of pure-command tokens');

	throw new TexInternalError ('not reached');
    };


    proto.to_cmd = function Token_to_cmd (engine) {
	var cmd = null, name = '<unexpected token command>';

	if (this.kind == TK_CHAR) {
	    if (this.catcode == C_ACTIVE)
		cmd = engine.get_active (this.ord);
	    else {
		var cmdclass = Command.catcode_commands[this.catcode];
		if (cmdclass === null)
		    throw new TexInternalError ('cannot commandify ' +
						'token ' + this);
		cmd = new cmdclass (this.ord);
		name = '[char ' + String.fromCharCode (this.ord) + ']';
	    }
	} else if (this.kind == TK_CSEQ) {
	    cmd = engine.get_cseq (this.name);
	    name = this.name;
	} else if (this.kind == TK_PURECMD) {
	    return this.cmd;
	} else {
	    throw new TexInternalError ('cannot commandify token ' + this);
	}

	if (cmd === null)
	    return new UndefinedCommand (name);
	return cmd;
    };


    proto.is_char = function Token_is_char () {
	return this.kind == TK_CHAR;
    };


    proto.isparam = function Token_isparam () {
	return this.kind == TK_PARAM;
    };


    proto.iscat = function Token_iscat (catcode) {
	if (this.kind != TK_CHAR)
	    return false;
	return this.catcode == catcode;
    };


    proto.isotherchar = function Token_isotherchar (ord) {
	if (this.kind != TK_CHAR || this.catcode != C_OTHER)
	    return false;
	return this.ord == ord;
    };


    proto.iscslike = function Token_iscslike () {
	if (this.kind == TK_CSEQ)
	    return true;
	if (this.kind == TK_CHAR)
	    return this.catcode == C_ACTIVE;
	return false;
    };


    proto.is_frozen_cs = function Token_is_frozen_cs () {
	if (this.kind != TK_CSEQ)
	    return false;
	return frozen_cs_names.hasOwnProperty (this.name);
    };


    proto.isspace = function Token_isspace (engine) {
	var cmd = null;

	if (this.kind == TK_CHAR) {
	    if (this.catcode == C_SPACE)
		return true;
	    if (this.catcode == C_ACTIVE)
		cmd = engine.get_active (this.ord);
	    else
		return false;
	} else if (this.kind == TK_CSEQ) {
	    cmd = engine.get_cseq (this.name);
	} else if (this.kind == TK_PURECMD) {
	    cmd = this.cmd;
	} else {
	    return false;
	}

	return (cmd instanceof SpacerCommand);
    };


    proto.maybe_octal_value = function Token_maybe_octal_value () {
	if (this.kind != TK_CHAR)
	    return -1;
	if (this.catcode != C_OTHER)
	    return -1;
	var v = this.ord - O_ZERO;
	if (v < 0 || v > 7)
	    return -1;
	return v;
    };

    proto.maybe_decimal_value = function Token_maybe_decimal_value () {
	if (this.kind != TK_CHAR)
	    return -1;
	if (this.catcode != C_OTHER)
	    return -1;
	var v = this.ord - O_ZERO;
	if (v < 0 || v > 9)
	    return -1;
	return v;
    };

    proto.maybe_hex_value = function Token_maybe_hex_value () {
	if (this.kind != TK_CHAR)
	    return -1;

	if (this.catcode == C_LETTER) {
	    var v = this.ord - O_UC_A;
	    if (v < 0 || v > 5)
		return -1;
	    return v + 10;
	}

	if (this.catcode != C_OTHER)
	    return -1;

	var v = this.ord - O_UC_A;
	if (v >= 0 && v < 6)
	    return v + 10;

	v = this.ord - O_ZERO;
	if (v < 0 || v > 9)
	    return -1;
	return v;
    };


    proto.iscmd = function Token_iscmd (engine, cmdname) {
	return this.to_cmd (engine).samecmd (engine.commands[cmdname]);
    };


    proto.assign_cmd = function Token_assign_cmd (engine, cmd) {
	if (this.kind == TK_CSEQ) {
	    engine.set_cseq (this.name, cmd);
	    return;
	}

	if (this.kind == TK_CHAR && this.catcode == C_ACTIVE) {
	    engine.set_active (this.ord, cmd);
	    return;
	}

	throw new TexInternalError ('cannot assign command for token ' + this);
    };


    proto.isexpandable = function Token_isexpandable (engine) {
	return this.to_cmd (engine).expandable;
    };


    proto.isconditional = function Token_isconditional (engine) {
	return this.to_cmd (engine).conditional;
    };


    /* The roundtrippable string format for serializing Engines.
       %[...] -> cseq
       %#0 -> macro param
       %XXc -> non-standard ord, or non-printable char, or % ord;
               XX is hex, C is catcode ident char.

       We don't use backslash as an escape character since this stuff gets
       exported to JSON, so all the backslashes need an extra escape, which
       gets annoying.
     */

    proto.to_serialize_str = function Token_to_serialize_str () {
	if (this.kind == TK_CHAR) {
	    if (ord_standard_catcodes[this.ord] == this.catcode &&
		this.ord >= 0x20 && this.ord <= 0x7e && this.ord != O_PERCENT)
		return String.fromCharCode (this.ord);
	    var s = ('00' + this.ord.toString (16)).substr (-2);
	    return '%' + s + cc_idchar[this.catcode];
	}

	if (this.kind == TK_PARAM)
	    return '%#' + this.pnum.toString ();

	if (this.kind == TK_PURECMD) {
	    // We need to handle this case since we use this function for
	    // debugging, and in those instances it may be valid to have a
	    // purecmd token in the list.
	    return '%!' + this.cmd;
	}

	// We must be a control sequence.
	return '%[' + [].map.call (this.name, function (c) {
	    var o = ord (c);
	    if (o < 0x20 || o > 0x7e || o == O_PERCENT || o == O_RIGHT_BRACKET)
		return '%' + ('00' + o.toString (16)).substr (-2);
	    return c;
	}).join ('') + ']';
    };


    // Constructors.

    Token.new_cseq = function Token_new_cseq (name) {
	var tok = new Token ();
	tok.kind = TK_CSEQ;
	tok.name = name;
	return tok;
    };

    Token.new_char = function Token_new_char (catcode, ord) {
	if (catcode < 0 || catcode > 15)
	    throw new TexInternalError ('illegal token catcode ' + catcode);
	if (ord < 0 || ord > 255)
	    throw new TexInternalError ('illegal token ord ' + ord);

	var tok = new Token ();
	tok.kind = TK_CHAR;
	tok.catcode = catcode;
	tok.ord = ord;
	return tok;
    };

    Token.new_param = function Token_new_param (pnum) {
	if (pnum < 1 || pnum > 9)
	    throw new TexInternalError ('illegal param num ' + pnum);

	var tok = new Token ();
	tok.kind = TK_PARAM;
	tok.pnum = pnum;
	return tok;
    };

    Token.new_cmd = function Token_new_cmd (cmd) {
	if (cmd == null)
	    throw new TexInternalError ('illegal null command');

	var tok = new Token ();
	tok.kind = TK_PURECMD;
	tok.cmd = cmd;
	return tok;
    };

    return Token;
}) ();
