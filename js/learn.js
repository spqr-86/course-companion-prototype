/* Ядро обучения 0.4: состояние, статусы, проверка-заглушка. Без DOM. */
(function () {
  const KEY = "cc-preview-0.4";
  const ORDER = ["seen", "helped", "solved", "self"]; // статус не понижается
  const empty = () => ({ onboarded: false, status: {}, understood: {}, disputed: {}, versions: {}, problems: {}, lab: {}, checks: {}, last: null });
  let cache = null;

  // Любой доступ к localStorage — в try/catch: приватный режим и битый JSON не должны ронять страницу.
  function load() {
    const base = empty();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const k of Object.keys(base)) {
          const v = raw[k];
          if (k === "onboarded") base[k] = v === true;
          else if (k === "last") base[k] = v && typeof v === "object" ? v : null;
          else if (v && typeof v === "object" && !Array.isArray(v)) base[k] = v;
        }
      }
    } catch (e) { /* чистое состояние */ }
    return base;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* хранилище недоступно */ }
  }
  function state() { return cache || (cache = load()); }
  function emit(detail) {
    try { window.dispatchEvent(new CustomEvent("cc:learn", { detail })); } catch (e) { /* не критично */ }
  }
  function save(patch) {
    Object.assign(state(), patch || {});
    persist();
    emit({ patch: Object.keys(patch || {}) });
  }
  function reset() {
    cache = empty();
    try { localStorage.removeItem(KEY); } catch (e) { /* ничего */ }
    emit({ reset: true });
  }
  const key = (lecture, unit) => lecture + ":" + unit;

  function setStatus(k, status) {
    const to = ORDER.indexOf(status);
    if (to < 0) return;
    const s = state();
    if (ORDER.indexOf(s.status[k]) >= to) return; // повышаем, не понижаем
    s.status[k] = status;
    persist();
    emit({ key: k, status });
  }
  function progress(lecture, units) {
    const s = state().status;
    return { self: units.filter(u => s[key(lecture, u)] === "self").length, total: units.length };
  }
  function touch(place) {
    if (!place) return;
    state().last = place;
    persist();
    emit({ last: place });
  }

  // Проверка-заглушка: слова, основы понятий. Не ИИ.
  const norm = t => String(t || "").toLowerCase().replace(/ё/g, "е");
  const words = t => norm(t).split(/[^a-zа-я0-9]+/).filter(Boolean);
  const stem = w => w.slice(0, Math.max(4, w.length - 2));
  function hasConcept(ws, syn) {
    const parts = words(syn).map(stem);
    if (!parts.length) return false;
    for (let i = 0; i + parts.length <= ws.length; i++) {
      if (parts.every((p, j) => ws[i + j].startsWith(p))) return true;
    }
    return false;
  }
  function grade(text, rule) {
    const ws = words(text);
    if (ws.length < rule.minWords) return { ok: false, reason: "short", missing: [] };
    const missing = rule.concepts.filter(c => !c.some(s => hasConcept(ws, s))).map(c => c[0]);
    return missing.length ? { ok: false, reason: "missing", missing } : { ok: true, reason: "ok", missing: [] };
  }
  function checkNumber(input, expected, tol) {
    const m = String(input || "").match(/^\s*([-+]?\d+(?:[.,]\d+)?)/);
    if (!m) return false;
    return Math.abs(parseFloat(m[1].replace(",", ".")) - expected) <= tol;
  }

  window.Learn = { state, key, setStatus, grade, checkNumber, progress, save, reset, touch };
})();
