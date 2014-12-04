# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT license. See LICENSE.md for details.

"""First-pass transcription of how the page builder works in TeX. This code
doesn't run, but it transcribes "TeX: The Program" as closely as possible in a
sort of pseudo-Python.

XML-like tags denote sections in TeX: The Program where the code comes from.

Labels are rendered as decorators simply so that they stand out in Emacs.
Cases, do-whiles, etc. are rendered into Python equivalents. Octal goes to
hex. We use the Webtex naming convention for Scaleds.
"""

inf_bad = 10000 # <108/>
max_halfword = 0xFFFF # <110/>
inf_penalty = inf_bad # <157/>
eject_penalty = -inf_penalty # <157/>
awful_bad = 0x3fffffff # </833>
deplorable = 100000 # <974/>

# <980>
empty = 0 # <16>
inserts_only = 1
box_there = 2

page_tail = None
page_contents = empty # or inserts_only, or box_there
page_max_depth_S = Zero_S # scaled
best_page_break = None
least_page_cost = 0 # integer
best_size_S = Zero_S
# </980>

# <981>
inserting = 0
split_up = 1

class InsertionInfo (object):
    link = None # next insertion
    subtype = 0 # = insertion number
    type = inserting # or split_up
    height_S = Zero_S
    broken_ptr = None
    broken_ins = None
    last_ins_ptr = None
    best_ins_ptr = None

page_ins_head = InsertionInfo ()
page_ins_head.subtype = 255
page_ins_head.type = split_up
page_ins_head.link = page_ins_head # circular linked list!
# </981>

# <982>
page_so_far_S = [Zero_S] * 7
# page_goal === page_so_far[0]
# page_total === page_so_far[1]
# page_shrink === page_so_far[6]
# page_depth === page_so_far[7]
last_glue = None
last_penalty = 0
last_kern_S = Zero_S
insert_penalties = 0
# </982>

# <983>
# Primitives: \page{goal,total,stretch,filstretch,fillstretch,filllstretch,shrink,depth}
# command "set_page_dimen"
# </983>

# <987>
def set_page_so_far_zero (n):
    page_so_far_S[n] = Zero_S


def freeze_page_specs (s):
    page_contents = s
    page_goal_S = get_param ('vsize') # PSF[0] (i.e., page_so_far item)
    page_max_depth_S = max_depth_S
    page_depth_S = Zero_S # PSF[7]

    for i in xrange (1, 7):
        set_page_so_far_zero (i)

    least_page_cost = awful_bad

    if tracing_pages > 0:
        pass # print diagnostics
# </987>

# <988>
page_head.type = glue_node
page_head.subtype = normal
# </988>

# <990>
output_active = False
insert_penalties = 0
# </990>

# <991>, as a function
def start_a_new_current_page ():
    page_contents = empty
    page_tail = page_head
    page_head.link = None
    last_glue = max_halfword
    last_penalty = 0
    last_kern = 0
    page_depth_S = Zero_S
    page_max_depth_S = Zero_S
# </991>

# <993>
def ensure_vbox (n):
    if box_register(n) is an HBox:
        raise Exception()
# </993>

# <994>
"""A call on build_page should be immediately followed by "goto
big_switch".

"""
contribute = 80

