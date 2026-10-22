"""Намеренно красная до ручного запуска tools/gen_demo_ai.py (Task 9)."""
import os
from playwright.sync_api import sync_playwright

BASE=os.environ.get('CC_BASE_URL','http://127.0.0.1:8765/')
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page()
    page.add_init_script("localStorage.setItem('cc-preview-0.4',JSON.stringify({onboarded:true}))")
    page.goto(BASE,wait_until='networkidle')
    result=page.evaluate('''() => {
      const a=CCDemoAI;
      const complete = (name, nums, kind) => nums.every(n=>
        typeof a[name][kind][n] === 'string' && a[name][kind][n].trim() &&
        !a[name][kind][n].startsWith('[черновик]'));
      const all=(name,nums)=>complete(name,nums,'simple')&&complete(name,nums,'rewrite');
      return {model:a.meta.model, shad:all('shad',Array.from({length:12},(_,i)=>i+1)),
        physics:all('physics',[1,2,3,4,5]),
        shadExamples:complete('shad',[1,2,5,6,7,8,9,10,12],'example'),
        physicsExamples:complete('physics',[1,2,3,4,5],'example'),
        chat:[0,1,2,3].every(n=>typeof a.shad.chat[n]==='string'&&a.shad.chat[n].trim())};
    }''')
    assert result == {'model':'google/gemini-3.7-flash','shad':True,'physics':True,
                      'shadExamples':True,'physicsExamples':True,'chat':True},result
    browser.close()
