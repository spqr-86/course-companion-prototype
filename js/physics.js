/* Лекция без видео: источник справа, конспект, два слоя, проверка и лестницы задач. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const P = () => window.CCPhysics;
  const L = () => window.Learn;
  const source = id => P().source.find(s => s.id === id);
  const previewMd = value => window.marked ? window.marked.parse(value) : `<p>${esc(value)}</p>`;
  const txt = (n, field) => window.CCDemoAI?.physics?.[field]?.[n] || `[черновик] ${field === 'simple' ? 'Упрощение' : field === 'rewrite' ? 'Другая формулировка' : 'Пример'} для §${n}`;
  const position = (unit,kind='section') => ({lecture:'physics',unit,kind,route:kind === 'section' ? 'physics-'+unit : 'physics'});
  let hitTimer = null;
  let wired = false;
  function refs(md) {
    return md.replace(/\[\[src:([a-zA-Z0-9_-]+)\]\]/g, (all,id) => {
      const s = source(id);
      return s ? `<button type="button" class="src-link" data-src="${esc(id)}" aria-label="Сверить с источником, раздел ${esc(s.page)}">§ ${esc(s.page)}</button>` : all;
    });
  }
  function showSource(id) {
    const pane = $('#phys-source'), el = document.getElementById('src-'+id);
    if (!pane || !el) return;
    pane.open = true;
    $$('.is-hit', pane).forEach(e => e.classList.remove('is-hit'));
    el.classList.add('is-hit');
    el.scrollIntoView({block:'center',behavior:'instant'});
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => el.classList.remove('is-hit'),2000);
  }
  function versions(section) {
    const k='p'+section.n, Ls=L().state(), v=Ls.versions[k] || {}, own=Ls.understood['physics:version:'+section.n];
    const has={orig:true,simple:!!v.simple,rewrite:!!v.rewrite,mine:own!=null};
    const active=has[v.active]?v.active:'orig';
    const names={orig:'Оригинал',simple:'Проще (ИИ)',rewrite:'Переписано (ИИ)',mine:'Моя версия'};
    const text=active==='orig'?previewMd(refs(section.ref)):active==='mine'?previewMd(esc(own)):previewMd(esc(txt(section.n, active)));
    const tab=$(`#phys-version-${section.n}`);
    if (!tab) return;
    tab.innerHTML=`<div class="vtabs" role="tablist" aria-label="Версии раздела">${Object.keys(has).filter(t=>has[t]).map(t=>`<button type="button" role="tab" data-phy-version="${t}" data-phy-n="${section.n}" aria-selected="${t===active}" tabindex="${t===active?0:-1}">${names[t]}</button>`).join('')}<span class="vtab-origin">${active==='mine'?'моя заметка':active==='orig'?'объяснение ИИ':'объяснение ИИ · демо'}</span></div><div class="phys-version-content">${text}</div>`;
  }
  function saveVersion(n, patch) {
    const s=L().state(), versions={...s.versions};
    versions['p'+n]={...(versions['p'+n]||{}),...patch};
    L().save({versions});
    versionsView(n);
  }
  function versionsView(n) { versions(P().sections[n-1]); }
  function openMine(n) {
    const s=P().sections[n-1], root=$(`#phys-section-${n}`), k='physics:version:'+n;
    let box=$('.phys-mine-editor',root);
    if (!box) {box=document.createElement('div');box.className='phys-mine-editor';$('#phys-version-'+n).after(box);}
    box.innerHTML=`<label for="phys-edit-${n}">Моя версия · моя заметка</label><textarea id="phys-edit-${n}" rows="4">${esc(L().state().understood[k] || '')}</textarea><div class="u-actions"><button type="button" class="btn btn--small btn--primary" data-phy-save="${n}">Сохранить</button><button type="button" class="btn btn--small" data-phy-cancel>Отмена</button></div>`;
    $('textarea',box).focus();
  }
  function revealQuote(n) {
    const box=$(`#phys-quote-${n}`); if (!box) return;
    box.hidden=!box.hidden;
  }
  function problemState(p) {return L().state().problems['physics:'+p.id] || {rung:0,revealed:0,solved:null,similarSolved:false};}
  function updateProblem(p,patch) {
    const problems={...L().state().problems};
    const previous=problemState(p);
    if(previous.solved==='self' && patch.solved==='with-solution') patch={...patch,solved:'self'};
    problems['physics:'+p.id]={...previous,...patch};
    L().save({problems});
    if (problems['physics:'+p.id].solved === 'self') L().setStatus(L().key('physics',p.id),'self');
    else if (problems['physics:'+p.id].solved === 'with-solution') L().setStatus(L().key('physics',p.id),'solved');
    L().touch(position(p.id,'problem'));
    problemView(p);
  }
  function pResult(p, value, similar=false) {
    const r=p.kind==='calc' || similar
      ? {ok:L().checkNumber(value,similar?p.similar.answer:p.answer,similar?p.similar.tol:p.tol),reason:'missing',missing:['числовой ответ']}
      : L().grade(value,p.rule);
    if (r.ok && p.similar && !similar && problemState(p).revealed >= 2) {
      // Скопированный после раскрытия расчёт не равен самостоятельной проверке.
      return {ok:false,reason:'missing',missing:['После просмотра решения проверьте себя на похожей задаче']};
    }
    if (r.ok) updateProblem(p,similar?{similarSolved:true,solved:'self'}:{solved:'self'});
    return r;
  }
  function problemView(p) {
    const st=problemState(p), root=$(`#phys-problem-${p.id}`);
    if(!root) return;
    $('.phys-ladder',root).innerHTML=p.ladder.slice(0,st.rung).map((a,i)=>`<div class="phys-hint"><b>Подсказка ${i+1}.</b> ${typeof a==='object'?`Вернись к <a href="#physics-${a.link}" data-phy-help="${a.link}">разделу ${a.link}</a> и попробуй ещё раз.`:esc(a)}</div>`).join('');
    $('[data-rung-next]',root).disabled=st.rung>=p.ladder.length;
    $('.phys-steps',root).innerHTML=st.revealed?`<div class="phys-step"><b>Шаг 1.</b> ${esc(p.steps[0])}</div>`:'';
    if(st.revealed>=2) $('.phys-steps',root).innerHTML+=`<div class="phys-solution"><b>Решение:</b> ${esc(p.solution)}</div>`;
    $('[data-reveal]',root).disabled=st.revealed>=2;
    $('[data-reveal]',root).textContent=st.revealed===0?'Показать решение':st.revealed===1?'Полное решение':'Решение показано';
    const similar=$('.phys-similar',root);
    if(similar) similar.hidden=st.revealed<2;
    const status=$('.phys-pstatus',root);
    status.textContent=st.solved==='self'?'воспроизвёл сам':st.solved?'решено с решением':'';
    status.hidden=!st.solved;
  }
  function makeProblem(p) {
    const st=problemState(p), html=`<article class="phys-problem" id="phys-problem-${p.id}" data-unit="${p.id}">
      <div class="u-head"><b>${p.kind==='calc'?'Задача на расчёт':'Задача на понимание'}</b><span class="phys-pstatus" hidden></span></div>
      <h3>${esc(p.text)}</h3>
      <label class="sr" for="phys-answer-${p.id}">Ваш ответ</label>
      <textarea id="phys-answer-${p.id}" rows="3" placeholder="Сначала попробуй ответить без подсказки">${esc(st.draft||'')}</textarea>
      <div class="u-actions"><button type="button" class="btn btn--small btn--primary" data-phy-check="${p.id}">Проверить</button><button type="button" class="btn btn--small" data-rung-next="${p.id}">Подсказка</button><button type="button" class="btn btn--small" data-reveal="${p.id}">Показать решение</button></div>
      <div class="phys-result" aria-live="polite"></div><div class="phys-ladder"></div><div class="phys-steps"></div>
      ${p.similar?`<div class="phys-similar" hidden><h4>Похожая задача — теперь самостоятельно</h4><p>${esc(p.similar.text)}</p><label for="phys-similar-${p.id}">Ускорение, м/с²</label><input id="phys-similar-${p.id}" inputmode="decimal" value="${esc(st.similarDraft||'')}"><button type="button" class="btn btn--small" data-similar="${p.id}">Проверить ответ</button><div class="phys-similar-result" aria-live="polite"></div></div>`:''}
      </article>`;
    return html;
  }
  function render(r='physics') {
    const el=$('#view');
    if ($('.physics-page',el)) {
      if (r.startsWith('physics-')) goSection(+r.slice(8));
      return;
    }
    const data=P();
    if(!data){el.innerHTML='<p>Материалы физики не загружены.</p>';return;}
    const progress=L().progress('physics',[1,2,3,4,5,'q1','r1']);
    el.innerHTML=`<div class="page physics-page">
      <nav class="crumbs" aria-label="Путь"><a href="#library">Библиотека</a><span>/</span><span>Физика · учебник</span></nav>
      <div class="phys-head"><div class="eyebrow">Школьная физика · 9 класс · без видео</div><h1 class="page-title">Законы Ньютона</h1><p class="lead">Русский конспект рядом с короткими фрагментами оригинального учебника OpenStax.</p><p class="hint">${progress.self} из ${progress.total} · воспроизвёл сам</p></div>
      <nav class="phys-toc" aria-label="Разделы физики">${data.sections.map(s=>`<a href="#physics-${s.n}">${s.n}. ${esc(s.title)}</a>`).join('')}<a href="#physics" data-go-problems>Задачи</a></nav>
      <div class="phys-layout"><div id="phys-notes" class="phys-notes">
        ${data.sections.map(s=>`<section id="phys-section-${s.n}" data-phys-unit="${s.n}"><h2 data-unit="${s.n}">${s.n}. ${esc(s.title)}</h2><div class="phys-layer"><span class="uorigin uorigin--ai">объяснение ИИ</span><span class="hint">· редакционный демо-конспект</span></div><div id="phys-version-${s.n}"></div>
        ${s.figure?`<figure class="phys-figure">${s.figure}<figcaption>Схема сил · демо</figcaption></figure>`:''}
        <button class="btn btn--small" type="button" data-phy-quote="${s.n}" aria-controls="phys-quote-${s.n}">Оригинал рядом</button>
        <blockquote class="src-quote" id="phys-quote-${s.n}" hidden lang="en">${s.quotes.map(id=>`<span>${esc(source(id)?.html||'')} <a href="${esc(source(id)?.url)}" target="_blank" rel="noopener">§ ${esc(source(id)?.page)}</a></span>`).join(' ')}</blockquote>
        <div class="phys-actions"><button type="button" class="btn btn--small" data-phy-action="simple" data-phy-n="${s.n}">Объяснить</button><button type="button" class="btn btn--small" data-phy-action="example" data-phy-n="${s.n}">Показать на примере</button><button type="button" class="btn btn--small" data-phy-action="check" data-phy-n="${s.n}">Проверить себя</button><details><summary>Ещё</summary><button type="button" data-phy-action="rewrite" data-phy-n="${s.n}">Переписать иначе</button><button type="button" data-phy-action="mine" data-phy-n="${s.n}">Моя версия</button></details></div><div class="phys-example" hidden></div>
        </section>`).join('')}
        <section id="phys-problems"><h2>Проверь понимание на задачах</h2><p class="hint">Проверка ответов — демо-заглушка, не ИИ.</p>${data.problems.map(makeProblem).join('')}</section>
      </div>
      <details id="phys-source" class="phys-source" open><summary>Учебник · OpenStax Physics</summary><div class="phys-source-inner"><p class="hint">Цитаты на английском. ${esc(data.meta.pageNote)}</p>${data.source.map(s=>`<article id="src-${esc(s.id)}" class="phys-source-entry"><div class="uorigin">из источника</div><h3>§ ${esc(s.page)} · ${esc(s.heading)}</h3><blockquote lang="en">${esc(s.html)}</blockquote><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Читать в OpenStax ↗</a></article>`).join('')}</div></details>
      </div>
      <footer class="phys-attribution"><p>${esc(data.meta.attribution)}</p><p><a href="${esc(data.meta.url)}" target="_blank" rel="noopener noreferrer">Источник ↗</a> · <a href="${esc(data.meta.licenseUrl)}" target="_blank" rel="noopener noreferrer">Условия и атрибуция ↗</a></p></footer>
      </div>`;
    if(matchMedia('(max-width:1099px)').matches) $('#phys-source').open=false;
    data.sections.forEach(s=>{
      versions(s);
      const h2=$(`#phys-section-${s.n} h2`);
      const block=window.LearnUI.mountSection(h2,{lecture:'physics',unit:s.n,title:s.title,rule:s.check});
      block.addEventListener('focusin',()=>L().touch(position(s.n)));
      block.addEventListener('input',()=>L().touch(position(s.n)));
    });
    data.problems.forEach(problemView);
    if (!wired) {
      wired = true;
      el.addEventListener('click',handleClick);
      el.addEventListener('input',handleInput);
      el.addEventListener('keydown',handleKeys);
    }
    if(r.startsWith('physics-')) requestAnimationFrame(()=>goSection(+r.slice(8)));
    el.focus({preventScroll:true});
  }
  function handleKeys(e) {
    const tab=e.target.closest('[data-phy-version]');
    if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    const n=+tab.dataset.phyN;
    const siblings=$$(`#phys-version-${n} [data-phy-version]`);
    const idx=siblings.indexOf(tab);
    let next=e.key==='Home' ? 0 : e.key==='End' ? siblings.length-1
      : (idx+(e.key==='ArrowRight'?1:-1)+siblings.length)%siblings.length;
    const active=siblings[next].dataset.phyVersion;
    e.preventDefault();
    saveVersion(n,{active});
    $(`#phys-version-${n} [data-phy-version="${active}"]`)?.focus();
  }
  function handleInput(e) {
    const root=e.target.closest('.phys-problem'); if(!root) return;
    const p=P().problems.find(p=>root.id==='phys-problem-'+p.id); if(!p)return;
    const field=e.target.matches('textarea')?'draft':e.target.matches('.phys-similar input')?'similarDraft':null;
    if(field){updateProblem(p,{[field]:e.target.value});}
  }
  function handleClick(e) {
    const btn=e.target.closest('button,[data-phy-help],[data-go-problems]'); if(!btn)return;
    if(btn.dataset.src) {showSource(btn.dataset.src);return;}
    if(btn.hasAttribute('data-go-problems')){e.preventDefault();$('#phys-problems')?.scrollIntoView({block:'start'});return;}
    if(btn.dataset.phyHelp) L().setStatus(L().key('physics',+btn.dataset.phyHelp),'helped');
    if(btn.dataset.phyQuote){revealQuote(+btn.dataset.phyQuote);return;}
    const n=+btn.dataset.phyN;
    if(btn.dataset.phyVersion){saveVersion(n,{active:btn.dataset.phyVersion});return;}
    if(btn.dataset.phyAction){
      L().touch(position(n));
      if(btn.dataset.phyAction==='check'){$(`#phys-section-${n} .understand`)._openCheck();return;}
      if(btn.dataset.phyAction==='mine'){openMine(n);return;}
      if(btn.dataset.phyAction==='example'){
        const box=$(`#phys-section-${n} .phys-example`);
        box.hidden=false;box.innerHTML=`<span class="uorigin uorigin--ai">объяснение ИИ · демо</span><p>${esc(txt(n,'example'))}</p>`;
        L().setStatus(L().key('physics',n),'helped');return;
      }
      saveVersion(n,{[btn.dataset.phyAction]:true,active:btn.dataset.phyAction});
      L().setStatus(L().key('physics',n),'helped');return;
    }
    if(btn.dataset.phySave){
      const k='physics:version:'+btn.dataset.phySave,u={...L().state().understood};
      u[k]=$(`#phys-edit-${btn.dataset.phySave}`).value;
      L().save({understood:u});saveVersion(+btn.dataset.phySave,{active:'mine'});
      $(`#phys-section-${btn.dataset.phySave} .phys-mine-editor`)?.remove();return;
    }
    if(btn.hasAttribute('data-phy-cancel')){btn.closest('.phys-mine-editor').remove();return;}
    const id=btn.dataset.phyCheck||btn.dataset.rungNext||btn.dataset.reveal||btn.dataset.similar;
    if(!id)return;
    const p=P().problems.find(x=>x.id===id), root=$('#phys-problem-'+id), st=problemState(p);
    L().touch(position(id,'problem'));
    if(btn.dataset.rungNext){
      if(st.rung<p.ladder.length){const hint=p.ladder[st.rung];if(typeof hint==='object') L().setStatus(L().key('physics',hint.link),'helped');updateProblem(p,{rung:st.rung+1});}
      return;
    }
    if(btn.dataset.reveal){const next=Math.min(2,st.revealed+1);updateProblem(p,{revealed:next,...(next>=2?{solved:'with-solution'}:{})});return;}
    if(btn.dataset.similar){const r=pResult(p,$('#phys-similar-'+id).value,true);$('.phys-similar-result',root).textContent=r.ok?'Зачтено.':'Пока не зачтено. Проверь вычисление.';return;}
    if(btn.dataset.phyCheck){
      const r=pResult(p,$('#phys-answer-'+id).value);
      r.hint=p.rule?.concepts.map(c=>c[0])||[];
      LearnUI.renderVerdict($('.phys-result',root),r,{onDispute:()=>{updateProblem(p,{solved:'self'});LearnUI.renderVerdict($('.phys-result',root),{ok:true,disputed:true});}});
    }
  }
  function goSection(n) {
    const section=document.getElementById('phys-section-'+n);
    if(section){section.scrollIntoView({block:'start'});L().touch(position(n));}
  }
  function resume(last) {
    if(!last||last.lecture!=='physics')return;
    if(last.kind==='problem'){
      const p=document.getElementById('phys-problem-'+last.unit);
      if(p){p.scrollIntoView({block:'start'});$('textarea',p)?.focus({preventScroll:true});}
    } else {
      const section=document.getElementById('phys-section-'+last.unit);
      if(section){section.scrollIntoView({block:'start'});$('.understand textarea.understood',section)?.focus({preventScroll:true});}
    }
  }
  function dispose() {
    clearTimeout(hitTimer);
    const el=$('#view');
    el?.removeEventListener('click',handleClick);
    el?.removeEventListener('input',handleInput);
    el?.removeEventListener('keydown',handleKeys);
    wired = false;
    window.LearnUI?.dispose?.();
  }
  window.Physics={render,resume,showSource,dispose};
})();
