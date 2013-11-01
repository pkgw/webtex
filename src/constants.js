'use strict';

var M_VERT = 0,  // standard vertical mode
    M_IVERT = 1, // internal vertical mode
    M_HORZ = 2,  // standard horizontal mode
    M_RHORZ = 3, // restricted horizontal mode
    M_MATH = 4,  // standard math mode
    M_DMATH = 5; // display math mode


var C_ESCAPE = 0,
    C_BGROUP = 1,
    C_EGROUP = 2,
    C_MSHIFT = 3,
    C_ALIGNTAB = 4,
    C_EOL = 5,
    C_PARAM = 6,
    C_SUPER = 7,
    C_SUB = 8,
    C_IGNORE = 9,
    C_SPACE = 10,
    C_LETTER = 11,
    C_OTHER = 12,
    C_ACTIVE = 13,
    C_COMMENT = 14,
    C_INVALID = 15;

var cc_abbrev = [
    'esc', 'bgr', 'egr', 'mth',
    'tab', 'eol', 'par', 'sup',
    'sub', 'ign', 'spc', 'let',
    'oth', 'act', 'cmt', 'inv',
];


var O_NULL = 0, // '\0'
    O_BACKSPACE = 8, // '\b'
    O_RETURN = 13, // '\r'
    O_SPACE = 32, // ' '
    O_DQUOTE = 34, // '"'
    O_PERCENT = 37, // '%'
    O_SQUOTE = 39, // "'"
    O_ZERO = 48, // '0'
    O_EQUALS = 61, // '='
    O_UC_A = 65, // 'A'
    O_BACKSLASH = 92, // '\\'
    O_BACKTICK = 96, // '`'
    O_LC_A = 97; // 'a'


var AFM_INVALID = 0, // assign flags should not be active for this command
    AFM_CONTINUE = 1, // assign flags are propagated after this command
    AFM_CONSUME = 2; // this command responds to assign flags
