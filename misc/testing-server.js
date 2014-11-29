var http = require ('http');
var connect = require ('connect');
var path = require ('path');

var port = 17394; // totally arbitrary
var maxage = 0; // milliseconds; always freshly load everything.
var app = connect ().use (connect.static (path.dirname (__dirname), {maxAge: maxage}));

http.createServer (app).listen (port);
console.log ('listening on port ' + port);
