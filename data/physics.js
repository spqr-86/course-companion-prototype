/* Статический урок: пересказ — редакционный; короткие цитаты — OpenStax Physics, глава 4.
   page содержит проверенный номер веб-раздела, а не неподтверждённую страницу PDF. */
(function () {
  const base = 'https://openstax.org/books/physics/pages/';
  const makeSvg = (labels, arrows) => `<svg class="force-svg" viewBox="0 0 440 172" role="img" aria-label="${labels}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="phy-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7" fill="currentColor"/></marker></defs><rect x="192" y="69" width="56" height="35" rx="7" fill="none" stroke="currentColor" stroke-width="2"/>${arrows}</svg>`;
  const arrow = (x1,y1,x2,y2,label,x,y) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="currentColor" stroke-width="2.5" marker-end="url(#phy-arrow)"/><text x="${x}" y="${y}" fill="currentColor" font-size="15" font-family="sans-serif">${label}</text>`;
  window.CCPhysics = {
    meta: {
      book: 'Physics', chapter: 'Chapter 4 — Newton’s Laws of Motion',
      authors: 'Paul Peter Urone, Roger Hinrichs', publisher: 'OpenStax / Rice University',
      edition: 'Web edition, published 2020-03-26',
      url: base + '4-introduction', retrieved: '2026-10-22',
      license: 'CC BY 4.0 (раздел Customization); в разделе Citation/Attribution также названа CC BY-NC-SA 4.0 и отдельные ограничения — требуется проверка перед публикацией',
      attribution: 'На основе OpenStax Physics, гл. 4 (Paul Peter Urone, Roger Hinrichs; Texas Education Agency, OpenStax). Изменения: сокращение, перевод, примеры и оригинальные SVG. Для внутреннего демо; условия перепубликации и использования с ИИ необходимо отдельно согласовать. Бесплатная версия: https://openstax.org/books/physics/pages/1-introduction',
      licenseUrl: base + 'preface',
      pagination: 'web-section',
      pageNote: 'Номера PDF-страниц не проверены (официальный PDF недоступен); указаны проверенные § веб-учебника.'
    },
    source: [
      {id:'p41', page:'4.1', heading:'Force', url:base+'4-1-force', html:'The action of pushing or pulling is the application of force.'},
      {id:'p42', page:'4.2', heading:'Newton’s First Law of Motion: Inertia', url:base+'4-2-newtons-first-law-of-motion-inertia', html:'Generally, friction is an external force that acts opposite to the direction of relative motion or to prevent slipping.'},
      {id:'p43', page:'4.3', heading:'Newton’s Second Law of Motion', url:base+'4-3-newtons-second-law-of-motion', html:'Newton’s second law of motion is used to calculate what happens in situations involving forces and motion.'},
      {id:'p44', page:'4.4', heading:'Newton’s Third Law of Motion', url:base+'4-4-newtons-third-law-of-motion', html:'Newton’s third law of motion tells us that forces always occur in pairs,'},
      {id:'p4summary', page:'4', heading:'Chapter 4 Section Summary', url:base+'4-section-summary', html:'Acceleration is a change in velocity, meaning a change in speed, direction, or both.'}
    ],
    sections: [
      {n:1, title:'Сила и равнодействующая',
       ref:'**Сила** — действие одного тела на другое: толчок или притяжение. У силы есть величина и направление. Поэтому нельзя складывать силы, забывая о направлении. [[src:p41]]\n\n**Равнодействующая** (суммарная внешняя сила) — векторная сумма всех внешних сил, действующих на выбранное тело. Если справа толкают на 7 Н, а слева на 3 Н, результат — 4 Н вправо. Сначала определите тело, потом нарисуйте силы, действующие именно на него. [[src:p41]]',
       quotes:['p41'], figure:makeSvg('Две противоположные силы, справа больше', arrow(248,87,365,87,'7 Н',308,75)+arrow(192,87,121,87,'3 Н',116,75)),
       check:{question:'Почему две противоположные силы 7 Н и 3 Н не дают 10 Н? Что такое равнодействующая?',minWords:15,concepts:[['равнодействующ','сумма сил'],['направлен','противоположн'],['сил']]}},
      {n:2, title:'Первый закон Ньютона',
       ref:'Если **равнодействующая внешних сил равна нулю**, тело сохраняет покой либо движется **равномерно и прямолинейно**. Оно не обязано останавливаться после прекращения толчка. [[src:p42]]\n\n**Инерция** — свойство сохранять скорость; трение на реальной дороге меняет движение, поскольку создаёт внешнюю силу. Когда автобус тормозит, тело пассажира стремится сохранить прежнюю скорость относительно земли. [[src:p42]]',
       quotes:['p42'], figure:makeSvg('При нулевой сумме сил скорость сохраняется',arrow(248,87,352,87,'v = const',302,72)),
       check:{question:'Что произойдёт с движущимся телом, если все внешние силы уравновешены, и почему?',minWords:15,concepts:[['инерц','сохранен'],['скорост','равномерн'],['нул','равнодействующ','сумма сил']]}},
      {n:3, title:'Второй закон Ньютона',
       ref:'**ΣF = ma**: ускорение определяется **равнодействующей внешних сил**, а не одной из сил по отдельности. При той же массе двойная сила даёт двойное ускорение; при той же силе двойная масса уменьшает ускорение вдвое. [[src:p43]]\n\nУскорение описывает изменение **скорости по величине или направлению**. Торможение тоже ускорение; его вектор противоположен вектору движения. Единицы: ньютон = кг·м/с². [[src:p43]]',
       quotes:['p43'], figure:makeSvg('Равнодействующая направлена вправо, ускорение вправо',arrow(248,87,363,87,'ΣF, a',302,72)),
       check:{question:'Почему один и тот же толчок создаёт меньшее ускорение для тяжёлой тележки?',minWords:15,concepts:[['мас','тяжел'],['ускорен'],['сил','равнодействующ']]}},
      {n:4, title:'Третий закон Ньютона',
       ref:'Когда тело А действует на Б, тело Б действует на А **с такой же силой, но в обратном направлении**. Пара сил относится к **разным телам**, поэтому силы пары не взаимоуничтожаются на диаграмме одного тела. [[src:p44]]\n\nПример: человек толкает пол назад, пол толкает человека вперёд. Вес и реакция опоры для стоящего тела — не пара третьего закона: обе силы приложены к одному телу. [[src:p44]]',
       quotes:['p44'], figure:makeSvg('Два тела, равные противоположные силы',arrow(192,87,94,87,'F Б→А',94,70)+arrow(248,87,347,87,'F А→Б',294,70)),
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
