"""First-pass transcription of how math layout works in TeX. The key routine
is mlist_to_hlist(). This code doesn't run, but it transcribes "TeX: The
Program" as closely as possible in a sort of pseudo-Python.

XML-like tags denote sections in TeX: The Program where the code comes from.

Labels are rendered as decorators simply so that they stand out in Emacs.
Cases, do-whiles, etc. are rendered into Python equivalents. Octal goes to
hex.


Adaptions from how things are rendered in T:TP:
============================================================
(a "# one-off" comment indicates one-off adaptions)

kern_node      -> Kern ()
new_noad       -> Noad ()
new_null_box   -> Box ()
new_rule       -> Rule ()

char_exists(x)     -> x is not None
char_depth(f)(hd)  -> f.char_depth ([char-info from which hd was obtained])
char_height(f)(hd) -> f.char_height ([char-info from which hd was obtained])
char_tag(x)        -> x.char_tag
char_width(f)(x)   -> f.char_width (x)
character(x)       -> x.character
confusion(x)       -> die(x)
cramped_style(x)   -> cramped_style[x]
delete_glue_ref(x) -> (nothing)
depth(x)           -> x.depth
ext_bot(x)         -> x.ext_bot
ext_mid(x)         -> x.ext_mid
ext_rep(x)         -> x.ext_rep
ext_top(x)         -> x.ext_top
fam(x)             -> x.fam
fam_fnt(a + b)     -> get_math_font (a, b)
flush_node_list(x) -> (nothing)
free_node (x, y)   -> del x
get_avail()        -> (appropriate Node constructor)
get_node (s)       -> Node()
glue_ptr(x)        -> x.glue_ptr
height(x)          -> x.height
height_depth(x)    -> (translated into separate height/depth accesses)
hpack(x, natural)  -> hpack_natural (x)
info(x)            -> x.info
is_char_node(x)    -> x.is_char_node ()
large_char(x)      -> x.large_char
large_fam(x)       -> x.large_fam
left_delimiter(x)  -> x.left_delimiter
link(x)            -> x.next
math_type(x)       -> x.math_type
mu_mult(x)         -> mu_mult (x, f)
new_hlist(x)       -> x.new_hlist
nucleus(x)         -> x.nucleus
null               -> None
null_character     -> None
null_delimiter_space -> get_dimen_par ('nulldelimiterspace')
qo(x)              -> x
rem_byte(x)        -> x.rem_byte
right_delimiter(x) -> x.right_delimiter
shift_amount(x)    -> x.shift_amount
skip_byte(x)       -> x.skip_byte
small_char(x)      -> x.small_char
small_fam(x)       -> x.small_fam
sub_style(x)       -> sub_style[x]
subscr(x)          -> x.subscr
subtype(x)         -> x.subtype
sup_style(x)       -> sup_style[x]
supscr(x)          -> x.supscr
type(x)            -> x.type
vpack(x, natural)  -> vpack_natural (x)
width(x)           -> x.width
x[cur_f]           -> cur_f.x

type(x) <= vlist_node  -> (x is vlist or hlist)

display_style       - Display
text_style          - Text
script_style        - Script
script_script_style - ScriptScript

empty           - Empty # atom nucleus/sub/sup item types
math_char       - MathChar
math_text_char  - MathTextChar
sub_box         - SubBox
sub_mlist       - SubMlist

adjust_node   - Adjust # relevant h/vbox Node types
choice_node   - Choice
disc_node     - Disc
glue_node     - Glue
ins_node      - Ins
kern_node     - Kern
mark_node     - Mark
rule_node     - Rule
penalty_node  - Penalty
style_node    - Style
whatsit_node  - Whatsit

accent_noad   - Accent # Noad types
bin_noad      - Bin
close_noad    - Close
fraction_noad - Fraction
inner_noad    - Inner
left_noad     - Left
op_noad       - Op
open_noad     - Open
ord_noad      - Ord
over_noad     - Over
punct_noad    - Punct
radical_noad  - Radical
rel_noad      - Rel
right_noad    - Right
under_noad    - Under
vcenter_noad  - Vcenter

explicit      - Explicit # subtypes for Kern nodes
acc_kern      - AccKern

cond_math_glue - CondMathGlue # subtypes for math Glue nodes
normal         - Normal
mu_glue        - MuGlue

limits         - Limits # subtypes for Op atoms; Normal also ok
no_limits      - NoLimits

hlist_node(=0) - HList # types of box/list nodes
vlist_node(=1) - VList

no_tag(=0)     - NoTag # character tags in a font
ext_tag(=3)    - Ext
lig_tag(=1)    - Lig
list_tag(=2)   - List

stop_flag      - Stop # lig/kern program operators
kern_flag      - Kern

External dependencies:
============================================================

char_warning   - Complain about nonexistent character in font.
get_font_param - Get a "fontdimen" value.
get_math_font  - Get font for given family and size
hpack_exactly  - Pack an hbox at a specified width
hpack_natural  - Pack an hbox at its natural width
nx_plus_y      - Scaled math
rebox          - Re-pack a [hv]box at the specified width
vpack_natural  - Pack a vbox at its natural width
x_over_n       - Scaled division with remainder
xn_over_d      - Scaled multiply-and-divide.

"""
#<683>
default_code = 0x40000000
#</683>

