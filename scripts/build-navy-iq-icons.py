from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / 'public' / 'brand' / 'icons'
SOURCE = ROOT / 'public' / 'brand' / 'social' / 'social-profile-1080.png'
NAVY = (6, 23, 47, 255)


def square_canvas(size: int, scale: float) -> Image.Image:
    source = Image.open(SOURCE).convert('RGBA')
    alpha = source.getchannel('A')
    bbox = alpha.getbbox() or (0, 0, source.width, source.height)
    artwork = source.crop(bbox)
    artwork.thumbnail((round(size * scale), round(size * scale)), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (size, size), NAVY)
    x = (size - artwork.width) // 2
    y = (size - artwork.height) // 2
    canvas.alpha_composite(artwork, (x, y))
    return canvas


standard_sizes = {
    'app-icon-1024.png': (1024, 0.88),
    'apple-touch-icon.png': (180, 0.86),
    'favicon-16.png': (16, 0.92),
    'favicon-32.png': (32, 0.92),
    'favicon-256.png': (256, 0.90),
    'favicon-512.png': (512, 0.90),
    'pwa-192.png': (192, 0.84),
    'pwa-512.png': (512, 0.84),
}

for filename, (size, scale) in standard_sizes.items():
    square_canvas(size, scale).convert('RGB').save(ICON_DIR / filename, optimize=True)

maskable = square_canvas(512, 0.68)
maskable.convert('RGB').save(ICON_DIR / 'pwa-maskable-512.png', optimize=True)

favicon_frames = [square_canvas(size, 0.92) for size in (16, 32, 48)]
favicon_frames[0].save(
    ICON_DIR / 'favicon.ico',
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=favicon_frames[1:],
)

favicon_frames[0].save(
    ROOT / 'app' / 'favicon.ico',
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=favicon_frames[1:],
)
