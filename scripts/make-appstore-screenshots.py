#!/usr/bin/env python3
"""Compose App Store screenshots from raw iPhone captures.

Mirrors the visual language of the Play screenshots (violet field, bold
two-line headline, device-framed capture) at the sizes App Store Connect
accepts. Re-run whenever the raw captures are replaced.

    python scripts/make-appstore-screenshots.py

Raw captures live in `store-assets/screenshots apple/`; output lands in
`store-assets/appstore/<size>/`. Captures must come off the phone as files --
a chat app that re-compresses them to ~600px wide leaves the frame upscaled
and soft. Any capture aspect is accepted; it is fitted to the frame's screen.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'store-assets', 'screenshots apple')
OUT = os.path.join(ROOT, 'store-assets', 'appstore')
FONTS = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'inter')

# App Store Connect shows one upload tile per iPhone display size and scales
# the set down from the largest. 6.9" is what it asks for now; 6.7" is kept
# because older tiles still appear on some accounts.
SIZES = {'6.9': (1320, 2868), '6.7': (1290, 2796)}
BASE_W = 1290  # every layout constant below is in 6.7" units and scales from here

PRIMARY = (108, 53, 222)      # theme/colors.ts -> LightColors.primary
PRIMARY_HI = (139, 92, 246)   # DarkColors.primary, the gradient's far end
BEZEL = (24, 18, 42)
WHITE = (255, 255, 255)
SUB = (228, 219, 250)

# capture file, headline (one entry per line), subline
PANELS = [
    ('IMG_6099.PNG',
     ['News, events', 'and places'],
     'Everything happening around you, in one feed'),
    ('IMG_6098.PNG',
     ['Your community,', 'not a noise stream'],
     'Filter the feed by nationality, in 27 languages'),
    ('IMG_6100.PNG',
     ['Connect', 'across cultures'],
     'Free. No ads, no tracking, no location.'),
]


class Layout:
    """6.7"-unit constants, scaled to whatever canvas is being rendered."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.k = w / BASE_W

    def px(self, v):
        return round(v * self.k)


def font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, weight, f'Inter_{weight}.ttf'), size)


def background(L):
    """Violet field with the same soft off-centre circles the Play set uses."""
    bg = Image.new('RGB', (L.w, L.h), PRIMARY)
    glow = Image.new('L', (L.w, L.h), 0)
    g = ImageDraw.Draw(glow)
    for cx, cy, r, a in ((-120, 380, 900, 46), (1180, 1850, 1050, 38), (520, 2650, 820, 30)):
        cx, cy, r = L.px(cx), L.px(cy), L.px(r)
        g.ellipse((cx - r, cy - r, cx + r, cy + r), fill=a)
    glow = glow.filter(ImageFilter.GaussianBlur(L.px(120)))
    return Image.composite(Image.new('RGB', (L.w, L.h), PRIMARY_HI), bg, glow)


def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0], img.size[1]), radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def device(L, capture, width):
    """Dark bezel around the capture, sized from the bezel's outer width."""
    pad = L.px(18)
    screen_w = width - pad * 2
    shot = Image.open(capture).convert('RGB')
    screen_h = round(screen_w * shot.height / shot.width)
    shot = shot.resize((screen_w, screen_h), Image.LANCZOS)

    frame = Image.new('RGB', (width, screen_h + pad * 2), BEZEL)
    frame.paste(shot, (pad, pad))
    return rounded(frame, L.px(58))


def build(L, capture, headline, subline, dest):
    canvas = background(L)
    draw = ImageDraw.Draw(canvas)

    y = L.px(168)
    head_f = font('700Bold', L.px(96))
    for line in headline:
        draw.text(((L.w - draw.textlength(line, font=head_f)) / 2, y), line,
                  font=head_f, fill=WHITE)
        y += L.px(112)

    sub_f = font('400Regular', L.px(42))
    draw.text(((L.w - draw.textlength(subline, font=sub_f)) / 2, y + L.px(26)),
              subline, font=sub_f, fill=SUB)

    phone = device(L, capture, L.px(880))
    region_top, region_bottom = L.px(620), L.h - L.px(170)
    x = (L.w - phone.width) // 2
    top = region_top + max(0, (region_bottom - region_top - phone.height) // 2)

    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow.paste((38, 16, 86, 150),
                 (x, top + L.px(34), x + phone.width, top + L.px(34) + phone.height),
                 phone.split()[3])
    canvas = Image.alpha_composite(canvas.convert('RGBA'),
                                   shadow.filter(ImageFilter.GaussianBlur(L.px(44))))
    canvas = canvas.convert('RGB')
    canvas.paste(phone, (x, top), phone)
    canvas.save(dest, 'PNG')


if __name__ == '__main__':
    for label, (w, h) in SIZES.items():
        L = Layout(w, h)
        out_dir = os.path.join(OUT, f'{label}-inch')
        os.makedirs(out_dir, exist_ok=True)
        print(f'{label}" -> {w}x{h}')
        for i, (name, headline, subline) in enumerate(PANELS, 1):
            src = os.path.join(SRC, name)
            if not os.path.exists(src):
                print(f'  !! missing {name}')
                continue
            slug = headline[0].split(',')[0].lower().replace(' ', '-')
            dest = os.path.join(out_dir, f'{i:02d}-{slug}.png')
            build(L, src, headline, subline, dest)
            shot = Image.open(src)
            scale = L.px(880 - 36) / shot.width
            flag = '  UPSCALED' if scale > 1.02 else ''
            print(f'  {os.path.basename(dest):28s} <- {name} '
                  f'{shot.width}x{shot.height} x{scale:.2f}{flag}')
