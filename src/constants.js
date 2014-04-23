'use strict';

var T_INT = 0,     // a simple integer
    T_DIMEN = 1,   // a dimension
    T_GLUE = 2,    // regular glue (AKA "skip")
    T_MUGLUE = 3,  // math-mode glue (AKA "skip")
    T_TOKLIST = 4, // a list of tokens
    T_BOXLIST = 5, // a list (?) of boxes
    T_FONT = 6;    // a font.

var vt_ok_for_register = [true, true, true, true, true, true, false];
var vt_ok_for_parameter = [true, true, true, true, true, false, false];
var vt_names = ['int', 'dimen', 'glue', 'muglue', 'toklist', 'boxlist', 'font'];


// "Code types" -- not the best name for these things ...

var CT_CATEGORY = 0,  // catcodes -- handled specially.
    CT_LOWERCASE = 1, // lowercase
    CT_UPPERCASE = 2, // uppercase
    CT_SPACEFAC = 3,  // space factors
    CT_MATH = 4,      // math category codes
    CT_DELIM = 5;     // delimiter codes

var ct_maxvals = [15, 255, 255, 0x7FFF, 0x8000, 0xFFFFFF];
var ct_names = ['catcode', 'lccode', 'uccode', 'sfcode', 'mathcode', 'delcode'];


var M_VERT = 0,  // standard vertical mode
    M_IVERT = 1, // internal vertical mode
    M_HORZ = 2,  // standard horizontal mode
    M_RHORZ = 3, // restricted horizontal mode
    M_MATH = 4,  // standard math mode
    M_DMATH = 5; // display math mode

var mode_abbrev = [
    '_vert', 'ivert', '_horz', 'rhorz', '_math', 'dmath'
];


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

var cc_ischar = [
    0, 1, 1, 1,
    1, 0, 1, 1,
    1, 0, 0, 1,
    1, 1, 0, 0,
];

var O_NULL = 0, // '\0'
    O_ALARM = 7, // '\a'
    O_BACKSPACE = 8, // '\b'
    O_TAB = 9, // '\t'
    O_NEWLINE = 10, // '\n'
    O_VTAB = 11, // '\v'
    O_FORMFEED = 12, // '\f'
    O_RETURN = 13, // '\r'
    O_SPACE = 32, // ' '
    O_DQUOTE = 34, // '"'
    O_HASH = 35, // #
    O_PERCENT = 37, // '%'
    O_SQUOTE = 39, // "'"
    O_PLUS = 43, // '+'
    O_COMMA = 44, // ','
    O_MINUS = 45, // '-'
    O_PERIOD = 46, // '.'
    O_ZERO = 48, // '0'
    O_LESS = 60, // '<'
    O_EQUALS = 61, // '='
    O_GREATER = 62, // '>'
    O_UC_A = 65, // 'A'
    O_BACKSLASH = 92, // '\\'
    O_BACKTICK = 96, // '`'
    O_LC_A = 97; // 'a'


var AFM_INVALID = 0, // assign flags should not be active for this command
    AFM_CONTINUE = 1, // assign flags are propagated after this command
    AFM_CONSUME = 2; // this command responds to assign flags
