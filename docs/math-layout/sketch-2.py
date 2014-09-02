"""Second-pass of math layout transcription.

Here we clean up the structure in self-contained ways.

- Use min() and max() instead of 'if' statements
- Reorder 'if's for less nesting and shorter top halves.
- Remove gotos
- Remove irrelevant/dead code

...


"""

def clean_box (p, s): # <720>
    # p: noad pointer
    # s: math style to use

    cur_mlist = None

    if p.math_type == MathChar:
        cur_mlist = Noad ()
        cur_mlist.nucleus = p
    elif p.math_type == SubBox: # ie regular hbox/vbox
        q = p.info
    elif p.math_type == SubMlist:
        cur_mlist = p.info
    else:
        q = Box ()

    if cur_mlist not is None:
        save_style = cur_style
        cur_style = s
        mlist_penalities = False
        mlist_to_hlist ()
        q = temp_head.next
        cur_style = save_style
        set_cur_size_and_mu () #<703/>

    if q.is_char_node() or q is None:
        x = hpack_natural (q)
    else if q.next is None and (q is vlist or hlist) and q.shift_amount == 0:
        x = q # already clean
    else:
        x = hpack_natural (q)
        #<721>
        q = x.list_ptr
        if q.is_char_node ():
            r = q.next
            if r is not None and r.next is None and !r.is_char_node () and r.type == Kern:
                q.next = None
        #</721>

    return x


def make_ord (q): #<752>
    @restart:

    if q.subscr.math_type != Empty:
        return

    if q.supscr.math_type != Empty:
        return

    if q.nucleus.math_type != MathChar:
        return

    p = q.next
    if p is None:
        return

    if p.type not in (Ord, Op, Bin, Rel, Open, Close, Punct):
        return

    if p.nucleus.math_type != MathChar:
        return

    if p.nucleus.fam != q.nucleus.fam:
        return

    q.nucleus.math_type = MathTextChar
    fetch (q.nucleus)

    if cur_i.char_tag != Lig:
        return

    a = cur_f.lig_kern_start (cur_i)
    cur_c = p.nucleus.character
    cur_i = font_info[a].qqqq # ??

    if cur_i.skip_byte > StopFlag:
        a = cur_f.lig_kern_restart (cur_i)
        cur_i = font_info[a].qqqq # ??

    while True:
        #<753>
        if cur_i.next_char == cur_c:
            if cur_i.skip_byte <= StopFlag:
                if cur_i.op_byte >= KernFlag:
                    p = Kern (cur_f.char_kern (cur_i))
                    p.next = q.next
                    q.next = p
                    return
                else:
                    if cur_i.op_byte in (1, 5):
                        q.nucleus.character = cur_i.rem_byte
                    elif cur_i.op_byte in (2, 6):
                        p.nucleus.character = cur_i.rem_byte
                    elif cur_i.op_byte in (3, 7, 11):
                        r = Noad ()
                        r.nucleus.character = cur_i.rem_byte
                        r.nucleus.fam = q.nucleus.fam
                        q.next = r
                        r.next = p

                        if cur_i.op_byte < 11:
                            r.nucleus.math_type = MathChar
                        else:
                            r.nucleus.math_type = MathTextChar
                    else:
                        q.next = p.next
                        q.nucleus.character = cur_i.rem_byte
                        q.subscr = p.subscr
                        q.supscr = p.supscr
                        del p

                    if cur_i.op_byte > 3:
                        return
                    q.nucleus.math_type = MathChar
                    goto restart
        #</753>

        if cur_i.skip_byte >= StopFlag:
            return
        a += cur_i.skip_byte + 1
        cur_i = font_info[a].qqqq



def make_scripts (q, delta): #<756>
    p = q.new_hlist

    if p.is_char_node ():
        shift_up = 0
        shift_down = 0
    else:
        z = hpack_natural (p)
        if cur_style in (Display, Text):
            t = script_size
        else:
            t = script_script_size

        shift_up = z.height - sup_drop[t]
        shift_down = z.depth + sub_drop[t]

    if q.supscr.math_type == Empty:
        #<757>
        x = clean_box (q.subscr, sub_style[cur_style])
        x.width += script_space
        clr = x.height - abs (math_x_height[cur_size] * 4) / 5;
        x.shift_amount = max (shift_down, sub1[cur_size], clr)
        #</757>
    else:
        #<758>
        x = clean_box (q.supscr, sup_style[cur_style])
        x.width += script_space

        if odd(cur_style): # -> cramped style
            clr = sup3[cur_size]
        elif cur_style == Display:
            clr = sup1[cur_size]
        else:
            clr = sup2[cur_size]

        shift_up = max (shift_up, clr)
        clr = x.depth + abs (math_x_height[cur_size]) / 4
        shift_up = max (shift_up, clr)
        #</758>

        if q.subscr.math_type == Empty:
            x.shift_amount = -shift_up
        else:
            #<759>
            y = clean_box (q.subscr, sub_style[cur_style])
            y.width += script_space

            shift_down = max (shift_down, sub2[cur_size])

            clr = 4 * default_rule_thickness () - ((shift_up - x.depth) - (y.height - shift_down))
            if clr > 0:
                shift_down += clr
                clr = abs (math_x_height[cur_size] * 4) / 5 - (shift_up - x.depth)
                if clr > 0:
                    shift_up += clr
                    shift_down -= clr

            x.shift_amount = delta
            p = Kern ((shift_up - x.depth) - (y.height - shift_down))
            x.next = p
            p.next = y
            x = vpack_natural (x)
            x.shift_amount = shift_down
            #</759>

    if q.new_hlist is None:
        q.new_hlist = x
    else:
        p = q.new_hlist
        while p.next is not None:
            p = p.next
        p.next = x
