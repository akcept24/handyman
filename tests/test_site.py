import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
JS = (ROOT / "script.js").read_text(encoding="utf-8")
CSS = (ROOT / "styles.css").read_text(encoding="utf-8")
THANK_YOU = (ROOT / "thank-you.html").read_text(encoding="utf-8")
PUBLIC_TEXT = "\n".join(
    path.read_text(encoding="utf-8")
    for path in [ROOT / "index.html", ROOT / "robots.txt", ROOT / "sitemap.xml"]
)
DOMAIN = "https://california-handymen.com"


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.assets = []
        self.forms = []
        self._form = None
        self.json_ld = []
        self._json_ld_buffer = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag in {"img", "script", "link"}:
            value = attrs.get("src") or attrs.get("href")
            if value:
                self.assets.append(value)
        if tag == "form":
            self._form = {"id": attrs.get("id"), "labels": 0, "controls": []}
            self.forms.append(self._form)
        if self._form and tag == "label":
            self._form["labels"] += 1
        if self._form and tag in {"input", "select", "textarea"}:
            if attrs.get("type") != "hidden":
                self._form["controls"].append(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self._json_ld_buffer = []

    def handle_endtag(self, tag):
        if tag == "form":
            self._form = None
        if tag == "script" and self._json_ld_buffer is not None:
            self.json_ld.append("".join(self._json_ld_buffer))
            self._json_ld_buffer = None

    def handle_data(self, data):
        if self._json_ld_buffer is not None:
            self._json_ld_buffer.append(data)


PARSER = SiteParser()
PARSER.feed(HTML)


class ProductionReadinessTests(unittest.TestCase):
    def test_public_urls_use_live_domain_and_canonical(self):
        self.assertNotIn("californiahandymanpro.com", PUBLIC_TEXT)
        self.assertIn(f'<link rel="canonical" href="{DOMAIN}/">', HTML)
        self.assertIn(f"Sitemap: {DOMAIN}/sitemap.xml", PUBLIC_TEXT)

    def test_no_demo_business_or_tracking_placeholders(self):
        forbidden = [
            "(888) 888-8888",
            "+188****8888",
            "123 Main Street",
            "GA_MEASUREMENT_ID",
            "YOUR_PIXEL_ID",
            "AW-CONVERSION_ID",
            "500+ Reviews",
            "BBB A+",
        ]
        source = HTML + JS
        for placeholder in forbidden:
            with self.subTest(placeholder=placeholder):
                self.assertNotIn(placeholder, source)

    def test_no_dead_hash_links(self):
        self.assertNotIn("#", [href.strip() for href in PARSER.links])
        for href in PARSER.links:
            if href.startswith("#"):
                self.assertIn(href[1:], PARSER.ids, f"Missing anchor target: {href}")

    def test_legal_pages_are_real_files(self):
        self.assertIn("privacy.html", PARSER.links)
        self.assertIn("terms.html", PARSER.links)
        self.assertTrue((ROOT / "privacy.html").is_file())
        self.assertTrue((ROOT / "terms.html").is_file())

    def test_every_form_requires_recorded_contact_consent(self):
        self.assertEqual(3, HTML.count('name="contact_consent" required'))
        self.assertEqual(3, HTML.count('name="consent_version" value="2026-08-20"'))
        server = (ROOT / "server.js").read_text(encoding="utf-8")
        self.assertIn("Please agree to the contact and website terms.", server)

    def test_unlicensed_status_and_minor_work_limits_are_disclosed(self):
        self.assertGreaterEqual(HTML.count("Not a licensed contractor."), 3)
        self.assertIn("under $1,000 total", HTML)
        self.assertIn("including labor and materials", HTML)
        self.assertIn("no building permit", HTML)
        self.assertIn("Larger projects cannot be divided", HTML)

    def test_service_area_is_limited_to_santa_clarita_and_valencia(self):
        self.assertIn("Santa Clarita", HTML)
        self.assertIn("Valencia", HTML)
        self.assertIn("Serving Santa Clarita, including Valencia.", HTML)
        data = json.loads(PARSER.json_ld[0])
        area_names = {area["name"] for area in data["areaServed"]}
        self.assertEqual({"Santa Clarita", "Valencia, Santa Clarita"}, area_names)

    def test_local_assets_exist(self):
        missing = []
        for asset in PARSER.assets:
            if asset.startswith(("http://", "https://", "data:")):
                continue
            clean = asset.split("?", 1)[0].lstrip("/")
            if clean and not (ROOT / clean).is_file():
                missing.append(asset)
        self.assertEqual([], missing)

    def test_production_photos_are_optimized_webp(self):
        image_paths = re.findall(r'<img[^>]+src="([^"]+)"', HTML)
        production_photos = [path for path in image_paths if "/images/generated/" in path]
        self.assertEqual(7, len(production_photos))
        self.assertEqual(7, len(set(production_photos)))
        for asset in production_photos:
            with self.subTest(asset=asset):
                self.assertTrue(asset.endswith(".webp"))
                path = ROOT / asset.lstrip("/")
                self.assertTrue(path.is_file())
                self.assertLess(path.stat().st_size, 150_000)

    def test_json_ld_is_valid_and_contains_no_fake_address(self):
        self.assertEqual(1, len(PARSER.json_ld))
        data = json.loads(PARSER.json_ld[0])
        self.assertEqual(f"{DOMAIN}/", data["url"])
        self.assertNotIn("address", data)
        self.assertNotIn("geo", data)
        self.assertNotIn("aggregateRating", data)

    def test_forms_have_accessible_labels(self):
        self.assertGreaterEqual(len(PARSER.forms), 1)
        for form in PARSER.forms:
            with self.subTest(form=form["id"]):
                self.assertGreaterEqual(form["labels"], len(form["controls"]))
                for control in form["controls"]:
                    self.assertTrue(control.get("id"), control)
                    self.assertTrue(control.get("name"), control)

    def test_form_submission_uses_real_network_request(self):
        self.assertRegex(JS, r"fetch\s*\(\s*API_ENDPOINT")
        self.assertRegex(JS, r"if\s*\(\s*!response\.ok\s*\)")
        self.assertNotIn("Promise.resolve({ success: true })", JS)
        self.assertNotIn("Simulate API", JS)
        self.assertIn("form_type: formType", JS)

    def test_confirmed_leads_redirect_to_conversion_page(self):
        self.assertTrue((ROOT / "thank-you.html").is_file())
        self.assertIn("window.location.assign('/thank-you.html')", JS)
        self.assertGreater(JS.index("payload.success !== true"), JS.index("response.ok"))
        self.assertGreater(JS.index("window.location.assign('/thank-you.html')"), JS.index("await submitToAPI"))
        self.assertIn('<meta name="robots" content="noindex,nofollow">', THANK_YOU)
        self.assertIn("Thank you! Your request was received.", THANK_YOU)
        self.assertIn("Not a licensed contractor.", THANK_YOU)
        self.assertIn("under $1,000 total", THANK_YOU)

    def test_content_is_visible_without_javascript(self):
        for selector in [".service-card", ".project-tile"]:
            match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", CSS, re.S)
            self.assertIsNotNone(match, selector)
            self.assertNotRegex(match.group(1), r"opacity\s*:\s*0\s*;")
        self.assertIn("@media (prefers-reduced-motion: reduce)", CSS)


if __name__ == "__main__":
    unittest.main()
