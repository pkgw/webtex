// Fonts and related things.

var FontMetrics = (function FontMetrics_closure () {
    // This base class doubles as a sort of "null" font
    // metrics for the null font, returning 0 for everything.

    function FontMetrics () {
	this.font_dimens_S = [];

	for (var i = 0; i < 7; i++)
	    this.font_dimens_S.push (nlib.Zero_S);
    }

    var proto = FontMetrics.prototype;

    proto.box_for_ord = function FontMetrics_box_for_ord (font, ord) {
	// TODO: issue warning. Zero-size box is TeX behavior.
	return new Character (font, ord);
    };

    proto.height_plus_depth__O_S = function FontMetrics_height_plus_depth__O_S (ord) {
	return nlib.Zero_S;
    };

    proto.italic_correction__O_S = function FontMetrics_italic_correction__O_S (ord) {
	return nlib.Zero_S;
    };

    return FontMetrics;
}) ();


var TfmMetrics = (function TfmMetrics_closure () {
    function div (a, b) {
	return a / b >> 0; // XXX: C&P from values.js
    }

    var TAG_NONE = 0,
        TAG_LIG = 1,
        TAG_LIST = 2,
        TAG_EXT = 3;

    function prep_fix_word_math (z) {
	// T:TP 572
	var alpha = 16;

	while (z >= 0x800000) {
	    z = div (z, 2);
	    alpha *= 2;
	}

	var beta = div (256, alpha);
	alpha = alpha * z;

	var fwts__N_S = (function fix_word_to_scaled (as_u32_be) {
	    // T:TP 571
	    var a = (as_u32_be >> 24) & 0xFF;
	    var b = (as_u32_be >> 16) & 0xFF;
	    var c = (as_u32_be >> 8) & 0xFF;
	    var d = as_u32_be & 0xFF;

	    var sw = div (div (div (d * z, 0x100) + c * z, 0x100) + b * z, beta);

	    if (a == 0)
		return sw;
	    if (a == 0xFF)
		return sw - alpha;
	    throw new TexRuntimeError ('illegal fix_word value');
	});

	return fwts__N_S;
    }

    function TfmMetrics (contents, scale_factor) {
	// scale_factor is funky; see below.
	if (!(contents instanceof ArrayBuffer))
	    throw new TexInternalError ('TfmMetrics expected ArrayBuffer; got %o',
					contents);
	this.contents = contents;
	var dv = this.dv = new DataView (contents);

	// T:TP 540:

	if (this.contents.byteLength < 24)
	    throw new TexRuntimeError ('TFM file should be at least 24 bytes');

	var file_len = dv.getUint16 (0, false) * 4; // TeX "words" -> bytes
	var header_len = dv.getUint16 (2, false) * 4; // ditto
	var first_code = dv.getUint16 (4, false);
	var last_code = dv.getUint16 (6, false);
	var num_wds = dv.getUint16 (8, false); // widths
	var num_hts = dv.getUint16 (10, false); // heights
	var num_dps = dv.getUint16 (12, false); // depths
	var num_ics = dv.getUint16 (14, false); // italic corrections
	var num_lks = dv.getUint16 (16, false); // ligature/kerns
	var num_kns = dv.getUint16 (18, false); // plain kerns
	var num_xcs = dv.getUint16 (20, false); // extensible characters
	var num_fps = dv.getUint16 (22, false); // font parameters

	if (first_code - 1 > last_code)
	    throw new TexRuntimeError ('illegal TFM file format (1)');
	if (last_code > 255)
	    throw new TexRuntimeError ('illegal TFM file format (2)');
	if (header_len < 8)
	    throw new TexRuntimeError ('illegal TFM file format (3)');
	if (num_wds == 0 || num_hts == 0 || num_dps == 0 || num_ics == 0)
	    throw new TexRuntimeError ('illegal TFM file format (4)');

	// Prep for storing char data.

	var num_chars = last_code - first_code + 1;
	if (num_chars < 0)
	    num_chars = 0;

	this.first_code = first_code;
	this.last_code = last_code;
	this.ord_widths_S = new Array (256);
	this.ord_heights_S = new Array (256);
	this.ord_depths_S = new Array (256);
	this.ord_ics_S = new Array (256);
	this.ord_tags = new Array (256);
	this.ord_rembytes = new Array (256);
	this.font_dimens_S = [];

	//this.ord_tags = new Array (256); cf. T:TP 544.
	//this.ord_remainder = new Array (256);

	// Prep for file parsing.

	var header_ofs = 24;
	var char_info_ofs = header_ofs + header_len;
	var width_ofs = char_info_ofs + num_chars * 4;
	var height_ofs = width_ofs + num_wds * 4;
	var depth_ofs = height_ofs + num_hts * 4;
	var ic_ofs = depth_ofs + num_dps * 4;
	var lk_ofs = ic_ofs + num_ics * 4;
	var kt_ofs = lk_ofs + num_lks * 4;
	var xc_ofs = kt_ofs + num_kns * 4;
	var fp_ofs = xc_ofs + num_xcs * 4;

	// T:TP 568. scale_factor is a JS int. If it's is < 0, it's the
	// negative of a scale factor to apply to the design size, with -1000
	// being unity. Otherwise, it's a Scaled value, and we should replace
	// the design size with it.
	var design_size = dv.getUint32 (header_ofs + 4, false);
	design_size >>= 4; // TFM fix_word to TeX Scaled.

	if (scale_factor != -1000) {
	    if (scale_factor >= 0)
		design_size = scale_factor;
	    else
		design_size = nlib.xn_over_d__ISI_SS (-scale_factor, design_size, 1000)[0];
	}

	this.fw2s__N_S = prep_fix_word_math (design_size);

	// Create Scaleds out of all of the metrics.

	var widths_S = new Array (num_wds);
	for (var i = 0; i < num_wds; i++)
	    widths_S[i] = this.fw2s__N_S (dv.getUint32 (width_ofs + 4 * i, false));

	var heights_S = new Array (num_hts);
	for (var i = 0; i < num_hts; i++)
	    heights_S[i] = this.fw2s__N_S (dv.getUint32 (height_ofs + 4 * i, false));

	var depths_S = new Array (num_dps);
	for (var i = 0; i < num_dps; i++)
	    depths_S[i] = this.fw2s__N_S (dv.getUint32 (depth_ofs + 4 * i, false));

	var ics_S = new Array (num_ics);
	for (var i = 0; i < num_ics; i++)
	    ics_S[i] = this.fw2s__N_S (dv.getUint32 (ic_ofs + 4 * i, false));

	// Read in other necessary tables.

	this.ligkern = new Array (num_lks);
	for (var i = 0; i < num_lks; i++)
	    this.ligkern[i] = dv.getUint32 (lk_ofs + 4 * i, false);

	this.extensible = new Array (num_xcs);
	for (var i = 0; i < num_xcs; i++)
	    this.extensible[i] = dv.getUint32 (xc_ofs + 4 * i, false);

	widths_S[0] = null; // TeX defines wd=0 to always mean invalid character.

	// Read in the character data.

	for (var i = 0; i < num_chars; i++) {
	    var x = dv.getUint32 (char_info_ofs + i * 4, false);

	    var idx = (x >> 24) & 0xFF;
	    this.ord_widths_S[first_code + i] = widths_S[idx];

	    idx = (x >> 20) & 0x0F;
	    this.ord_heights_S[first_code + i] = heights_S[idx];

	    idx = (x >> 16) & 0x0F;
	    this.ord_depths_S[first_code + i] = depths_S[idx];

	    idx = (x >> 10) & 0x3F; // ital corr
	    this.ord_ics_S[first_code + i] = ics_S[idx];

	    idx = (x >>  8) & 0x03; // tag
	    this.ord_tags[first_code + i] = idx;

	    idx = x & 0xFF; // remainder
	    this.ord_rembytes[first_code + i] = idx;
	}

	// Font dimens. The zeroth parameter is the italic slant and should
	// NOT be scaled by the design size, unlike everything else. We do
	// that wrong for now since I doubt it'll matter. (Famous last words?)
	// Note that font dimens are overridable in TeX, so Font objects copy
	// these out on init.

	for (var i = 0; i < num_fps; i++)
	    this.font_dimens_S.push (this.fw2s__N_S (dv.getUint32 (fp_ofs + 4 * i, false)));
	for (var i = num_fps; i < 7; i++)
	    this.font_dimens_S.push (nlib.Zero_S);
    }

    inherit (TfmMetrics, FontMetrics);
    var proto = TfmMetrics.prototype;

    proto.has_ord = function TfmMetrics_has_ord (ord) {
	// T:TP 543: valid if it is between first_ and last_ code and
	// its width_index is nonzero.
	if (ord < this.first_code)
	    return false;
	if (ord > this.last_code)
	    return false;
	return this.ord_widths_S[ord] != null;
    };

    proto.is_lig = function TfmMetrics_is_lig (ord) {
	return this.ord_tags[ord] == TAG_LIG;
    };

    proto.is_list = function TfmMetrics_is_list (ord) {
	return this.ord_tags[ord] == TAG_LIST;
    };

    proto.is_extensible = function TfmMetrics_is_extensible (ord) {
	return this.ord_tags[ord] == TAG_EXT;
    };

    proto.rembyte = function TfmMetrics_rembyte (ord) {
	return this.ord_rembytes[ord];
    };

    proto.height_plus_depth__O_S = function TfmMetrics_height_plus_depth__O_S (ord) {
	return this.ord_heights_S[ord] + this.ord_depths_S[ord];
    };

    proto.italic_correction__O_S = function TfmMetrics_italic_correction__O_S (ord) {
	return this.ord_ics_S[ord];
    };

    proto.box_for_ord = function TfmMetrics_box_for_ord (font, ord) {
	if (this.ord_widths_S[ord] == null) {
	    // TODO: TeX warns in this case; then returns a zero-size box
	    return new Character (font, ord);
	}

	var rv = new Character (font, ord);
	rv.width_S = this.ord_widths_S[ord];
	rv.height_S = this.ord_heights_S[ord];
	rv.depth_S = this.ord_depths_S[ord];
	return rv;
    };

    proto.extensible_recipe = function TfmMetrics_extensible_recipe (ord) {
	if (!this.is_extensible (ord))
	    throw new TexInternalError ('no extensible recipe for %o', ord);
	return this.extensible[this.ord_rembytes[ord]];
    };

    return TfmMetrics;
}) ();


