# Cuts assets/vehicles/panzerwerfer-42-RAW.png into the game atlas (source stays untouched).
# The sheet holds one Panzerwerfer 42 hull four times; only the launcher differs:
# frame 0 aims forward, 1 to the right, 2 backward, 3 to the left (relative to the hull).
# Every frame faces up, like the tank layers. Same approach as prepare-miner-sprites.py:
# near-transparent noise (alpha < 128) is cleared, resampled edges are kept hard.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'assets' / 'vehicles'
src = Image.open(root / 'panzerwerfer-42-RAW.png').convert('RGBA')
src.putalpha(src.getchannel('A').point(lambda v: 255 if v >= 128 else 0))

# Left edges of the four vehicles; every frame is 258x634 px, top at y=38 (measured bounding boxes).
LEFT = [143, 687, 1229, 1772]
FRAME = (64, 158)
out = Image.new('RGBA', (FRAME[0] * len(LEFT), FRAME[1]))
for i, x in enumerate(LEFT):
    out.paste(src.crop((x, 38, x + 258, 672)).resize(FRAME, Image.Resampling.LANCZOS), (i * FRAME[0], 0))
out.putalpha(out.getchannel('A').point(lambda v: 255 if v >= 110 else 0))
out.save(root / 'panzerwerfer-42.png')
print('Prepared panzerwerfer-42.png', out.size)
