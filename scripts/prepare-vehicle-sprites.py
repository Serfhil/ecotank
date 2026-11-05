import sys, os
from pathlib import Path
workspace=Path(__file__).resolve().parents[2]
os.chdir(workspace)
sys.path.insert(0,str(__import__('pathlib').Path('.tools/pillow').resolve()))
from PIL import Image, ImageDraw, ImageChops
from pathlib import Path
import json
out=Path('ecotank/assets/vehicles');out.mkdir(parents=True,exist_ok=True)
# Explicit source pivots/contours from the inspected reference PNGs; source files stay untouched.
specs={
 't34-player':dict(box=(303,407,873,1305),body=[(386,420),(792,420),(794,1297),(386,1297)],turret=[(550,523),(626,523),(690,602),(718,728),(706,849),(652,920),(522,920),(462,847),(456,700),(489,596)],gun=(550,16,632,581),track=(303,441,385,1298),color=(119,128,44)),
 'is2-player':dict(box=(219,477,808,1485),body=[(271,479),(753,479),(753,1468),(271,1468)],turret=[(491,601),(565,601),(668,652),(714,786),(679,945),(593,1026),(430,1030),(352,967),(324,843),(346,692),(416,633)],gun=(476,31,551,689),track=(219,518,272,1478),color=(126,135,55)),
 'is2-ii-player':dict(box=(138,466,888,1468),body=[(194,469),(830,469),(830,1459),(194,1459)],turret=[(423,574),(594,574),(723,646),(775,779),(733,933),(640,1018),(390,1019),(277,945),(248,808),(284,665)],gun=(423,108,497,685),track=(138,513,194,1453),color=(125,135,55)),
 'pzkpfw-iii-scout':dict(box=(300,339,911,1255),body=[(355,341),(846,341),(850,1235),(355,1235)],turret=[(501,489),(688,490),(784,549),(780,840),(693,898),(503,898),(420,839),(418,569)],gun=(565,22,641,500),track=(303,419,355,1243),color=(121,132,145)),
 'panther-soldier':dict(box=(316,339,862,1280),body=[(369,342),(807,342),(809,1264),(369,1264)],turret=[(514,503),(663,503),(722,604),(770,744),(719,837),(467,840),(404,744),(451,590)],gun=(548,24,624,541),track=(316,367,369,1269),color=(123,134,146)),
 'tiger-heavy':dict(box=(294,294,908,1280),body=[(352,298),(848,298),(848,1259),(352,1259)],turret=[(525,524),(674,524),(746,578),(785,709),(728,870),(669,926),(504,926),(429,852),(411,719),(458,579)],gun=(565,17,646,566),track=(294,326,352,1259),color=(129,139,150)),
 'ferdinand-artillery':dict(box=(230,260,890,1370),body=[(274,265),(841,265),(841,1340),(274,1340)],turret=None,gun=(518,28,607,758),track=(231,316,275,1344),color=(178,151,86))}
for name,s in specs.items():
 src=Image.open(Path('output/imagegen')/(name+'-sprite.png')).convert('RGBA');w,h=src.size
 # Exact masks remove all outer halo, including glow with high alpha around the IS variants.
 mask=Image.new('L',src.size);d=ImageDraw.Draw(mask);d.polygon(s['body'],fill=255)
 hull=Image.new('RGBA',src.size);hull.paste(src,(0,0),mask)
 hd=ImageDraw.Draw(hull)
 if s['turret']:
  hd.polygon(s['turret'],fill=s['color']+(255,))
  xs=[x for x,y in s['turret']];ys=[y for x,y in s['turret']];cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
  hd.ellipse((cx-95,cy-95,cx+95,cy+95),outline=tuple(max(0,c-35) for c in s['color'])+(255,),width=8)
 # Remove the old barrel still crossing the front deck.
 gx0,gy0,gx1,gy1=s['gun'];top=s['box'][1]
 hd.rectangle((gx0,top,gx1,min(gy1,max(y for x,y in s['turret']) if s['turret'] else gy1)),fill=s['color']+(255,))
 # Hull pixels outside its silhouette are always transparent.
 hull.putalpha(ImageChops.multiply(hull.getchannel('A'),mask))
 hull.crop(s['box']).resize((192,224),Image.Resampling.LANCZOS).save(out/(name+'-hull.png'))
 if s['turret']:
  m=Image.new('L',src.size);ImageDraw.Draw(m).polygon(s['turret'],fill=255);layer=Image.new('RGBA',src.size);layer.paste(src,(0,0),m)
  xs=[x for x,y in s['turret']];ys=[y for x,y in s['turret']];layer.crop((min(xs),min(ys),max(xs)+1,max(ys)+1)).resize((128,128),Image.Resampling.LANCZOS).save(out/(name+'-turret.png'))
 gun=src.crop(s['gun']);a=gun.getchannel('A').point(lambda v:255 if v>140 else 0);gun.putalpha(a);gun.resize((36,192),Image.Resampling.LANCZOS).save(out/(name+'-gun.png'))
 track=src.crop(s['track']).resize((24,224),Image.Resampling.LANCZOS);track.putalpha(track.getchannel('A').point(lambda v:255 if v>140 else 0))
 atlas=Image.new('RGBA',(24,896))
 for phase in range(4):atlas.paste(ImageChops.offset(track,0,phase*4),(0,phase*224))
 atlas.save(out/(name+'-tracks.png'))
print('Prepared',len(list(out.glob('*.png'))),'RGBA layers; original sources unchanged.')
