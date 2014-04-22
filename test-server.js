var http = require ('http');
var connect = require ('connect');

var port = 17394;
var maxage = 0; // ms; always freshly load everything.
var app = connect ().use (connect.static (__dirname, {maxAge: maxage}));

http.createServer (app).listen (port);
console.log ('listening on port ' + port);
