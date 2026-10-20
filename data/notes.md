# Лекция 1.2 — Tools & MCP

**Спикер:** Зайцева Алёна, AI Lead at Yandex Lavka
**Источники:** PDF (slides) + транскрипт YouTube `VctYHtCap3o`
**Дата:** апрель 2026

---

## 1. LLM без инструментов

Три ограничения без tools:
1. Ограниченные возможности из-за специфики обучения (нет актуальных данных, плохая арифметика)
2. Нет доступа к up-to-date информации
3. Не могут самостоятельно выполнять действия

Конкретные провалы без инструментов:
- Counting task: модель отвечает **87** вместо правильного **97**
- Math: модель отвечает **8293** вместо правильного **825.44**

> Переломный момент: обучение LLM использованию инструментов — это когда мы перешли от chatbot → agent.

---

## 2. Что такое Tool

**Определение:** инструмент — функция, предоставленная LLM для взаимодействия с внешними системами.

**Tool должен включать:**
- Описание (что делает — text description)
- Исполняемую функцию (runtime implementation)
- Входные аргументы с типами
- Выходные данные с типом

---

## 3. Как работает Tool Calling

**Ключевое:** LLM только генерирует текст — она не исполняет код.

Цикл tool calling:
```
User → LLM → генерирует JSON с {tool_name, args}
           ↓
       Agent (код) → детектирует вызов → исполняет функцию
           ↓
       Результат → передаётся обратно в LLM
           ↓
       LLM → генерирует финальный ответ пользователю
```

Для пользователя выглядит так, что LLM "использовала инструмент" — но агент сделал реальную работу.

**Пример из лекции:** пользователь спрашивает "какие аэропорты есть в Лондоне?". Модель понимает, что нужно вызвать `list_all_airports`, генерирует JSON с именем функции и аргументами. Агент вызывает функцию, получает список реальных аэропортов, передаёт результат обратно в модель — та отвечает пользователю без галлюцинаций.

### Как передавать инструменты модели:

Два шага:
1. **Информирование** — список доступных tools передаётся через system prompt
2. **Обучение** — модели обучены генерировать tool calls в нужном формате через pre-training/fine-tuning со специальными токенами

Требование к описаниям: **чёткие, точные, согласованные** — модель понимает инструмент через описание, не через код.

---

## 4. Принципы проектирования инструментов

| Принцип | Суть | Пример |
|---------|------|--------|
| **Handling Partial Failures** | Инструмент должен работать в распределённых транзакциях, уметь откатить частично выполненные действия | charge → reserve → delivery: если delivery упал → откатить charge и reserve |
| **Idempotency & Safe Retries** | Повторный вызов после сбоя/таймаута должен быть безопасным | Отправка email при retry → не должна отправить дважды |
| **Clear Error Messages** | Ошибки должны быть понятны LLM, чтобы агент мог решить что делать дальше | Если не хватает параметра → сказать какого; если auth error → указать это явно |
| **Guidance for Next Steps** | Инструмент может возвращать подсказки агенту, как продолжать | "Спроси у пользователя дату доставки" |
| **Structured Outputs** | Возвращать машиночитаемые данные, не prose | `{status, order_id, delivery_window}` вместо текста |

**Key Takeaway:** хороший tool — не просто функция. Это **надёжный контракт** между LLM и внешней системой, устойчивый к сбоям, повторным вызовам и изменениям среды.

---

## 5. Почему понадобился протокол (MCP)

Tools значительно расширили возможности LLM. Но по мере роста сложности появились проблемы:

| Проблема | Следствие |
|---------|-----------|
| Tools жёстко встроены в каждого агента | Низкая переиспользуемость |
| API меняются → нужно обновлять каждого агента вручную | Дорого, хрупко |
| Разные модели ожидают разные форматы tool calls | Системы сложно масштабировать |

---

## 6. Что такое MCP

**Model Context Protocol** — открытый стандарт от Anthropic (25 ноября 2024).

Позволяет: **безопасные двусторонние соединения** между AI-моделями и внешними системами (APIs, tools, data sources).

> MCP = "USB-C порт" или "HTTP layer" для AI-экосистемы.

Категории AI applications (hosts):
- **Chat interface** — Claude Desktop, LibreChat
- **IDEs** — Claude Code, Goose
- **Other AI apps**

Категории MCP серверов:
- **Data/file systems** — PostgreSQL, SQLite, GDrive
- **Dev tools** — Git, Sentry
- **Productivity tools** — Slack, Google Maps

---

## 7. Архитектура MCP

Клиент-серверная архитектура с **тремя ролями**:

### Host
Основное AI-приложение, пользовательский интерфейс.
- Оркестрирует LLM и AI workflows
- Управляет соединениями: **один MCP client на каждый MCP server**
- Контролирует UI, auth, permissions
- Обрабатывает user consent (подтверждения для чувствительных действий)

Примеры: Cursor, custom agents, Claude Code

