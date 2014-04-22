'use strict';

var url = 'texbundles/default.zip';
WEBTEX.Web.make_random_access_url (url).then (function (rau) {
    var z = new WEBTEX.ZipReader (rau.read_range.bind (rau), rau.size ());
    return new WEBTEX.Bundle (z);
}).then (function (bundle) {
    setTimeout (function () {
	var lb = bundle.try_open_linebuffer ('xetex.ini');

	function iterate() {
	    var l = lb.get ();
	    if (l === WEBTEX.EOF)
		return;
	    if (l !== WEBTEX.NeedMoreData)
		console.log (l);
	    setTimeout (iterate, 1);
	}

	iterate ();
    }, 1000);
});
