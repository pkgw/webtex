#! /usr/bin/env python
# -*- mode: python; coding: utf-8 -*-
# Copyright 2014 Peter Williams
# Licensed under the MIT License

from __future__ import absolute_import, division, print_function, unicode_literals
import contextlib, hashlib, io, lzma, os.path, sys, tarfile, tempfile, urllib, zipfile

cache_ident = 'tl2013'
url_base = 'ftp://tug.org/historic/systems/texlive/2013/tlnet-final/archive/'
pkg_extension = '.tar.xz'
skip_roots = frozenset (('makeindex', 'tlpkg'))
skip_prefixes = frozenset (('fonts/map/dvips', ))
patch_suffixes = ['.post']


class Bundler (object):
    def __init__ (self, specfile, cachedir, destdir, patchdir, otherfiles):
        self.specfile = specfile
        self.cachedir = cachedir
        self.destdir = destdir
        self.patchdir = patchdir
        self.otherfiles = otherfiles
        self.elemshas = {}


    def go (self):
        try:
            os.mkdir (os.path.join (self.cachedir, cache_ident))
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
        zbase = s.hexdigest () + '.zip'
        zpath = os.path.join (self.destdir, zbase)
        os.rename (temp.name, zpath)
        print ('Created', zpath)

        lpath = os.path.join (self.destdir, 'latest.zip')
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
                    for pfx in skip_prefixes:
                        if info.name.startswith (pfx):
                            info = None
                            break
                    if info is None:
                        continue

                    base = pieces[-1]
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

                    # Include any patches that may exist for this file.
                    for sfx in patch_suffixes:
                        p = os.path.join (self.patchdir, cache_ident, base + sfx)
                        if not os.path.exists (p):
                            continue

                        contents = io.open (p, 'rt').read ()
                        zip.writestr ('__wtpatches__/' + base + sfx, contents)
                        s.update (sfx)
                        s.update (contents)

                    s.update ('eof')
                    self.elemshas[base] = s.digest ()


    def get_package (self, pkgname):
        cachepath = os.path.join (self.cachedir, cache_ident,
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


def commandline (argv):
    if len (sys.argv) < 5:
        print ('usage: make-tex-bundle.py <specfile-path> <cachedir> <destdir> '
               '<patchdir> [otherfiles...]', file=sys.stderr)
        sys.exit (1)

    b = Bundler (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:])
    b.go ()


if __name__ == '__main__':
    commandline (sys.argv)
