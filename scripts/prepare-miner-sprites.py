# Cuts assets/vehicles/suiside-and-motocycle-RAW.png into game atlases (source stays untouched).
# Rows of the source sheet: suicide bomber walk (4), motorcycle drive (4), motorcycle mine drop (4),
# mine / trigger / explosion / smoke (4). Every frame faces up, like the tank layers.
# The sheet has a near-transparent noise background and a faint red halo: alpha < 128 is cleared.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'assets' / 'vehicles'
src = Image.open(root / 'suiside-and-motocycle-RAW.png').convert('RGBA')
alpha = src.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
src.putalpha(alpha)

def atlas(name, boxes, size):
    out = Image.new('RGBA', (size[0] * len(boxes), size[1]))
    for i, box in enumerate(boxes):
        out.paste(src.crop(box).resize(size, Image.Resampling.LANCZOS), (i * size[0], 0))
    # Keep pixel-art edges hard after resampling.
    out.putalpha(out.getchannel('A').point(lambda v: 255 if v >= 110 else 0))
    out.save(root / name)

def centered(cx, cy, w, h):
    return (cx - w // 2, cy - h // 2, cx - w // 2 + w, cy - h // 2 + h)

# Bomber: fixed 240x240 frames centred on each figure (pivot = body centre).
bomber = [(52, 61, 293, 269), (360, 58, 583, 278), (649, 58, 883, 268), (954, 58, 1182, 277)]
atlas('suicide-bomber.png', [centered((x0 + x1) // 2, 165, 240, 240) for x0, y0, x1, y1 in bomber], (64, 64))

# Motorcycle: frames anchored on the motorcycle's left edge and row top so the body never jitters;
# the frame is wide enough for the mine dropped beside the sidecar.
moto_left = [89, 388, 685, 984]
drive = [(x - 6, 318, x + 234, 618) for x in moto_left]
drop = [(x - 6, 632, x + 234, 932) for x in moto_left]
atlas('motorcycle-miner.png', drive + drop, (80, 100))

# Mine and its explosion, centred on the mine.
atlas('mine.png', [centered(168, 1096, 240, 240), centered(469, 1093, 240, 240), centered(764, 1087, 240, 240), centered(1065, 1086, 240, 240)], (64, 64))
print('Prepared suicide-bomber.png, motorcycle-miner.png, mine.png')
