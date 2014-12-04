# Copyright 2014 Peter Williams and collaborators.
# Licensed under the MIT license. See LICENSE.md for details.

"""First-pass transcription of how alignment layout is done in TeX. This code
doesn't run, but it transcribes "TeX: The Program" as closely as possible in a
sort of pseudo-Python.

XML-like tags denote sections in TeX: The Program where the code comes from.

Labels are rendered as decorators simply so that they stand out in Emacs.
Cases, do-whiles, etc. are rendered into Python equivalents. Octal goes to
hex.



"preamble" points to linked list of the preamble info. It alternates between
tabskip glue records, and alignrecords storing state info for each column.


set_glue_ratio_zero(x) literally means "x = 0.0".
set_glue_ratio_one(x) is analogous.
"""


class AlignRecord ():
    link = None # points to next tabskip glue; link.link = next AlignRecord
    info = None # span width info linked list; end_span -> None
    u_part = None # list of "u part" tokens
    v_part = None # list of "v part" tokens


class SpanNode ():
    width = None # largest natural width in this span
    link = None # number of spanned columns
    info = None # next wider SpanNode, or end_span if none


def fin_align ():
    #<800>

    if cur_group != align_group:
        confusion ('align1')

    unsave ()

    if cur_group != align_group:
        confusion ('align0')

    unsave ()

    if modes[-2] == MATHMODE:
        o_S = display_indent_S
    else:
        o_S = Zero_S

    #<801>

    q = preamble.link # = first col's alignrecord

    while True:
        p = q.link.link # = next alignrecord

        if q.width is None:
            #<802>
            q.width = 0
            q.link.glue_ptr = Zero_Glue
            #</802>

        if q.info is not None:
            #<803>
            # r moves through q's linked list of SpanNodes
            # s moves through p's linked list of SpanNodes
            t = q.width + q.link.glue_ptr.width # total width of col + its glue
            r = q.info # first span-node record
            s = None # XXX end_span
            s.info = p # = next alignrecord, temporarily [1]
            n = 1

            while True:
                r.width -= t

                u = r.info # next SpanNode
                while r.link > n:
                    s = s.info # s = first or next SpanNode (see [1])
                    n = s.info.link + 1 # ncol in next SpanNode + 1 => our "reference frame"

                if r.link < n:
                    # if this record fits between the active ones in the next
                    # column, splice it in, with a smaller link but the same
                    # width.
                    r.info = s.info
                    s.info = r
                    r.link -= 1
                    s = r
                elif r.width > s.info.width:
                    # this record spans as many or more columns than the
                    # current one in the next column. Boost its width.
                    s.info.width = r.width
                    del r

                # On to the next SpanNode for this column
                r = u
                if r is None:
                    break
            #</803>

        q.type = unset_node
        q.span_count = 0
        q.height = 0
        q.depth = 0
        q.glue_order = Normal
        q.glue_sign = Normal
        q.glue_stretch = 0
        q.glue_shrink = 0
        q = p

        if q is None:
            break

    #</801>
    #<804>

    #{restore pack style and target size}
    pack_begin_line = -mode_line

    if mode == -VMODE:
        rule_save = overfull_rule
        overfull_rule = 0
        p = hpack (preamble, {saved info})
        overfull_rule = rule_save
    else:
        q = preamble.link

        while True:
            q.height = q.width
            q.width = 0
            q = q.link.link
            if q is None:
                break

        p = vpack (preamble, {saved info})

        q = preamble.link

        while True:
            q.width = q.height
            q.height = 0
            q = q.link.link
            if q is None:
                break

    pack_begin_line = 0
    #</804>

    #<805>
    q = head.link # first row
    s = head

    while q is not None:
        if not is_char_node (q):
            if q.type == unset_node:
                #<807>
                if mode == -VMODE:
                    q.type = hlist_node
                    q.width = p.width
                else:
                    q.type = vlist_node
                    q.height = p.height

                q.glue_order = p.glue_order
                q.glue_sign = p.glue_sign
                q.glue_set = p.glue_set
                q.shift_amount = o
                r = q.list_ptr.link # items within this row's box
                s = p.list_ptr.link # first column specification in the alignment

                while True:
                    #<808>
                    n = r.span_count # number of columns spanned by this cell
                    t = s.width # total width of this span
                    w = t # width of the first column of this span
                    u = hold_head # temporary list

                    while n > 0:
                        n -= 1
                        #<809>
                        s = s.link # s is now tabskip glue after this col
                        v = s.glue_ptr
                        u.link = new_glue (v)
                        u = u.link
                        u.subtype = tab_skip_code + 1
                        t += v.width

                        if p.glue_sign == Stretching:
                            if v.stretch_order == p.glue_order:
                                t += round (float (p.glue_set) * v.stretch)
                        elif p.glue_sign == Shrinking:
                            if v.shrink_order == p.glue_order:
                                t -= round (float (p.glue_set) * v.shrink)

                        s = s.link # s is now the next col
                        u.link = new_null_box ()
                        u = u.link
                        t += s.width

                        if mode == -VMODE:
                            u.width = s.width
                        else:
                            u.type = vlist_node
                            u.height = s.width
                        #</809>

                    if mode == -VMODE:
                        #<810>
                        r.height = q.height
                        r.depth = q.depth

                        if r.width == t:
                            r.glue_sign = Normal
                            r.glue_order = Normal
                            #set_glue_ratio_zero (r.glue_set)
                            r.glue_set = 0.
                        elif t > r.width:
                            r.glue_sign = Stretching
                            if r.glue_stretch == 0:
                                #set_glue_ratio_zero (r.glue_set)
                                r.glue_set = 0.
                            else:
                                r.glue_set = unfloat ((t - r.width) / r.glue_stretch)
                        else:
                            r.glue_order = r.glue_sign
                            r.glue_sign = Shrinking
                            if r.glue_shrink == 0:
                                #set_glue_ratio_zero (r.glue_set)
                                r.glue_set = 0.
                            elif r.glue_order == Normal and r.width - t > r.glue_shrink:
                                #set_glue_ratio_one (r.glue_set)
                                r.glue_set = 1.
                            else:
                                r.glue_set = unfloat ((r.width - t) / r.glue_shrink)

                        r.width = w
                        r.type = HlistNode
                        #</810>
                    else:
                        #<811>
                        r.width = q.width

                        if r.height == t:
                            r.glue_sign = Normal
                            r.glue_order = Normal
                            #set_glue_ratio_zero (r.glue_set)
                            r.glue_set = 0.
                        elif t > r.height:
                            r.glue_sign = Stretching
                            if r.glue_stretch == 0:
                                #set_glue_ratio_zero (r.glue_set)
                                r.glue_set = 0.
                            else:
                                r.glue_set = unfloat ((t - r.height) / r.glue_stretch)
                        else:
                            r.glue_order = r.glue_sign
                            r.glue_sign = Shrinking
                            if r.glue_shrink == 0:
                                #set_glue_ratio_zero (r.glue_set)
                                r.glue_set = 0.
                            elif r.glue_order == Normal and r.height - t > r.glue_shrink:
                                #set_glue_ratio_one (r.glue_set)
                                r.glue_set = 1.
                            else:
                                r.glue_set = unfloat ((r.height - t) / r.glue_shrink)

                        r.height = w
                        r.type = VlistNode
                        #</811>

                    r.shift_amount = 0

                    if u != hold_head:
                        u.link = r.link
                        r.link = hold_head.link
                        r = u
                    #</808>

                    r = r.link.link # next cell box
                    s = s.link.link # next column spec

                    if r is None:
                        break
                #</807>
            elif q.type == rule_node:
                #<806>
                if is_running (q.width):
                    q.width = p.width
                if is_running (q.height):
                    q.height = p.height
                if is_running (q.depth):
                    q.depth = p.depth

                if o != 0:
                    r = q.link
                    q.link = None
                    q = hpack (q, 'natural')
                    q.shift_amount = o
                    q.link = r
                    s.link = q
                #</806>

        s = q
        q = q.link
    #</805>

    flush_node_list (p)
    pop_alignment ()

    #<812>
    aux_save = aux # See <212>; essentially saves prev_depth
    p = head.link
    q = tail
    pop_nest ()

    if mode == MMODE:
        #<1206>
        do_assignments ()

        if cur_cmd != MathShift:
            {complain about alignment usage: <1207>}
        else:
            {check that another $ follows: <1197>}

        pop_nest ()
        tail_append (new_penalty (pre_display_penalty))
        tail_append (new_param_glue (above_display_skip_code))
        tail.link = p

        if p is not None:
            tail = q

        tail_append (new_penalty (post_display_penalty))
        tail_append (new_param_glue (below_display_skip_code))
        prev_depth = aux_save.sc
        resume_after_display ()
        #</1206>
    else:
        aux = aux_save
        tail.link = p

        if p is not None:
            tail = q

        if mode == VMODE:
            build_page ()
    #</812>
    #</800>