var Font = (function Font_closure () {
    function Font (engine, ident, scale) {
	this.ident = ident;
	this.scale = scale;
	this.hyphenchar = null;
	this.skewchar = null;

	// I thought about lazy loading of the metrics, but that means that
	// every font-dimen operation needs an engine as an argument. Easier
	// just to load automatically.

	if (ident == 'nullfont') {
	    this.metrics = new FontMetrics ();
	} else {
	    var contents = engine.iostack.get_contents_ab (ident + '.tfm');
	    this.metrics = new TfmMetrics (contents, scale);
	}

	this.dimens_S = [];

	for (var i = 0; i < this.metrics.font_dimens_S.length; i++) {
	    this.dimens_S.push (this.metrics.font_dimens_S[i]);
	}

	engine.set_font (ident, this);
    }

    inherit (Font, Value);
    var proto = Font.prototype;

    proto.toString = function Font_toString () {
	return '<Font ' + this.ident + '@' + this.scale + '>';
    };

    proto.equals = function Font_equals (other) {
	if (other == null)
	    return false;
	if (!(other instanceof Font))
	    throw new TexInternalError ('comparing Font to %o', other);
	return (this.ident == other.ident) && (this.scale == other.scale);
    };

    proto.get_serialize_ident = function Font_get_serialize_ident (state, housekeeping) {
	if (this._serialize_ident == null) {
	    // Not sure about this, but Engine ctor creates nullfont by default.
	    if (this.ident == 'nullfont')
		this._serialize_ident = '<null>';
	    else {
		this._serialize_ident = state.fonts.length;
		state.fonts.push ([this.ident,
				   this.scale,
				   this.dimens_S,
				   this.hyphenchar,
				   this.skewchar]);
	    }
	}

	return this._serialize_ident;
    };

    Font.deserialize = function Font_deserialize (engine, data) {
	var font = new Font (engine, data[0], data[1]);
	font.dimens_S = data[2];
	font.hyphenchar = data[3];
	font.skewchar = data[4];
	return font;
    };

    proto.get_metrics = function Font_get_metrics () {
	return this.metrics;
    };

    proto.get_dimen__N_S = function Font_get_dimen__N_S (number) {
	// TeX font dimens are 1-based; we offset.
	if (number > this.dimens_S.length)
	    throw new TexRuntimeError ('undefined fontdimen #%d for %o', number, this);
	return this.dimens_S[number - 1];
    };

    proto.set_dimen__NS = function Font_set_dimen__NS (number, value_S) {
	// XXX: we're supposed to only allow the number of parameters to be
	// extended "just after the font has been loaded". (TeXBook p. 433).

	while (this.dimens_S.length < number)
	    this.dimens_S.push (nlib.Zero_S);
	this.dimens_S[number - 1] = value_S;
    };

    proto.has_ord = function Font_has_ord (ord) {
	return this.get_metrics ().has_ord (ord);
    };

    proto.box_for_ord = function Font_box_for_ord (ord) {
	return this.metrics.box_for_ord (this, ord);
    };

    proto.italic_correction__O_S = function Font_italic_correction__O_S (ord) {
	return this.metrics.italic_correction__O_S (ord);
    };

    return Font;
}) ();


