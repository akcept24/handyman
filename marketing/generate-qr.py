"""Generate print-safe QR assets for the California Handyman furniture campaign."""
from pathlib import Path
import qrcode

OUT = Path(__file__).resolve().parent / "offline" / "assets"
OUT.mkdir(parents=True, exist_ok=True)
URL = "https://california-handymen.com/?service=furniture-assembly&utm_source=offline&utm_medium=print&utm_campaign=furniture-assembly-scv"

qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=12,
    border=4,
)
qr.add_data(URL)
qr.make(fit=True)
qr.make_image(fill_color="#111827", back_color="white").save(OUT / "furniture-assembly-scv-qr.png")

print(f"Generated {OUT / 'furniture-assembly-scv-qr.png'}")
print(URL)
