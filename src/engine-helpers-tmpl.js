function init_generic_eqtb (obj) {
    var i = 0, t = null;

    // Makes more sense to special-case this here than the generator.
    t = obj._catcodes = {};
    for (i = 0; i < 256; i++)
	t[i] = obj.parent._catcodes[i];

    $eqtb_generic_init
}

function fill_generic_eqtb_accessors (proto) {
    $eqtb_generic_accessors
}

function init_top_eqtb (obj) {
    var i = 0, t = null;

    $eqtb_toplevel_init
}

function fill_top_eqtb_accessors (proto) {
    $eqtb_toplevel_accessors
}