#<688>
# each of these plus one is the "cramped" version
display_style = 0
text_style = 2
script_style = 4
script_script_style = 6
#</688>

#<699>
text_size = 0
script_size = 16
script_script_size = 32
#</699>

#<719>
cur_mlist = None # beginning of mlist to be translated
cur_style = None # style code at current place in list
cur_size = None # size code corresponding to cur_style
cur_mu = None # math unit width corresponding to cur_size
mlist_penalties = False # should mlist_to_list insert penalities?
#</719>

#<724>
cur_f = None # font of current math char
cur_c = None # ord of current math char
cur_i = None # char-info or lig/kern instruction of current math char
#</724>

#<764>
math_spacing = ('02340001' # 0: no space
                '22*40001' # 1: conditional thin space
                '33**3**3' # 2: thin space
                '44*04004' # 3: conditional medium space
                '00*00000' # 4: conditional thick space
                '02340001' # *: not allowed
                '11*11111'
                '12341011')
#</764>

def clean_box (p, s): # <720>
    # p: noad pointer
    # s: math style to use

    if p.math_type == MathChar:
        cur_mlist = Noad ()
        cur_mlist.nucleus = p
    elif p.math_type == SubBox: # ie regular hbox/vbox
        q = p.info
        goto found
    elif p.math_type == SubMlist:
        cur_mlist = p.info
    else:
        q = Box ()
        goto found

    save_style = cur_style
    cur_style = s
    mlist_penalities = False
    mlist_to_hlist ()
    q = temp_head.next
    cur_style = save_style
    set_cur_size_and_mu () #<703/>

    @found:

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
            if r is not None:
                if r.next is None:
                    if !r.is_char_node ():
                        if r.type == Kern:
                            del r
                            q.next = None
        #</721>

    return x


def fetch (a): #<722>
    # a: MathChar field of an atom
    cur_c = a.character
    cur_f = get_math_font (a.fam, cur_size)
    if cur_f == null_font:
        #<723>
        raise ('bad character in family')
        cur_i = None
        #</723>
        a.math_type = None
    else:
        if (cur_c is in range for current font): # one-off
            cur_i = cur_f.char_info (cur_c)
        else:
            cur_i = None # null character

        if cur_i is None:
            char_warning (cur_f, cur_c)
            a.math_type = Empty


