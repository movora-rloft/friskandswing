"""Screenshot the dev site for visual QA."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/"
OUT_DIR = "/home/harry/friskandswing/preview"

import os
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # Desktop full-page
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(700)  # let webfonts settle
    page.screenshot(path=f"{OUT_DIR}/desktop-full.png", full_page=True)
    page.screenshot(path=f"{OUT_DIR}/desktop-hero.png", full_page=False)
    print("Desktop screenshots done")
    ctx.close()

    # Mobile
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True)
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(700)
    page.screenshot(path=f"{OUT_DIR}/mobile-full.png", full_page=True)
    page.screenshot(path=f"{OUT_DIR}/mobile-hero.png", full_page=False)
    print("Mobile screenshots done")
    ctx.close()

    # Tablet
    ctx = browser.new_context(viewport={"width": 820, "height": 1180}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(700)
    page.screenshot(path=f"{OUT_DIR}/tablet-full.png", full_page=True)
    print("Tablet screenshot done")
    ctx.close()

    browser.close()

print("All done. Files:")
for f in sorted(os.listdir(OUT_DIR)):
    p = f"{OUT_DIR}/{f}"
    print(f"  {f}  {os.path.getsize(p)/1024:.0f} KB")
