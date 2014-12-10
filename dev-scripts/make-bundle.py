#! /usr/bin/env python
# -*- mode: python; coding: utf-8 -*-
# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT License. See LICENSE.md for details.

from __future__ import absolute_import, division, print_function, unicode_literals
import contextlib, hashlib, io, json, lzma, os.path, sys, tarfile, tempfile
import time, urllib, zipfile

from glyphlist import glyph_to_unicode

distribution = 'tl2013'
url_base = 'ftp://tug.org/historic/systems/texlive/2013/tlnet-final/archive/'
pkg_extension = '.tar.xz'
skip_roots = frozenset (('makeindex', 'tlpkg'))
skip_extensions = frozenset (('.afm', '.afm.gz', '.aft', '.mf', '.otf', '.pfm'))
patch_suffixes = ['.post']

debug_unicode_mapping = False

class Bundler (object):
    def __init__ (self, specfile, mapfile, cachedir, destdir, patchdir, otherfiles):
        self.specfile = specfile
        self.mapfile = mapfile
        self.cachedir = cachedir
        self.destdir = destdir
        self.patchdir = patchdir
        self.otherfiles = otherfiles
        self.elemshas = {}

        # The whole font mess.
        self.map_files = set ()
        self.encoding_files = {}
        self.pfb_files = {}
        self.encoding_data = {}
        self.charname_list = None
        self.charname_ids = None


    def go (self):
        self.load_map_names ()

        try:
            os.mkdir (os.path.join (self.cachedir, distribution))
        except OSError:
            pass # live dangerously by not checking that it's EEXIST. Whatever.

        temp = tempfile.NamedTemporaryFile (dir=self.destdir, delete=False)
        temp.close ()

        try:
            with zipfile.ZipFile (temp.name, 'w', zipfile.ZIP_DEFLATED, True) as zip:
                for path in self.otherfiles:
                    self.load_miscfile (zip, path)

                for line in io.open (self.specfile, 'rt'):
                    pkgname = line.split ('#', 1)[0].strip ()
                    if not len (pkgname):
                        continue

                    self.load_package (zip, pkgname)

                # Write out the collected font info
                self.issue_charname_ids ()
                self.insert_font_info (zip)
        except:
            e1, e2, e3 = sys.exc_info ()
            try:
                os.unlink (temp.name)
            except:
                pass
            raise e1, e2, e3

        s = hashlib.sha1 ()
        for name in sorted (self.elemshas.iterkeys ()):
            s.update (name)
            s.update (self.elemshas[name])
        zbase = '-'.join ([distribution,
                           time.strftime ('%Y%m%d'),
                           s.hexdigest () + '.zip'])
        zpath = os.path.join (self.destdir, zbase)
        os.rename (temp.name, zpath)
        print ('Created', zpath)

        self.save_charname_ids ()

        lpath = os.path.join (self.destdir, 'newest-bundle.zip')
        try:
            os.unlink (lpath)
        except OSError:
            pass # more living dangerously
        os.symlink (zbase, lpath)
        print ('Linked', lpath)


    def load_miscfile (self, zip, path):
        base = os.path.basename (path)

        with io.open (path, 'rb') as f:
            # zipfile has no way to stream data into the archive
            # (lame), so we read the whole file into memory.
            contents = f.read ()
            zip.writestr (base, contents)
            s = hashlib.sha1 ()
            s.update (contents)
            self.elemshas[base] = s.digest ()


    def load_package (self, zip, pkgname):
        path = self.get_package (pkgname)

        with contextlib.closing (lzma.LZMAFile (path)) as xz:
            with tarfile.open (fileobj=xz, mode='r') as tar:
                while True:
                    info = tar.next ()
                    if info is None:
                        break

                    pieces = info.name.split ('/')
                    if pieces[0] in skip_roots:
                        continue

                    # We act like dvips for the purposes of compiling font
                    # maps and encodings. Maps for other tools have the same
                    # filenames, so eliminate them.
                    if (info.name.startswith ('fonts/map/')
                        and not info.name.startswith ('fonts/map/dvips/')):
                        continue

                    base = pieces[-1]
                    for ext in skip_extensions:
                        if base.endswith (ext):
                            info = None
                            break;

                    if info is None:
                        continue

                    if base in self.elemshas:
                        print ('error: duplicated file name "%s" (this one in '
                               'package %s)' % (base, pkgname), file=sys.stderr)
                        sys.exit (1)

                    # zipfile has no way to stream data into the archive
                    # (lame), so we read the whole file into memory.
                    contents = tar.extractfile (info).read ()
                    zip.writestr (base, contents)
                    s = hashlib.sha1 ()
                    s.update (contents)

                    if base in self.map_files:
                        self.process_map_file (base, contents)

                    if base.endswith ('.enc'):
                        # We may not have yet read in all the necessary map
                        # files, so we may not know which encodings we need.
                        # So we have to parse every encoding that we see just
                        # in case.
                        self.process_encoding_file (base, contents)

                    # Include any patches that may exist for this file.
                    for sfx in patch_suffixes:
                        p = os.path.join (self.patchdir, distribution, base + sfx)
                        if not os.path.exists (p):
                            continue

                        contents = io.open (p, 'rt').read ()
                        zip.writestr ('__wtpatches__/' + base + sfx, contents)
                        s.update (sfx)
                        s.update (contents)

                    s.update ('eof')
                    self.elemshas[base] = s.digest ()


    def get_package (self, pkgname):
        cachepath = os.path.join (self.cachedir, distribution,
                                  pkgname + pkg_extension)
        if os.path.exists (cachepath):
            return cachepath

        url = url_base + urllib.quote (pkgname) + pkg_extension

        try:
            print ('downloading', pkgname, '...')
            fn, headers = urllib.urlretrieve (url, cachepath)
            return fn
        except:
            e1, e2, e3 = sys.exc_info ()
            try:
                os.unlink (cachepath)
            except:
                pass
            raise e1, e2, e3

    # The font-handling mess

    def load_map_names (self):
        for line in io.open (self.mapfile, 'rt'):
            mapname = line.split ('#', 1)[0].strip ()
            if not len (mapname):
                continue

            self.map_files.add (mapname)


    def process_map_file (self, basename, contents):
        for line in contents.decode ('ascii').split ('\n'):
            t = line.split ('%', 1)[0].strip ()
            if not len (t):
                continue

            # Map entries can have either 3 or 5 fields, and in the latter
            # case the third entry usually has a space and is quote-delimited.
            # I *so* do not want to deal with this, and I think that I don't
            # need to, so this parsing is cheesy.

            bits = t.split ()
            fontname = bits[0]

            if len (bits) == 3:
                encname = self.guess_encoding (fontname)
            else:
                item = bits[-2]
                if item[0] != '<':
                    print ('error: unhandled entry in font map file "%s"' % basename,
                           file=sys.stderr)
                    print ('       "%s"' % t[:-1], file=sys.stderr)
                    sys.exit (1)
                encname = item[1:]

            if encname is None:
                print ('warning: cannot determine encoding for font "%s"' % fontname)
                continue

            item = bits[-1]
            if item[0] != '<':
                print ('error: unhandled entry in font map file "%s"' % basename,
                       file=sys.stderr)
                print ('       "%s"' % t[:-1], file=sys.stderr)
                sys.exit (1)
            pfbname = item[1:]

            self.encoding_files[fontname] = encname
            self.pfb_files[fontname] = pfbname


    cm_encodings = {
        'b': '*OT1', # original text
        'bsy': '*OMS', # original math symbols
        'bx': '*OT1',
        'bxsl': '*OT1',
        'bxti': '*OT1',
        'csc': '*OT1',
        'dunh': '*OT1',
        'ex': '*OMX', # original math extension characters
        'ff': '*OT1',
        'fi': '*OT1',
        'fib': '*OT1',
        'inch': '*OT1',
        'itt': '*OT1',
        'mi': '*OML', # original math letters
        'mib': '*OML',
        'r': '*OT1',
        'sl': '*OT1',
        'sltt': '*OT1',
        'ss': '*OT1',
        'ssbx': '*OT1',
        'ssdc': '*OT1',
        'ssi': '*OT1',
        'ssq': '*OT1',
        'ssqi': '*OT1',
        'sy': '*OMS',
        'tcsc': '*OT1',
        'tex': '*cmtex', # Annoying.
        'ti': '*OT1',
        'tt': '*OT1',
        'u': '*OT1',
        'vtt': '*OT1',
    }

    def guess_encoding (self, fontname):
        while fontname[-1].isdigit ():
            fontname = fontname[:-1]

        if fontname.startswith ('cm'):
            return self.cm_encodings.get (fontname[2:])

        if fontname == 'msam':
            return '*MSAM'

        if fontname == 'msbm':
            return '*MSBM'

        return None


    def get_encoding_tokens (self, contents):
        # '.enc' files are parsed like PostScript and are
        # somewhat annoying to deal with.

        seen_open_bracket = False
        ready_to_stop = False

        for line in contents.decode ('ascii').split ('\n'):
            line = line.split ('%', 1)[0].strip ()
            if not len (line):
                continue

            if not seen_open_bracket:
                if '[' not in line:
                    continue
                line = line.split ('[', 1)[1]
                seen_open_bracket = True
            elif ']' in line:
                line = line.split (']', 1)[0]
                ready_to_stop = True

            for item in line.split ():
                yield item

            if ready_to_stop:
                break


    def process_encoding_file (self, basename, contents):
        charnames = []

        for tok in self.get_encoding_tokens (contents):
            if tok[0] != '/':
                print ('error: encoding file parse failure around "%s"' % tok, file=sys.stderr)
                sys.exit (1)

            charnames.append (tok[1:])

        self.encoding_data[basename] = charnames


    def get_encoding (self, encname):
        if encname[0] == '*':
            rv = self.encoding_data.get (encname)
            if rv is None:
                data = io.open ('data/encodings/%s.enc' % (encname[1:]), 'rb').read ()
                self.process_encoding_file (encname, data)
                rv = self.encoding_data.get (encname)
            return rv

        rv = self.encoding_data.get (encname)
        if rv is None:
            print ('error: cannot find data for encoding file "%s"' % encname, file=sys.stderr)
            sys.exit (1)

        return rv


    def issue_charname_ids (self):
        seen_encnames = set ()
        charnames = set ()

        for encname in self.encoding_files.itervalues ():
            if encname in seen_encnames:
                continue

            for charname in self.get_encoding (encname):
                charnames.add (charname)

            seen_encnames.add (encname)

        self.charname_list = sorted (charnames)
        self.charname_ids = {}
        self.charname_unicodes = dict (glyph_to_unicode)

        for idx, charname in enumerate (self.charname_list):
            self.charname_ids[charname] = idx

            u = self.charname_unicodes.get (charname)
            if u is None:
                if debug_unicode_mapping:
                    print ('warning: no Unicode equivalent for glyph "%s"' % charname, file=sys.stderr)
                self.charname_unicodes[charname] = u'\u0000'


    def insert_font_info (self, zip):
        data = {}
        data['font2enc'] = self.encoding_files
        data['font2pfb'] = self.pfb_files
        data['encinfo'] = {}

        seen_encnames = set ()

        for encname in self.encoding_files.itervalues ():
            if encname in seen_encnames:
                continue

            charnames = self.get_encoding (encname)
            data['encinfo'][encname] = info = {}

            info['idents'] = [self.charname_ids[x] for x in charnames]
            info['unicode'] = ''.join (self.charname_unicodes[x] for x in charnames)

        base = 'wtfontdata.json'
        jdata = json.dumps (data, sort_keys=True)
        zip.writestr (base, jdata)
        s = hashlib.sha1 ()
        s.update (jdata)
        self.elemshas[base] = s.digest ()


    def save_charname_ids (self):
        path = os.path.join (self.destdir, 'glyph-encoding.json')
        data  = {}
        unilit = lambda u: '\\u%04x' % ord (u)

        data['names'] = self.charname_list
        data['unicode'] = ''.join (self.charname_unicodes[c] for c in self.charname_list)

        with io.open (path, 'wb') as f:
            json.dump (data, f, sort_keys=True, indent=4)

        print ('Created', path)


def commandline (argv):
    if len (sys.argv) < 6:
        print ('usage: make-bundle.py <specfile-path> <mapfile-path> <cachedir> <destdir> '
               '<patchdir> [otherfiles...]', file=sys.stderr)
        sys.exit (1)

    b = Bundler (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:])
    b.go ()


if __name__ == '__main__':
    commandline (sys.argv)