def mlist_to_hlist (): # <726>
    mlist = cur_mlist
    penalties = mlist_penalties
    style = cur_style
    q = mlist # noad iterator
    r = None # noad before q
    r_type = Op # type of r or Op if r is None
    max_h = 0
    max_d = 0

    set_cur_size_and_mu () #<703/>

    while q is not None:
        # <727>
        # <728>
    @reswitch:
        delta = 0

        if q.type == Bin:
            # Change type of q if not in bin op context.
            if r_type in (Bin, Op, Rel, Open, Punct, Left):
                q.type = Ord
                goto rewswitch
        elif q.type in (Rel, Close, Punct, Right):
            #<729>
            if r_type == Bin:
                r.type = Ord
            #</729>
            if q.type == Right:
                goto done_with_noad
        #<733>
        elif q.type == Left:
            goto done_with_noad
        elif q.type == Fraction:
            make_fraction (q)
            goto check_dimensions
        elif q.type == Op:
            delta = make_op (q)
            if q.subtype == Limits:
                goto check_dimensions
        elif q.type == Ord:
            make_ord (q)
        elif q.type in (Open, Inner):
            pass
        elif q.type == Radical:
            make_radical (q)
        elif q.type == Over:
            make_over (q)
        elif q.type == Under:
            make_under (q)
        elif q.type == Accent:
            make_math_accent (q)
        elif q.type == Vcenter:
            make_vcenter (q)
        #</733>
        #<730>
        elif q.type == Style:
            cur_style = q.subtype
            set_cur_size_and_mu () #<703/>
            goto done_with_node
        elif q.type == Choice:
            #<731>
            if cur_style == Display:
                p = q.display_mlist
                q.display_mlist = None
            elif cur_style == Text:
                p = q.text_mlist
                q.text_mlist = None
            elif cur_style == Script:
                p = q.script_mlist
                q.script_mlist = None
            elif cur_style == ScriptScript:
                p = q.script_script_mlist
                q.script_script_mlist = None
            q.type = Style
            q.subtype = cur_style
            q.width = 0
            q.depth = 0
            if p is not None:
                z = q.next
                q.next = p
                while p.next is not None:
                    p = p.next
                p.next = z
            goto done_with_node
            #</731>
        elif q.type in (Ins, Mark, Adjust, Whatsit, Penalty, Disc):
            goto done_with_node
        elif q.type == Rule:
            if q.height > max_h:
                max_h = q.height
            if q.depth > max_d:
                max_d = q.depth
            goto done_with_node
        elif q.type == Glue:
            #<732>
            if q.subtype == MuGlue:
                x = q.glue_ptr
                y = math_glue (x, cur_mu)
                q.glue_ptr = y
                q.subtype = Normal
            elif cur_size != text_size && q.subtype == CondMathGlue:
                p = q.next
                if p is not None:
                    if p.type == Glue or p.type == Kern:
                        q.next = p.next
                        p.next = None
            #</732>
            goto done_with_node
        elif q.type == Kern:
            math_kern (q, cur_mu)
            goto done_with_node
        #</730>
        else:
            die ('mlist1')

        #<754>
        if q.nucleus.math_type in (MathChar, MathTextChar):
            #<755>
            fetch (q.nucleus)

            if char_exists (cur_i):
                delta = cur_f.char_italic (cur_i)
                p = Character (cur_f, cur_c)
                if q.nucleus.math_type == MathTextChar and space(cur_f) != 0:
                    delta = 0
                if q.subscr.math_type == Empty and delta != 0:
                    p.next = Kern (delta)
                    delta = 0
            else:
                p = None
            #</755>
        elif q.nucleus.math_type == Empty:
            p = None
        elif q.nucleus.math_type == SubBox:
            p = q.nucleus.info
        elif q.nucleus.math_type == SubMlist:
            cur_mlist = q.nucleus_info
            save_style = cur_style
            mlist_penalties = False
            mlist_to_hlist ()
            cur_style = save_style
            set_cur_size_and_mu () #<703/>
            p = hpack_natural (temp_head.next)
        else:
            die ('mlist2')

        q.new_hlist = p

        if q.subscr.math_type == Empty and q.supscr.math_type == Empty:
            goto check_dimensions

        make_scripts (q, delta)
        #</754>
        #</728>

    @check_dimensions:
        z = hpack_natural (q.new_hlist)
        if z.height > max_h:
            max_h = z.height
        if z.depth > max_d:
            max_d = z.depth
        del z

    @done_with_noad:
        r = q
        r_type = r.type

    @done_with_node:
        q = q.next
        # </727>

    #<729>
    if r_type == Bin:
        r.type = Ord
    #</729>

    #<760>
    p = temp_head
    p.next = None
    q = mlist
    r_type = 0
    cur_style = style
    set_cur_size_and_mu () #<703/>

    while q is not None:
        #<761>
        t = Ord
        s = noad_size
        pen = inf_penalty

        if q.type in (Op, Open, Close, Punct, Inner):
            t = q.type
        elif q.type == Bin:
            t = Bin
            pen = bin_op_penalty
        elif q.type == Rel:
            t = Rel
            pen = rel_penalty
        elif q.type in (Ord, Vcenter, Over, Under):
            pass
        elif q.type == Radical:
            s = radical_noad_size
        elif q.type == Accent:
            s = accent_noad_size
        elif q.type == Fraction:
            t = Inner
            s = fraction_noad_size
        elif q.type in (Left, Right):
            t = make_left_right (q, style, max_d, max_h)
        elif q.type == Style:
            #<763>
            cur_style = q.subtype
            s = style_node_size
            set_cur_size_and_mu () #<703/>
            goto delete_q
            #</763>
        elif q.type in (Whatsit, Penalty, Rule, Disc, Adjust, Ins, Mark, Glue, Kern):
            p.next = q
            p = q
            q = p.next
            p.next = None
            goto done
        else:
            die ('mlist3')
        #</761>

        #<766>
        if r_type > 0:
            zzz = math_spacing[r_type * 8 + t] # one-off
            if zzz == '0':
                x = 0
            elif zzz == '1':
                if cur_style in (Text, Display):
                    x = thin_mu_skip_code
                else:
                    x = 0
            elif zzz == '2':
                x = thin_mu_skip_code
            elif zzz == '3':
                if cur_style in (Text, Display):
                    x = med_mu_skip_code
                else:
                    x = 0
            elif zzz == '4':
                if cur_style in (Text, Display):
                    x = thick_mu_skip_code
                else:
                    x = 0
            else:
                die ('mlist4')

            if x != 0:
                y = math_glue (x.glue_par, cur_mu)
                z = Glue (y)
                p.next = z
                p = z
                z.subtype = x + 1
        #</766>

        #<767>
        if q.new_hlist is not None:
            p.next = q.new_hlist
            while True:
                p = p.next
                if p.next is None:
                    break

        if penalties:
            if q.next is not None:
                if pen < inf_penalty:
                    r_type = q.link.type
                    if r_type != Penalty:
                        if r_type != Rel:
                            z = Penalty (pen)
                            p.next = z
                            p = z
        #</767>
        r_type = t

    @delete_q:
        r = q
        q = q.next
        del r

    @done:
        pass
    #</760>


