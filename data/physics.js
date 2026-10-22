/* Статический урок: пересказ — редакционный; короткие цитаты — LibreTexts / OpenStax University Physics, глава 5.
   page содержит проверенный номер веб-раздела, а не неподтверждённую страницу PDF. */
(function () {
  const base = "https://phys.libretexts.org/Bookshelves/University_Physics/University_Physics_(OpenStax)/Book%3A_University_Physics_I_-_Mechanics_Sound_Oscillations_and_Waves_(OpenStax)/05%3A_Newton%27s_Laws_of_Motion/";
  let figureId = 0;
  const makeSvg = (labels, arrows, bodies = '<rect x="192" y="69" width="56" height="35" rx="7" fill="none" stroke="currentColor" stroke-width="2"/>') => `<svg class="force-svg" viewBox="0 0 440 172" role="img" aria-label="${labels}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="phy-arrow-${++figureId}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7" fill="currentColor"/></marker></defs>${bodies}${arrows}</svg>`;
  const arrow = (x1,y1,x2,y2,label,x,y) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="currentColor" stroke-width="2.5" marker-end="url(#phy-arrow-${figureId+1})"/><text x="${x}" y="${y}" fill="currentColor" font-size="15" font-family="sans-serif">${label}</text>`;
  window.CCPhysics = {
    meta: {
      book: 'University Physics Volume 1 · LibreTexts', chapter: '5 — Newton’s Laws of Motion',
      authors: 'Samuel J. Ling, Jeff Sanny, William Moebs; OpenStax / LibreTexts',
      publisher: 'OpenStax / LibreTexts', edition: 'LibreTexts web edition (страницы обновлены 2022–2025)',
      url: base+'5.S%3A_Newton%27s_Laws_of_Motion_(Summary)', retrieved: '2026-10-22',
      license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'На основе University Physics Volume 1 (Samuel J. Ling, Jeff Sanny, William Moebs; OpenStax), глава 5, редакция LibreTexts. CC BY 4.0. Изменения: сокращение, русский пересказ, учебные примеры и собственные схемы. Оригинал и атрибуция доступны по ссылкам каждого фрагмента.',
      pagination: 'web-section', pageNote: 'Указаны разделы веб-учебника (§), а не номера страниц PDF.'
    },
    source: [
      {id:'p41', page:'5.2', heading:'Forces', url:base+'5.02%3A_Forces', html:'we can define force as the push or pull on an object with a specific magnitude and direction.'},
      {id:'p42', page:'5.3', heading:'Newton’s First Law', url:base+'5.03%3A_Newton%27s_First_Law', html:'remains in motion at constant velocity unless acted on by a net external force.'},
      {id:'p43', page:'5.4', heading:'Newton’s Second Law', url:base+'5.04%3A_Newton%27s_Second_Law', html:'acceleration is exactly inversely proportional to mass, just as it is directly proportional to net external force.'},
      {id:'p44', page:'5.6', heading:'Newton’s Third Law', url:base+'5.06%3A_Newtons_Third_Law', html:'You might think that two equal and opposite forces would cancel, but they do not because they act on different systems.'},
      {id:'p4summary', page:'5.S', heading:'Newton’s Laws of Motion · Summary', url:base+'5.S%3A_Newton%27s_Laws_of_Motion_(Summary)', html:'a net external force causes nonzero acceleration.'}
    ],
    sections: [
      {n:1, title:'Сила и равнодействующая',
       ref:'**Сила** — действие одного тела на другое: толчок или притяжение. У силы есть величина и направление. Поэтому нельзя складывать силы, забывая о направлении. [[src:p41]]\n\n**Равнодействующая** (суммарная внешняя сила) — векторная сумма всех внешних сил, действующих на выбранное тело. Если справа толкают на 7 Н, а слева на 3 Н, результат — 4 Н вправо. Сначала определите тело, потом нарисуйте силы, действующие именно на него. [[src:p41]]',
       quotes:['p41'], figure:makeSvg('Две противоположные силы, справа больше', arrow(248,87,365,87,'7 Н',308,75)+arrow(192,87,121,87,'3 Н',116,75)),
       check:{question:'Почему две противоположные силы 7 Н и 3 Н не дают 10 Н? Что такое равнодействующая?',minWords:15,concepts:[['равнодействующ','сумма сил'],['направлен','противоположн'],['сил']]}},
      {n:2, title:'Первый закон Ньютона',
       ref:'В инерциальной системе отсчёта, если **равнодействующая внешних сил равна нулю**, тело сохраняет покой либо движется **равномерно и прямолинейно**. Оно не обязано останавливаться после прекращения толчка. [[src:p42]]\n\n**Инерция** — свойство сохранять скорость; трение на реальной дороге меняет движение, поскольку создаёт внешнюю силу. Когда автобус тормозит, тело пассажира стремится сохранить прежнюю скорость относительно земли. [[src:p42]]',
       quotes:['p42'], figure:makeSvg('При нулевой сумме сил скорость сохраняется',arrow(248,87,352,87,'v = const',302,72)),
       check:{question:'Что произойдёт с движущимся телом, если все внешние силы уравновешены, и почему?',minWords:15,concepts:[['инерц','сохранен'],['скорост','равномерн'],['нул','равнодействующ','сумма сил']]}},
      {n:3, title:'Второй закон Ньютона',
       ref:'**ΣF = ma**: ускорение определяется **равнодействующей внешних сил**, а не одной из сил по отдельности. При той же массе двойная сила даёт двойное ускорение; при той же силе двойная масса уменьшает ускорение вдвое. [[src:p43]]\n\nУскорение описывает изменение **скорости по величине или направлению**. Торможение тоже ускорение; его вектор противоположен вектору движения. Единицы: ньютон = кг·м/с². [[src:p43]]',
       quotes:['p43'], figure:makeSvg('Равнодействующая направлена вправо, ускорение вправо',arrow(248,87,363,87,'ΣF, a',302,72)),
       check:{question:'Почему один и тот же толчок создаёт меньшее ускорение для тяжёлой тележки?',minWords:15,concepts:[['мас','тяжел'],['ускорен'],['сил','равнодействующ']]}},
      {n:4, title:'Третий закон Ньютона',
       ref:'Когда тело А действует на Б, тело Б действует на А **с такой же силой, но в обратном направлении**. Пара сил относится к **разным телам**, поэтому силы пары не взаимоуничтожаются на диаграмме одного тела. [[src:p44]]\n\nПример: человек толкает пол назад, пол толкает человека вперёд. Сила тяжести и реакция опоры для стоящего тела — не пара третьего закона: обе силы приложены к одному телу. [[src:p44]]',
       quotes:['p44'], figure:makeSvg('Два тела, равные противоположные силы',arrow(138,87,65,87,'F Б→А',60,58)+arrow(304,87,377,87,'F А→Б',310,58), '<rect x="138" y="69" width="56" height="35" rx="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="248" y="69" width="56" height="35" rx="7" fill="none" stroke="currentColor" stroke-width="2"/><text x="160" y="92" fill="currentColor">А</text><text x="270" y="92" fill="currentColor">Б</text>'),
       check:{question:'Почему пара действие–противодействие не означает, что тело обязательно остаётся на месте?',minWords:15,concepts:[['равн','одинаков'],['противоположн','обратн'],['разны','друг']]}},
      {n:5, title:'Типичные ошибки',
       ref:'**Сила ≠ скорость**: ненулевая суммарная сила изменяет скорость, но не обязана совпадать с направлением движения. **Ускорение ≠ только разгон**: изменение направления и торможение также считаются ускорением. [[src:p4summary]]\n\n**Пара сил третьего закона** всегда приложена к разным телам. Для одного тела вычерчивайте только силы, действующие *на него*, и складывайте их вектора. [[src:p44]]',
       quotes:['p4summary','p44'], figure:null,
       check:{question:'Почему объект может двигаться вправо, хотя равнодействующая сил направлена влево?',minWords:15,concepts:[['скорост','движен'],['сил','равнодействующ'],['ускорен','торможен']]} }
    ],
    problems: [
      {id:'q1',kind:'concept',text:'Автобус резко тормозит. Почему пассажир наклоняется вперёд, хотя автобус движется всё медленнее?',
       rule:{minWords:15,concepts:[['инерц','сохранен'],['скорост','движен'],['тормож','замедлен']]},
       ladder:['Сравни движение пассажира и автобуса.',{link:2},'Чью скорость пассажир старается сохранить по первому закону?'],
       steps:['Относительно земли пассажир ещё движется вперёд.'],solution:'Из-за инерции тело пассажира стремится сохранить исходную скорость относительно земли, пока силы от сиденья или ремня не изменят движение.'},
      {id:'r1',kind:'calc',text:'Тележку массой 10 кг толкают вправо с силой 35 Н, трение — 10 Н влево. Чему равно ускорение?',
       answer:2.5,tol:0.05,unit:'м/с²',
       ladder:['Сначала вычти трение из приложенной силы.',{link:3},'Подставь суммарную силу в a = F / m.'],
       steps:['Равнодействующая: 35 − 10 = 25 Н.','Ускорение: a = 25 / 10 = 2,5 м/с².'],
       solution:'ΣF = 35 − 10 = 25 Н. По второму закону Ньютона a = ΣF / m = 25 / 10 = 2,5 м/с².',
       similar:{text:'Тележку массой 8 кг толкают с силой 32 Н, трение — 8 Н. Каково ускорение?',answer:3,tol:0.05}}
    ]
  };
})();
