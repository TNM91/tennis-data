"""Build three original tennis chat animations; no third-party images or services."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import base64, io, json, math
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',30)
items=[]
for key,label in [('nice-shot','Nice shot!'),('lets-go',"Let\'s go!"),('good-game','Good game!')]:
 frames=[]
 for i in range(24):
  frame=Image.new('RGB',(280,180),'#081d35');d=ImageDraw.Draw(frame)
  d.line([(0,145),(280,145)],fill='#3c85c4',width=3)
  d.text((140,28),label,font=font,fill='#f4f8ff',anchor='mt')
  x=140+int(55*math.sin(i*math.tau/24));y=112-int(28*abs(math.sin(i*math.tau/24)))
  d.ellipse((x-20,149,x+20,155),fill='#102c47')
  d.ellipse((x-20,y-20,x+20,y+20),fill='#b8ed36',outline='#dcff8a',width=2)
  d.arc((x-35,y-18,x-4,y+18),-85,85,fill='#ffffff',width=3)
  d.arc((x+4,y-18,x+35,y+18),95,265,fill='#ffffff',width=3)
  frames.append(frame)
 out=io.BytesIO();frames[0].save(out,format='GIF',save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True,disposal=2)
 preview=io.BytesIO();frames[0].save(preview,format='PNG')
 items.append({'id':key,'label':label,'base64':base64.b64encode(out.getvalue()).decode(),'preview':'data:image/png;base64,'+base64.b64encode(preview.getvalue()).decode()})
Path(__file__).resolve().parents[1].joinpath('src/chat-gif-library.json').write_text(json.dumps(items,separators=(',',':'))+'\n',encoding='utf-8')
print('Built original tennis GIFs:',[(x['id'],len(x['base64'])) for x in items])