var FontFamilyValref = (function FontFamilyValref_closure () {
    function FontFamilyValref (style, index) {
	if (style < MS_TEXT || style > MS_SCRIPTSCRIPT)
	    throw new TexRuntimeError ('illegal font family style %d', style);
	if (index < 0 || index > 15)
	    throw new TexRuntimeError ('illegal font family number %d', index);

	Valref.call (this, T_FONT);
	this.style = style;
	this.index = index;
    }

    inherit (FontFamilyValref, Valref);
    var proto = FontFamilyValref.prototype;

    proto.get = function FontFamilyValref_get (engine) {
	return engine.get_font_family (this.style, this.index);
    };

    proto.set = function FontFamilyValref_set (engine, value) {
	engine.set_font_family (this.style, this.index, value);
    };

    return FontFamilyValref;
}) ();


var GivenFontCommand = (function GivenFontCommand_closure () {
    function GivenFontCommand (font) {
	Command.call (this);
	this.font = font;
    }

    inherit (GivenFontCommand, Command);
    var proto = GivenFontCommand.prototype;
    proto.name = '<given-font>';
    proto.multi_instanced = true;

    proto._serialize_data = function GivenFontCommand__serialize_data (state, housekeeping) {
	return this.font.get_serialize_ident (state, housekeeping);
    };

    proto.same_cmd = function GivenFontCommand_same_cmd (other) {
	if (other == null)
	    return false;
	if (this.name != other.name)
	    return false;
	return this.font.equals (other.font);
    };

    proto.invoke = function GivenFontCommand_invoke (engine) {
	engine.trace ('activate font %o', this.font);
	engine.set_misc ('cur_font', this.font);
    };

    proto.get_valtype = function GivenFontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function GivenFontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, this.font);
    };

    proto.texmeaning = function GivenFontCommand_texmeaning (engine) {
	return 'select font ' + this.font.texmeaning (engine);
    };

    return GivenFontCommand;
})();