### Server
Провайдер контекста и возможностей. Лёгкая программа, может работать локально или удалённо.
- Регистрирует свои capabilities при старте
- Обрабатывает запросы (tool execution)
- Предоставляет контекст из data sources
- Отправляет уведомления клиентам об изменениях

Может разрабатываться любой командой и переиспользоваться разными агентами.

### Client
Коннектор внутри Host между Host и Server. Один client — одно соединение с одним server.
- Протокол: **JSON-RPC 2.0**
- Capability negotiation при инициализации (версия, поддерживаемые функции)
- Исполняет tool calls, возвращает результаты
- Обрабатывает real-time уведомления от сервера

---

## 8. MCP Flow (sequence diagram)

```
Initialization:
App → MCP Client 1 → MCP Server 1: request tools/resources
App → MCP Client 2 → MCP Server 2: request tools/resources
App stores combined tool catalog locally

Runtime (per user request):
User → App → LLM: forward prompt + tool catalog
LLM: analyze prompt, select tools
LLM → App: request tool execution
App → MCP Client → MCP Server: execute tool
MCP Server → App: return results
App → LLM: process results
LLM → App: generate response
App → User: display final answer
```

Параллельность: несколько clients могут запрашивать tools параллельно (один client = один server).

---

## 9. Проблемы, решённые MCP

| Проблема | Без MCP | С MCP |
|---------|---------|-------|
| Tool reusability | Каждая команда реализовывала одно и то же заново | Tools живут в MCP servers — write once, reuse everywhere |
| API updates | Все агенты обновлялись вручную | Ответственность на maintainers MCP servers; agents autodiscover при инициализации |
| Scaling | Тесная связность, изменение одного компонента = рефактор везде | Separation of concerns, изменения локализованы |

---

## 10. Про over-engineering

**Правило:** не добавляй MCP, пока не столкнёшься с проблемами выше.

