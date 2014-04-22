'use strict';

var url = 'http://newton.cx/~peter/files/tb-default.zip';
WEBTEX.Web.make_random_access_url (url).then (function (rau) {
    console.log ('whoa ' + rau._size);
});
