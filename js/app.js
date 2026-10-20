/* Course Companion — прототип. Маршруты — простые токены в hash (#library, #course-shad, #lecture-tools-mcp,
   #tools-mcp-notes …), чтобы ссылку на любой экран можно было отправить. */
(function () {
  const C = window.CC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const fmt = t => {
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
  };
  const norm = s => s.toLowerCase().replace(/ё/g, "е");
  const ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg>';

  const S = {
    data: null, notesMd: null, player: null, ytState: "idle", now: 0, pendingSeek: null,
    lectureMounted: false, follow: true, slide: 0, panelTab: "transcript", cv: null, lab: null,
    visited: new Set(), extraCourses: []
  };

  /* ---------- Подсветка кода по строкам ---------- */
  function highlightLines(code) {
    let html;
    try { html = window.hljs ? hljs.highlight(code, { language: "python" }).value : esc(code); }
    catch (e) { html = esc(code); }
    const lines = [], stack = [];
    let cur = "";
    html.split(/(<span[^>]*>|<\/span>|\n)/).forEach(tok => {
      if (!tok) return;
      if (tok === "\n") { cur += "</span>".repeat(stack.length); lines.push(cur); cur = stack.join(""); }
      else if (tok.startsWith("<span")) { stack.push(tok); cur += tok; }
      else if (tok === "</span>") { stack.pop(); cur += tok; }
      else cur += tok;
    });
    lines.push(cur);
    return lines.map(l => `<span class="ln">${l || " "}</span>`).join("");
  }

  /* ---------- Данные лекции ---------- */
  async function loadData() {
    if (S.data) return S.data;
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
    const [tr, chapters, slides] = await Promise.all([get("data/transcript.json"), get("data/chapters.json"), get("data/slides.json")]);
    S.notesMd = await fetch("data/notes.md").then(r => r.text());
    S.data = { segs: tr.segments, duration: tr.duration, chapters, slides };
    return S.data;
  }
  const chapterAt = t => {
    const ch = S.data.chapters;
    let i = 0;
    for (let k = 0; k < ch.length; k++) if (t >= ch[k].t) i = k;
    return i;
  };
  const chapterForNotes = n => S.data && S.data.chapters.find(c => c.notes_section === n);

  /* ---------- Навигация ---------- */
  function renderSide(route) {
    const cur = t => route === t || (t === "lecture-tools-mcp" && route.startsWith("tools-mcp")) ? ' aria-current="page"' : "";
    const lectures = C.course.modules.flatMap(m => m.lectures);
    $("#side-nav").innerHTML = `
      <a href="#library"${cur("library")}>Библиотека</a>
      <div class="group">Неделя агентов 2026</div>
      <a href="#course-shad"${cur("course-shad")}>Обзор курса</a>
      ${lectures.map(l => l.token
        ? `<a href="#${l.token}"${cur(l.token)}><span class="k">${l.code}</span>${esc(l.title)}</a>`
        : `<a class="off" href="#course-shad" title="Лекция ещё не собрана"><span class="k">${l.code}</span>${esc(l.title)}</a>`).join("")}
      <div class="group">Лаборатории</div>
      <a href="#tools-mcp-lab"${route === "tools-mcp-lab" ? ' aria-current="page"' : ""}><span class="k">L01</span>Повтор и идемпотентность</a>`;
  }

  function route() {
    const r = (location.hash || "#library").slice(1) || "library";
    renderSide(r);
    closeSide();
    $$("[data-open-chat]").forEach(b => { b.hidden = !(r.startsWith("lecture") || r.startsWith("tools-mcp")); });
    if (r === "library") return renderLibrary();
    if (r === "course-shad") return renderCourse();
    if (r === "lecture-tools-mcp" || r.startsWith("tools-mcp")) return renderLecture(r);
    renderLibrary();
  }

  function leaveLecture() {
    if (!S.lectureMounted) return;
    S.lectureMounted = false;
    S.cv && S.cv.pause();
    S.lab && S.lab.stop();
    if (S.player && S.player.destroy) try { S.player.destroy(); } catch (e) { }
    S.player = null; S.ytState = "idle";
    clearInterval(S.poll);
  }

  /* ---------- Библиотека ---------- */
  function cover(hue, seed) {
    // Небольшой граф «узлы и рёбра» — детерминированный по seed.
    let x = seed * 9301 + 49297;
    const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
    const pts = Array.from({ length: 9 }, () => [12 + rnd() * 276, 12 + rnd() * 72]);
    const edges = pts.slice(1).map((p, i) => { const q = pts[Math.floor(rnd() * (i + 1))]; return `<line x1="${q[0].toFixed(0)}" y1="${q[1].toFixed(0)}" x2="${p[0].toFixed(0)}" y2="${p[1].toFixed(0)}"/>`; }).join("");
    const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${i % 3 ? 3.5 : 6}"/>`).join("");
    return `<svg viewBox="0 0 300 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="width:100%;height:100%;display:block">
      <rect width="300" height="96" fill="hsl(${hue} 45% 50% / .14)"/>
      <g stroke="hsl(${hue} 55% 45% / .55)" stroke-width="1.3">${edges}</g>
      <g fill="hsl(${hue} 60% 42%)">${dots}</g></svg>`;
  }

  function renderLibrary() {
    leaveLecture();
    const resume = C.moments.idempotency;
    const cards = [...S.extraCourses, ...C.library];
    $("#view").innerHTML = `
<div class="page">
  <div class="lib-head">
    <div>
      <div class="eyebrow">Библиотека</div>
      <h1 class="page-title">Мои курсы</h1>
      <p class="lead">Каждый курс — отдельное пространство со своими лекциями, материалами, лабораториями и чатом.</p>
    </div>
    <button class="btn" type="button" data-add-course>+ Добавить курс</button>
  </div>

  <section class="continue" aria-label="Продолжить обучение">
    <a class="continue-art" href="#lecture-tools-mcp" data-resume>
      <img src="assets/slides/slide-07.webp" alt="Слайд «Tool Design Principles»" loading="lazy">
      <span class="tc">▶ ${fmt(resume.t)}</span>
    </a>
    <div class="continue-body">
      <div class="eyebrow">Продолжить · Неделя агентов 2026 · Лекция 1.2</div>
      <h2>Tools &amp; MCP</h2>
      <div class="resume-at"><b>${fmt(resume.t)}</b><span>${esc(resume.label)}</span></div>
      <div class="path-mini" aria-label="Маршрут по лекции">
        <span class="on">Фрагмент видео</span><span>Объяснение</span><span>Code-video</span><span>Лаборатория</span>
      </div>
      <span class="demo-tag">Демо-прогресс: место остановки задано вручную</span>
      <div class="actions">
        <a class="btn btn--primary" href="#lecture-tools-mcp" data-resume>${ICON_PLAY} Продолжить с ${fmt(resume.t)}</a>
        <a class="btn" href="#course-shad">Открыть курс</a>
      </div>
    </div>
  </section>

  <div class="section-h"><h2>Курсы</h2><p>${cards.length} в библиотеке</p></div>
  <div class="cards">
    ${cards.map((c, i) => {
      const pct = Math.round(c.done / c.lectures * 100);
      const inner = `
        <div class="ccard-cover">${cover(c.hue, i + 3)}</div>
        <div class="ccard-body">
          <div class="ccard-org">${esc(c.org)}</div>
          <h3>${esc(c.title)}</h3>
          <p class="note">${esc(c.note)}</p>
          <div class="bar">
            <div class="bar-row"><span>${c.building ? "Сборка идёт" : `${c.done} из ${c.lectures} лекций`}</span><span>${c.building ? "демо" : pct + " %"}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${c.building ? 12 : pct}%"></div></div>
          </div>
        </div>`;
      return c.token
        ? `<a class="ccard" href="#${c.token}">${inner}</a>`
        : `<div class="ccard${c.building ? " ccard--building" : ""}">${inner}</div>`;
    }).join("")}
    <button class="ccard ccard--add" type="button" data-add-course>
      <span class="plus" aria-hidden="true">+</span>
      <b>Добавить курс</b>
      <span class="note">Ссылки на видео, слайды, ноутбуки</span>
    </button>
  </div>
  <p class="hint" style="margin-top:14px">Прогресс в карточках — демо-данные. Материалы есть только у курса «Неделя агентов 2026».</p>
</div>`;
    $$("[data-resume]").forEach(a => a.addEventListener("click", () => { S.pendingSeek = resume.t; }));
    $$("[data-add-course]").forEach(b => b.addEventListener("click", openAdd));
    $("#view").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ---------- Добавление курса (демо) ---------- */
  function openAdd() {
    $("#add-modal").hidden = false;
    $("#add-build").hidden = true;
    $("#add-submit").disabled = false;
    $("#add-name").focus();
  }
  function closeAdd() { $("#add-modal").hidden = true; }
  function setupAdd() {
    $$("[data-close-modal]").forEach(b => b.addEventListener("click", closeAdd));
    $("#add-modal").addEventListener("click", e => { if (e.target.id === "add-modal") closeAdd(); });
    $("#add-form").addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#add-name").value.trim() || "Новый курс";
      const stages = ["Создаю пространство курса", "Получаю субтитры с таймкодами", "Делю лекции на главы", "Сверяю слайды с речью", "Пишу конспект", "Готовлю code-video и лабораторию"];
      const box = $("#add-build");
      box.hidden = false;
      $("#add-submit").disabled = true;
      box.innerHTML = `<span class="demo-tag">Демо-состояние сборки: импорт ещё не реализован</span>` +
        stages.map((s, i) => `<div class="row" data-i="${i}"><i></i>${s}</div>`).join("");
      let i = 0;
      const tick = () => {
        $$(".build .row").forEach((r, k) => { r.className = "row" + (k < i ? " ok" : k === i ? " on" : ""); });
        if (i++ < 2) setTimeout(tick, 650);
        else setTimeout(() => {
          S.extraCourses.unshift({ title: name, org: "Добавлен сейчас", lectures: 1, done: 0, hue: 270, building: true, note: "Демо: сборка показана для оценки интерфейса" });
          closeAdd();
          $("#add-form").reset();
          if ((location.hash || "#library") === "#library") renderLibrary(); else location.hash = "library";
        }, 900);
      };
      tick();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") { closeAdd(); closeChat(); closeSide(); } });
  }

  /* ---------- Курс ---------- */
  const MAT = { video: "Видео", transcript: "Транскрипт", slides: "Слайды", notes: "Конспект", codevideo: "Code-video", lab: "Лаборатория" };
  const MAT_STATE = { ready: "готово", building: "собирается · демо", planned: "в плане · демо", none: "нет" };

  function renderCourse() {
    leaveLecture();
    const k = C.course;
    const lectures = k.modules.flatMap(m => m.lectures);
    const full = lectures.filter(l => Object.values(l.state).every(v => v === "ready")).length;
    $("#view").innerHTML = `
<div class="page">
  <nav class="crumbs" aria-label="Путь"><a href="#library">Библиотека</a><span>/</span><span>${esc(k.title)}</span></nav>
  <div class="course-head">
    <div>
      <div class="eyebrow">${esc(k.org)}</div>
      <h1 class="page-title">${esc(k.title)}</h1>
      <p class="lead">${esc(k.lead)}</p>
    </div>
    <div class="course-stats">
      <div><b>${lectures.length}</b><span>лекций</span></div>
      <div><b>${full}</b><span>собрана полностью</span></div>
      <div><b>${k.labs.filter(l => l.ready).length} / ${k.labs.length}</b><span>лабораторий готово</span></div>
    </div>
  </div>

  <div class="section-h"><h2>Модули и лекции</h2>
    <div class="legend"><span><span class="mat ready"><i></i>готово</span></span><span><span class="mat building"><i></i>собирается</span></span><span><span class="mat planned"><i></i>в плане</span></span><span><span class="mat"><i></i>нет</span></span></div>
  </div>
  <div class="modules">
    ${k.modules.map((m, mi) => `
    <section class="module">
      <div class="module-h"><b>Модуль ${mi + 1}. ${esc(m.title)}</b><span>${m.lectures.length} ${m.lectures.length === 1 ? "лекция" : "лекции"}</span></div>
      ${m.lectures.map(l => {
        const mats = Object.entries(MAT).map(([key, label]) => {
          const st = l.state[key];
          return `<span class="mat ${st}" title="${label}: ${MAT_STATE[st]}"><i></i>${label}${st === "building" || st === "planned" ? ` · ${MAT_STATE[st].split(" · ")[0]}` : ""}</span>`;
        }).join("");
        const body = `<span class="lcode">${l.code}</span>
          <div><div class="t">${esc(l.title)}</div>
          ${l.speaker ? `<div class="s">${esc(l.speaker)} · ${l.duration}</div>` : `<div class="s">Сборка не запускалась: есть только конспект</div>`}
          <div class="mats">${mats}</div></div>
          ${l.token ? `<span class="go">Открыть лекцию →</span>` : `<span class="go dim">не собрана</span>`}`;
        return l.token ? `<a class="lrow" href="#${l.token}">${body}</a>` : `<div class="lrow">${body}</div>`;
      }).join("")}
    </section>`).join("")}
  </div>
  <p class="hint" style="margin-top:10px">Состояния «собирается» и «в плане» показаны для оценки интерфейса, реальной сборки нет.</p>

  <div class="section-h" id="labs"><h2>Каталог лабораторий</h2><p>Эксперименты на примерах из лекций</p></div>
  <div class="labcards">
    ${k.labs.map(l => {
      const inner = `<div class="top"><span>${l.code} · лекция ${l.lecture}</span><span class="state-pill ${l.ready ? "ready" : "planned"}">${l.ready ? "готова" : "в плане · демо"}</span></div>
        <h3>${esc(l.title)}</h3><p>${esc(l.text)}</p>`;
      return l.ready ? `<a class="labcard" href="#${l.token}">${inner}</a>` : `<div class="labcard planned">${inner}</div>`;
    }).join("")}
  </div>
</div>`;
    $("#view").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ---------- Лекция ---------- */
  async function renderLecture(r) {
    if (S.lectureMounted) { scrollToSection(r); return; }
    leaveLecture();
    $("#view").innerHTML = `<div class="page"><p class="empty">Загружаю материалы лекции…</p></div>`;
    try { await loadData(); }
    catch (e) {
      $("#view").innerHTML = `<div class="page"><p class="empty">Не удалось загрузить данные лекции (${esc(e.message)}). Откройте прототип через веб-сервер, а не как файл.</p></div>`;
      return;
    }
    const D = S.data, M = C.moments;
    const l = C.course.modules[0].lectures[1];
    $("#view").innerHTML = `
<div class="page">
  <nav class="crumbs" aria-label="Путь"><a href="#library">Библиотека</a><span>/</span><a href="#course-shad">${esc(C.course.title)}</a><span>/</span><span>Лекция 1.2</span></nav>
  <header class="lec-head">
    <div class="eyebrow">Модуль 1 · Основы агентов · Лекция 1.2</div>
    <h1 class="page-title">Tools &amp; MCP</h1>
    <p class="lead" style="margin-top:4px">Как модель «пользуется» инструментами, каким должен быть хороший инструмент и зачем понадобился Model Context Protocol.</p>
    <div class="lec-meta">
      <span>${esc(l.speaker)}, AI Lead, Яндекс Лавка</span>
      <span>Видео ${fmt(D.duration)}</span>
      <span>${D.slides.length} слайдов</span>
      <span>${D.chapters.length} глав</span>
      <span>Субтитры: автоматические YouTube, ${D.segs.length} фрагментов</span>
      <a href="${C.video.url}" target="_blank" rel="noopener">Оригинал на YouTube ↗</a>
    </div>
  </header>

  <nav class="route" aria-label="Маршрут по лекции">
    <a href="#tools-mcp-video" data-route="video" data-seek="${M.idempotency.t}"><span class="n">1 · фрагмент видео</span><b>${fmt(M.idempotency.t)} Безопасные повторы</b><small>Лектор объясняет идемпотентность</small></a>
    <a href="#tools-mcp-notes" data-route="notes" data-notes="4"><span class="n">2 · объяснение</span><b>Конспект §4</b><small>Принципы проектирования инструментов</small></a>
    <a href="#tools-mcp-codevideo" data-route="codevideo"><span class="n">3 · code-video</span><b>Один ход агента</b><small>Запрос → модель → вызов → выполнение → ответ</small></a>
    <a href="#tools-mcp-lab" data-route="lab"><span class="n">4 · лаборатория</span><b>Повтор с ключом и без</b><small>Сломайте cancel_booking сами</small></a>
  </nav>

  <nav class="localnav" aria-label="Разделы лекции">
    <a href="#tools-mcp-video" data-sec="video">Видео</a>
    <a href="#tools-mcp-notes" data-sec="notes">Конспект</a>
    <a href="#tools-mcp-code" data-sec="code">Код</a>
    <a href="#tools-mcp-codevideo" data-sec="codevideo">Code-video</a>
    <a href="#tools-mcp-lab" data-sec="lab">Лаборатория</a>
    <span class="spacer"></span>
    <button class="btn btn--small" type="button" data-open-chat>Чат лекции</button>
  </nav>

  <section id="sec-video" class="watch" aria-label="Видео, главы и транскрипт">
    <div class="player-col">
      <div class="player"><div id="yt"></div>
        <div class="player-fallback" hidden><div>
          <b>Видео не загрузилось</b>
          <p>Встроенный плеер YouTube недоступен в этом окне. Таймкоды продолжают работать как ссылки на YouTube.</p>
          <a class="btn btn--primary yt-link" href="${C.video.url}" target="_blank" rel="noopener">Открыть на YouTube</a>
        </div></div>
      </div>
      <div class="nowbar"><span class="tc now-tc">0:00</span><span>·</span><b class="now-ch"></b></div>
      <div class="chap-strip" aria-hidden="true">${D.chapters.map((c, i) => {
        const end = i + 1 < D.chapters.length ? D.chapters[i + 1].t : D.duration;
        return `<span style="flex:${(end - c.t).toFixed(1)}"></span>`;
      }).join("")}</div>
      <div class="chapters" role="list">
        ${D.chapters.map((c, i) => `
        <div class="chap" role="listitem" data-ch="${i}" data-seek="${c.t}" tabindex="0">
          <span class="tc">${fmt(c.t)}</span>
          <div><div class="t">${esc(c.title)}</div><div class="s">${esc(c.summary)}</div></div>
          ${c.notes_section ? `<a class="more" href="#tools-mcp-notes" data-notes="${c.notes_section}">Конспект §${c.notes_section} →</a>` : "<span></span>"}
        </div>`).join("")}
      </div>
    </div>
    <aside class="panel" aria-label="Транскрипт и слайды">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" data-ptab="transcript" aria-selected="true">Транскрипт</button>
        <button type="button" role="tab" data-ptab="slides" aria-selected="false">Слайды · ${D.slides.length}</button>
      </div>
      <div class="ptab" data-pane="transcript">
        <div class="tr-tools">
          <div class="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
            <label class="sr" for="tr-q">Поиск по транскрипту</label>
            <input id="tr-q" type="search" placeholder="Поиск по транскрипту: «тайм-аут», «MCP», «host»…" autocomplete="off">
          </div>
          <div class="tr-meta"><span class="tr-count">Автоматические субтитры YouTube</span>
            <label><input type="checkbox" id="tr-follow" checked> следовать за видео</label></div>
        </div>
      </div>
      <div class="panel-body" id="panel-body"></div>
    </aside>
  </section>

  <section id="sec-notes" aria-labelledby="notes-h">
    <div class="section-h"><h2 id="notes-h">Конспект</h2><p>Таймкоды и слайды привязаны к разделам</p></div>
    <div class="reading">
      <article class="notes" id="notes"></article>
      <nav class="toc" id="toc" aria-label="Оглавление конспекта"></nav>
    </div>
  </section>

  <section id="sec-code" aria-labelledby="code-h">
    <div class="section-h"><h2 id="code-h">Разобранный код</h2><p>Фрагменты практического ноутбука с пояснениями к строкам</p></div>
    <div class="wt-tabs" role="tablist">${C.walkthrough.map((w, i) => `<button type="button" role="tab" data-wt="${i}" aria-selected="${i === 0}">${esc(w.title)}</button>`).join("")}</div>
    <div class="wt" id="wt"></div>
  </section>

  <section id="sec-codevideo" aria-labelledby="cv-h">
    <div class="section-h"><h2 id="cv-h">Code-video</h2><p>Цикл одного вызова: запрос → модель → вызов → выполнение → результат → ответ</p></div>
    <div id="cv-root"></div>
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="chip" type="button" data-seek="${M.cancelDemo.t}">${ICON_PLAY}<span class="tc">${fmt(M.cancelDemo.t)}</span> Этот же сценарий в видео</button>
      <a class="chip chip--strong" href="#tools-mcp-lab">Что будет при повторе? Открыть лабораторию →</a>
    </div>
  </section>

  <section id="sec-lab" aria-labelledby="lab-h">
    <div class="section-h"><h2 id="lab-h">Лаборатория · L01 Повтор вызова и идемпотентность</h2><p>Тот же cancel_booking: меняйте условия и следите за базой</p></div>
    <div id="lab-root"></div>
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="chip" type="button" data-seek="${M.idempotency.t}">${ICON_PLAY}<span class="tc">${fmt(M.idempotency.t)}</span> ${esc(M.idempotency.label)}</button>
      <button class="chip" type="button" data-seek="${M.errors.t}">${ICON_PLAY}<span class="tc">${fmt(M.errors.t)}</span> ${esc(M.errors.label)}</button>
    </div>
  </section>
</div>`;

    S.lectureMounted = true;
    renderPanel();
    renderNotes();
    renderWalkthrough(0);
    S.cv = window.CodeVideo.mount($("#cv-root"), { highlightLines });
    S.lab = window.Lab.mount($("#lab-root"));
    bindLecture();
    setupPlayer();
    updateNow(S.pendingSeek ?? 0, true);
    if (S.pendingSeek != null) { const t = S.pendingSeek; S.pendingSeek = null; seek(t, { scroll: false }); }
    $("#view").focus({ preventScroll: true });
    if (r === "lecture-tools-mcp") window.scrollTo(0, 0); else requestAnimationFrame(() => scrollToSection(r));
  }

  function scrollToSection(r) {
    const sec = r.replace("tools-mcp-", "");
    const el = $("#sec-" + sec);
    if (r === "lecture-tools-mcp" || !el) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    S.visited.add(sec);
    markRoute();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markRoute() { $$(".route a").forEach(a => a.classList.toggle("done", S.visited.has(a.dataset.route))); }

  /* ---------- Плеер ---------- */
  function setupPlayer() {
    const fallback = () => {
      if (S.ytState === "ready") return;
      S.ytState = "failed";
      const fb = $(".player-fallback");
      if (fb) fb.hidden = false;
    };
    const create = () => {
      if (!$("#yt")) return;
      S.player = new YT.Player("yt", {
        videoId: C.video.id,
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1, hl: "ru", cc_lang_pref: "ru" },
        events: {
          onReady: () => {
            S.ytState = "ready";
            if (S.pendingSeek != null) { S.player.seekTo(S.pendingSeek, true); S.pendingSeek = null; }
          },
          onError: fallback
        }
      });
    };
    S.ytState = "loading";
    if (window.YT && window.YT.Player) create();
    else {
      window.onYouTubeIframeAPIReady = create;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.onerror = fallback;
        document.head.appendChild(s);
      }
    }
    setTimeout(() => { if (S.ytState !== "ready") fallback(); }, 9000);
    clearInterval(S.poll);
    S.poll = setInterval(() => {
      if (S.ytState === "ready" && S.player && S.player.getCurrentTime) {
        const t = S.player.getCurrentTime();
        if (Math.abs(t - S.now) > .2) updateNow(t);
      }
    }, 350);
  }

  function seek(t, { scroll = true, play = true } = {}) {
    if (!S.lectureMounted) { S.pendingSeek = t; location.hash = "lecture-tools-mcp"; return; }
    updateNow(t, true);
    const link = $(".yt-link");
    if (link) link.href = `${C.video.url}&t=${Math.floor(t)}s`;
    if (S.ytState === "ready" && S.player) {
      S.player.seekTo(t, true);
      if (play) S.player.playVideo();
    } else if (S.ytState !== "failed") S.pendingSeek = t;
    S.visited.add("video");
    markRoute();
    if (scroll) {
      const p = $(".player");
      const r = p.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) p.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function updateNow(t, force) {
    S.now = t;
    if (!S.data || !$(".now-tc")) return;
    const ci = chapterAt(t);
    $(".now-tc").textContent = fmt(t);
    $(".now-ch").textContent = S.data.chapters[ci].title;
    $$(".chap").forEach((el, i) => el.classList.toggle("now", i === ci));
    $$(".chap-strip span").forEach((el, i) => el.classList.toggle("now", i === ci));
    // текущий сегмент транскрипта
    const segs = S.data.segs;
    let lo = 0, hi = segs.length - 1, si = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (segs[mid].t <= t) { si = mid; lo = mid + 1; } else hi = mid - 1; }
    const prev = $(".seg.now");
    if (prev) prev.classList.remove("now");
    const el = si >= 0 ? $(`.seg[data-i="${si}"]`) : null;
    if (el) {
      el.classList.add("now");
      if (S.follow || force) {
        const body = $("#panel-body");
        const er = el.getBoundingClientRect(), br = body.getBoundingClientRect();
        if (er.top < br.top + 40 || er.bottom > br.bottom - 40) body.scrollTo({ top: body.scrollTop + er.top - br.top - br.height / 3, behavior: force ? "auto" : "smooth" });
      }
    }
    // слайд, который сейчас на экране у лектора
    let live = -1;
    S.data.slides.forEach((s, i) => { if (s.t != null && s.t <= t) live = i; });
    S.liveSlide = live;
    $$(".thumbs button").forEach((b, i) => { const d = b.querySelector(".live"); if (d) d.hidden = i !== live; });
  }

  /* ---------- Панель: транскрипт и слайды ---------- */
  function renderPanel() {
    $$("[data-ptab]").forEach(b => b.setAttribute("aria-selected", b.dataset.ptab === S.panelTab));
    $('[data-pane="transcript"]').hidden = S.panelTab !== "transcript";
    if (S.panelTab === "transcript") renderTranscript($("#tr-q").value.trim());
    else renderSlides();
  }

  function renderTranscript(query) {
    const D = S.data, body = $("#panel-body");
    if (query.length >= 2) {
      const nq = norm(query);
      const hits = [];
      D.segs.forEach((s, i) => {
        const joined = norm(s.text + " " + (D.segs[i + 1] ? D.segs[i + 1].text : ""));
        if (norm(s.text).includes(nq) || (joined.includes(nq) && !norm(D.segs[i + 1]?.text || "").includes(nq))) hits.push(i);
      });
      $(".tr-count").textContent = hits.length ? `Найдено: ${hits.length}` : "Ничего не найдено";
      const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[её]/gi, "[её]"), "gi");
      body.innerHTML = hits.length ? `<ul class="hits">${hits.slice(0, 200).map(i => {
        const s = D.segs[i], ctx = [D.segs[i - 1], s, D.segs[i + 1]].filter(Boolean).map(x => x.text).join(" ");
        return `<li><button type="button" data-seek="${s.t}" data-seg="${i}"><span class="tc">${fmt(s.t)}</span><span><span class="ch">${esc(D.chapters[chapterAt(s.t)].title)}</span>${esc(ctx).replace(re, m => `<mark>${m}</mark>`)}</span></button></li>`;
      }).join("")}</ul>` : `<p class="empty">По запросу «${esc(query)}» в субтитрах ничего нет. Автосубтитры иногда искажают термины: попробуйте часть слова.</p>`;
      return;
    }
    $(".tr-count").textContent = "Автоматические субтитры YouTube";
    const parts = [];
    D.chapters.forEach((c, ci) => {
      const end = ci + 1 < D.chapters.length ? D.chapters[ci + 1].t : Infinity;
      const idx = [];
      D.segs.forEach((s, i) => { if (s.t >= c.t && s.t < end) idx.push(i); });
      if (!idx.length) return;
      const paras = [];
      let cur = [];
      idx.forEach(i => {
        cur.push(i);
        const txt = D.segs[i].text.trim();
        if ((cur.length >= 7 && /[.?!]$/.test(txt)) || cur.length >= 12) { paras.push(cur); cur = []; }
      });
      if (cur.length) paras.push(cur);
      parts.push(`<div class="tr-chapter"><h4><button type="button" data-seek="${c.t}">${fmt(c.t)}</button>${esc(c.title)}</h4>${paras.map(p =>
        `<p class="tr-para"><button type="button" class="tr-tc" data-seek="${D.segs[p[0]].t}">${fmt(D.segs[p[0]].t)}</button>${p.map(i => `<span class="seg" data-i="${i}" data-seek="${D.segs[i].t}">${esc(D.segs[i].text)}</span>`).join(" ")}</p>`).join("")}</div>`);
    });
    body.innerHTML = parts.join("");
    updateNow(S.now, true);
  }

  function renderSlides() {
    const D = S.data, s = D.slides[S.slide], body = $("#panel-body");
    const n = String(s.n).padStart(2, "0");
    const conf = { high: "момент найден по речи лектора", medium: "момент найден приблизительно", low: "привязка неуверенная", none: "момент в видео не определён" }[s.t_confidence];
    body.innerHTML = `
      <div class="slides-view">
        <div class="slide-main"><img src="assets/slides/slide-${n}.webp" alt="Слайд ${s.n}: ${esc(s.title)}"></div>
        <div class="slide-cap"><b>${esc(s.title)}</b><span class="n">${s.n} / ${D.slides.length}</span></div>
        <div class="slide-nav">
          <button class="btn btn--small" type="button" data-slide="${S.slide - 1}" ${S.slide === 0 ? "disabled" : ""} aria-label="Предыдущий слайд">←</button>
          <button class="btn btn--small" type="button" data-slide="${S.slide + 1}" ${S.slide === D.slides.length - 1 ? "disabled" : ""} aria-label="Следующий слайд">→</button>
          ${s.t != null ? `<button class="btn btn--small btn--primary" type="button" data-seek="${s.t}">${ICON_PLAY} ${fmt(s.t)} в видео</button>` : ""}
          ${S.liveSlide >= 0 && S.liveSlide !== S.slide ? `<button class="btn btn--small" type="button" data-slide="${S.liveSlide}">К слайду из видео</button>` : ""}
        </div>
        <span class="conf">Привязка: ${conf}</span>
      </div>
      <div class="thumbs">${D.slides.map((x, i) => `<button type="button" data-slide="${i}" aria-current="${i === S.slide}" aria-label="Слайд ${x.n}: ${esc(x.title)}"><img src="assets/slides/thumb-${String(x.n).padStart(2, "0")}.webp" alt="" loading="lazy"><span class="num">${x.n}</span><span class="live" ${i === S.liveSlide ? "" : "hidden"}></span></button>`).join("")}</div>`;
  }

  /* ---------- Конспект ---------- */
  const FIG_LOOP = `<figure class="figure"><svg viewBox="0 0 620 200" role="img" aria-label="Цикл tool calling: пользователь, модель, код агента, функция, результат обратно в модель">
    <defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
    <g font-family="var(--f-ui)" font-size="13" font-weight="600">
      <rect x="6" y="70" width="104" height="52" rx="10" fill="var(--surface)" stroke="var(--c-user)" stroke-width="1.6"/><text x="58" y="101" text-anchor="middle" fill="var(--ink)">Пользователь</text>
      <rect x="168" y="70" width="104" height="52" rx="10" fill="var(--surface)" stroke="var(--c-model)" stroke-width="1.6"/><text x="220" y="94" text-anchor="middle" fill="var(--ink)">LLM</text><text x="220" y="111" text-anchor="middle" fill="var(--muted)" font-weight="400" font-size="11">пишет текст</text>
      <rect x="330" y="70" width="120" height="52" rx="10" fill="var(--surface)" stroke="var(--c-call)" stroke-width="1.6"/><text x="390" y="94" text-anchor="middle" fill="var(--ink)">Код агента</text><text x="390" y="111" text-anchor="middle" fill="var(--muted)" font-weight="400" font-size="11">видит tool_call</text>
      <rect x="506" y="70" width="108" height="52" rx="10" fill="var(--surface)" stroke="var(--c-exec)" stroke-width="1.6"/><text x="560" y="94" text-anchor="middle" fill="var(--ink)">Функция</text><text x="560" y="111" text-anchor="middle" fill="var(--muted)" font-weight="400" font-size="11">выполняется</text>
    </g>
    <g stroke="var(--muted)" stroke-width="1.5" fill="none" marker-end="url(#ar2)">
      <path d="M110 96 H166"/><path d="M272 90 H328"/><path d="M450 96 H504"/>
      <path d="M560 122 C 560 178, 220 178, 220 124"/><path d="M168 82 C 120 30, 70 40, 60 68"/>
    </g>
    <g font-family="var(--f-mono)" font-size="11" fill="var(--muted)">
      <text x="300" y="82" text-anchor="middle">JSON {name, args}</text>
      <text x="390" y="170" text-anchor="middle">TOOL_RESULT → снова в модель</text>
      <text x="96" y="30">финальный ответ</text>
    </g></svg>
    <figcaption>Модель только генерирует текст. Вызов распознаёт и исполняет код агента, результат возвращается модели. Подробно по шагам — в code-video ниже.</figcaption></figure>`;

  const FIG_MCP = `<figure class="figure"><svg viewBox="0 0 620 232" role="img" aria-label="Архитектура MCP: Host содержит по одному Client на каждый Server, связь по JSON-RPC 2.0">
    <defs><marker id="ar3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
    <rect x="6" y="10" width="300" height="212" rx="12" fill="var(--sunken)" stroke="var(--line-strong)"/>
    <text x="22" y="34" font-family="var(--f-ui)" font-size="13" font-weight="700" fill="var(--ink)">Host</text>
    <text x="62" y="34" font-family="var(--f-mono)" font-size="11" fill="var(--muted)">Claude Code, Cursor, свой агент</text>
    <rect x="22" y="52" width="110" height="46" rx="8" fill="var(--surface)" stroke="var(--c-model)" stroke-width="1.5"/><text x="77" y="80" text-anchor="middle" font-family="var(--f-ui)" font-size="12.5" font-weight="600" fill="var(--ink)">LLM + UI</text>
    <g font-family="var(--f-ui)" font-size="12.5" font-weight="600" fill="var(--ink)">
      <rect x="170" y="52" width="120" height="40" rx="8" fill="var(--surface)" stroke="var(--c-call)" stroke-width="1.5"/><text x="230" y="77" text-anchor="middle">Client 1</text>
      <rect x="170" y="112" width="120" height="40" rx="8" fill="var(--surface)" stroke="var(--c-call)" stroke-width="1.5"/><text x="230" y="137" text-anchor="middle">Client 2</text>
      <rect x="170" y="172" width="120" height="40" rx="8" fill="var(--surface)" stroke="var(--c-call)" stroke-width="1.5"/><text x="230" y="197" text-anchor="middle">Client 3</text>
      <rect x="440" y="52" width="170" height="40" rx="8" fill="var(--surface)" stroke="var(--c-exec)" stroke-width="1.5"/><text x="525" y="77" text-anchor="middle">Server · PostgreSQL</text>
      <rect x="440" y="112" width="170" height="40" rx="8" fill="var(--surface)" stroke="var(--c-exec)" stroke-width="1.5"/><text x="525" y="137" text-anchor="middle">Server · Git</text>
      <rect x="440" y="172" width="170" height="40" rx="8" fill="var(--surface)" stroke="var(--c-exec)" stroke-width="1.5"/><text x="525" y="197" text-anchor="middle">Server · Slack</text>
    </g>
    <g stroke="var(--muted)" stroke-width="1.4" fill="none">
      <path d="M132 75 H168" marker-end="url(#ar3)"/><path d="M132 82 C 150 82, 150 132, 168 132" marker-end="url(#ar3)"/><path d="M132 90 C 146 90, 146 192, 168 192" marker-end="url(#ar3)"/>
      <path d="M292 72 H438" marker-start="url(#ar3)" marker-end="url(#ar3)"/><path d="M292 132 H438" marker-start="url(#ar3)" marker-end="url(#ar3)"/><path d="M292 192 H438" marker-start="url(#ar3)" marker-end="url(#ar3)"/>
    </g>
    <text x="365" y="64" text-anchor="middle" font-family="var(--f-mono)" font-size="10.5" fill="var(--muted)">JSON-RPC 2.0</text>
    </svg>
    <figcaption>Один Client — одно соединение с одним Server. Host собирает общий каталог инструментов от всех серверов при инициализации. Серверы в схеме — примеры категорий из лекции.</figcaption></figure>`;

  function renderNotes() {
    const el = $("#notes");
    el.innerHTML = window.marked ? marked.parse(S.notesMd) : `<pre>${esc(S.notesMd)}</pre>`;
    // таблицы в прокручиваемую обёртку
    $$("table", el).forEach(t => { const w = document.createElement("div"); w.className = "table-wrap"; t.replaceWith(w); w.appendChild(t); });
    $$("pre code", el).forEach(c => { if (window.hljs && /python/.test(c.className)) hljs.highlightElement(c); });
    const toc = [];
    $$("h2", el).forEach(h => {
      const m = h.textContent.match(/^(\d+)\.\s*(.+)$/);
      if (!m) return;
      const n = +m[1];
      h.id = "n-" + n;
      toc.push({ n, title: m[2] });
      const chs = S.data.chapters.filter(c => c.notes_section === n);
      const chips = [];
      if (chs.length) {
        const c0 = chs[0];
        chips.push(`<button class="chip" type="button" data-seek="${c0.t}">${ICON_PLAY}<span class="tc">${fmt(c0.t)}</span> ${esc(c0.title)}</button>`);
        const sl = chs.map(c => c.slides).filter(Boolean);
        if (sl.length) {
          const a = Math.min(...sl.map(x => x[0])), b = Math.max(...sl.map(x => x[1]));
          chips.push(`<button class="chip" type="button" data-open-slide="${a - 1}">Слайд${a === b ? ` ${a}` : `ы ${a}–${b}`}</button>`);
        }
      }
      if (n === 3) chips.push(`<a class="chip chip--strong" href="#tools-mcp-codevideo">Code-video: цикл вызова →</a>`);
      if (n === 11) chips.push(`<a class="chip" href="#tools-mcp-code">Разобранный код →</a>`);
      if (chips.length) h.insertAdjacentHTML("afterend", `<div class="sec-chips">${chips.join("")}</div>`);
    });
    // §3: ASCII-схему цикла заменяем рисунком
    const h3 = $("#n-3", el);
    if (h3) {
      let node = h3.nextElementSibling;
      while (node && node.tagName !== "H2") { if (node.tagName === "PRE") { node.insertAdjacentHTML("beforebegin", FIG_LOOP); node.remove(); break; } node = node.nextElementSibling; }
    }
    // §4: связь принципов с примером из ноутбука
    const h4 = $("#n-4", el);
    if (h4) {
      const tableWrap = (() => { let n = h4.nextElementSibling; while (n && n.tagName !== "H2") { if (n.classList.contains("table-wrap")) return n; n = n.nextElementSibling; } return null; })();
      (tableWrap || h4).insertAdjacentHTML("afterend", `<div class="callout">
        <div><b>На примере из практики.</b> <code>cancel_booking</code> в ноутбуке не идемпотентен: каждый вызов делает <code>seats += 1</code> и считает возврат, статус не проверяется. Если ответ потерялся и агент повторил вызов, место и возврат удвоятся.</div>
        <div class="row">
          <button class="chip" type="button" data-seek="${C.moments.idempotency.t}">${ICON_PLAY}<span class="tc">${fmt(C.moments.idempotency.t)}</span> лектор про повторы</button>
          <a class="chip" href="#tools-mcp-codevideo">Code-video: один вызов</a>
          <a class="chip chip--strong" href="#tools-mcp-lab" data-lab-scen="lost">Лаборатория: потерянный ответ →</a>
        </div></div>`);
    }
    const h7 = $("#n-7", el);
    if (h7) { const c = h7.nextElementSibling; (c && c.classList.contains("sec-chips") ? c : h7).insertAdjacentHTML("afterend", FIG_MCP); }

    $("#toc").innerHTML = `<div class="eyebrow">Разделы</div>` + toc.map(t => `<a href="#tools-mcp-notes" data-notes="${t.n}">${t.n}. ${esc(t.title)}</a>`).join("");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => {
        es.forEach(e => {
          if (!e.isIntersecting) return;
          const n = e.target.id.slice(2);
          $$("#toc a").forEach(a => a.classList.toggle("on", a.dataset.notes === n));
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      $$("h2[id^='n-']", el).forEach(h => io.observe(h));
    }
  }

  function goNotes(n) {
    const h = $("#n-" + n);
    if (!h) return;
    S.visited.add("notes");
    markRoute();
    h.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Разобранный код ---------- */
  function renderWalkthrough(i, active = 0) {
    const w = C.walkthrough[i];
    $$("[data-wt]").forEach(b => b.setAttribute("aria-selected", +b.dataset.wt === i));
    $("#wt").innerHTML = `
      <div class="wt-lead"><span>${esc(w.cell)}</span><div style="flex-basis:100%">${esc(w.lead)}</div></div>
      <pre class="code" id="wt-code">${highlightLines(w.code)}</pre>
      <ol class="wt-notes">${w.notes.map((n, k) => `<li class="${n.warn ? "warn" : ""}"><button type="button" data-note="${k}" aria-pressed="${k === active}">
        <span class="lines">${n.lines[0] === n.lines[1] ? "стр. " + n.lines[0] : n.lines[0] + "–" + n.lines[1]}</span>
        <span>${n.text}${n.lab ? `<br><a class="to-lab" href="#tools-mcp-lab" data-lab-scen="lost">Проверить в лаборатории →</a>` : ""}</span></button></li>`).join("")}</ol>`;
    const mark = k => {
      const n = w.notes[k];
      $$("#wt-code .ln").forEach((ln, idx) => {
        const on = idx + 1 >= n.lines[0] && idx + 1 <= n.lines[1];
        ln.classList.toggle("hl", on);
        ln.classList.toggle("warn", on && !!n.warn);
      });
      $$("[data-note]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.note === k));
    };
    $$("[data-note]").forEach(b => b.addEventListener("click", e => { if (e.target.closest("a")) return; mark(+b.dataset.note); }));
    mark(active);
  }

  /* ---------- События лекции ---------- */
  function bindLecture() {
    const view = $("#view");
    view.addEventListener("click", e => {
      const seekEl = e.target.closest("[data-seek]");
      const notesEl = e.target.closest("[data-notes]");
      const slideEl = e.target.closest("[data-slide]");
      const openSlide = e.target.closest("[data-open-slide]");
      const ptab = e.target.closest("[data-ptab]");
      const wt = e.target.closest("[data-wt]");
      const labScen = e.target.closest("[data-lab-scen]");
      const secLink = e.target.closest('a[href^="#tools-mcp-"]');
      if (notesEl && (!seekEl || seekEl.contains(notesEl))) { e.preventDefault(); goNotes(+notesEl.dataset.notes); return; }
      if (labScen && S.lab) S.lab.setScenario(labScen.dataset.labScen, { compare: true });
      if (secLink && !seekEl && secLink.getAttribute("href") === location.hash) { e.preventDefault(); scrollToSection(location.hash.slice(1)); return; }
      if (seekEl) {
        e.preventDefault();
        seek(+seekEl.dataset.seek, { scroll: !seekEl.closest(".panel") });
        if (seekEl.dataset.route) location.hash = "tools-mcp-video";
        return;
      }
      if (slideEl) { S.slide = +slideEl.dataset.slide; renderSlides(); return; }
      if (openSlide) { S.slide = +openSlide.dataset.openSlide; S.panelTab = "slides"; renderPanel(); seek(S.data.slides[S.slide].t ?? S.now, { play: false }); return; }
      if (ptab) { S.panelTab = ptab.dataset.ptab; renderPanel(); return; }
      if (wt) { renderWalkthrough(+wt.dataset.wt); return; }
    });
    view.addEventListener("keydown", e => {
      const ch = e.target.closest(".chap");
      if (ch && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); seek(+ch.dataset.seek); }
    });
    $("#tr-q").addEventListener("input", e => renderTranscript(e.target.value.trim()));
    $("#tr-follow").addEventListener("change", e => { S.follow = e.target.checked; });
    // локальная навигация подсвечивает видимый раздел
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(en => {
        if (!en.isIntersecting) return;
        const sec = en.target.id.replace("sec-", "");
        $$(".localnav a").forEach(a => a.classList.toggle("on", a.dataset.sec === sec));
      }), { rootMargin: "-30% 0px -60% 0px" });
      ["video", "notes", "code", "codevideo", "lab"].forEach(s => { const el = $("#sec-" + s); if (el) io.observe(el); });
    }
    $$("[data-open-chat]", view).forEach(b => b.addEventListener("click", openChat));
  }

  /* ---------- Чат (демо) ---------- */
  function refChip(r) {
    if (r.moment) { const m = C.moments[r.moment]; return `<button class="chip" type="button" data-ref-seek="${m.t}">${ICON_PLAY}<span class="tc">${fmt(m.t)}</span> ${esc(m.label)}</button>`; }
    if (r.notes) return `<button class="chip" type="button" data-ref-notes="${r.notes}">Конспект §${r.notes}</button>`;
    if (r.codevideo != null) return `<button class="chip" type="button" data-ref-cv="${r.codevideo}">${esc(r.label)}</button>`;
    if (r.lab) return `<button class="chip chip--strong" type="button" data-ref-lab="${r.lab}">${esc(r.label)}</button>`;
    return "";
  }
  function setupChat() {
    const log = $("#chat-log");
    log.innerHTML = `<div class="bubble bot"><span class="demo-tag">Демо</span><span>Я отвечаю по материалам этой лекции и даю ссылки на моменты видео, разделы конспекта и лабораторию. В прототипе ответы подготовлены заранее — выберите вопрос ниже.</span></div>`;
    $("#chat-suggest").innerHTML = C.chat.map((c, i) => `<button type="button" data-q="${i}">${esc(c.q)}</button>`).join("");
    const ask = (q, a) => {
      log.insertAdjacentHTML("beforeend", `<div class="bubble me">${esc(q)}</div>`);
      log.insertAdjacentHTML("beforeend", a);
      log.scrollTop = log.scrollHeight;
    };
    $("#chat-suggest").addEventListener("click", e => {
      const b = e.target.closest("[data-q]");
      if (!b) return;
      const c = C.chat[+b.dataset.q];
      ask(c.q, `<div class="bubble bot"><span class="demo-tag">Демо-ответ, подготовлен заранее</span><span>${esc(c.a)}</span><div class="refs">${c.refs.map(refChip).join("")}</div></div>`);
    });
    $("#chat-form").addEventListener("submit", e => {
      e.preventDefault();
      const v = $("#chat-input").value.trim();
      if (!v) return;
      $("#chat-input").value = "";
      ask(v, `<div class="bubble bot"><span class="demo-tag">Демо</span><span>Агент чата появится на следующем этапе, свободные вопросы пока без ответа. Попробуйте один из подготовленных вопросов.</span></div>`);
    });
    log.addEventListener("click", e => {
      const s = e.target.closest("[data-ref-seek]"), n = e.target.closest("[data-ref-notes]"),
        cv = e.target.closest("[data-ref-cv]"), lab = e.target.closest("[data-ref-lab]");
      if (!(s || n || cv || lab)) return;
      if (window.innerWidth < 1100) closeChat();
      const act = () => {
        if (s) seek(+s.dataset.refSeek);
        if (n) goNotes(+n.dataset.refNotes);
        if (cv) { S.cv.goStep(+cv.dataset.refCv); $("#sec-codevideo").scrollIntoView({ behavior: "smooth" }); }
        if (lab) { S.lab.setScenario(lab.dataset.refLab, { compare: true }); $("#sec-lab").scrollIntoView({ behavior: "smooth" }); }
      };
      if (S.lectureMounted) act();
      else { location.hash = "lecture-tools-mcp"; const wait = setInterval(() => { if (S.lectureMounted) { clearInterval(wait); act(); } }, 100); }
    });
    $("#chat-close").addEventListener("click", closeChat);
    $$(".topbar [data-open-chat]").forEach(b => b.addEventListener("click", openChat));
  }
  function openChat() { const c = $("#chat"); c.classList.add("open"); c.setAttribute("aria-hidden", "false"); setTimeout(() => $("#chat-input").focus(), 250); }
  function closeChat() { const c = $("#chat"); c.classList.remove("open"); c.setAttribute("aria-hidden", "true"); }

  /* ---------- Мобильное меню ---------- */
  function openSide() { $("#side").classList.add("open"); $("#scrim").hidden = false; $("#menu-btn").setAttribute("aria-expanded", "true"); }
  function closeSide() { $("#side").classList.remove("open"); $("#scrim").hidden = true; $("#menu-btn").setAttribute("aria-expanded", "false"); }

  $("#menu-btn").addEventListener("click", () => $("#side").classList.contains("open") ? closeSide() : openSide());
  $("#scrim").addEventListener("click", closeSide);
  setupAdd();
  setupChat();
  window.addEventListener("hashchange", route);
  route();
})();
