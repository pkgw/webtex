// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

var http = require ('http');
var connect = require ('connect');
var path = require ('path');

var port = 17395; // totally arbitrary
var maxage = 0; // milliseconds; always freshly load everything.
var app = connect ().use (connect.static (__dirname, {maxAge: maxage}));

http.createServer (app).listen (port);
console.log ('listening on port ' + port);