def make_over (q): #<734>
    q.nucleus.info = overbar (clean_box (q.nucleus, cramped_style[cur_style]),
                              3 * default_rule_thickness (),
                              default_rule_thickness ())
    q.nucleus.math_type = SubBox


def make_under (q): #<735>
    x = clean_box (q.nucleus, cur_style)
    p = Kern (3 * default_rule_thickness)
    x.next = p
    p.next = fraction_rule (default_rule_thickness ())
    y = vpack_natural (x)
    delta = y.height + y.depth + default_rule_thickness ()
    y.height = x.height
    y.depth = delta - y.height

    q.nucleus.info = y
    q.nucleus.math_type = SubBox


def make_vcenter (q): #<736>
    v = q.nucleus.info
    if v.type != VList:
        die ('expected vlist in vcenter')
    delta = v.height + v.depth
    v.height = axis_height (cur_size) + half (delta)
    v.depth = delta - v.height


def make_radical (q): #<737>
    x = clean_box (q.nucleus, cramped_style[cur_style])
    if cur_style == Display: # cramped, or not
        clr = default_rule_thickness () + abs (math_x_height (cur_size)) // 4
    else:
        clr = default_rule_thickness ()
        clr += abs (clr) // 4

    y = var_delimiter (q.left_delimiter, cur_size,
                       x.height + x.depth + clr + default_rule_thickness ())
    delta = y.depth - (x.height + x.depth + clr)
    if delta > 0:
        clr += half (delta)

    y.shift_amount = -(x.height + clr)
    y.next = overbar (x, clr, y.height)
    q.nucleus.info = hpack_natural (y)
    q.nucleus.type = SubBox


