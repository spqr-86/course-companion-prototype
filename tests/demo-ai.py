"""Check that all required static demo answers were generated (Task 9)."""
# ANCHOR: Shared browser assertion also included in learning-flow.py; no model calls.
import os
from playwright.sync_api import sync_playwright
from preview04_extra import demo_ai_data

BASE=os.environ.get('CC_BASE_URL','http://127.0.0.1:8765/')
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page()
    page.add_init_script("localStorage.setItem('cc-preview-0.4',JSON.stringify({onboarded:true}))")
    demo_ai_data(page, BASE)
    browser.close()