def build_page ():
    if contrib_head.link is None or output_active:
        return

    while True:
        @continue_:

        p = contrib_head.link
        # <996>
        if last_glue != max_halfword:
            del last_glue
        last_penalty = 0
        last_kern = 0

        if p.type == glue_node:
            last_glue = p.glue_ptr
        else:
            last_glue = max_halfword
            if p.type == penalty_node:
                last_penalty = p.penalty
            elif p.type == kern_node:
                last_kern = p.width
        # </996>
        # <997>
        # "The code here is an example of a many-way switch into routines that
        # merge together in different places. Some people call this
        # unstructured programming, but the author doesn’t see much wrong with
        # it, as long as the various labels have a well-understood meaning."
        # <1000>
        if p.type in (hlist_node, vlist_node, rule_node):
            if page_contents < box_there:
                # <1001>
                if page_contents == empty:
                    freeze_page_specs (box_there)
                else:
                    page_contents = box_there

                q = get_param ('topskip')

                if q.width_S > p.height_S:
                    q.width_S -= p.height_S
                else:
                    q.width_S = 0

                q.link = p
                contrib_head.link = q
                goto continue_
                # </1001>
            else:
                # <1002>
                page_total_S += page_depth_S + p.height_S
                page_depth_S = p.depth_S
                goto contribute
                # <1002>
        elif p.type == whatsit_node:
            # <1364>
            # </1364>
        elif p.type == glue_node:
            if page_contents < box_there:
                goto done1
            elif precedes_break (page_tail): # <-> page_tail.type < math_node: <148/>
                pi = 0
            else:
                goto update_heights
        elif p.type == kern_node:
            if page_contents < box_there:
                goto done1
            elif p.link is None:
                return
            elif p.link.type == glue_node:
                pi = 0
            else:
                goto update_heights
        elif p.type == penalty_node:
            if page_contents < box_there:
                goto done1
            else:
                pi = p.penalty
        elif p.type == mark_node:
            goto contribute
        elif p.type == ins_node:
            # <1008>
            if page_contents == empty:
                freeze_page_specs (inserts_only)

            n = p.subtype
            r = page_ins_head
            while n >= r.link.subtype:
                r = r.link

            if r.subtype != n:
                # <1009>
                q = InsertionInfo ()
                q.link = r.link
                r.link = q
                r = q
                r.subtype = n
                r.type = inserting
                ensure_vbox (n)

                if get_box_register (n) is None:
                    r.height = 0
                else:
                    r.height = get_box_register (n).height + get_box_register (n).depth

                r.best_ins_ptr = None
                q = get_glue_register (n)

                if get_count_register (n) == 1000:
                    h = r.height
                else:
                    h = x_over_n (r.height, 1000) * get_count_register (n)

                page_goal -= h + q.width
                page_so_far[2 + q.stretch_order] += q.stretch
                page_shrink += q.shrink
                if q.shrink_order != normal and q.shrink != 0:
                    raise Exception ('infinite shrinkability on MVL')
                # </1009>

            if r.type == split_up:
                insert_penalties += p.float_cost
            else:
                r.last_ins_ptr = p
                delta = page_goal - page_total - page_depth + page_shrink
                if get_int_register (n) == 1000:
                    h = p.height
                else:
                    h = x_over_n (p.height, 1000) * get_int_register (n)

                if (h <= 0 or h <= delta) and (p.height + r.height <= get_dimen_register (n)):
                    page_goal -= h
                    r.height += p.height
                else:
                    # <1010> See long comment in TTP
                    if get_int_register (n) <= 0:
                        w = max_dimen
                    else:
                        w = page_goal - page_total - page_depth
                        if get_int_register (n) != 1000:
                            w = x_over_n (w, get_int_register (n)) * 1000

                    if w > get_dimen_register (n) - r.height:
                        w = get_dimen_register (n) - r.height

                    q = vert_break (p.ins_ptr, w, p.deth)
                    r.height += best_height_plus_depth
                    # <tracing_pages stuff>

                    if get_int_register (n) != 1000:
                        best_height_plus_depth = (x_over_n (best_height_plus_depth, 1000) *
                                                  get_int_register (n))

                    page_goal -= best_height_plus_depth
                    r.type = split_up
                    r.broken_ptr = q
                    r.broken_ins = p

                    if q is None:
                        insert_penalties += eject_penalty
                    elif q.type == penalty_node:
                        insert_penalties += q.penalty
                    # </1010>

            goto contribute
            # </1008>
        else:
            raise Exception ('unexpected node in MVL')
        # </1000>
        # <1005>
        if pi < inf_penalty:
            # <1007>
            if page_total < page_goal:
                if page_so_far[3] != 0 or page_so_far[4] != 0 or page_so_far[5] != 0:
                    b = 0
                else:
                    b = badness (page_goal - page_total, page_so_far[2])
            elif page_total - page_goal > page_shrink:
                b = awful_bad
            else:
                b = badness (page_total - page_goal, page_shrink)
            # </1007>

            if b < awful_bad:
                if pi <= eject_penalty:
                    c = pi
                elif b < inf_bad:
                    c = b + pi + insert_penalties
                else:
                    c = deplorable
            else:
                c = b

            if insert_penalties >= 10000:
                c = awful_bad

            # <tracing_pages debugging>

            if c <= least_page_cost:
                best_page_break = p
                best_size = page_goal
                least_page_cost = c
                r = page_ins_head.link

                while r is not page_ins_head:
                    r.best_ins_ptr = r.last_ins_ptr
                    r = r.link

            if c == awful_bad or pi <= eject_penalty:
                fire_up (p)
                if output_active:
                    return
                goto done
        # </1005>
        if p.type < glue_node or p.type > kern_node:
            goto contribute

        @update_heights:
        # <1004>
        if p.type == kern_node:
            q = p
        else:
            q =~ p.glue_ptr
            page_so_far[2 + q.stretch_order] += q.stretch_S
            page_shrink_S += q.shrink_S
            if q.shrink_order != normal and q.shrink_S != 0:
                raise Exception ('infinite shrinking on MVL not allowed')

        page_total_S += page_depth_S + q.width_S
        page_depth_S = 0
        # </1004>

        @contribute:
        # <1003>
        if page_depth_S > page_max_depth_S:
            page_total_S += page_depth_S - page_max_depth_S
            page_depth_S = page_max_depth_S
        # </1003>
        # <998>
        page_tail.link = p
        page_tail = p
        contrib_head.link = p.link
        p.link = None
        goto done
        # </998>

        @done1:
        # <999>
        contrib_head.link = p.link
        p.link = None
        del p
        # </999>

        @done:
        pass
        # </997>

        if contrib_head.link is None:
            break

    # <995>
    # "Make the contribution list empty by setting its tail to contrib_head"
    if "current list is the main vertical list":
        tail = contrib_head
    else:
        (tail of MVL) = contrib_head
    # </995>
    @exit_:
    pass
