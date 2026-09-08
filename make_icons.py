"""Generate FeedMiles icons: a road receding into the distance with a milestone marker,
on the indigo→pink brand gradient. Drawn with supersampling so it stays crisp at 16 px."""
from PIL import Image, ImageDraw, ImageFilter
import math

C1, C2 = (99, 102, 241), (236, 72, 153)   # indigo → pink

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(S):
    g = Image.new("RGBA", (S, S))
    px = g.load()
    for y in range(S):
        for x in range(S):
            t = (x * 0.6 + y * 1.0) / (1.6 * S)
            px[x, y] = lerp(C1, C2, t) + (255,)
    return g

def make(size, small=False):
    S = 512  # design canvas, downsampled at the end
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)
    img.paste(gradient(S), (0, 0), mask)
    d = ImageDraw.Draw(img)

    # --- horizon glow (soft, top area) ---
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([S * 0.15, S * 0.05, S * 0.85, S * 0.45], fill=(255, 255, 255, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.09))
    img.alpha_composite(glow)

    # --- road: perspective trapezoid, wider at bottom ---
    bottom_y = S * 0.92
    top_y = S * 0.30
    bw, tw = S * 0.66, S * 0.12  # bottom / top widths
    cx = S * 0.5
    road = [(cx - bw / 2, bottom_y), (cx + bw / 2, bottom_y), (cx + tw / 2, top_y), (cx - tw / 2, top_y)]
    d.polygon(road, fill=(255, 255, 255, 255))

    # road edge lines (subtle, brand-tinted) for definition
    edge = (120, 80, 220, 90)
    d.line([road[0], road[3]], fill=edge, width=int(S * 0.012))
    d.line([road[1], road[2]], fill=edge, width=int(S * 0.012))

    # --- centre dashes with perspective (bigger near bottom) ---
    n = 3 if small else 4
    ts = [0.06, 0.34, 0.62, 0.84][:n] if not small else [0.08, 0.42, 0.74]
    for t in ts:
        # t: 0 at bottom, 1 at top
        y0 = bottom_y - (bottom_y - top_y) * t
        length = (S * 0.13) * (1 - t) + S * 0.025
        y1 = y0 - length
        w = (S * 0.06) * (1 - t) + S * 0.012
        d.rounded_rectangle([cx - w / 2, y1, cx + w / 2, y0], radius=int(w / 2), fill=lerp(C1, C2, 0.35) + (255,))

    # --- milestone marker: pin at the top-right of the road ---
    px_, py_ = S * 0.72, S * 0.24
    r = S * 0.095
    # pin body (teardrop)
    pin = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pin)
    pd.ellipse([px_ - r, py_ - r, px_ + r, py_ + r], fill=(255, 255, 255, 255))
    pd.polygon([(px_ - r * 0.72, py_ + r * 0.62), (px_ + r * 0.72, py_ + r * 0.62), (px_, py_ + r * 1.9)], fill=(255, 255, 255, 255))
    # soft shadow under pin
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([px_ - r * 0.9, py_ + r * 1.6, px_ + r * 0.9, py_ + r * 2.3], fill=(40, 20, 90, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.02))
    img.alpha_composite(sh)
    img.alpha_composite(pin)
    # pin hole
    d.ellipse([px_ - r * 0.42, py_ - r * 0.42, px_ + r * 0.42, py_ + r * 0.42], fill=lerp(C1, C2, 0.85) + (255,))

    out = img.resize((size, size), Image.LANCZOS)
    return out

for s in (16, 32, 48, 128):
    make(s, small=(s <= 32)).save(f"icons/icon{s}.png")
make(512).save("icons/icon512.png")
print("icons written")
