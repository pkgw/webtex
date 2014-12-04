#! /bin/bash
# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT license. See LICENSE.md for details.

# Have TeX prepare a page and dump the resulting box.
#
# $1 - a file containing TeX commands. It will be wrapped in some
#      code to lay out the commands as a page and dump the results.
#
# The results will be printed to stdout.

# Internal notes:
#
# "\par\penalty-20000" is \supereject which forces a page break.
#
# The magic sed commands say: "delete lines from 1 until we match ^> \box..",
# "delete lines from when we match ^$ to the end".
#
# TeX exits with an exit code of 1 when we use \showbox so we can't check for
# errors!

sampfile="$1"
work=$(mktemp -d)

(cd $work
cat >boxshow.tex <<'EOF'
\scrollmode
\output{\setbox0=\box255 \showbox0}
EOF
cat "$sampfile" >>boxshow.tex
cat >>boxshow.tex <<'EOF'
\par \penalty -20000
\output{\plainoutput}
\end
EOF

tex boxshow.tex >chatter.log
sed -e '1,/^> \\box0=/d' -e '/^$/,$d' boxshow.log
) || exit 1

rm -rf "$work"
