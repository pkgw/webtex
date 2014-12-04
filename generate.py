#! /usr/bin/env python
# -*- mode: python; coding: utf-8 -*-
# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT license. See LICENSE.md for details.

"""Generate various code fragments from tables and other resources."""


def die (fmt, *args):
    if not len (args):
        text = str (fmt)
    else:
        text = fmt % args

    raise SystemExit ('error: ' + text)


class Holder (object):
    def extract (self):
        return self.__dict__.copy ()


def read_table (path, colnames):
    colnames = colnames.split ()

    with open (path) as f:
        for full_line in f:
            l = full_line.rstrip ().split ('#', 1)[0]
            if not len (l):
                continue

            bits = l.split ()
            if len (bits) != len (colnames):
                die ('expected %d columns but got %d; input line '
                     'was "%s"', len (colnames), len (bits), full_line)

            h = Holder ()
            for cname, text in zip (colnames, bits):
                setattr (h, cname, text)

            yield h


def parsebool (text):
    if text == 'yes':
        return True
    elif text == 'n':
        return False

    die ('unexpected boolean text value "%s"', text)


all_tables = [
    ('catcodes', 'long_name code short_name charlike single_char'),
    ('commands', 'escname expand cond afm'),
    ('namedparams', 'name type'),
]

_load_pname_escapes = {
    '_space_': ' ',
}

def load_all ():
    h = Holder ()

    for basename, colnames in all_tables:
        data = list (read_table (basename + '.txt', colnames))
        setattr (h, basename, data)

    # Globally-applicable fixup

    for item in h.commands:
        item.name = _load_pname_escapes.get (item.escname, item.escname)
        item.expand = parsebool (item.expand)
        item.cond = parsebool (item.cond)

    return h


def process (data, inpath, outpath, restargs):
    try:
        with open (inpath) as inf, open (outpath + '.new', 'w') as outf:
            for line in inf:
                idx = line.find ('$')
                if idx == -1:
                    # No substitution
                    outf.write (line)
                    continue

                # Substitute some stuff!
                prefix = line[:idx]
                macro = line[idx+1:].strip ()
                func = globals ().get ('mac_' + macro)

                if not callable (func):
                    die ('unknown templating macro %s', macro)

                def emit (fmt, *args):
                    if not len (args):
                        text = fmt
                    else:
                        if len (args) == 1:
                            args = args[0]
                        text = fmt % args

                    if not len (text):
                        print >>outf
                    else:
                        for line in text.splitlines ():
                            print >>outf, prefix + line

                func (emit, data, restargs)
    except:
        raise
    else:
        import os
        os.rename (outpath + '.new', outpath)


# The macros

def mac_insert_files (emit, data, restargs):
    for path in restargs:
        with open (path) as f:
            for line in f:
                emit (line.rstrip ())


def mac_command_info (emit, data, restargs):
    for item in data.commands:
        if item.afm == 'inval':
            afm = 'AFM_INVALID'
        elif item.afm == 'consume':
            afm = 'AFM_CONSUME'
        elif item.afm == 'cont':
            afm = 'AFM_CONTINUE'
        else:
            die ('unexpected command "afm" setting %r', item.afm)

        emit ('[%r, %r, %s, %s, %s],', item.name, item.escname,
              repr (item.expand).lower (),
              repr (item.cond).lower (),
              afm)


def mac_parameter_info (emit, data, restargs):
    for item in data.namedparams:
        emit ('[%r, T_%s],', item.name, item.type.upper ())


def mac_init_parameters (emit, data, restargs):
    # XXX fold this into mac_parameter_info.

    info = {'glue': ('T_GLUE', 'new Glue ()'),
            'muglue': ('T_MUGLUE', 'new Glue ()'),
            'toklist': ('T_TOKLIST', 'new Toklist ()'),
            'int': ('T_INT', '0'),
            'dimen': ('T_DIMEN', 'nlib.Zero_S'),
        }

    for item in data.namedparams:
        valtype, init = info[item.type]
        emit ('engine.set_parameter (%s, %r, %s);' % (valtype, item.name, init))


# Driver.

if __name__ == '__main__':
    import sys
    process (load_all (), sys.argv[1], sys.argv[-1], sys.argv[2:-1])
