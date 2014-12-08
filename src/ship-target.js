// Copyright 2014 Peter Williams and collaborators.
// Licensed under the MIT license. See LICENSE.md for details.

// Objects that receive shipout information from the LaTeX engine. Note that
// we don't actually run the output routine in the current design, though, so
// \shipout is never actually used ...


var ShipTarget = (function ShipTarget_closure () {
    // This base class is also a "null" ship target that does nothing.
    function ShipTarget () {}

    var proto = ShipTarget.prototype;

    proto.process = function ShipTarget_process (engine, box) {
    };

    proto.finish = function ShipTarget_finish (engine) {
    };

    return ShipTarget;
}) ();

webtex_export ('ShipTarget', ShipTarget);


var ConsoleFlatDumpTarget = (function ConsoleFlatDumpTarget_closure () {
    function ConsoleFlatDumpTarget () {}

    inherit (ConsoleFlatDumpTarget, ShipTarget);
    var proto = ConsoleFlatDumpTarget.prototype;

    proto.process = function ConsoleFlatDumpTarget_process (engine, box) {
	global_logf ('==== shipped out: ====');
	box.traverse__SSO (nlib.Zero_S, nlib.Zero_S, function (x, y, item) {
	    global_logf ('x=%o y=%o %o', x, y, item);
	});
	global_logf ('==== (end of shipout) ====');
    };

    return ConsoleFlatDumpTarget;
}) ();

webtex_export ('ConsoleFlatDumpTarget', ConsoleFlatDumpTarget);


var ConsoleHierDumpTarget = (function ConsoleHierDumpTarget_closure () {
    function ConsoleHierDumpTarget () {}

    inherit (ConsoleHierDumpTarget, ShipTarget);
    var proto = ConsoleHierDumpTarget.prototype;

    proto.process = function ConsoleHierDumpTarget_process (engine, box) {
	global_logf ('==== shipped out: ====');
	global_logf (box.uitext ());
	global_logf ('==== (end of shipout) ====');
    };

    return ConsoleHierDumpTarget;
}) ();

webtex_export ('ConsoleHierDumpTarget', ConsoleHierDumpTarget);