def make_math_accent (q): #<738>
    fetch (q.accent_chr)

    if char_exists (cur_i):
        i = cur_i
        c = cur_c
        f = cur_f

        #<741>
        s = 0
        if q.nucleus.math_type == MathChar:
            fetch (q.nucleus)
            if cur_i.char_tag == Lig:
                a = cur_f.lig_kern_start (cur_i)
                cur_i = font_info[a].qqqq # ??
                if cur_i.skip_byte > Stop:
                    a = cur_f.lig_kern_restart (cur_i)
                    cur_i = font_info[a].qqqq # ??

                while True:
                    if cur_i.next_char = cur_f.skew_char:
                        if cur_i.op_byte >= Kern:
                            if cur_i.skip_byte <= Stop:
                                s = cur_f.char_kern (cur_i)
                        break

                    if cur_i.skip_byte >= StopFlag:
                        break

                    a += cur_i.skip_byte + 1
                    cur_i = font_info[a].qqqq # ??
        #</741>

        x = clean_box (q.nucleus, cramped_style[cur_style])
        w = x.width
        h = x.height
        #<740>
        while True:
            if i.char_tag != List:
                break
            y = i.rem_byte
            i = f.char_info (y)
            if not char_exists (i):
                break
            if f.char_width (i) > w:
                break
            c = y
        #</740>
        if h < f.x_height:
            delta = h
        else:
            delta = f.x_height

        if q.subscr.math_type != Empty or q.subscr.math_type != Empty:
            if q.nucleus.math_type == MathChar:
                #<742>
                x = Node ()
                x.nucleus = q.nucleus
                x.supscr = q.supscr
                x.subscr = q.subscr
                q.supscr = q.subscr = None
                q.nucleus.math_type = SubMlist
                q.nucleus.info = x
                x = clean_box (q.nucleus, cur_style)
                delta += x.height - h
                h = x.height
                #</742>

        y = char_box (f, c)
        y.shift_amount = s + half (w - y.width)
        y.width = 0
        p = Kern (-delta)
        p.next = x
        y.next = p
        y = vpack_natural (y)
        y.width = x.width

        if y.height < h:
            # <739>
            p = Kern (h - y.height)
            p.next = y.list_ptr
            y.list_ptr = p
            y.height = h
            # </739>

        q.nucleus.info = y
        q.nucleus.math_type = SubBox


def make_fraction (q): #<743>
    if q.thickness == default_code:
        q.thickness = default_rule_thickness ()

    #<744>
    x = clean_box (q.numerator, num_style[cur_style])
    z = clean_box (q.denominator, denom_style[cur_style])

    if x.width < z.width:
        x = rebox (x, z.width)
    else:
        z = rebox (z, x.width)

    if cur_style == DisplayStyle: # any crampedness
        shift_up = num1 (cur_size)
        shift_down = denom1 (cur_size)
    else:
        shift_down = denom2 (cur_size)
        if q.thickness != 0:
            shift_up = num2 (cur_size)
        else:
            shift_up = num3 (cur_size)
    #</744>

    if q.thickness == 0:
        #<745>
        if cur_style == DisplayStyle: # any crampedness
            clr = 7 * default_rule_thickness ()
        else:
            clr = 3 * default_rule_thickness ()
        delta = half (clr - ((shift_up - x.depth) - (z.height - shift_down)))
        if delta > 0:
            shift_up += delta
            shift_down += delta
        #</745>
    else:
        #<746>
        if cur_style == DisplayStyle: # any crampedness
            clr = 3 * q.thickness
        else:
            clr = q.thickness

        delta = half (q.thickness)
        delta1 = clr - ((shift_up - x.depth) - (axis_height[cur_size] + delta))
        delta2 = clr - ((axis_height[cur_size] - delta) - (z.height - shift_down))

        if delta1 > 0:
            shift_up += delta1
        if delta2 > 0:
            shift_down += delta2
        #</746>

    #<747>
    v = Box ()
    v.type = VList
    v.height = x.height + shift_up
    v.depth = z.depth + shift_down
    v.width = x.width

    if q.thickness == 0:
        p = Kern ((shift_up - x.depth) - (z.height - shift_down))
        p.next = z
    else:
        y = fraction_rule (q.thickness)
        p = Kern ((axis_height (cur_size) - delta) - (z.height - shift_down))
        y.next = p
        p.next = z
        p = Kern ((shift_up - x.depth) - (axis_height(cur_size) + delta))
        p.next = y

    x.next = p
    v.list_ptr = x
    #</747>

    #<748>
    if cur_style == DisplayStyle: # any crampedness
        delta = delim1 (cur_size)
    else:
        delta = delim2 (cur_size)

    x = var_delimiter (q.left_delimiter, cur_size, delta)
    x.next = v
    z = var_delimiter (q.right_delimiter, cur_size, delta)
    v.next = z
    q.new_hlist = hpack_natural (x)
    #</748>


