"""End-to-end learning and customization checks for the static prototype."""
# ANCHOR: Covers cross-mode links, saved edits and L02; contexts are disposable.
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("CC_BASE_URL", "http://127.0.0.1:8876/")
ONBOARDED = "try { if (localStorage.getItem('cc-preview-0.4') === null) localStorage.setItem('cc-preview-0.4', JSON.stringify({onboarded: true})) } catch (e) {}"  # старые сценарии не видят онбординг; уже сохранённое состояние не затираем
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


PLACEHOLDER = "Напиши 1–2 предложения своими словами. ИИ сюда не пишет — это твой след понимания"
LONG_OK4 = "Хороший инструмент это надёжный контракт: он идемпотентен, поэтому повторный вызов после сбоя безопасен, возвращает понятные ошибки и отдаёт структурированные данные вместо текста"
LONG_NONE = "Тело сохраняет свою скорость пока на него ничего не действует и это очень важно для понимания законов движения в любой системе"


def section_flow(page):
    """Механики раздела: «Как я понял», статусы, «видел», проверка, оспаривание, прогресс курса."""
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE + "#lecture-tools-mcp", wait_until="networkidle")
    page.evaluate("location.hash='tools-mcp-notes'")
    page.wait_for_selector(".understand[data-unit='4']", state="attached")
    u4 = page.locator(".understand[data-unit='4']")
    ta = u4.locator("textarea.understood")
    assert ta.get_attribute("placeholder") == PLACEHOLDER
    expect(u4.locator(".ustatus")).to_have_count(1)
    expect(u4.locator(".uorigin")).to_contain_text("моя заметка")
    # у разделов 11–12 проверки нет
    expect(page.locator(".understand[data-unit='11'] [data-check-open]")).to_have_count(0)
    expect(page.locator(".understand[data-unit='1'] [data-check-open]")).to_have_count(1)
    ta.scroll_into_view_if_needed()
    ta.fill("Инструмент это контракт между моделью и системой")
    page.wait_for_timeout(700)
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".understand[data-unit='4']", state="attached")
    expect(page.locator(".understand[data-unit='4'] textarea.understood")).to_have_value("Инструмент это контракт между моделью и системой")
    # «видел»: прокрутка до конца раздела
    page.locator(".understand[data-unit='4']").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    expect(page.locator(".understand[data-unit='4'] .ustatus")).to_have_text("видел")
    assert page.evaluate("Learn.state().status['shad:4']") == "seen"
    # «Объяснить проще» в §4 -> «разобрался с помощью»
    f4 = page.locator(".frag[data-sec='4']").first
    f4.scroll_into_view_if_needed()
    f4.hover()
    f4.locator(".frag-plus").click()
    page.locator("[data-fa=simple]").click()
    expect(page.locator(".understand[data-unit='4'] .ustatus")).to_have_text("разобрался с помощью")
    # проверка: 3 слова -> «Слишком коротко» + плашка
    u4 = page.locator(".understand[data-unit='4']")
    u4.locator("[data-check-open]").click()
    expect(page.locator("#n-4 ~ .understand[data-unit='4'].checking, .understand[data-unit='4'].checking")).to_have_count(1)
    expect(u4.locator(".check-q")).to_be_visible()
    u4.locator("textarea.check-answer").fill("идемпотентность и ошибки")
    u4.locator("[data-check-submit]").click()
    expect(u4.locator(".verdict")).to_contain_text("Слишком коротко")
    expect(u4.locator(".verdict")).to_contain_text("Демо-проверка по ключевым словам, не ИИ")
    # 15+ слов без понятий -> «Не хватает»
    u4.locator("textarea.check-answer").fill(LONG_NONE)
    u4.locator("[data-check-submit]").click()
    expect(u4.locator(".verdict")).to_contain_text("Не хватает")
    # верный ответ -> «Зачтено», «воспроизвёл сам»
    u4.locator("textarea.check-answer").fill(LONG_OK4)
    u4.locator("[data-check-submit]").click()
    expect(u4.locator(".verdict")).to_contain_text("Зачтено")
    expect(u4.locator(".ustatus")).to_have_text("воспроизвёл сам")
    expect(u4).not_to_have_class("checking")
    # страница курса: 1 из 10
    page.evaluate("location.hash='course-shad'")
    expect(page.locator(".course-progress")).to_contain_text("1 из 10")
    expect(page.locator(".course-progress")).to_contain_text("воспроизвёл сам")
    # §5: короткий ответ -> «Оспорить»
    page.evaluate("location.hash='lecture-tools-mcp'")
    page.evaluate("location.hash='tools-mcp-notes'")
    page.wait_for_selector(".understand[data-unit='5']", state="attached")
    u5 = page.locator(".understand[data-unit='5']")
    u5.locator("[data-check-open]").scroll_into_view_if_needed()
    u5.locator("[data-check-open]").click()
    u5.locator("textarea.check-answer").fill("протокол нужен")
    u5.locator("[data-check-submit]").click()
    expect(u5.locator(".verdict")).to_contain_text("Слишком коротко")
    u5.locator("[data-check-dispute]").click()
    expect(u5.locator(".ustatus")).to_have_text("воспроизвёл сам")
    expect(u5.locator(".verdict")).to_contain_text("засчитано по оспариванию")
    assert page.evaluate("Learn.state().disputed['shad:5']") is True
    # меню фрагмента: «Проверить себя» ведёт к проверке своего раздела
    f6 = page.locator(".frag[data-sec='6']").first
    f6.scroll_into_view_if_needed()
    f6.hover()
    f6.locator(".frag-plus").click()
    page.locator("[data-fa=check]").click()
    expect(page.locator(".understand[data-unit='6'].checking .check-q")).to_be_visible()
    f11 = page.locator(".frag[data-sec='11']").first
    f11.scroll_into_view_if_needed()
    f11.hover()
    f11.locator(".frag-plus").click()
    assert page.locator("[data-fa=check]").get_attribute("hidden") is not None
    assert not errors, errors
    print("PASS section_flow", flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}))
    unit_ctx = browser.new_context(viewport={"width": 1024, "height": 800})
    unit_ctx.add_init_script(ONBOARDED)
    learn_unit(unit_ctx.new_page())
    unit_ctx.close()
    sec_ctx = browser.new_context(viewport={"width": 1024, "height": 800})
    sec_ctx.add_init_script(ONBOARDED)
    section_flow(sec_ctx.new_page())
    sec_ctx.close()
    for width, theme in [(390, "light"), (1440, "light"), (390, "dark")]:
        if os.environ.get("CC_ONLY") and os.environ["CC_ONLY"] != f"{width}-{theme}":
            continue
        context = browser.new_context(viewport={"width": width, "height": 844}, color_scheme=theme)
        context.add_init_script(ONBOARDED)
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
        settle_scroll()
        frag = page.locator(".frag[data-rw='1']").first
        orig_text = frag.locator(".frag-src").inner_text()
        frag.hover()
        frag.locator(".frag-plus").click()
        # Меню: три главных действия по порядку, «Создать объяснение» убрано
        order = page.evaluate("[...document.querySelectorAll('#fmenu [data-fa]')].filter(b => !b.closest('.fa-more')).map(b => b.dataset.fa)")
        assert order[:3] == ["simple", "example", "check"], order
        labels = page.evaluate("[...document.querySelectorAll('#fmenu [data-fa]')].map(b => b.querySelector('b').textContent)")
        assert labels == ["Объяснить", "Показать на примере", "Проверить себя", "Переписать иначе", "Моя версия", "Спросить в чате"], labels
        assert page.locator("[data-fa=check]").get_attribute("hidden") is None
        expect(page.locator("[data-fa=scene]")).to_have_count(0)
        expect(page.locator("#fmenu .fa-more summary")).to_have_text("Ещё")
        # «Показать на примере» в разделе без лабы: карточка с пометкой
        page.locator("[data-fa=example]").click()
        expect(page.locator(".xcard--example")).to_contain_text("объяснение ИИ · демо")
        assert page.evaluate("Learn.state().status['shad:1']") == "helped"
        # «Объяснить»: вкладка simple, текст отличается от оригинала
        frag.hover()
        frag.locator(".frag-plus").click()
        page.locator("[data-fa=simple]").click()
        expect(frag.locator("[data-vtab=simple][aria-selected=true]")).to_have_count(1)
        assert frag.locator(".frag-mine").inner_text() != orig_text
        expect(frag.locator(".frag-mine")).to_contain_text("объяснение ИИ · демо")
        expect(frag.locator(".frag-src")).to_be_hidden()
        frag.locator("[data-vtab=orig]").click()
        expect(frag.locator(".frag-src")).to_be_visible()
        expect(frag.locator("[data-vtab=orig][aria-selected=true]")).to_have_count(1)
        # «Моя версия»
        frag.hover()
        frag.locator(".frag-plus").click()
        page.locator("#fmenu .fa-more summary").click()
        page.locator("[data-fa=rewrite]").click()
        frag.locator("textarea").fill("Мой пример: модель выбирает функцию, а код её запускает.")
        frag.locator("[data-edit-save]").click()
        expect(frag.locator("[data-vtab=mine][aria-selected=true]")).to_have_count(1)
        expect(frag.locator(".frag-mine")).to_contain_text("Мой пример")
        expect(frag.locator(".frag-mine")).to_contain_text("моя заметка")
        page.reload(wait_until="networkidle")
        expect(page.locator(".frag.is-mine .frag-mine")).to_contain_text("Мой пример")
        frag = page.locator(".frag.is-mine").first
        expect(frag.locator("[data-vtab=mine][aria-selected=true]")).to_have_count(1)
        expect(frag.locator("[data-vtab=simple]")).to_have_count(1)
        frag.hover()
        frag.locator(".frag-plus").click()
        page.locator("#fmenu .fa-more summary").click()
        page.locator("[data-fa=ask]").click()
        page.locator("#chat-input").fill("Объясни на примере")
        page.locator("#chat-form button").click()
        expect(page.locator("#chat-prompts")).not_to_have_attribute("open")
        page.locator("[data-pin]").last.click()
        expect(page.locator(".xcard--chat")).to_have_count(1)
        shot("chat")
        page.locator("#chat-close").click()
        # клавиатура: стрелки переключают вкладки версий, панель связана с активной вкладкой
        frag.locator("[data-vtab=mine]").focus()
        page.keyboard.press("ArrowLeft")
        expect(frag.locator("[data-vtab][aria-selected=true]")).not_to_have_attribute("data-vtab", "mine")
        page.keyboard.press("ArrowRight")
        expect(frag.locator("[data-vtab=mine]")).to_have_attribute("aria-selected", "true")
        page.keyboard.press("Home")
        expect(frag.locator("[data-vtab=orig]")).to_have_attribute("aria-selected", "true")
        page.keyboard.press("End")
        expect(frag.locator("[data-vtab=mine]")).to_be_focused()
        pid = frag.get_attribute("data-pid")
        expect(frag.locator(".frag-mine")).to_have_attribute("aria-labelledby", f"vt-{pid}-mine")
        frag.locator("[data-mine=reset]").click()
        expect(frag.locator("[data-vtab=mine]")).to_have_count(0)
        expect(page.locator(".frag.is-mine")).to_have_count(0)
        # пример в разделе с лабораторией ведёт в лабораторию
        page.locator("#notes-jump").click()
        page.locator("#toc-mobile [data-notes='4']").click()
        settle_scroll()
        f4 = page.locator(".frag[data-sec='4']").first
        f4.hover()
        f4.locator(".frag-plus").click()
        page.locator("[data-fa=example]").click()
        page.wait_for_timeout(400)
        assert page.evaluate("location.hash") == "#tools-mcp-lab", page.evaluate("location.hash")
        navigate("notes")
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
