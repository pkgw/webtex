'use strict;'

/* The representation of tokens is kind of awkward. I think it's
 * better to have a single class with an internal "kind" rather than
 * subclasses, but maybe that's wrong. */

var Token = WEBTEX.Token = (function Token_closure () {
    var TK_CHAR = 0, TK_CSEQ = 1, TK_PARAM = 2;

    function Token () {};

    Token.prototype = {
	_csesc: function Token__csesc (escape) {
	    return [].map.call (this.name, ord).map (escape).join ('');
	},

	toString: function Token_toString () {
	    if (this.kind == TK_CHAR)
		return escchr (this.ord) + ':' + cc_abbrev[this.catcode];
	    if (this.kind == TK_CSEQ)
		return '<' + this._csesc (escchr) + '>';
	    if (this.kind == TK_PARAM)
		return '#' + this.pnum;
	    throw new TexInternalException ('not reached');
	},

	uitext: function Token_uitext () {
	    if (this.kind == TK_CHAR)
		return escchr (this.ord);
	    if (this.kind == TK_CSEQ)
		return '\\' + this._csesc (escchr) + ' ';
	    if (this.kind == TK_PARAM)
		return '#' + this.pnum;
	    throw new TexInternalException ('not reached');
	},

	textext: function Token_textext (engine, ismacro) {
	    if (this.kind == TK_CHAR) {
		if (ismacro && this.ord == O_HASH)
		    return '##';
		return texchr (this.ord);
	    }

	    if (this.kind == TK_CSEQ)
		return (texchr (engine.intpar ('escapechar')) +
			this._csesc (texchr) + ' ');

	    if (this.kind == TK_PARAM)
		return '#' + this.pnum

	    throw new TexInternalException ('not reached');
	},

	equals: function Token_equals (other) {
	    if (other === undefined)
		return false;
	    if (!(other instanceof Token))
		throw new TexInternalException ('Tokens can only be ' +
						'compared to Tokens');
	    if (other.kind != this.kind)
		return false;

	    if (this.kind == TK_CHAR)
		return this.ord == other.ord && this.catcode == other.catcode;
	    if (this.kind == TK_CSEQ)
		return this.name == other.name;
	    if (this.kind == TK_PARAM)
		return this.pnum == other.pnum;
	    throw new TexInternalException ('not reached');
	},

	tocmd: function Token_tocmd (engine) {
	    var cmd = undefined;

	    if (this.kind == TK_CHAR) {
		if (this.catcode == C_ACTIVE)
		    cmd = engine.active (this.ord);
		else {
		    cmdclass = catcode_commands[this.catcode];
		    if (cmdclass === undefined)
			throw new TexInternalException ('cannot commandify ' +
							'token ' + this);
		    cmd = new cmdclass (this.ord);
		}
	    } else if (this.kind == TK_CSEQ) {
		cmd = engine.cseq (this.name);
	    } else {
		throw new TexInternalException ('cannot commandify token ' + this);
	    }

	    if (cmd === undefined)
		return new CommandUnimplPrimitive (this);
	    return cmd;
	},

	iscat: function Token_iscat (catcode) {
	    if (this.kind != TK_CHAR)
		return false;
	    return this.catcode == catcode;
	},

	isotherchar: function Token_isotherchar (ord) {
	    if (this.kind != TK_CHAR || this.catcode != C_OTHER)
		return false;
	    return this.ord == ord;
	},

	iscslike: function Token_iscslike () {
	    if (this.kind == TK_CSEQ)
		return true;
	    if (this.kind == TK_CHAR)
		return this.catcode == C_ACTIVE;
	    return false;
	},
    };

    return Token;
}) ();
