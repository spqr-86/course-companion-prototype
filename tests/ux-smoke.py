"""Browser regressions for the reading, navigation and dialog UX."""
# ANCHOR: Check an HTTP-served prototype in disposable contexts; never reset user data.
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CC_BASE_URL", "http://127.0.0.1:8876/")
CHROME = os.environ.get("CC_CHROME")
failures = []
ONBOARDED = "try { if (localStorage.getItem('cc-preview-0.4') === null) localStorage.setItem('cc-preview-0.4', JSON.stringify({onboarded: true})) } catch (e) {}"  # старые сценарии не видят онбординг; уже сохранённое состояние не затираем


def check(name, value):
    print(f"{'PASS' if value else 'FAIL'} {name}", flush=True)
    if not value:
        failures.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}))
    for width, theme in [(390, "light"), (1440, "light"), (390, "dark"), (1024, "light")]:
        context = browser.new_context(viewport={"width": width, "height": 844}, color_scheme=theme)
        context.add_init_script(ONBOARDED)
        page = context.new_page()
        prefix = f"{width}/{theme}"
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE + "#lecture-tools-mcp", wait_until="networkidle")
        page.wait_for_selector("#notes", state="attached")
        page.wait_for_timeout(300)
        check(prefix + " no page overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        if width == 390:
            check(prefix + " video in first screen", page.locator(".player").bounding_box()["y"] < 600)
            check(prefix + " materials below player", page.locator(".panel").bounding_box()["y"] < 1100)
        page.evaluate("location.hash='tools-mcp-notes'")
        page.wait_for_timeout(2200)
        check(prefix + " one reading mode", page.locator("#sec-video:visible, #sec-notes:visible, #sec-code:visible, #sec-codevideo:visible, #sec-lab:visible").count() == 1)
        if width <= 1180:
            check(prefix + " accessible table of contents", page.locator("#notes-jump").is_visible())
        plus = page.locator(".frag .frag-plus").first
        if width == 390:
            box = plus.bounding_box()
            check(prefix + " fragment touch target", box["width"] >= 44 and box["height"] >= 44)
        # Natural keyboard sequence after closing the chat.
        page.locator("[data-open-chat]:visible").first.click()
        page.wait_for_timeout(400)
        page.locator("#chat-close").click()
        page.keyboard.press("Tab")
        check(prefix + " closed chat excluded from keyboard", page.evaluate("!document.activeElement.closest('#chat')"))
        page.evaluate("location.hash='tools-mcp-lab'")
        page.wait_for_timeout(2200)
        tab = page.locator(".localnav [data-sec=lab]").bounding_box()
        check(prefix + " selected tab fully visible", tab["x"] >= 0 and tab["x"] + tab["width"] <= width)
        if width == 390:
            check(prefix + " scenario before simulation", page.locator(".lab-side").bounding_box()["y"] < page.locator(".lab-main").bounding_box()["y"])
        page.locator("[data-order-lab=L02]").last.click()
        page.wait_for_timeout(400)
        check(prefix + " plan starts at title", page.locator("#plan-title").bounding_box()["y"] >= 0)
        page.locator("[data-plan-act=confirm]").focus()
        page.keyboard.press("Tab")
        check(prefix + " dialog contains keyboard focus", page.evaluate("!!document.activeElement.closest('#plan-modal')"))
        page.keyboard.press("Escape")
        check(prefix + " dialog closes with Escape", not page.locator("#plan-modal").is_visible())
        check(prefix + " no Javascript errors", not errors)
        context.close()

    # Онбординг: чистый контекст, одно окно с плашкой демо.
    PILL = "Это демо-превью. Ответы ИИ заготовлены заранее, проверка ответов — упрощённая заглушка. Сохраняется только в этом браузере"
    for width in (390, 1440):
        context = browser.new_context(viewport={"width": width, "height": 844})
        page = context.new_page()
        prefix = f"onboarding {width}"
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE + "#library", wait_until="networkidle")
        modal = page.locator("#onb-modal")
        check(prefix + " visible at first visit", modal.is_visible())
        check(prefix + " contains demo pill verbatim", PILL in modal.inner_text())
        check(prefix + " no page overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        for _ in range(8):
            page.keyboard.press("Tab")
            if not page.evaluate("!!document.activeElement.closest('#onb-modal')"):
                break
        check(prefix + " Tab stays inside", page.evaluate("!!document.activeElement.closest('#onb-modal')"))
        page.keyboard.press("Escape")
        check(prefix + " Escape closes", not modal.is_visible())
        page.reload(wait_until="networkidle")
        check(prefix + " not shown after reload", not page.locator("#onb-modal").is_visible())
        if width == 390:
            page.locator("#menu-btn").click()
        page.locator("[data-open-onboarding]:visible").first.click()
        check(prefix + " reopens from menu", page.locator("#onb-modal").is_visible())
        page.locator("[data-onb=physics]").click()
        page.wait_for_timeout(200)
        check(prefix + " physics button sets hash", page.evaluate("location.hash") == "#physics")
        check(prefix + " physics button closes dialog", not page.locator("#onb-modal").is_visible())
        check(prefix + " no Javascript errors", not errors)
        context.close()
    browser.close()

if failures:
    raise SystemExit(f"{len(failures)} failed: " + ", ".join(failures))
