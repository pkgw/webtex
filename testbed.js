'use strict';

var url = 'texbundles/default.zip';
WEBTEX.Web.make_random_access_url (url).then (function (rau) {
    console.log ('whoa ' + rau._size);
});
