#!/usr/bin/env python3
"""Генератор статических ответов Course Companion через OpenRouter.

Запускать только локально с OPENROUTER_API_KEY. --only shad:4 / physics:2 / chat:0
прогоняет один раздел или вопрос. Первый удачный дубль сохраняется без редактуры.
ANCHOR: тот же content.js/physics.js, что показывает браузерное демо.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MODEL = 'google/gemini-3.7-flash'
TEMPERATURE = 0.3
URL = 'https://openrouter.ai/api/v1/chat/completions'
SYSTEM = ('Ты готовишь короткие статические демо-ответы для взрослого русскоязычного самоучки. '
          'Опирайся только на предоставленный фрагмент и не выдумывай источники. '
          'Отвечай по-русски; без вступлений, маркетинга и Markdown-ограждений. '
          'Пример должен содержать конкретные числа/действия, а пересказ быть точным.')
PROMPTS = {
    'simple': 'Объясни фрагмент проще на уровне школьника: 80–130 слов, не теряя смысл и ограничения.',
    'rewrite': 'Перепиши фрагмент яснее, сохрани техническую точность и структуру: 80–130 слов.',
    'example': 'Дай один конкретный небольшой пример, который раскрывает идею фрагмента: 70–120 слов.',
    'chat': 'Ответь на вопрос с опорой на следующий фрагмент: 60–120 слов.'
}
LOG = logging.getLogger('gen_demo_ai')

def js_data(files: list[str], name: str):
    script = """const fs=require('fs'),vm=require('vm');const w={};const ctx={window:w};
