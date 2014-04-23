'use strict';

// Short utility routines

function ord (chr) {
    return chr.charCodeAt (0);
}

var _printable = '0123456789abcdefghijklmnopqrstuvwxyz' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\\\'()*+,-./:;<=>?@[\\]^_`{|}~ ';

function escchr (ord) {
    if (ord == O_NULL)
	return '\\0';
    if (ord == O_ALARM)
	return '\\a';
    if (ord == O_BACKSPACE)
	return '\\b';
    if (ord == O_TAB)
	return '\\t';
    if (ord == O_NEWLINE)
	return '\\n';
    if (ord == O_VTAB)
	return '\\v';
    if (ord == O_FORMFEED)
	return '\\f';
    if (ord == O_RETURN)
	return '\\r';
    if (ord == O_BACKSLASH)
	return '\\\\';

    var asstr = String.fromCharCode (ord);

    if (_printable.indexOf (asstr) >= 0)
	return asstr;

    return '\\x' + ('00' + ord.toString (16)).substr (-2);
}

WEBTEX.escchr = escchr;

function texchr (ord) {
    if (ord < 32)
	return '^^' + String.fromCharCode (ord + 64);
    if (ord < 127)
	return String.fromCharCode (ord);
    if (ord == 127)
	return '^^?';
    return '^^' + ord.toString (16);
}

WEBTEX.texchr = texchr;
