"""Capture screenshots of Mundial Edge redesign at 375px and 1440px."""
from playwright.sync_api import sync_playwright
import os

BASE_URL = "https://mundial-edge-delta.vercel.app"
ROUTES = ["/", "/matches", "/edges"]
VIEWPORTS = [
    {"name": "mobile", "width": 375, "height": 812},
    {"name": "desktop", "width": 1440, "height": 900},
]
OUT_DIR = "screenshots"

os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    for vp in VIEWPORTS:
        context = browser.new_context(
            viewport={"width": vp["width"], "height": vp["height"]},
            color_scheme="dark",
        )
        page = context.new_page()

        for route in ROUTES:
            url = BASE_URL + route
            print(f"  [{vp['name']}] {url}")
            page.goto(url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(800)  # allow fonts to load

            slug = route.strip("/") or "home"
            path = f"{OUT_DIR}/{slug}_{vp['name']}_{vp['width']}px.png"
            page.screenshot(path=path, full_page=True)
            print(f"    saved {path}")

        context.close()

    browser.close()

print("\nDone.")
