"""Second-pass of math layout transcription.

Here we clean up the structure in self-contained ways.

- Use min() and max() instead of 'if' statements
- Reorder 'if's for less nesting and shorter top halves.
- Remove gotos
- Remove irrelevant/dead code

...


"""

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
