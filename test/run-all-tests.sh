#! /bin/sh

module="$1"
exitcode=0

./run-js-tests.sh "$module" || exitcode=1

exit $exitcode
