/* Parsing the TeX TFM format. These files are small so we read them all
 * into memory at once.
 *
 */

'use strict';

var TfmReader = WEBTEX.TfmReader = (function TfmReader_closure () {
    function div (a, b) {
	return a / b >> 0; // XXX: C&P from values.js
    }

    function prep_fix_word_math (z) {
	// T:TP 572
	var alpha = 16;

	while (z >= 0x800000) {
	    z = div (z, 2);
	    alpha *= 2;
	}

	var beta = div (256, alpha);
	alpha = alpha * z;

	var fwts = (function fix_word_to_scaled (as_u32_be) {
	    // T:TP 571
	    var a = (as_u32_be >> 24) & 0xFF;
	    var b = (as_u32_be >> 16) & 0xFF;
	    var c = (as_u32_be >> 8) & 0xFF;
	    var d = as_u32_be & 0xFF;

	    var sw = div (div (div (d * z, 0x100) + c * z, 0x100) + b * z, beta);

	    if (a == 0)
		return new Scaled (sw);
	    if (a == 0xFF)
		return new Scaled (sw - alpha);
	    throw new TexRuntimeError ('illegal fix_word value');
	});

	return fwts;
    }

    function TfmReader (contents, scale_factor) {
	// scale_factor is funky; see below.
	this.contents = contents; // should be ArrayBuffer
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

	this.ord_widths = new Array (256);
	this.ord_heights = new Array (256);
	this.ord_depths = new Array (256);
	this.ord_ics = new Array (256);
	this.font_dimens = [];

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
	var xt_ofs = kt_ofs + num_kns * 4;
	var fp_ofs = xt_ofs + num_xcs * 4;

	// T:TP 568. scale_factor is a JS int. If it's is < 0, it's the
	// negative of a scale factor to apply to the design size, with -1000
	// being unity. Otherwise, it's a Scaled value, and we should replace
	// the design size with it.
	var design_size = dv.getUint32 (header_ofs + 4, false);
	design_size >>= 4; // TFM fix_word to TeX Scaled.

	if (scale_factor != -1000) {
	    if (scale_factor >= 0)
		design_size = scale_factor;
	    else {
		var tmp = new Scaled (design_size);
		design_size = tmp.times_n_over_d (-scale_factor, 1000)[0].value;
	    }
	}

	this.fw2s = prep_fix_word_math (design_size);

	// Create Scaleds out of all of the metrics.

	var widths = new Array (num_wds);
	for (var i = 0; i < num_wds; i++)
	    widths[i] = this.fw2s (dv.getUint32 (width_ofs + 4 * i, false));

	var heights = new Array (num_hts);
	for (var i = 0; i < num_hts; i++)
	    heights[i] = this.fw2s (dv.getUint32 (height_ofs + 4 * i, false));

	var depths = new Array (num_dps);
	for (var i = 0; i < num_dps; i++)
	    depths[i] = this.fw2s (dv.getUint32 (depth_ofs + 4 * i, false));

	var ics = new Array (num_ics);
	for (var i = 0; i < num_ics; i++)
	    ics[i] = this.fw2s (dv.getUint32 (ic_ofs + 4 * i, false));

	widths[0] = null; // TeX defines wd=0 to always mean invalid character.

	// Read in the character data.

	for (var i = 0; i < num_chars; i++) {
	    var x = dv.getUint32 (char_info_ofs + i * 4, false);

	    var idx = (x >> 24) & 0xFF;
	    this.ord_widths[first_code + i] = widths[idx];

	    idx = (x >> 20) & 0x0F;
	    this.ord_heights[first_code + i] = heights[idx];

	    idx = (x >> 16) & 0x0F;
	    this.ord_depths[first_code + i] = depths[idx];

	    idx = (x >> 10) & 0x3F; // ital corr
	    this.ord_ics[first_code + i] = ics[idx];

	    idx = (x >>  8) & 0x03; // tag
	    idx = x & 0xFF; // remainder
	}

	// Font dimens. The zeroth parameter is the italic slant and should
	// NOT be scaled by the design size, unlike everything else. We do
	// that wrong for now since I doubt it'll matter. (Famous last words?)
	// Note that font dimens are overridable in TeX, so Font objects copy
	// these out on init.

	for (var i = 0; i < num_fps; i++)
	    this.font_dimens.push (this.fw2s (dv.getUint32 (fp_ofs + 4 * i, false)));
	for (var i = num_fps; i < 7; i++)
	    this.font_dimens.push (new Scaled (0));
    }

    var proto = TfmReader.prototype;

    proto.has_ord = function TfmReader_has_ord (ord) {
	// T:TP 543: valid if it is between first_ and last_ code and
	// its width_index is nonzero.
    };

    proto.width = function TfmReader_width (ord) {
	return this.ord_widths[ord];
    };

    proto.height = function TfmReader_height (ord) {
	return this.ord_heights[ord];
    };

    proto.depth = function TfmReader_depth (ord) {
	return this.ord_depths[ord];
    };

    proto.italic_correction = function TfmReader_italic_correction (ord) {
	return this.ord_ics[ord];
    };

    proto.box_for_ord = function TfmReader_box_for_ord (ord) {
	if (this.ord_widths[ord] == null) {
	    // TODO: TeX warns in this case; then returns a zero-size box
	    return new Character (this, ord);
	}

	var rv = new Character (this, ord);
	rv.width.sp = this.ord_widths[ord];
	rv.height.sp = this.ord_heights[ord];
	rv.depth.sp = this.ord_depths[ord];
	return rv;
    };

    return TfmReader;
}) ();
