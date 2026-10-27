"""Build original geometric tennis animations; no third-party imagery or requests."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import base64, io, json, math
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 28)
items = []
choices = [
 ('nice-shot', 'Nice shot!', 'Respect', 'winner volley point', 'arc'),
 ('lets-go', "Let's go!", 'Hype', 'ready pumped cheer', 'bounce'),
 ('good-game', 'Good game!', 'Respect', 'gg thanks sportsmanship', 'pair'),
 ('ace', 'Ace!', 'Hype', 'serve winner point', 'serve'),
 ('on-fire', 'On fire!', 'Hype', 'hot streak winning', 'fire'),
 ('match-point', 'Match point', 'Match day', 'focus clutch finish', 'target'),
 ('you-got-this', 'You got this!', 'Hype', 'encourage confidence support', 'rise'),
 ('my-bad', 'My bad!', 'Respect', 'sorry oops miss', 'wobble'),
 ('rain-check', 'Rain check?', 'Match day', 'weather rain reschedule', 'rain'),
 ('court-time', 'Court time!', 'Match day', 'practice warmup ready play', 'court'),
 ('what-a-rally', 'What a rally!', 'Respect', 'rally amazing wow doubles', 'rally'),
 ('team-win', 'Team win!', 'Hype', 'celebrate victory team trophy', 'confetti'),
]
def ball(draw, x, y, radius=18):
 draw.ellipse((x-radius,y-radius,x+radius,y+radius), fill='#b8ed36', outline='#dcff8a', width=2)
 draw.arc((x-radius*1.7,y-radius*.9,x-radius*.2,y+radius*.9),-85,85,fill='white',width=3)
 draw.arc((x+radius*.2,y-radius*.9,x+radius*1.7,y+radius*.9),95,265,fill='white',width=3)
for key, label, category, tags, motion in choices:
 frames = []
 for i in range(24):
  t = i * math.tau / 24
  frame = Image.new('RGB',(280,180),'#081d35'); d=ImageDraw.Draw(frame)
  d.rounded_rectangle((7,7,272,172),radius=18,outline='#285c87',width=2)
  d.line([(12,148),(268,148)],fill='#3c85c4',width=2)
  d.text((140,23),label,font=font,fill='#f4f8ff',anchor='mt')
  x,y=140+int(55*math.sin(t)),116-int(26*abs(math.sin(t)))
  if motion=='arc': x,y=140+int(88*math.sin(t)),118-int(34*abs(math.cos(t)))
  elif motion=='pair':
   gap=32+int(12*(1+math.cos(t))); ball(d,140-gap,112,16);x,y=140+gap,112
  elif motion=='serve':
   x,y=35+int(210*i/24),137-int(60*math.sin(math.pi*i/24));d.line((x-24,y+7,x-50,y+15),fill='#55b9ff',width=3)
  elif motion=='fire':
   x,y=140,111-int(12*math.sin(t));
   for j in range(5):
    dx=(j-2)*12;dy=int(8*math.sin(t+j));d.polygon([(x+dx-9,y+10),(x+dx,y-38+dy),(x+dx+9,y+10)],fill='#ff9f38')
  elif motion=='target':
   x,y=140,111
   for radius in [35+int(4*math.sin(t)),49+int(4*math.sin(t))]: d.ellipse((x-radius,y-radius,x+radius,y+radius),outline='#3c85c4',width=2)
  elif motion=='rise':
   x,y=140,117-int(20*abs(math.sin(t)));d.line((75,132,100,106,119,124,164,80,204,102),fill='#55b9ff',width=4)
  elif motion=='wobble': x,y=140+int(19*math.sin(t*2)),121-int(8*abs(math.sin(t)))
  elif motion=='rain':
   x,y=140,125
   for j in range(12):
    rx=30+(j*19)%220;ry=68+(j*13+i*5)%60;d.line((rx,ry,rx-4,ry+10),fill='#55b9ff',width=2)
  elif motion=='court':
   d.rectangle((45,78,235,143),outline='#55b9ff',width=2);d.line((140,78,140,143),fill='#f4f8ff',width=2);x,y=140+int(60*math.sin(t)),109
  elif motion=='rally':
   x,y=140+int(90*math.sin(t)),110-int(20*abs(math.cos(t)));d.line((140,78,140,145),fill='#55b9ff',width=2)
  elif motion=='confetti':
   x,y=140,114-int(10*abs(math.sin(t)))
   for j in range(18):
    cx=22+(j*37)%235;cy=64+(j*23+i*4)%85;d.rectangle((cx,cy,cx+4,cy+6),fill=['#55b9ff','#b8ed36','#f4f8ff'][j%3])
  d.ellipse((x-17,150,x+17,155),fill='#102c47');ball(d,x,y);frames.append(frame)
 out=io.BytesIO();frames[0].save(out,format='GIF',save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True,disposal=2)
 preview=io.BytesIO();frames[0].save(preview,format='PNG')
 items.append({'id':key,'label':label,'category':category,'tags':tags,'base64':base64.b64encode(out.getvalue()).decode(),'preview':'data:image/png;base64,'+base64.b64encode(preview.getvalue()).decode()})
Path(__file__).resolve().parents[1].joinpath('src/chat-gif-library.json').write_text(json.dumps(items,separators=(',',':'))+'\n',encoding='utf-8')
print('Original GIF pack:',[(x['id'],len(base64.b64decode(x['base64']))) for x in items])
