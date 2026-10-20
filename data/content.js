/* Подготовленные вручную данные прототипа.
   Реальное: лекция 1.2 (видео, субтитры, слайды, конспект, код ноутбука).
   Демо: прогресс, состояния сборки, карточки других курсов, ответы чата. */
window.CC = {
  video: { id: "VctYHtCap3o", url: "https://www.youtube.com/watch?v=VctYHtCap3o" },

  // Ключевые моменты: t — начало реального сегмента субтитров (data/transcript.json).
  moments: {
    toolLoop: { t: 222.04, label: "Цикл tool calling на примере аэропортов" },
    partial: { t: 344.56, label: "Принцип: частичные сбои и откат" },
    idempotency: { t: 379.64, label: "Принцип: идемпотентность и безопасные повторы" },
    errors: { t: 403.08, label: "Принцип: понятные сообщения об ошибках" },
    host: { t: 669.96, label: "Роль Host" },
    cancelDemo: { t: 1951.92, label: "Отмена бронирования с подтверждением" }
  },

  library: [
    {
      id: "shad", token: "course-shad", title: "Неделя агентов 2026", org: "ШАД · Яндекс",
      lectures: 7, done: 2, real: true, hue: 214,
      note: "Лекция 1.2 собрана целиком"
    },
    {
      id: "langchain", title: "LangChain Academy", org: "LangChain", lectures: 6, done: 3, hue: 160,
      note: "Демо-карточка: материалы не загружены"
    },
    {
      id: "google", title: "5-Day AI Agents Intensive", org: "Google · Kaggle", lectures: 5, done: 5, hue: 32,
      note: "Демо-карточка: материалы не загружены"
    },
    {
      id: "stanford", title: "MS&E435: Economics of the AI Supercycle", org: "Stanford", lectures: 9, done: 6, hue: 350,
      note: "Демо-карточка: материалы не загружены"
    }
  ],

  course: {
    title: "Неделя агентов 2026",
    org: "Школа анализа данных, Яндекс",
    lead: "Семь лекций о том, как устроены LLM-агенты: инструменты и MCP, память и guardrails, мультиагентные системы, оценка и эксплуатация.",
    modules: [
      { title: "Основы агентов", lectures: [
        { code: "1.1", title: "Intro to AI Agents, LLM", state: { video: "none", transcript: "building", slides: "none", notes: "ready", codevideo: "none", lab: "none" } },
        { code: "1.2", title: "Tools & MCP", token: "lecture-tools-mcp", speaker: "Алёна Зайцева", duration: "33:13",
          state: { video: "ready", transcript: "ready", slides: "ready", notes: "ready", codevideo: "ready", lab: "ready" } }
      ]},
      { title: "Память и защита", lectures: [
        { code: "2", title: "Memory & Guardrails", state: { video: "none", transcript: "none", slides: "none", notes: "ready", codevideo: "planned", lab: "planned" } }
      ]},
      { title: "Сложные системы", lectures: [
        { code: "3", title: "Agent Workflows, Multi-Agent", state: { video: "none", transcript: "none", slides: "none", notes: "ready", codevideo: "none", lab: "none" } }
      ]},
      { title: "Оценка", lectures: [
        { code: "4", title: "Agent Evaluation", state: { video: "none", transcript: "none", slides: "none", notes: "ready", codevideo: "none", lab: "planned" } }
      ]},
      { title: "Эксплуатация", lectures: [
        { code: "5.1", title: "Production Engineering", state: { video: "none", transcript: "none", slides: "none", notes: "ready", codevideo: "none", lab: "none" } },
        { code: "5.2", title: "Production Engineering 2", state: { video: "none", transcript: "none", slides: "none", notes: "ready", codevideo: "none", lab: "none" } }
      ]}
    ],
    labs: [
      { code: "L01", title: "Повтор вызова и идемпотентность", lecture: "1.2", ready: true, token: "tools-mcp-lab",
        text: "cancel_booking из ноутбука: успешный вызов, неверные аргументы, потерянный ответ. Повтор с ключом и без." },
      { code: "L02", title: "Частичный сбой транзакции", lecture: "1.2",
        text: "charge → reserve → delivery: где остановиться и что откатить, если упала доставка." },
      { code: "L03", title: "MCP: инициализация и каталог", lecture: "1.2",
        text: "Host поднимает клиентов, собирает каталог инструментов и маршрутизирует вызов." },
      { code: "L04", title: "Guardrails против prompt injection", lecture: "2",
        text: "Входной и выходной фильтр на одном диалоге, утечка через инструмент." },
      { code: "L05", title: "Траектория против финального ответа", lecture: "4",
        text: "Один ответ, две оценки: по результату и по шагам агента." }
    ]
  },

  // Разобранный код: фрагменты ноутбука lecture_1_2_tools_mcp.ipynb, текст строк не изменён.
  walkthrough: [
    {
      id: "manual", title: "Ручной цикл агента", cell: "Ячейка 6 · без отладочного вывода в конце",
      lead: "Модель возвращает текст. Решение «вызвать функцию» принимает код агента, когда разбирает этот текст как JSON.",
      code: `def process_tool_call(json_model_output, tools_by_name):
    tool_name = json_model_output["name"]
    tool_args = json_model_output["arguments"]
    print(f'Executing tool {tool_name} with args: {tool_args}')

    if tool_name not in tools_by_name:
      raise ValueError("Unknown tool")

    tool_result = tools_by_name[tool_name](**tool_args)

    print(f'Tool result: {tool_result}')

    return tool_result


def run_agent_inner(prompt, tools_by_name):
    # call LLM
    model_output = call_llm(prompt)
    json_model_output = json.loads(model_output)
    print(f"model_output: {model_output}")

    # process tool-call if needed
    if json_model_output["type"] == "tool_call":
        tool_result = process_tool_call(json_model_output, tools_by_name)

        # call LLM with the tool_result
        prompt_with_tool_result = (
            f"{prompt}\\n"
            f"ASSISTANT: {model_output}\\n"
            f"TOOL_RESULT: {tool_result}\\n"
        )
        return run_agent_inner(prompt_with_tool_result, tools_by_name)

    return json_model_output["answer"]`,
      notes: [
        { lines: [1, 3], text: "Модель вернула JSON вида <code>{\"type\":\"tool_call\",\"name\":…,\"arguments\":…}</code>. Агент достаёт из него имя и аргументы." },
        { lines: [6, 7], text: "Неизвестное имя — ошибка. Модель может придумать инструмент, которого нет, поэтому реестр проверяется кодом." },
        { lines: [9, 9], text: "Единственное место, где функция действительно выполняется. Аргументы распаковываются как есть: опечатка в имени аргумента упадёт здесь." },
        { lines: [18, 19], text: "Ответ модели — строка. <code>json.loads</code> превращает её в решение: вызывать инструмент или отвечать." },
        { lines: [23, 32], text: "Результат дописывается в промпт строкой <code>TOOL_RESULT</code>, и модель вызывается снова. Так из двух вызовов LLM получается цикл." },
        { lines: [34, 34], text: "Выход из рекурсии: модель ответила <code>type: final</code>. Для «17 × 23 × 10» это случилось после двух вызовов multiply." }
      ]
    },
    {
      id: "wrap", title: "Описание из сигнатуры", cell: "Ячейка 19",
      lead: "Декоратор читает типы и docstring функции. Описание для модели больше не расходится с кодом.",
      code: `def wrap_tool(func: Callable[..., Any]) -> Tool:
    sig = inspect.signature(func)

    # args
    arguments = []
    for p in sig.parameters.values():
        ann = p.annotation
        if ann is inspect._empty:
            ann_name = "Any"
        else:
            ann_name = getattr(ann, "__name__", str(ann))

        arguments.append((p.name, ann_name))

    # return type
    ret = sig.return_annotation
    if ret is inspect._empty:
        outputs = "Any"
    else:
        outputs = getattr(ret, "__name__", str(ret))

    description = (func.__doc__ or "No description provided").strip()
    name = func.__name__

    return Tool(name, description, func, arguments, outputs)`,
      notes: [
        { lines: [2, 2], text: "<code>inspect.signature</code> отдаёт параметры и аннотации функции во время выполнения." },
        { lines: [5, 13], text: "Для каждого параметра берётся имя типа. Без аннотации — <code>Any</code>: модель не узнает, что ждать." },
        { lines: [16, 20], text: "Тип результата попадает в описание так же. Сменили <code>int</code> на <code>float</code> — описание обновится само." },
        { lines: [22, 23], text: "Docstring становится описанием инструмента. Модель понимает инструмент по этому тексту, а не по коду." }
      ]
    },
    {
      id: "cancel", title: "cancel_booking и граф", cell: "Ячейка 35 · два фрагмента",
      lead: "Инструмент с побочным эффектом. Каждый вызов меняет базу, и это важно при повторах.",
      code: `@tool
def cancel_booking(booking_id: str) -> str:
    """Cancel a booking."""
    booking_record = DATABASE["bookings"].get(booking_id)
    if not booking_record:
        return json.dumps({"error": "Booking not found"}, ensure_ascii=False)

    flight_record = DATABASE["flights"].get(booking_record["flight_key"])
    booking_record["status"] = "cancelled"

    if flight_record:
        flight_record["seats"] += 1

    refund_amount = flight_record["price"] if flight_record else 0
    return json.dumps({"success": True, "refund": refund_amount}, ensure_ascii=False)


def route_after_llm(state: AgentStateRed) -> Literal["tools", "end"]:
    last = state["messages"][-1]
    # If the model requested tool calls, send to ToolNode; else finish.
    has_tool_calls = getattr(last, "tool_calls", None)
    return "tools" if has_tool_calls else "end"`,
      notes: [
        { lines: [1, 3], text: "<code>@tool</code> из LangChain делает то же, что наш <code>wrap_tool</code>: схема аргументов из сигнатуры, описание из docstring." },
        { lines: [5, 6], text: "Понятная ошибка вместо исключения: модель прочитает её и сможет переспросить пользователя." },
        { lines: [9, 9], text: "Статус не проверяется. Отменённую бронь можно «отменить» ещё раз." },
        { lines: [11, 12], text: "Побочный эффект: место возвращается в продажу при каждом вызове. Повтор после таймаута добавит лишнее место.", warn: true, lab: true },
        { lines: [14, 15], text: "Возврат тоже считается на каждый вызов. В лаборатории видно, как без ключа он удваивается.", warn: true, lab: true },
        { lines: [18, 22], text: "Маршрутизатор графа: есть <code>tool_calls</code> — идём в ToolNode, нет — заканчиваем. После ToolNode ребро ведёт обратно в llm." }
      ]
    }
  ],

  // Подготовленные ответы чата. ref: notes — раздел конспекта, moment — ключ из moments.
  chat: [
    {
      q: "Почему модель сама не выполняет функцию?",
      a: "Модель только генерирует текст: имя инструмента и аргументы в JSON. Распознаёт вызов и исполняет функцию код агента, затем возвращает результат модели. Для пользователя это выглядит как «модель воспользовалась инструментом».",
      refs: [{ moment: "toolLoop" }, { notes: 3 }, { codevideo: 3, label: "Code-video: шаг «Вызов инструмента»" }]
    },
    {
      q: "Что сломается, если повторить cancel_booking без ключа?",
      a: "В коде из ноутбука каждый вызов увеличивает seats на 1 и считает возврат заново, статус не проверяется. Если ответ потерялся и агент повторил вызов, мест станет 5 вместо 4, а возвратов будет два. Пользователь при этом услышит про один возврат 120 $.",
      refs: [{ moment: "idempotency" }, { notes: 4 }, { lab: "lost", label: "Лаборатория: потерянный ответ" }]
    },
    {
      q: "Чем Host отличается от Client в MCP?",
      a: "Host — само AI-приложение: оркестрирует модель, интерфейс, права и согласие пользователя. Client живёт внутри Host и держит одно соединение с одним MCP-сервером по JSON-RPC 2.0. Сколько серверов, столько клиентов.",
      refs: [{ moment: "host" }, { notes: 7 }]
    },
    {
      q: "Когда MCP не нужен?",
      a: "Пока инструменты не нужно переиспользовать между агентами и API не меняются часто. Лектор советует не добавлять MCP заранее: начать с простых инструментов или лёгких экосистем вроде Agent Skills.",
      refs: [{ notes: 10 }]
    }
  ]
};
