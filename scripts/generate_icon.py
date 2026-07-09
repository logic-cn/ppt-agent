#!/usr/bin/env python3
"""Generate PPT Agent app icon — dark bg + large white slide for Dock visibility."""

from PIL import Image, ImageDraw
import math, os, subprocess, sys, shutil

SRC_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(SRC_DIR, 'src-tauri', 'icons')

# Palette
DARK_BG = (11, 17, 30)       # near-black navy
SLIDE_WHITE = (244, 246, 252)
HEADER_BLUE = (79, 140, 255)  # brand accent
BAR_BLUE = (55, 115, 230)
GOLD = (251, 191, 36)
STAND_LIGHT = (220, 228, 248)


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def rounded_rect(d, rect, r, fill, outline=None):
    d.rounded_rectangle(rect, radius=r, fill=fill, outline=outline)


def draw_sparkle(d, cx, cy, ro, ri, fill, rot=0):
    pts = []
    for i in range(8):
        a = math.pi * i / 4 + rot
        r = ro if i % 2 == 0 else ri
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=fill)


def create_icon_image(size):
    s = size / 1024
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # ── 1. Dark navy background ───────────────────────────────
    rounded_rect(d, [(0,0),(size-1,size-1)], int(210*s), DARK_BG)

    # ── 2. Slide shadow ──────────────────────────────────────
    sm = int(68 * s)
    slide_l = sm
    slide_t = int(115 * s)
    slide_r = size - sm
    slide_b = int(818 * s)
    rounded_rect(d,
        [slide_l+int(5*s), slide_t+int(5*s), slide_r+int(5*s), slide_b+int(5*s)],
        int(26*s), fill=(0,0,0,100))

    # ── 3. White slide body ──────────────────────────────────
    rounded_rect(d,
        [slide_l, slide_t, slide_r, slide_b],
        int(26*s), fill=SLIDE_WHITE)

    # ── 4. Blue header bar ───────────────────────────────────
    bar_h = int(66 * s)
    bar_r = int(22 * s)
    rounded_rect(d,
        [slide_l, slide_t, slide_r, slide_t + bar_h],
        bar_r, fill=HEADER_BLUE)
    d.rectangle(
        [slide_l, slide_t + bar_h - bar_r, slide_r, slide_t + bar_h],
        fill=HEADER_BLUE)

    # ── 5. Title placeholder (white lines) ───────────────────
    ty = slide_t + bar_h // 2
    rounded_rect(d, 
        [slide_l+int(48*s), ty-int(4*s), slide_l+int(240*s), ty+int(4*s)],
        int(3*s), fill=(255,255,255,200))
    rounded_rect(d, 
        [slide_l+int(260*s), ty-int(4*s), slide_l+int(430*s), ty+int(4*s)],
        int(3*s), fill=(255,255,255,120))
    rounded_rect(d, 
        [slide_l+int(450*s), ty-int(4*s), slide_l+int(520*s), ty+int(4*s)],
        int(3*s), fill=(255,255,255,70))

    # ── 6. Subtle grid lines ─────────────────────────────────
    grid_l = slide_l + int(70 * s)
    grid_r = slide_r - int(70 * s)
    grid_top = slide_t + bar_h + int(36 * s)
    grid_bot = slide_b - int(40 * s)
    for i in range(1, 4):
        y = grid_top + (grid_bot - grid_top) * i // 4
        d.line([(grid_l, y), (grid_r, y)],
               fill=(180, 190, 210, 60), width=max(1, int(1*s)))

    # ── 7. Chart bars ────────────────────────────────────────
    bar_area_w = grid_r - grid_l
    n_bars = 6
    bar_w = int(34 * s)
    bar_gap = int(22 * s)
    bar_left_start = grid_l
    bar_bottom = grid_bot

    heights = [0.80, 0.50, 0.95, 0.65, 0.40, 0.75]
    for i, h_pct in enumerate(heights):
        x = bar_left_start + i * (bar_w + bar_gap)
        h_px = int((grid_bot - grid_top) * h_pct)
        y = bar_bottom - h_px
        alpha = 170 + int(70 * (1 - abs(h_pct - 0.65) / 0.55))
        rounded_rect(d, 
            [x, y, x + bar_w, bar_bottom],
            int(5*s), fill=BAR_BLUE + (min(alpha, 255),))

    # ── 8. Gold AI sparkle ───────────────────────────────────
    sp_cx = slide_r - int(90 * s)
    sp_cy = slide_t + bar_h + int(55 * s)
    draw_sparkle(d, sp_cx, sp_cy, int(36*s), int(14*s), GOLD)
    d.ellipse([sp_cx-int(58*s), sp_cy-int(58*s),
               sp_cx-int(44*s), sp_cy-int(44*s)], fill=GOLD)
    d.ellipse([sp_cx+int(42*s), sp_cy-int(42*s),
               sp_cx+int(56*s), sp_cy-int(28*s)], fill=GOLD)

    # ── 9. Footer accent strip ───────────────────────────────
    fh = int(20 * s)
    rounded_rect(d, 
        [slide_l+int(160*s), slide_b-fh, slide_r-int(160*s), slide_b],
        int(5*s), fill=HEADER_BLUE + (50,))

    # ── 10. Minimal stand ────────────────────────────────────
    st_top = slide_b
    st_bot = slide_b + int(58 * s)
    cx = size // 2
    leg_gap = int(140 * s)
    leg_w = int(18 * s)

    d.polygon([
        (cx - leg_gap - leg_w, st_bot), (cx - leg_gap, st_bot),
        (cx + leg_w//2, st_top), (cx - leg_w//2, st_top),
    ], fill=SLIDE_WHITE)
    d.polygon([
        (cx + leg_gap + leg_w, st_bot), (cx + leg_gap, st_bot),
        (cx - leg_w//2, st_top), (cx + leg_w//2, st_top),
    ], fill=STAND_LIGHT)

    base_w = int(320 * s)
    rounded_rect(d, 
        [cx-base_w//2, st_bot-int(4*s), cx+base_w//2, st_bot+int(10*s)],
        int(8*s), fill=SLIDE_WHITE)
    rounded_rect(d, 
        [cx-base_w//2+int(10*s), st_bot+int(6*s),
         cx+base_w//2-int(10*s), st_bot+int(12*s)],
        int(3*s), fill=(0,0,0,40))

    return im


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)

    print("Creating 1024x1024 master icon...")
    im_1024 = create_icon_image(1024)
    master_path = os.path.join(ICONS_DIR, 'icon_1024x1024.png')
    im_1024.save(master_path)
    print(f"  Saved {master_path}")

    sizes = {
        '512x512': 512,
        '256x256': 256,
        '128x128@2x': 256,
        '128x128': 128,
        '32x32': 32,
    }
    for name, sz in sizes.items():
        path = os.path.join(ICONS_DIR, f'{name}.png')
        im_1024.resize((sz, sz), Image.LANCZOS).save(path)
        print(f"  Saved {path} ({sz}x{sz})")

    # icon.ico
    print("\nCreating icon.ico...")
    ico_sizes = [256, 128, 64, 48, 32, 16]
    ico_imgs = [im_1024.resize((s, s), Image.LANCZOS) for s in ico_sizes]
    ico_path = os.path.join(ICONS_DIR, 'icon.ico')
    ico_imgs[0].save(ico_path, format='ICO', sizes=[(s,s) for s in ico_sizes],
                     append_images=ico_imgs[1:])
    print(f"  Saved {ico_path}")

    # icon.icns via iconset
    print("\nCreating icon.icns...")
    iconset_dir = os.path.join(ICONS_DIR, 'ppt-agent.iconset')
    os.makedirs(iconset_dir, exist_ok=True)
    iconset_map = {
        'icon_16x16.png': 16, 'icon_16x16@2x.png': 32,
        'icon_32x32.png': 32, 'icon_32x32@2x.png': 64,
        'icon_128x128.png': 128, 'icon_128x128@2x.png': 256,
        'icon_256x256.png': 256, 'icon_256x256@2x.png': 512,
        'icon_512x512.png': 512, 'icon_512x512@2x.png': 1024,
    }
    for name, sz in iconset_map.items():
        path = os.path.join(iconset_dir, name)
        im_1024.resize((sz, sz), Image.LANCZOS).save(path)

    icns_path = os.path.join(ICONS_DIR, 'icon.icns')
    result = subprocess.run(
        ['iconutil', '-c', 'icns', iconset_dir, '-o', icns_path],
        capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  Saved {icns_path}")
    else:
        print(f"  iconutil error: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    shutil.rmtree(iconset_dir, ignore_errors=True)
    os.remove(master_path)
    for name in ['512x512.png', '256x256.png']:
        p = os.path.join(ICONS_DIR, name)
        if os.path.exists(p):
            os.remove(p)

    print("\nDone! Icons regenerated.")
    print(f"\nFiles in {ICONS_DIR}:")
    for f in sorted(os.listdir(ICONS_DIR)):
        fp = os.path.join(ICONS_DIR, f)
        print(f"  {f:30s} {os.path.getsize(fp):>8d} bytes")


if __name__ == '__main__':
    main()