def make_op (q): #<749>
    if q.subtype == Normal and cur_style == DisplayStyle: # any crampedness
        q.subtype = Limits

    if q.nucleus.math_type == MathChar:
        fetch (q.nucleus)

        if cur_style == DisplayStyle and cur_i.char_tag == List: # any crampedness
            c = cur_i.rem_byte
            i = cur_f.char_info (c)
            if char_exists (i):
                cur_c = c
                cur_i = i
                q.nucleus.character = c

        delta = cur_f.char_italic (cur_i)
        x = clean_box (q.nucleus, cur_style)

        if q.subscr.math_type != Empty and q.subtype != Limits:
            x.width -= delta # remove italic correction

        x.shift_amount = half (x.height - x.depth) - axis_height (cur_size)
        q.nucleus.math_type = SubBox
        q.nucleus.info = x
    else:
        delta = 0

    if q.subtype == Limits:
        #<750>
        x = clean_box (q.supscr, sup_style[cur_style])
        y = clean_box (q.nucleus, cur_style)
        z = clean_box (q.subscr, sub_style[cur_style])
        v = Box ()
        v.type = VList
        v.width = y.width
        if x.width > v.width:
            v.width = x.width
        if z.width > v.width:
            v.width = z.width

        x = rebox (x, v.width)
        y = rebox (y, v.width)
        z = rebox (z, v.width)
        x.shift_amount = half (delta)
        z.shift_amount = -x.shift_amount
        v.height = y.height
        v.depth = y.depth

        #<751>
        if q.supscr.math_type is Empty:
            del x
            v.list_ptr = y
        else:
            shift_up = big_op_spacing3() - x.depth
            if shift_up < big_op_spacing1():
                shift_up = big_op_spacing1()
            p = Kern (shift_up)
            p.next = y
            x.next = p

            p = Kern (big_op_spacing5 ())
            p.next = x
            v.list_ptr = p

            v.height += big_op_spacing5() + x.height + x.depth + shift_up

        if q.subscr.math_type is Empty:
            del z
        else:
            shift_down = big_op_spacing4() - z.height
            if shift_down < big_op_spacing2():
                shift_down = big_op_spacing2()

            p = Kern (shift_down)
            y.next = p
            p.next = z

            p = Kern (big_op_spacing5 ())
            z.next = p

            v.depth += big_op_spacing5() + z.height + z.depth + shift_down
        #</751>

        q.new_hlist = v
        #</750>

    return delta


