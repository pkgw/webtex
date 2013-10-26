(function WebtexAutoload_closure () {
    var items = document.querySelectorAll (".autowebtex");

    for (var i = 0; i < items.length; i++) {
	var item = items[i];
	var src = item.getAttribute ('data-src');
	WEBTEX.Web.render (src, item);
    }
})();
