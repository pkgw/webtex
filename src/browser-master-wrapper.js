if (typeof Webtex === 'undefined') {
    (typeof window !== 'undefined' ? window : this).Webtex = {Web: {}};
}

(function webtex_wrapper (webtexApiObject) {
    'use strict';
    var globalScope = (typeof window === 'undefined') ? this : window;

    function webtex_export (name, value) {
	webtexApiObject[name] = value;
    }

$insert_files

}).call ((typeof window === 'undefined') ? this : window, Webtex);