def make_ord (q): #<752>
    @restart:

    if q.subscr.math_type == Empty:
        if q.supscr.math_type == Empty:
            if q.nucleus.math_type == MathChar:
                p = q.next
                if p is not None:
                    if p.type in (Ord, Op, Bin, Rel, Open, Close, Punct):
                        if p.nucleus.math_type == MathChar:
                            if p.nucleus.fam == q.nucleus.fam:
                                q.nucleus.math_type = MathTextChar
                                fetch (q.nucleus)

                                if cur_i.char_tag == Lig:
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
                                                    check_interrupt ()

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

    @exit:
    pass


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
        del z

    if q.supscr.math_type == Empty:
        #<757>
        x = clean_box (q.subscr, sub_style[cur_style])
        x.width += script_space

        if shift_down < sub1[cur_size]:
            shift_down = sub1[cur_size]

        clr = x.height - abs (math_x_height[cur_size] * 4) / 5;

        if shift_down < clr:
            shift_down = clr

        x.shift_amount = shift_down
        #</757>
    else:
        #<758>
        x = clean_box (q.supscr, sup_style[cur_style])
        x.width += script_space

        if odd(cur_style): # -> in a cramped style?
            clr = sup3[cur_size]
        elif cur_style == Display:
            clr = sup1[cur_size]
        else:
            clr = sup2[cur_size]

        if shift_up < clr:
            shift_up = clr

        clr = x.depth + abs (math_x_height[cur_size]) / 4
        if shift_up < clr:
            shift_up = clr
        #</758>

        if q.subscr.math_type == Empty:
            x.shift_amount = -shift_up
        else:
            #<759>
            y = clean_box (q.subscr, sub_style[cur_style])
            y.width += script_space

            if shift_down < sub2[cur_size]:
                shift_down = sub2[cur_size]

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


def make_left_right (q, style, max_d, max_h): #<762>
    # "We use the fact that right_noad - left_noad = close_noad - open_noad"

    if style in (Display, Text):
        cur_size = text_size
    else:
        cur_size = 16 * ((style - text_style) / 2) # interp?

    delta2 = max_d + axis_height[cur_size]
    delta1 = max_h + max_d - delta2

    if delta2 > delta1:
        delta1 = delta2

    delta = delta1 / 500 * delimiter_factor
    delta2 = delta1 + delta1 - delimiter_shortfall
    if delta < delta2:
        delta = delta2

    q.new_hlist = var_delimiter (q.delimiter, cur_size, delta)
    return q.type - (left_noad - open_noad) # identity magic


def math_kern (p, m): #<717>
    # p is a Glue node
    # m is the current math unit

    if p.subtype == MuGlue:
        n = x_over_n (m, 0x10000)
        f = remainder

        if f < 0:
            n -= 1
            f += 0x10000

        p.width = mu_mult (p.width, f)
        p.subtype = Explicit


def mu_mult (x, f): #<716>
    return nx_plus_y (n, x, xn_over_d (x, f, 0x10000))


def math_glue (g, m):
    # g is a Glue node specification
    # m is the current math unit

    n = x_over_n (m, 0x10000)
    f = remainder

    if f < 0:
        n -= 1
        f += 0x10000

    p = Node ()
    p.width = mu_mult (g.width, f)
    p.stretch_order = g.stretch_order
    if p.stretch_order == Normal:
        p.stretch = mu_mult (g.stretch, f)
    else:
        p.stretch = g.stretch
    p.shrink_order = g.shrink_order
    if p.shrink_order == Normal:
        p.shrink = mu_mult (g.shrink, f)
    else:
        p.shrink = g.shrink
    return p


def overbar (b, k, t): #<705>
    p = Kern (k)
    p.next = b
    q = fraction_rule (t)
    q.next = p
    p = Kern (t)
    p.next = q
    return vpack_natural (p)


def fraction_rule (t): #<704>
    p = Rule ()
    p.height = t
    p.depth = 0
    return p