for(const p of process.argv.slice(1))vm.runInNewContext(fs.readFileSync(p,'utf8'),ctx,{filename:p});
process.stdout.write(JSON.stringify(w[process.env.CC_GLOBAL]));"""
    env = {**os.environ, 'CC_GLOBAL': name}
    output = subprocess.check_output(['node', '-e', script, *[str(ROOT / p) for p in files]], env=env)
    return json.loads(output)

def chapter_text(number: int, notes: str) -> str:
    # Заголовки конспекта ШАД различаются по синтаксису, поэтому запасной
    # вариант — исходный раздел правил проверки + соседний краткий пересказ.
    m = re.search(rf'(?m)^##\s+(?:{number}\.|§\s*{number}\b|{number}\s+)', notes)
    if not m:
        return notes[:2500] if number == 1 else notes[min(len(notes), (number-1)*1700):number*1700]
    following = re.search(r'(?m)^##\s+', notes[m.end():])
    return notes[m.start():m.end()+following.start() if following else None][:4500]

def jobs():
    shad = js_data(['data/content.js'], 'CC')
    phys = js_data(['data/physics.js'], 'CCPhysics')
    old = js_data(['data/demo-ai.js'], 'CCDemoAI')
    notes = (ROOT/'data/notes.md').read_text(encoding='utf-8')
    for n in range(1,13):
        context = chapter_text(n,notes).strip() or old['shad']['simple'].get(str(n), '')
        for action in ('simple','rewrite','example'):
            if action == 'example' and n in (3,4,11): continue  # маршруты в code-video, lab, code
            yield ('shad',str(n),action,context)
    for s in phys['sections']:
        for action in ('simple','rewrite','example'):
            yield ('physics',str(s['n']),action,s['title']+'\n'+s['ref'])
    for i,item in enumerate(shad['chat']):
        context = item['q']+'\n'+item['a']+'\n'+chapter_text((item['refs'][-1].get('notes') or 4),notes)
        yield ('chat',str(i),'chat',context)

def request_one(api_key: str, user_prompt: str):
    payload = json.dumps({'model':MODEL, 'temperature':TEMPERATURE,
                          'messages':[{'role':'system','content':SYSTEM},
                                      {'role':'user','content':user_prompt}]}, ensure_ascii=False).encode('utf-8')
    req = Request(URL, data=payload, headers={'Authorization':f'Bearer {api_key}',
                  'Content-Type':'application/json', 'HTTP-Referer':'https://github.com/spqr-86/course-companion-prototype',
                  'X-Title':'Course Companion preview 0.4'}, method='POST')
    with urlopen(req, timeout=90) as resp:
        answer=json.load(resp)
    if answer.get('error'): raise RuntimeError(str(answer['error']))
    text=answer['choices'][0]['message']['content']
    if isinstance(text,list): text=''.join(piece.get('text','') for piece in text if isinstance(piece,dict))
    if not isinstance(text,str) or not text.strip(): raise RuntimeError('Модель вернула пустой ответ')
    usage=answer.get('usage') or {}
    cost=usage.get('cost')
    if cost is None: cost=answer.get('total_cost')
    if cost is None:
        raise RuntimeError('Ответ OpenRouter не содержит usage.cost; невозможно подтвердить бюджет')
    cost=float(cost)
    if cost < 0: raise RuntimeError('Некорректная отрицательная стоимость API')
    return text.strip(), usage, cost, answer.get('id')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--only',help='Раздел shad:4 или physics:2; один чат-вопрос chat:0')
    p.add_argument('--budget',type=float,default=.10,help='Максимальные суммарные расходы в USD')
    args=p.parse_args()
    if args.budget<=0: p.error('--budget должен быть больше нуля')
    key=os.environ.get('OPENROUTER_API_KEY')
    if not key: p.error('Требуется переменная OPENROUTER_API_KEY')
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    provenance=ROOT/'provenance/demo-ai'
    (provenance/'raw').mkdir(parents=True, exist_ok=True)
    (provenance/'prompt.md').write_text('\n\n'.join([f'# {key}\n\n{value}' for key,value in PROMPTS.items()]) + '\n\n## System\n' + SYSTEM + '\n', encoding='utf-8')
    manifest=provenance/'run.json'
    state=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {'model':MODEL,'temperature':TEMPERATURE,'started':datetime.now(timezone.utc).isoformat(),'calls':[]}
    already={(r['lecture'],r['section'],r['action']) for r in state['calls'] if r.get('success')}
    work=[x for x in jobs() if not args.only or f'{x[0]}:{x[1]}'==args.only or x[0]==args.only]
    if not work: p.error(f'Раздел не найден: {args.only}')
    # Никогда не затираем уже полученные ответы: это первый успешный дубль.
    spent=sum(float(r['cost_usd']) for r in state['calls'] if r.get('cost_usd') is not None)
    for lecture,section,action,context in work:
        if (lecture,section,action) in already: continue
        if spent>=args.budget: raise RuntimeError(f'Бюджет ${args.budget:.2f} исчерпан')
        prompt=f'{PROMPTS[action]}\n\nКонтекст:\n{context[:5200]}'
        stamp={'lecture':lecture,'section':section,'action':action,
               'prompt':prompt, 'model':MODEL,'temperature':TEMPERATURE}
        name=f'{lecture}-{section}-{action}'
        (provenance/'raw'/f'{name}.prompt.txt').write_text(prompt,encoding='utf-8')
        for attempt in range(1,4):
            try:
                text,usage,cost,req_id=request_one(key,prompt)
                (provenance/'raw'/f'{name}.txt').write_text(text,encoding='utf-8')
                stamp.update(success=True,retries=attempt-1,usage=usage,cost_usd=cost,request_id=req_id,output=text)
                spent+=cost
                LOG.info('%s: tokens=%s cost=%s', name, usage.get('total_tokens'), cost)
                break
            except (HTTPError,URLError,TimeoutError,RuntimeError,KeyError,IndexError) as exc:
                LOG.error('%s попытка %s: %s',name,attempt,exc)
                if attempt==3:
                    stamp.update(success=False,retries=attempt-1,error=str(exc))
                    break
                time.sleep(min(2**attempt,8))
        state['calls'].append(stamp)
        manifest.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
        if not stamp.get('success'): raise RuntimeError('Генерация прервана: '+name)
        if spent>args.budget: raise RuntimeError(f'Лимит превышен после ответа: ${spent:.5f}')
    answers=js_data(['data/demo-ai.js'], 'CCDemoAI')
    answers.update({'meta':{'model':MODEL,'date':datetime.now(timezone.utc).date().isoformat(),
                     'prompt':SYSTEM+'\n'+json.dumps(PROMPTS,ensure_ascii=False),'run':'provenance/demo-ai/run.json'}})
    for r in state['calls']:
        if not r.get('success'):continue
        if r['lecture']=='chat': answers['shad']['chat'][r['section']]=r['output']
        else: answers[r['lecture']][r['action']][r['section']]=r['output']
    output=ROOT/'data/demo-ai.js'
    output.write_text('/* Первый успешный дубль OpenRouter. Не редактировать ответы вручную. */\nwindow.CCDemoAI = '
                      +json.dumps(answers,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    manifest.write_text(json.dumps({**state,'ended':datetime.now(timezone.utc).isoformat(),
                                    'reported_total_usd':spent,'expected_calls':len(list(jobs()))},
                                   ensure_ascii=False,indent=2),encoding='utf-8')
    LOG.info('Готово %s / %s; расходы (по данным API): $%.5f',len([r for r in state['calls'] if r.get('success')]),len(list(jobs())),spent)

if __name__=='__main__': main()