Промежуточный вариант: **lightweight tool ecosystems** (например, AgentSkills — https://agentskills.io):
- Ready-to-use skills
- Standardized interfaces
- Быстрая разработка без тяжёлой инфраструктуры
- Stepping stone к MCP

**Ready-to-use tools:**
- LangChain integrations: https://docs.langchain.com/oss/python/integrations/tools
- awesome-mcp-servers (GitHub): https://github.com/punkpeye/awesome-mcp-servers
- Zapier MCP: https://zapier.com/mcp
- Tavily (search): https://www.tavily.com/

**Официальная документация MCP:**
- https://www.anthropic.com/news/model-context-protocol
- https://modelcontextprotocol.io/docs/getting-started/intro

---

## 11. Практика: реализация tools

### Ручная реализация (без библиотек)

```python
# Формат промта: инструмент описывается вручную
RAW_TOOLS_DESC = """
    Tool name: multiply
    Description: Multiply two integers
    Arguments:
      - a: integer
      - b: integer
    Returns: integer
"""

# System prompt указывает формат вызова
system_prompt = f"""You are a tool-using assistant.
You have access to the following tools:
{tools_descr}

When you need to use a tool, output EXACTLY one JSON object (no extra text):
{{"type":"tool_call","name":"<tool_name>","arguments":{{...}}}}

When you want to answer the user, output EXACTLY one JSON:
{{"type":"final","answer":"..."}}
"""

# Обработка вызова инструмента
def process_tool_call(json_model_output, tools_by_name):
    tool_name = json_model_output["name"]
    tool_args = json_model_output["arguments"]
    if tool_name not in tools_by_name:
        raise ValueError("Unknown tool")
    return tools_by_name[tool_name](**tool_args)

# Рекурсивный агент-цикл
def run_agent_inner(prompt, tools_by_name):
    model_output = call_llm(prompt)
    parsed = json.loads(model_output)
    if parsed["type"] == "tool_call":
        tool_result = process_tool_call(parsed, tools_by_name)
        # Добавляем результат инструмента и зовём LLM снова
        new_prompt = f"{prompt}\nASSISTANT: {model_output}\nTOOL_RESULT: {tool_result}\n"
        return run_agent_inner(new_prompt, tools_by_name)
    return parsed["answer"]
```

**Демо из практики:**
- `17 × 23` → модель генерирует tool_call с args `{a:17, b:23}`, получает 391
- `17 × 23 × 10` → два последовательных вызова: сначала `(17,23)→391`, потом `(391,10)→3910`
- "Столица Британии?" → модель видит, что инструмент не нужен, сразу возвращает `type:final`

### Проблема с ручным подходом:
- Описания инструментов оторваны от реализации
- При изменении функции (например, `int` → `float`) легко забыть обновить описание в промте → агент падает с ошибками

### Промежуточное решение: класс Tool
```python
class Tool:
    def __init__(self, name, description, func, arguments, outputs):
        # arguments: List[Tuple[str, str]] — [(имя, тип), ...]
        ...

    def to_string(self) -> str:
        # Единообразный формат: Tool Name, Description, Arguments, Outputs
        ...

    def __call__(self, *args, **kwargs):
        return self.func(*args, **kwargs)
```
Решает проблему единообразия формата, но описание всё ещё пишется вручную — отдельно от функции.

### Решение через декоратор `wrap_tool`:
```python
import inspect

def wrap_tool(func):
    sig = inspect.signature(func)
    arguments = [(p.name, getattr(p.annotation, "__name__", str(p.annotation)))
                 for p in sig.parameters.values()]
    outputs = getattr(sig.return_annotation, "__name__", str(sig.return_annotation))
    description = (func.__doc__ or "No description").strip()
    return Tool(func.__name__, description, func, arguments, outputs)

@wrap_tool
def multiply_tool(a: int, b: int) -> int:
    """Multiply two integers and return the result."""
    return a * b
```
Декоратор читает сигнатуру функции через `inspect`, берёт docstring как описание. Если типы аргументов меняются — описание обновляется автоматически.

### LangGraph с инструментами (библиотечный подход):

```python
# LLM с привязанными tools
llm = ChatOpenAI(model="gpt-4", temperature=0).bind_tools(tools)

# Граф: LLM → (если tool call) → Tool Node → LLM → ... → END
graph = StateGraph(AgentState)
graph.add_node("llm", llm_node)
graph.add_node("tools", ToolNode(tools))
graph.set_entry_point("llm")
graph.add_conditional_edges("llm", tools_condition,
    {"tools": "tools", END: END})
graph.add_edge("tools", "llm")
app = graph.compile()
```

### Демо: airline agent с инструментами

**База данных** (in-memory словарь):
```python
DATABASE = {
    "flights": {
        "AY001_2026-02-22": {"from": "HEL", "to": "AMS", "date": "2026-02-22",
                              "time": "09:30", "seats": 3, "price": 120, ...},
        "AY101_2026-02-22": {..., "time": "16:10", "seats": 1, "price": 155},
    },
    "bookings": {
        "BKG-123": {"flight_key": "AY001_2026-02-22", "passenger_name": "Jane Doe",
                    "status": "confirmed"}
    }
}
```

Три инструмента (с `@tool` декоратором LangChain):
- `get_booking(booking_id: str)` → JSON с деталями бронирования + рейса
- `search_flights(origin: str, destination: str, date: str)` → список подходящих рейсов
- `cancel_booking(booking_id: str)` → отмена (с подтверждением от пользователя)

**AgentState** — теперь с редьюсером `add_messages` (добавляет, не перезаписывает):
```python
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
```
Это необходимо для поддержки многошагового диалога (подтверждение отмены).

**Класс `Chat`** для хранения состояния между запросами:
```python
class Chat:
    def __init__(self, app):
        self.state = {"messages": []}
        self.app = app

    def ask(self, user_text: str) -> str:
        self.state["messages"].append(HumanMessage(content=user_text))
        out = self.app.invoke(self.state)
        self.state = out  # сохраняем всю историю
        return out["messages"][-1].content
```

**Сценарий отмены:**
1. `chat.ask("Cancel booking BKG-123")` → агент нашёл бронирование и просит подтверждения
2. `chat.ask("I confirm the cancellation")` → агент отменяет, статус меняется

Что изменилось vs агент без tools:
- Агент реально ходит в "базу данных" и находит рейсы (раньше только галлюцинировал)
- Guardrail перед деструктивным действием — в системном промте ("ask for confirmation")
- Состояние хранится между сообщениями через `Chat` + `add_messages` редьюсер

---

## 12. Ключевые вопросы для интервью

**Q: Что такое tool calling?**
A: LLM генерирует текст в виде JSON с именем функции и аргументами. Агент (код) детектирует это, исполняет функцию, возвращает результат в LLM. LLM сама код не исполняет.

**Q: Что должен содержать хорошо спроектированный инструмент?**
A: Описание, исполняемую функцию, типизированные аргументы, типизированный вывод. Плюс: idempotency, обработка partial failures, понятные error messages для LLM, structured output.

**Q: Что такое MCP и зачем он нужен?**
A: Model Context Protocol — открытый стандарт Anthropic (ноябрь 2024). Решает: low tool reusability, хрупкость при API updates, сложность масштабирования. Аналогия: USB-C для AI или HTTP для браузеров.

**Q: Три роли в MCP архитектуре?**
A: Host (AI-приложение, UI, orchestration) → Client (connector, JSON-RPC 2.0, один client per server) → Server (provider of tools/context, capability registration). Один host создаёт N clients для N servers.

**Q: Когда добавлять MCP в проект?**
A: Когда появляются конкретные проблемы: нужно переиспользовать tools между агентами, или API часто меняются, или система становится хрупкой. Не добавлять заранее — over-engineering.

**Q: В чём отличие агента с tools от простого LLM?**
A: Агент с tools может выполнять реальные действия (читать БД, отменять бронирования, искать рейсы). LLM без tools — только генератор текста, ограниченный знаниями из обучения.
