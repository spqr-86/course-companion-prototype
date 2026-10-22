"""E2E checks for tasks 6–8 and 10. Task 9 remains separately red until local generation."""
from playwright.sync_api import expect

LONG2 = ('По первому закону Ньютона инерция означает сохранение скорости тела: когда равнодействующая '
         'внешних сил равна нулю, тело продолжает двигаться равномерно и прямолинейно, а не останавливается само.')
LONG_Q = ('Инерция сохраняет скорость пассажира относительно земли, хотя автобус начинает торможение. '
          'Его тело продолжает движение вперёд, пока ремень или сиденье не изменит скорость внешней силой.')


def physics_data(page, base):
    page.goto(base + '#physics', wait_until='networkidle')
    value=page.evaluate('''() => ({sections:CCPhysics.sections.map(x=>({n:x.n,rule:x.check,ref:x.ref})),
       source:CCPhysics.source.map(x=>x.id), license:CCPhysics.meta.license})''')
    assert len(value['sections'])==5,value
    assert 'CC BY' in value['license']
    ids=set(value['source'])
    assert len(ids)==len(value['source'])
    for section in value['sections']:
        assert len(section['rule']['concepts'])>=2
        import re
        assert all(x in ids for x in re.findall(r'\[\[src:([^\]]+)\]\]',section['ref']))
    for source_id in ids:
        assert any(f'[[src:{source_id}]]' in s['ref'] for s in value['sections'])
    print('PASS physics_data',flush=True)


def physics_ui(page, base):
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base + '#library',wait_until='networkidle')
    expect(page.locator('[data-course-physics]')).to_be_visible()
    page.locator('[data-course-physics]').click()
    expect(page.locator('#phys-notes section[data-phys-unit] > h2')).to_have_count(5)
    link=page.locator('.src-link').first
    source_id=link.get_attribute('data-src')
    link.click()
    hit=page.locator('#src-'+source_id)
    expect(hit).to_have_class(__import__('re').compile('is-hit'))
    expect(hit).to_be_visible()
    page.locator('[data-phy-quote="2"]').click()
    expect(page.locator('#phys-quote-2')).to_be_visible()
    page.locator('[data-phy-action="simple"][data-phy-n="2"]').click()
    expect(page.locator('#phys-version-2 [data-phy-version=simple]')).to_be_visible()
    page.locator('#phys-version-2 [data-phy-version=orig]').click()
    section=page.locator('#phys-section-2')
    section.locator('.understand textarea.understood').fill('Моя личная формулировка закона инерции')
    page.reload(wait_until='networkidle')
    expect(page.locator('#phys-section-2 .understand textarea.understood')).to_have_value('Моя личная формулировка закона инерции')
    page.locator('#phys-section-2 [data-check-open]').click()
    page.locator('#phys-section-2 .check-answer').fill(LONG2)
    page.locator('#phys-section-2 [data-check-submit]').click()
    expect(page.locator('#phys-section-2 .verdict')).to_contain_text('Зачтено')
    assert page.evaluate("Learn.state().status['physics:2']")=='self'
    assert not errors, errors
    print('PASS physics_ui',flush=True)


def physics_problems(page,base):
    page.goto(base+'#physics',wait_until='networkidle')
    root=page.locator('#phys-problem-r1')
    for _ in range(3):root.locator('[data-rung-next]').click()
    expect(root.locator('.phys-hint')).to_have_count(3)
    page.reload(wait_until='networkidle')
    root=page.locator('#phys-problem-r1')
    expect(root.locator('.phys-hint')).to_have_count(3)
    root.locator('[data-reveal]').click()
    expect(root.locator('.phys-step')).to_have_count(1)
    root.locator('[data-reveal]').click()
    expect(root.locator('.phys-solution')).to_be_visible()
    assert page.evaluate("Learn.state().problems['physics:r1'].solved")=='with-solution'
    root.locator('#phys-answer-r1').fill('2,5')
    root.locator('[data-phy-check]').click()
    assert page.evaluate("Learn.state().problems['physics:r1'].solved")=='with-solution', 'Ответ после показа решения не должен повышать статус до self'
    root.locator('#phys-similar-r1').fill('0')
    root.locator('[data-similar]').click()
    expect(root.locator('.phys-similar-result')).to_contain_text('не зачтено')
    root.locator('#phys-similar-r1').fill('3,0 м/с²')
    root.locator('[data-similar]').click()
    expect(root.locator('.phys-similar-result')).to_contain_text('Зачтено')
    assert page.evaluate("Learn.state().problems['physics:r1'].solved")=='self'
    root=page.locator('#phys-problem-q1')
    root.locator('textarea').fill(LONG_Q)
    root.locator('[data-phy-check]').click()
    expect(root.locator('.phys-result')).to_contain_text('Зачтено')
    print('PASS physics_problems',flush=True)


def continue_flow(page,base):
    page.goto(base+'#library',wait_until='networkidle')
    expect(page.locator('.continue')).to_contain_text('Начать')
    page.goto(base+'#physics',wait_until='networkidle')
    page.locator('#phys-problem-r1 [data-rung-next]').click()
    page.locator('#phys-problem-r1 [data-rung-next]').click()
    page.goto(base+'#library',wait_until='networkidle')
    expect(page.locator('.continue')).to_contain_text('шаг подсказки 2')
    page.locator('[data-continue]').click()
    expect(page.locator('#phys-problem-r1')).to_be_visible()
    print('PASS continue_flow',flush=True)


def responsiveness(page,base):
    page.goto(base+'#physics',wait_until='networkidle')
    expect(page.locator('#phys-source')).to_be_visible()
    if page.viewport_size['width']<1100:
        page.locator('#phys-source summary').click()
        expect(page.locator('#phys-source .phys-source-inner')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    print(f"PASS physics responsive {page.viewport_size['width']}",flush=True)


def run_all(browser,base,onboarded):
    context=browser.new_context(viewport={'width':1024,'height':844})
    context.add_init_script(onboarded)
    # Изолированные страницы, чтобы экспериментальные статусы не загрязняли следующие проверки.
    for runner in (physics_data,physics_ui,physics_problems,continue_flow):
        page=context.new_page()
        page.goto(base,wait_until='networkidle')
        page.evaluate("localStorage.removeItem('cc-preview-0.4')")
        page.close()
        # new_page() same context has inherited localStorage, init-script restores onboarded
        runner(context.new_page(),base)
    context.close()
    for width,scheme in ((390,'dark'),(1024,'light'),(1440,'light')):
        c=browser.new_context(viewport={'width':width,'height':844},color_scheme=scheme)
        c.add_init_script(onboarded)
        responsiveness(c.new_page(),base)
        c.close()