var FontFamilyCommand = (function FontFamilyCommand_closure () {
    function FontFamilyCommand (style, stylename) {
	Command.call (this);

	this.style = style;
	this.name = stylename + 'font';
    }

    inherit (FontFamilyCommand, Command);
    var proto = FontFamilyCommand.prototype;
    proto.assign_flag_mode = AFM_CONSUME;

    proto.invoke = function FontFamilyCommand_invoke (engine) {
	var index = engine.scan_int_4bit__I ();
	engine.scan_optional_equals ();
	var newval = engine.scan_valtype (T_FONT);
	engine.trace ('%s #%d = %o', this.name, index, newval);
	(new FontFamilyValref (this.style, index)).set (engine, newval);
    };

    proto.get_valtype = function FontFamilyCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function FontFamilyCommand_as_valref (engine) {
	var index = engine.scan_int_4bit__I ();
	return new FontFamilyValref (this.style, index);
    };

    return FontFamilyCommand;
})();


register_command ('font', (function FontCommand_closure () {
    function FontCommand () { Command.call (this); }
    inherit (FontCommand, Command);
    var proto = FontCommand.prototype;
    proto.name = 'font';

    proto.invoke = function FontCommand_invoke (engine) {
	var cstok = engine.scan_r_token ();
	engine.scan_optional_equals ();
	var fn = engine.scan_file_name ();
	var s = -1000;

	if (engine.scan_keyword ('at')) {
	    s = engine.scan_dimen__O_S (false);
	    if (s <= 0) // FIXME: || s > SC_MAX
		throw new TexRuntimeError ('illegal font size %o', s);
	} else if (engine.scan_keyword ('scaled')) {
	    s = -engine.scan_int__I ();
	    if (s >= 0 || s < -32768)
		throw new TexRuntimeError ('illegal font magnification factor %d', -s);
	}

	var font = new Font (engine, fn, s);
	var cmd = new GivenFontCommand (font);
	engine.trace ('font %o = %o', cstok, font);
	cstok.assign_cmd (engine, cmd);
    };

    proto.get_valtype = function FontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function FontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, engine.get_misc ('cur_font'));
    };

    return FontCommand;
}) ());