def var_delimiter (d, s, v): #<706>
    f = None # null_font
    w = 0
    large_attempt = False
    z = d.small_fam
    x = d.small_char

    while True:
        #<707>
        if z != 0 or (x is not invalid): # one-off
            z += s + 16
            while True:
                z -= 16
                g = get_math_font (~z, s) # one-off family/font breakdown
                if g is not None:
                    #<708>
                    y = x
                    if (y in font g):
    @continue:
                        q = g.char_info (y)
                        if char_exists (q):
                            if q.char_tag == Ext:
                                f = g
                                c = y
                                goto found
                            u = g.char_height (q) + g.char_depth (q) # one-off
                            if u > w:
                                f = g
                                c = y
                                w = u
                                if u >= v:
                                    goto found
                            if q.char_tag == List:
                                y = q.rem_byte
                                goto continue
                    #</708>
                if z < 16:
                    break
        #</707>

        if large_attempt:
            goto found
        large_attempt = True
        z = d.large_fam
        x = d.large_char

    @found:

    if f is not None:
        #<710>
        if q.char_tag == Ext:
            #<713>
            b = Box ()
            b.type = Vlist
            r = font_info[exten_base[f] + q.rem_byte].qqqq # ??
            #<714>
            c = r.ext_rep
            u = height_plus_depth (f, c)
            w = 0
            q = f.char_info (c)
            b.width = f.char_width (q) + f.char_italic (q)
            c = r.ext_bot
            if c is not None:
                w += height_plus_depth (f, c)
            c = r.ext_mid
            if c is not None:
                w += height_plus_depth (f, c)
            c = r.ext_top
            if c is not None:
                w += height_plus_depth (f, c)
            n = 0
            if u > 0:
                while w < v:
                    w += u
                    n += 1
                    if r.ext_mid is not None:
                        w += u
            #</714>
            c = r.ext_bot
            if c is not None:
                stack_into_box (b, f, c)
            c = r.ext_rep
            for m in xrange (1, n+1):
                stack_into_box (b, f, c)
            c = r.ext_mid
            if c is not None:
                stack_into_box (b, f, c)
                c = r.ext_rep
                for m in xrange (1, n+1):
                    stack_into_box (b, f, c)
            c = r.ext_top
            if c is not None:
                stack_into_box (b, f, c)
            b.depth = w - b.height
            #</713>
        else:
            b = char_box (f, c)
        #</710>
    else:
        b = Box ()
        b.width = get_dimen_par ('nulldelimiterspace')

    b.shift_amount = half (b.height - b.depth) - axis_height(s)
    return b


def char_box (f, c): #<709>
    q = f.char_info (c)
    b = Box ()
    b.width = f.char_width (q) + f.char_italic (q)
    b.height = f.char_height (q)
    b.depth = f.char_depth (q)

    p = Character ()
    p.character = c
    p.font = c

    b.list_ptr = p
    return b


def stack_into_box (b, f, c): #<711>
    p = char_box (f, c)
    p.next = b.list_ptr
    b.list_ptr = p
    b.height = p.height


def height_plus_depth (f, c): #<712>
    q = f.char_info (c)
    return f.char_height (q) + f.char_depth (q)


def rebox (b, w): #<715>
    if b.width != w and b.list_ptr is not None:
        if b.type == Vlist:
            b = hpack_natural (b)

        p = b.list_ptr

        if p.is_char_node() and p.next is None:
            f = p.font
            v = f.char_width (p)
            if v != b.width:
                p.next = Kern (b.width - v)

        del b
        b = Glue (ss_glue)
        b.next = p

        while p.next is not None:
            p = p.next

        p.next = Glue (ss_glue)
        return hpack_exactly (b, w)
    else:
        b.width = w
        return b


def set_cur_size_and_mu (): # <703>
    if cur_style < Script: # Display or Text
        cur_size = text_size
    else:
        # script{,_script}_style -> script{,_script}_size
        cur_size = 16 * ((cur_style - text_style) // 2)

    cur_mu = x_over_n (math_quad (cur_size), 18)


#<700> -- font dimens of family 2 = math symbol
def math_x_height (size):
    return get_font_param (get_math_font (2, size), 5)
# analogously:
# math_quad   - 6
# num1        - 8
# num2        - 9
# num3        - 10
# denom1      - 11
# denom2      - 12
# sup1        - 13
# sup2        - 14
# sup3        - 15
# sub1        - 16
# sub2        - 17
# sup_drop    - 18
# sub_drop    - 19
# delim1      - 20
# delim2      - 21
# axis_height - 22
#</700>

#<701> -- font dimens of family 3 = math extension
def default_rule_thickness ():
    return get_font_param (get_math_font (3, cur_size), 8)
# analogously:
# big_op_spacing1 - 9
# big_op_spacing2 - 10
# big_op_spacing3 - 11
# big_op_spacing4 - 12
# big_op_spacing5 - 13
#</701>

#<100>
def half (x):
    if odd (x):
        return (x + 1) // 2
    return x // 2
#</100>
