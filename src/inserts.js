// Insertions and adjustments

var Adjustment = (function Adjustment_closure () {
    // These are not boxlike.
    function Adjustment (box) {
	if (!(box instanceof VBox))
	    throw new TexInternalError ('must fill Adjustment with a vbox');

	this.ltype = LT_ADJUST;
	this.list = box.list;
    }

    inherit (Adjustment, Listable);
    var proto = Adjustment.prototype;

    proto._uiitems = function Adjustment__uiitems () {
	return ListBox.prototype._uiitems.call (this);
    };

    proto._uisummary = function Adjustment__uisummary () {
	return format ('Adjustment: %d items', this.list.length);
    };

    return Adjustment;
}) ();


var Insertion = (function Insertion_closure () {
    // These are boxlike, kind of. TeX stores stuff in their height and depth
    // fields so let's run with it.

    function Insertion (num, box, splittopskip, splitmaxdepth_S, float_cost) {
	if (!(box instanceof VBox))
	    throw new TexInternalError ('must fill Insertion with a vbox');

	this.ltype = LT_INSERT;
	this.list = box.list;
	this.num = num;
	this.splittopskip = splittopskip;
	this.float_cost = float_cost;

	this.height_S = box.height_S + box.depth_S;
	this.depth_S = splitmaxdepth_S;
	this.width_S = nlib.Zero_S;
    }

    inherit (Insertion, Boxlike);
    var proto = Insertion.prototype;

    proto._uiitems = function Insertion__uiitems () {
	return ListBox.prototype._uiitems.call (this);
    };

    proto._uisummary = function Insertion__uisummary () {
	return format ('Insertion %d: nit=%d sts=%o fc=%d', this.num,
		       this.list.length, this.splittopskip, this.float_cost);
    };

    return Insertion;
}) ();


(function inserts_closure () {
    function begin_insert_or_adjust (engine, is_adjust) {
	// TTP 1097-1099, "begin_insert_or_adjust"

	if (is_adjust && engine.absmode () == M_VERT)
	    throw new TexRuntimeError ('\\vadjust may not be used in vertical mode');

	if (is_adjust) {
	    engine.trace ('vadjust');
	} else {
	    var num = engine.scan_char_code__I ();
	    if (num == 255)
		throw new TexRuntimeError ('\\insert255 is forbidden');
	    engine.trace ('insert %d', num);
	}

	engine.trace ('vadjust');
	engine.nest_eqtb ();
	engine.scan_left_brace ();

	// TTP 1070, "normal_paragraph" (TODO: collect copies into a real function)
	engine.set_parameter (T_INT, 'looseness', 0);
	engine.set_parameter__OS ('hangindent', nlib.Zero_S);
	engine.set_parameter (T_INT, 'hangafter', 1);

	engine.enter_mode (M_IVERT);
	engine.enter_group ('vadjust', function (eng) {
	    // TTP 1100
	    engine.end_graf ();

	    var sts = engine.get_parameter (T_GLUE, 'splittopskip');
	    var smd_S = engine.get_parameter__O_S ('splitmaxdepth');
	    var fp = engine.get_parameter__O_I ('floatingpenalty');

	    engine.unnest_eqtb ();
	    var vb = new VBox ();
	    vb.list = engine.leave_mode ();
	    vb.set_glue__OOS (engine, false, nlib.Zero_S);

	    if (is_adjust)
		engine.accum (new Adjustment (vb));
	    else
		engine.accum (new Insertion (num, vb, sts, smd_S, fp));

	    if (engine.mode () == M_VERT)
		engine.run_page_builder ();
	});

	engine.set_prev_depth_to_ignore ();
    }

    register_command ('insert', function cmd_insert (engine) {
	begin_insert_or_adjust (engine, false);
    });

    register_command ('vadjust', function cmd_vadjust (engine) {
	begin_insert_or_adjust (engine, true);
    });

}) ();