# </994>

# <1012>
def fire_up (c):
    # <1013>
    if best_page_break.type == penalty_node:
        global_set (outputpenalty, best_page_break.penalty)
        best_bage_break.penalty = inf_penalty
    else:
        global_set (outputpenalty, inf_penalty)
    # </1013>

    if bot_mark is not None:
        if top_mark is not None:
            del top_mark
        top_mark = bot_mark
        del first_mark
        first_mark = None

    # <1014>
    if c == best_page_break:
        best_page_break = None

    # <1015>
    if get_box_register (255) is not None:
        raise Exception ('box255 must be empty now')
    # </1015>

    insert_penalites = 0
    save_split_top_skip = split_top_skip

    if holding_inserts <= 0:
        # <1018>
        r = page_ins_head.link

        while r is not page_ins_head:
            if r.best_ins_ptr is not None:
                n = r.subtype
                ensure_vbox (n)
                if get_box_register(n) is None:
                    set_box_register (n, NullBox ())

                p = get_box_register(n).list
                while p.link is not None:
                    p = p.link

                r.last_ins_ptr = p

            r = r.link
        # </1018>

    q = hold_head
    q.link = None
    prev_p = page_head
    p = prev_p.link

    while p is not best_page_break:
        if p.type == ins_node:
            if holding_inserts <= 0:
                # <1020>
                r = page_ins_head.link

                while r.subtype != p.subtype:
                    r = r.link

                if r.best_ins_ptr is None:
                    wait = True
                else:
                    wait = False
                    s = r.last_ins_ptr
                    s.link = p.ins_ptr

                    if r.best_ins_ptr is p:
                        # <1021>
                        if r.type == split_up:
                            if r.broken_ins is p and r.broken_ptr is not None:
                                while s.link is not r.broken_ptr:
                                    s = s.link

                                s.link = None
                                split_top_skip = p.split_top_ptr
                                p.ins_ptr = prune_page_top (r.broken_ptr)

                                if p.ins_ptr is not None:
                                    temp_ptr = vpack (p.ins_ptr, natural)
                                    p.height = temp_ptr.height + temp_ptr.depth
                                    del temp_ptr
                                    wait = True

                        r.best_ins_ptr = None
                        n = r.subtype
                        temp_ptr = get_box_register (n).list_ptr
                        del get_box_register (n)
                        set_box_register (n, vpack (temp_ptr, natural))
                        # </1021>
                    else:
                        while s.link is not None:
                            s = s.link
                        r.last_ins_ptr = s

                # <1022>
                prev_p.link = p.link
                p.link = None

                if wait:
                    q.link = p
                    q = p
                    insert_penalites += 1
                else:
                    del p.split_top_ptr
                    del p

                p = prev_p
                # </1022>
                # </1020>
        elif p.type == mark_node:
            # <1016>
            if first_mark is None:
                first_mark = p.mark_ptr
            if bot_mark is not None:
                del bot_mark
            bot_mark = p.mark_ptr
            # </1016>

        prev_p = p
        p = prev_p.link

    split_top_skip = save_split_top_skip
    # <1017>
    if p is not None:
        if contrib_head.link is None:
            if nest_ptr == 0:
                tail = page_tail
            else:
                contrib_tail = page_tail

        page_tail.link = contrib_head.link
        contrib_head.link = p
        prev_p.link = None

    save_vbadness = vbadness
    vbadness = inf_bad
    save_vfuzz = vfuzz
    vfuzz = max_dimen
    set_box_register (255, vpackage (page_head.link, best_size,
                                     Exact, page_max_depth))
    vbadness = save_vbadness
    vfuzz = save_vfuzz

    if last_glue != max_halfword:
        del last_glue

    start_a_new_current_page ()

    if q is not hold_head:
        page_head.link = hold_head.link
        page_tail = q

    # </1017>
    # <1019>
    r = page_ins_head.link
    while r is not page_ins_head:
        q = r.link
        del r
        r = q

    page_ins_head.link = page_ins_head
    # </1019>
    # </1014>

    if top_mark is not None and first_mark is None:
        first_mark = top_mark

    if output_routine is not None:
        if dead_cycles >= max_dead_cycles:
            # <1024>
            raise Exception ('too many dead cycles')
            # </1024>
        else:
            # <1025>
            output_active = True
            dead_cycles += 1
            push_nest () #
            enter_mode (-vmode)
            prev_depth = ignore_depth
            mode_line = -line
            begin_token_list (output_routine)
            new_save_level (output_group)
            normal_paragraph ()
            scan_left_brace ()
            return
            # </1025>

    # <1023>
    if page_head.link is not None:
        if contrib_head.link is None:
            if nest_ptr == 0:
                tail = page_tail
            else:
                contrib_tail = page_tail
        else:
            page_tail.link = contrib_head.link

        contrib_head.link = page_head.link
        page_head.link = None
        page_tail = page_head

    ship_out (get_box_register (255))
    set_box_register (255, None)
    # </1023>
    @exit_:
    pass
# </1012>


# <1026>
def clean_up_after_output_routine_finishes ():
    # <1027>: clean up if things are unbalanced
    end_token_list ()

    end_graf ()
    unsave ()
    output_active = False
    insert_penalites = 0

    # <1028>
    if get_box_register (255) is not None:
        raise Exception ('box255 should be left empty')
    # </1028>

    if tail is not head:
        page_tail.link = head.link
        page_tail = tail

    if page_head.link is not None:
        if contrib_head.link is None:
            contrib_tail = page_tail

        page_tail.link = contrib_head.link
        contrib_head.link = page_head.link
        page_head.link = None
        page_tail = page_head

    pop_nest ()
    build_page ()
# </1026>
