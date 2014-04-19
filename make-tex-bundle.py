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


class Bundler (object):
    def __init__ (self, specfile, cachedir):
        self.specfile = specfile
        self.cachedir = cachedir
        self.elemshas = {}


    def go (self):
        try:
            os.mkdir (os.path.join (self.cachedir, cache_ident))
        except OSError:
            pass # live dangerously by not checking that it's EEXIST. Whatever.

        temp = tempfile.NamedTemporaryFile (dir='.', delete=False)
        temp.close ()

        try:
            with zipfile.ZipFile (temp.name, 'w', zipfile.ZIP_DEFLATED, True) as zip:
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
        zpath = s.hexdigest () + '.zip'
        os.rename (temp.name, zpath)
        print ('Created', zpath)


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
    if len (sys.argv) != 3:
        print ('usage: make-tex-bundle.py <specfile-path> <cachedir>',
               file=sys.stderr)
        sys.exit (1)

    b = Bundler (sys.argv[1], sys.argv[2])
    b.go ()


if __name__ == '__main__':
    commandline (sys.argv)
