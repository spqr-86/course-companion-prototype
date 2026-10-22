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

    # Заявки на генерацию — в закрытом архиве; лаборатории и code-video остаются видны.
    BADGE = "Уходит в архив, в MVP-0 нет"
    for width in (390, 1440):
        context = browser.new_context(viewport={"width": width, "height": 844})
        context.add_init_script(ONBOARDED)
        page = context.new_page()
        prefix = f"archive {width}"
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE + "#tools-mcp-notes", wait_until="networkidle")
        page.wait_for_timeout(1500)
        if width == 390:
            page.locator("#menu-btn").click()
        arch = page.locator("#side-nav details.side-archive")
        check(prefix + " side archive closed by default", arch.count() == 1 and not arch.evaluate("d => d.open"))
        check(prefix + " side archive holds requests", arch.locator("a[href='#course-requests']").count() == 1)
        check(prefix + " badge text verbatim", BADGE in arch.locator("summary").inner_text())
        check(prefix + " requests link hidden while closed", not arch.locator("a[href='#course-requests']").is_visible())
        check(prefix + " labs group visible", page.locator("#side-nav a[href='#tools-mcp-lab']").is_visible())
        if width == 390:
            page.evaluate("document.querySelector('#scrim').click()")
        check(prefix + " localnav lab visible", page.locator(".localnav [data-sec=lab]").is_visible())
        page.evaluate("location.hash='course-shad'")
        page.wait_for_timeout(500)
        carch = page.locator(".ctabs details.side-archive")
        check(prefix + " course archive closed", carch.count() == 1 and not carch.evaluate("d => d.open"))
        check(prefix + " course badge verbatim", BADGE in carch.locator("summary").inner_text())
        check(prefix + " no Javascript errors", not errors)
        context.close()

    # Code-video: необязательный вопрос перед шагом «Выполнение».
    context = browser.new_context(viewport={"width": 1024, "height": 800})
    context.add_init_script(ONBOARDED)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "#tools-mcp-codevideo", wait_until="networkidle")
    page.wait_for_timeout(1500)
    ask = page.locator(".cv-ask")
    check("cv-ask hidden at start", not ask.is_visible())
    page.locator("[data-step='3']").click()
    check("cv-ask not before step 4", not ask.is_visible())
    page.locator("#cv-speed").select_option("2")
    page.locator("[data-cv=play]").click()
    try:
        ask.wait_for(state="visible", timeout=9000)
    except Exception:
        pass
    check("cv-ask visible at step 4", ask.is_visible())
    check("cv-ask question verbatim", "Где выполняется cancel_booking?" in ask.inner_text())
    check("cv-ask paused on step 3/4 border", page.locator(".cv-caption .step-n").inner_text() == "4 / 6")
    ask.locator("[data-ask-skip]").click()
    check("cv-ask hidden after skip", not ask.is_visible())
    t0 = page.locator(".cv-time").inner_text()
    page.wait_for_timeout(1500)
    check("cv playback continues after skip", page.locator(".cv-time").inner_text() != t0)
    page.locator("[data-step='3']").click()
    page.locator("[data-step='4']").click()
    check("cv-ask not shown twice", not ask.is_visible())
    # ответ: пояснение и продолжение с шага «Выполнение» (новый контекст страницы, чтобы вопрос снова был доступен)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(800)
    page.locator("[data-step='4']").click()
    check("cv-ask visible on direct step 4", ask.is_visible())
    ask.locator("[data-ask='tools']").click()
    check("cv-ask explanation visible", ask.is_visible() and "ToolNode" in ask.inner_text())
    page.locator("[data-ask-continue]").click()
    check("cv-ask closes on continue", not ask.is_visible())
    check("cv-ask continues from step 4", page.locator(".cv-caption .step-n").inner_text() == "4 / 6")
    check("cv-ask no Javascript errors", not errors)
    context.close()

    # Автопродолжение вопроса не переживает ручной запуск и уход из раздела.
    def secs(pg):
        m, sec = pg.locator(".cv-time").inner_text().split(" / ")[0].split(":")
        return int(m) * 60 + int(sec)
    context = browser.new_context(viewport={"width": 1024, "height": 800})
    context.add_init_script(ONBOARDED)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "#tools-mcp-codevideo", wait_until="networkidle")
    page.wait_for_timeout(1000)
    ask = page.locator(".cv-ask")
    page.locator("[data-step='3']").click()
    page.locator("[data-cv=play]").click()
    ask.wait_for(state="visible", timeout=12000)
    page.locator("[data-cv=play]").click()  # «Смотреть» при открытом вопросе
    page.wait_for_timeout(11000)  # дольше таймера автопродолжения
    t1 = secs(page)
    page.wait_for_timeout(3000)
    dt = secs(page) - t1
    check("cv-ask manual play + timer: single tick chain (1x)", 2 <= dt <= 4)
    check("cv-ask manual play: no Javascript errors", not errors)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(800)
    page.locator("[data-step='3']").click()
    page.locator("[data-cv=play]").click()
    ask.wait_for(state="visible", timeout=12000)
    page.evaluate("location.hash='tools-mcp-notes'")
    page.wait_for_timeout(500)
    t0 = page.locator(".cv-time").inner_text()
    page.wait_for_timeout(11000)
    check("cv-ask leaving section: no resume in hidden section", page.locator(".cv-time").inner_text() == t0)
    context.close()

    # Лаба в режиме «Проверить себя»: без горизонтального скролла на 390.
    context = browser.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
    context.add_init_script(ONBOARDED)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "#tools-mcp-lab", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.locator("[data-group=mode] [data-v=check]").click()
    check("lab check 390: no page overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    page.locator("[data-pred='2 и 1']").click()
    page.locator("[data-lab=run]").click()
    page.locator("[data-lab=run] span").filter(has_text="Заново").wait_for(timeout=20000)
    check("lab check 390 after run: no page overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check("lab check 390: no Javascript errors", not errors)
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
        page.keyboard.press("Escape")
        check(prefix + " sidebar drawer closed after reopen", not page.evaluate("document.querySelector('#side').classList.contains('open')"))
        if width == 390:
            page.locator("#menu-btn").click()
        page.locator("[data-open-onboarding]:visible").first.click()
        page.locator("#onb-modal [data-onb=shad]").click()
        page.wait_for_timeout(200)
        check(prefix + " shad button sets hash", page.evaluate("/^#(lecture|tools-mcp)/.test(location.hash)"))  # лекция сама уточняет хэш до раздела
        if width == 390:
            page.locator("#menu-btn").click()
        page.locator("[data-open-onboarding]:visible").first.click()
        page.locator("#onb-modal [data-onb=physics]").click()
        page.wait_for_timeout(200)
        check(prefix + " physics button sets hash", page.evaluate("location.hash") == "#physics")
        check(prefix + " physics button closes dialog", not page.locator("#onb-modal").is_visible())
        check(prefix + " no Javascript errors", not errors)
        context.close()
    # Прямая ссылка на лекцию в чистом контексте: окно один раз, хэш не меняется.
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "#lecture-tools-mcp", wait_until="networkidle")
    check("onboarding deep link: modal shown", page.locator("#onb-modal").is_visible())
    page.locator("[data-onb-close]").click()
    check("onboarding deep link: stays on lecture hash after close", page.evaluate("/^#(lecture|tools-mcp)/.test(location.hash)"))  # лекция сама уточняет хэш до раздела
    check("onboarding deep link: lecture stays", page.locator("#notes").count() > 0)
    page.reload(wait_until="networkidle")
    check("onboarding deep link: not shown again", not page.locator("#onb-modal").is_visible())
    check("onboarding deep link: no Javascript errors", not errors)
    context.close()
    browser.close()

if failures:
    raise SystemExit(f"{len(failures)} failed: " + ", ".join(failures))
