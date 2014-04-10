#! /usr/bin/env python

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
    ('catcodes', 'long_name code short_name charlike'),
    ('commands', 'escname expand cond afm'),
    ('eqtbitems', 'name index valuetype'),
    ('namedparams', 'name type'),
]

_load_pname_escapes = {
    '_space_': ' ',
    '_dash_': '-',
    '_fslash_': '/',
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
# TODO: port all this stuff from Python!

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

        emit ('(%r, %r, %r, %r, %s),', item.name, item.escname, item.expand, item.cond, afm)


def mac_parameter_info (emit, data, restargs):
    facmap = {'glue': 'CommandNamedGlue',
              'muglue': 'CommandNamedMuGlue',
              'toklist': 'CommandNamedToks',
              'int': 'CommandNamedInt',
              'dimen': 'CommandNamedDimen',
    }

    for item in data.namedparams:
        emit ('(%r, %s),', item.name, facmap[item.type])


def mac_init_parameters (emit, data, restargs):
    info = {'glue': ('set_gluepar', 'Glue ()'),
            'muglue': ('set_mugluepar', 'Glue ()'),
            'toklist': ('set_tokpar', '[]'),
            'int': ('set_intpar', '0'),
            'dimen': ('set_dimenpar', '0'),
        }

    for item in data.namedparams:
        setter, init = info[item.type]
        emit ('self.%s (%r, %s)' % (setter, item.name, init))


def mac_include_impls (emit, data, restargs):
    with open ('impls.py') as f:
        for line in f:
            emit ('%s', line.rstrip ())


def mac_eqtb_generic_init (emit, data, restargs):
    for item in data.eqtbitems:
        if item.name == 'catcodes':
            continue

        emit ('obj._%s = {};', item.name)


def mac_eqtb_generic_accessors (emit, data, restargs):
    for item in data.eqtbitems:
        assert item.name[-1] == 's'
        item.shname = item.name[:-1]

        if item.index == 'ord':
            item.idxvar = 'ord'
        elif item.index == 'str':
            item.idxvar = 'name'
        elif item.index == 'reg':
            item.idxvar = 'reg'
        else:
            die ('unknown eqtb index kind "%s"', item.index)

        emit ('''proto.%(shname)s = function EquivTable_%(shname)s (%(idxvar)s) {
  if (this._%(name)s.hasOwnProperty (%(idxvar)s))
    return this._%(name)s[%(idxvar)s];
  return this._parent.%(shname)s (%(idxvar)s);
};

proto.set_%(shname)s = function EquivTable_set_%(shname)s (%(idxvar)s, value) {
  self._%(name)s[%(idxvar)s] = value;
};
''', item.extract ())


def mac_eqtb_toplevel_init (emit, data, restargs):
    for item in data.eqtbitems:
        if item.valuetype in ('catcode', 'ord', 'mathcode', 'int', 'delcode', 'dimen'):
            initval = '0'
        else:
            initval = 'undefined'

        if item.index in ('ord', 'reg'):
            emit ('''t = obj._%s = {};
for (i = 0; i < 256; i++)
    t[i] = %s;''', item.name, initval)
        elif item.index == 'str':
            emit ('obj._%s = {};', item.name)
        else:
            die ('unknown eqtb index kind "%s"', item.index)


def mac_eqtb_toplevel_accessors (emit, data, restargs):
    for item in data.eqtbitems:
        assert item.name[-1] == 's'
        item.shname = item.name[:-1]

        if item.index == 'ord':
            item.idxvar = 'ord'
        elif item.index == 'str':
            item.idxvar = 'name'
        elif item.index == 'reg':
            item.idxvar = 'reg'
        else:
            die ('unknown eqtb index kind "%s"', item.index)

        emit ('''proto.%(shname)s = function TopEquivTable_%(shname)s (%(idxvar)s) {
  return this._%(name)s[%(idxvar)s];
};
''', item.extract ())


def mac_eqtb_engine_wrappers (emit, data, restargs):
    for item in data.eqtbitems:
        assert item.name[-1] == 's'
        item.shname = item.name[:-1]

        if item.index == 'ord':
            item.idxvar = 'ord'
        elif item.index == 'str':
            item.idxvar = 'name'
        elif item.index == 'reg':
            item.idxvar = 'reg'
        else:
            die ('unknown eqtb index kind "%s"', item.index)

        emit ('''def %(shname)s (self, %(idxvar)s):
  return self._eqtbs[-1].%(shname)s (%(idxvar)s)

def set_%(shname)s (self, %(idxvar)s, value):
  if self.assign_flags & AF_GLOBAL:
    self._eqtbs[0].set_%(shname)s (%(idxvar)s, value)
  else:
    self._eqtbs[-1].set_%(shname)s (%(idxvar)s, value)
  self.maybe_insert_after_assign_token ()

''', item.extract ())



# Driver.

if __name__ == '__main__':
    import sys
    process (load_all (), sys.argv[1], sys.argv[-1], sys.argv[2:-1])
