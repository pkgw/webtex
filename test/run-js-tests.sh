#! /bin/sh

module="$1"
exitcode=0

for t in js/*.js ; do
    echo $t ...
    node "$t" ../"$module" || exitcode=1
done

exit $exitcode