register_command ('nullfont', (function NullFontCommand_closure () {
    // XXX: redundant with GivenFontCommand in several ways.
    function NullFontCommand () { Command.call (this); }
    inherit (NullFontCommand, Command);
    var proto = NullFontCommand.prototype;
    proto.name = 'nullfont';

    proto.invoke = function NullFontCommand_invoke (engine) {
	engine.trace ('activate null font');
	engine.set_misc ('cur_font', engine.get_font ('<null>'));
    };

    proto.get_valtype = function NullFontCommand_get_valtype () {
	return T_FONT;
    };

    proto.as_valref = function NullFontCommand_as_valref (engine) {
	return new ConstantValref (T_FONT, engine.get_font ('<null>'));
    };

    proto.texmeaning = function NullFontCommand_texmeaning (engine) {
	return 'select font nullfont';
    };

    return NullFontCommand;
}) ());


register_command ('fontdimen', (function FontDimenCommand_closure () {
    // XXX: redundant with GivenFontCommand in several ways.
    function FontDimenCommand () { Command.call (this); }
    inherit (FontDimenCommand, Command);
    var proto = FontDimenCommand.prototype;
    proto.name = 'fontdimen';

    proto.invoke = function FontDimenCommand_invoke (engine) {
	var num = engine.scan_int__I ();
	var tok = engine.next_tok_throw ();
	var val = tok.to_cmd (engine).as_valref (engine);

	if (val.valtype != T_FONT)
	    throw new TexRuntimeError ('expected \\fontdimen to be followed ' +
				       'by a font; got %o', tok);

	var font = val.get (engine);
	engine.scan_optional_equals ();
	var val_S = engine.scan_dimen__O_S (false);
	engine.trace ('fontdimen %o %d = %S', font, num, val_S);
	font.set_dimen__NS (num, val_S);
	engine.maybe_insert_after_assign_token ();
    };

    proto.get_valtype = function FontDimenCommand_get_valtype () {
	return T_DIMEN;
    };

    proto.as_valref = function FontDimenCommand_as_valref (engine) {
	var num = engine.scan_int__I ();
	var tok = engine.next_tok_throw ();
	var font = tok.to_cmd (engine).as_valref (engine);

	if (font.valtype != T_FONT)
	    throw new TexRuntimeError ('expected \\fontdimen to be followed ' +
				       'by a font; got %o', tok);

	var val_S = font.get (engine).get_dimen__N_S (num);
	engine.trace ('got: %S', val_S);
	// FIXME: should be settable.
	return new ConstantValref (T_DIMEN, val_S);
    };

    return FontDimenCommand;
}) ());


register_command ('skewchar', function cmd_skewchar (engine) {
    var tok = engine.next_tok_throw ();
    var val = tok.to_cmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\skewchar to be followed by a font; ' +
				   'got %o', tok);

    var font = val.get (engine);
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code__I ();
    engine.trace ('skewchar %o = %C', font, ord);
    font.skewchar = ord;
    engine.maybe_insert_after_assign_token ();
});


register_command ('hyphenchar', function cmd_hyphenchar (engine) {
    var tok = engine.next_tok_throw ();
    var val = tok.to_cmd (engine).as_valref (engine);

    if (val.valtype != T_FONT)
	throw new TexRuntimeError ('expected \\hyphenchar to be followed by a font; ' +
				   'got %o', tok);

    var font = val.get (engine);
    engine.scan_optional_equals ();
    var ord = engine.scan_char_code__I ();
    engine.trace ('hyphenchar %o = %C', font, ord);
    font.hyphenchar = ord;
    engine.maybe_insert_after_assign_token ();
});


register_command ('textfont', new FontFamilyCommand (MS_TEXT, 'text'));
register_command ('scriptfont', new FontFamilyCommand (MS_SCRIPT, 'script'));
register_command ('scriptscriptfont', new FontFamilyCommand (MS_SCRIPTSCRIPT, 'scriptscript'));
