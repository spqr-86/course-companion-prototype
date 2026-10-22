"""End-to-end learning and customization checks for the static prototype."""
# ANCHOR: Covers cross-mode links, saved edits and L02; contexts are disposable.
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("CC_BASE_URL", "http://127.0.0.1:8876/")
CHROME = os.environ.get("CC_CHROME")
OUT = Path(os.environ.get("CC_SCREENSHOTS", "/tmp/cc-ux-03"))
OUT.mkdir(parents=True, exist_ok=True)

def learn_unit(page):
    """Unit-проверки ядра Learn (без DOM): заглушка проверки, статусы, хранение."""
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.removeItem('cc-preview-0.4')")
    page.reload(wait_until="networkidle")
    R = {"minWords": 15, "concepts": [["инерция", "инертн"], ["равнодействующ", "сумма сил"]]}
    g = lambda t: page.evaluate("([t, r]) => Learn.grade(t, r)", [t, R])
    assert g("")["reason"] == "short"
    assert g("   ")["reason"] == "short"
    assert g("тело сохраняет скорость")["reason"] == "short"
    # 15+ слов без обоих понятий
    none = g("тело сохраняет свою скорость пока на него ничего не действует и это очень важно для понимания законов движения")
    assert none["reason"] == "missing" and none["missing"] == ["инерция", "равнодействующ"], none
    # есть «равнодействующая», нет инерции -> missing == ["инерция"]
    one = g("тело движется равномерно когда равнодействующая сил равна нулю и это очень важно для понимания законов движения тел")
    assert one["reason"] == "missing" and one["missing"] == ["инерция"], one
    # формы слов: «инерцией», «равнодействующая»
    ok = g("по закону движения тело сохраняет скорость за счёт инерцией пока равнодействующая сил равна нулю и это важно")
    assert ok["ok"] is True and ok["reason"] == "ok", ok
    cn = lambda s: page.evaluate("(s) => Learn.checkNumber(s, 2.5, 0.05)", s)
    assert cn("2,5") and cn("2.5 м/с²")
    assert not cn("3") and not cn("")
    page.evaluate("Learn.setStatus('shad:1','self'); Learn.setStatus('shad:1','seen')")
    assert page.evaluate("Learn.state().status['shad:1']") == "self"
    assert page.evaluate("Learn.key('shad', 4)") == "shad:4"
    assert page.evaluate("Learn.progress('shad', [1, 2])") == {"self": 1, "total": 2}
    assert page.evaluate("Learn.state().last") is None
    page.evaluate("Learn.touch({lecture:'shad',unit:4,kind:'section',route:'lecture-tools-mcp'})")
    page.reload(wait_until="networkidle")
    assert page.evaluate("Learn.state().last.unit") == 4
    assert page.evaluate("Learn.state().status['shad:1']") == "self"
    page.evaluate("localStorage.setItem('cc-preview-0.4', '{bad')")
    page.reload(wait_until="networkidle")
    assert page.evaluate("Learn.state().status") == {}
    assert not errors, errors
    print("PASS learn_unit", flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}))
    unit_ctx = browser.new_context(viewport={"width": 1024, "height": 800})
    learn_unit(unit_ctx.new_page())
    unit_ctx.close()
    for width, theme in [(390, "light"), (1440, "light"), (390, "dark")]:
        if os.environ.get("CC_ONLY") and os.environ["CC_ONLY"] != f"{width}-{theme}":
            continue
        context = browser.new_context(viewport={"width": width, "height": 844}, color_scheme=theme)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        prefix = f"{width}-{theme}"

        def shot(name):
            page.screenshot(path=str(OUT / f"{prefix}-{name}.png"))

        def settle_scroll():
            page.evaluate("""() => new Promise(resolve => {
                let previous = scrollY, stable = 0, frames = 0;
                const tick = () => {
                    stable = Math.abs(scrollY - previous) < 1 ? stable + 1 : 0;
                    previous = scrollY;
                    if (stable >= 8 || frames++ > 180) resolve();
                    else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            })""")

        def navigate(mode):
            page.evaluate("(mode) => location.hash = 'tools-mcp-' + mode", mode)
            page.wait_for_timeout(350)
            expect(page.locator("#sec-" + mode)).to_be_visible()

        page.goto(BASE, wait_until="networkidle")
        shot("library")
        expect(page.locator("#side-nav .k")).to_have_count(0)
        page.locator("#view a[href='#course-shad']").first.click()
        expect(page.locator(".course-resume")).to_be_visible()
        shot("course")
        page.locator(".course-resume").click()
        page.wait_for_selector(".player")
        page.wait_for_timeout(800)
        shot("video")
        page.locator("[data-ptab=transcript]").click()
        page.locator("#tr-q").fill("MCP")
        expect(page.locator(".hits li").first).to_be_visible()
        page.locator("#tr-q").fill("")
        page.locator("[data-ptab=slides]").click()
        expect(page.locator(".slide-main img")).to_be_visible()
        page.locator("[data-slide='1']").first.click()
        expect(page.locator(".slide-cap .n")).to_have_text("2 / 18")
        page.locator("[data-ptab=chapters]").click()
        page.locator(".chap .more").first.click()
        expect(page.locator("#sec-notes")).to_be_visible()
        page.wait_for_timeout(700)
        if page.locator("[data-tip-close]").count():
            page.locator("[data-tip-close]").click()
        page.locator("#notes-jump").click()
        page.locator("#toc-mobile [data-notes='4']").click()
        settle_scroll()
        expect(page.locator("#toc-modal")).not_to_be_visible()
        y = page.evaluate("scrollY")
        navigate("video")
        navigate("notes")
        assert abs(page.evaluate("scrollY") - y) < 12, f"reading position was lost: {y} -> {page.evaluate('scrollY')}"
        shot("notes")

        # Editing and chat preserve the selected section across mode switches.
        page.locator("#notes-jump").click()
        page.locator("#toc-mobile [data-notes='1']").click()
        page.wait_for_timeout(600)
        frag = page.locator(".frag[data-rw='1']").first
        frag.hover()
        frag.locator(".frag-plus").click()
        page.locator("[data-fa=rewrite]").click()
        frag.locator("textarea").fill("Мой пример: модель выбирает функцию, а код её запускает.")
        frag.locator("[data-edit-save]").click()
        expect(frag.locator(".frag-mine")).to_contain_text("Мой пример")
        page.reload(wait_until="networkidle")
        expect(page.locator(".frag.is-mine .frag-mine")).to_contain_text("Мой пример")
        frag = page.locator(".frag.is-mine").first
        frag.hover()
        frag.locator(".frag-plus").click()
        page.locator("[data-fa=ask]").click()
        page.locator("#chat-input").fill("Объясни на примере")
        page.locator("#chat-form button").click()
        expect(page.locator("#chat-prompts")).not_to_have_attribute("open")
        page.locator("[data-pin]").last.click()
        expect(page.locator(".xcard--chat")).to_have_count(1)
        shot("chat")
        page.locator("#chat-close").click()
        frag.locator("[data-mine=reset]").click()
        expect(page.locator(".frag.is-mine")).to_have_count(0)
        navigate("code")
        page.locator("[data-wt='1']").click()
        expect(page.locator("[data-wt='1']")).to_have_attribute("aria-selected", "true")
        navigate("codevideo")
        page.locator("[data-cv=next]").click()
        expect(page.locator(".cv-caption .step-n")).to_have_text("1 / 6")
        shot("animation")
        navigate("lab")
        lab_heading = page.locator("#lab-h").bounding_box()["y"]
        assert 0 <= lab_heading < 220, f"new mode opened midway down the page: {lab_heading}"
        shot("lab")
        for _ in range(9):
            page.locator("[data-lab=step]").click()
        expect(page.locator(".lane").nth(0).locator(".counters")).to_contain_text("240 $")
        expect(page.locator(".lane").nth(1).locator(".counters")).to_contain_text("120 $")
        expect(page.locator(".lab-comparison")).to_contain_text("240 $")
        shot("lab-result")
        page.locator("[data-order-lab=L02]").last.click()
        shot("plan")
        page.locator("[data-plan-act=edit]").click()
        page.locator("#pl-title").fill("L02 · Мой эксперимент")
        page.locator("#plan-form button[type=submit]").click()
        expect(page.locator("#plan-title")).to_have_text("L02 · Мой эксперимент")
        page.locator("[data-plan-act=confirm]").click()
        page.wait_for_timeout(9500)
        page.evaluate("location.hash='course-requests'")
        page.wait_for_timeout(500)
        draft = page.locator(".req-row").filter(has=page.locator(".rstate.draft"))
        expect(draft).to_have_count(1)
        draft.locator("button").click()
        page.wait_for_timeout(1200)
        expect(page.locator("#sec-notes")).to_be_visible()
        expect(page.locator("[data-mini-run]")).to_be_visible()
        shot("draft")
        page.locator("[data-mini-run]").click()
        page.locator("[data-req-act=accept]").click()
        expect(page.locator(".xcard--req .rstate")).to_have_text("принято")
        page.reload(wait_until="networkidle")
        expect(page.locator(".xcard--req .rstate")).to_have_text("принято")
        assert not errors, errors
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        print(f"PASS {prefix}: reading, search, slides, editing, chat, animation, L01, L02, reload", flush=True)
        context.close()
    browser.close()
