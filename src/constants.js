'use strict';

// Value types

var T_INT = 0,     // a simple integer
    T_DIMEN = 1,   // a dimension
    T_GLUE = 2,    // regular glue (AKA "skip")
    T_MUGLUE = 3,  // math-mode glue (AKA "skip")
    T_TOKLIST = 4, // a list of tokens
    T_BOX = 5,     // a box
    T_FONT = 6;    // a font.

var vt_ok_for_register = [true, true, true, true, true, true, false];
var vt_ok_for_parameter = [true, true, true, true, true, false, false];
var vt_names = ['int', 'dimen', 'glue', 'muglue', 'toklist', 'box', 'font'];


// "listable" types -- things that can go in horizontal, vertical, or math lists.
// Rather than generic "whatsits", we implement them more specifically.

var LT_BOX = 0,
    LT_RULE = 1,
    LT_CHARACTER = 2,
    LT_GLUE = 3,
    LT_KERN = 4,
    LT_MARK = 5,
    LT_PENALTY = 6,
    LT_LEADER = 7,
    LT_SPECIAL = 8; // a \special{}

var lt_names = ['box', 'rule', 'character', 'glue', 'kern', 'mark', 'penalty',
		'leader', 'special'];


// Box types

var BT_VOID = 0,
    BT_HBOX = 1,
    BT_VBOX = 2;

var bt_names = ['void', 'hbox', 'vbox'];


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

var cc_idchar = 'egGmtEpsSi_loacX';

var cc_idchar_unmap = {
    'e': 0, 'g': 1, 'G':  2, 'm':  3, 't':  4, 'E':  5, 'p':  6, 's':  7,
    'S': 8, 'i': 9, '_': 10, 'l': 11, 'o': 12, 'a': 13, 'c': 14, 'X': 15
};


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
    O_LEFT_BRACKET = 91, // '['
    O_BACKSLASH = 92, // '\\'
    O_RIGHT_BRACKET = 93, // ']'
    O_BACKTICK = 96, // '`'
    O_LC_A = 97; // 'a'

var ord_standard_catcodes = [
// 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
   9,  8, 12, 12, 12, 12, 12, 12, 15, 10, 12,  7, 13,  5, 12, 12, // 000-015
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 016-031
  10, 12, 12,  6,  3, 14,  4, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 032-047
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 048-063
  12, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, // 064-079
  11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12,  0, 12,  7,  8, // 080-095
  12, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, // 096-111
  11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,  1, 12,  2, 13, 12, // 112-127
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 128-143
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 144-159
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 160-175
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 176-191
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 192-207
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 208-223
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 224-239
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12  // 240-255
];


var AFM_INVALID = 0, // assign flags should not be active for this command
    AFM_CONTINUE = 1, // assign flags are propagated after this command
    AFM_CONSUME = 2; // this command responds to assign flags
