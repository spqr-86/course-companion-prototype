#!/usr/bin/env python3
"""Генератор статических ответов Course Companion через OpenRouter.

Запускать только локально с OPENROUTER_API_KEY. --only shad:4 / physics:2 / chat:0
прогоняет один раздел или вопрос. Первый удачный дубль сохраняется без редактуры.
ANCHOR: тот же content.js/physics.js, что показывает браузерное демо.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import logging
import math
import os
import re
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
MODEL = "google/gemini-3.7-flash"
TEMPERATURE = 0.3
PROMPT_FILE = ROOT / "tools/prompts/demo-ai.json"
CONFIG = json.loads(PROMPT_FILE.read_text())
SYSTEM, PROMPTS = CONFIG["system"], CONFIG["actions"]
MAX_TOKENS = 2048
LOG = logging.getLogger("gen_demo_ai")
STOP_REQUESTED = False


def request_stop(signum, frame):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    LOG.warning("Остановка запрошена; сохраняем текущий ответ и счёт перед выходом")


class PromptVariables(BaseModel):
    instruction: str
    context: str


class Usage(BaseModel):
    cost: float = Field(ge=0, allow_inf_nan=False)
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)


def delegate_client():
    path = Path(
        os.environ.get(
            "CC_DELEGATE",
            str(Path.home() / "assistant-core/skills/delegate/scripts/delegate.py"),
        )
    )
    spec = importlib.util.spec_from_file_location("cc_delegate", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def js_data(files: list[str], name: str):
    script = """const fs=require('fs'),vm=require('vm');const w={};const ctx={window:w};
for(const p of process.argv.slice(1))vm.runInNewContext(fs.readFileSync(p,'utf8'),ctx,{filename:p});
process.stdout.write(JSON.stringify(w[process.env.CC_GLOBAL]));"""
    env = {**os.environ, "CC_GLOBAL": name}
    output = subprocess.check_output(
        ["node", "-e", script, *[str(ROOT / p) for p in files]], env=env
    )
    return json.loads(output)


def chapter_text(number: int, notes: str) -> str:
    m = re.search(rf"(?m)^##\s+(?:{number}\.|§\s*{number}\b|{number}\s+)", notes)
    if not m:
        raise ValueError(f"Нет исходного раздела {number}")
    following = re.search(r"(?m)^##\s+", notes[m.end() :])
    return notes[m.start() : m.end() + following.start() if following else None]


def jobs():
    shad = js_data(["data/content.js"], "CC")
    phys = js_data(["data/physics.js"], "CCPhysics")
    notes = (ROOT / "data/notes.md").read_text(encoding="utf-8")
    for n in range(1, 13):
        context = chapter_text(n, notes).strip()
        for action in ("simple", "rewrite", "example"):
            if action == "example" and n in (3, 4, 11):
                continue  # маршруты в code-video, lab, code
            yield ("shad", str(n), action, context)
    for s in phys["sections"]:
        for action in ("simple", "rewrite", "example"):
            yield ("physics", str(s["n"]), action, s["title"] + "\n" + s["ref"])
    for i, item in enumerate(shad["chat"]):
        n = next((r["notes"] for r in item["refs"] if r.get("notes")), 4)
        context = item["q"] + "\n" + item["a"] + "\n" + chapter_text(n, notes)
        yield ("chat", str(i), "chat", context)


def request_one(api_key: str, user_prompt: str, raw_path: Path):
    payload = {
        "model": MODEL,
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
        "reasoning": {"effort": "low"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
    }
    answer = delegate_client().post(payload, api_key, 90)
    raw_path.write_text(json.dumps(answer, ensure_ascii=False, indent=2))
    if answer.get("error"):
        raise RuntimeError(str(answer["error"]))
    text = answer["choices"][0]["message"]["content"]
    if isinstance(text, list):
        text = "".join(
            piece.get("text", "") for piece in text if isinstance(piece, dict)
        )
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Модель вернула пустой ответ")
    usage = answer.get("usage") or {}
    Usage.model_validate(usage)
    cost = usage.get("cost")
    if cost is None:
        cost = answer.get("total_cost")
    if cost is None:
        raise RuntimeError(
            "Ответ OpenRouter не содержит usage.cost; невозможно подтвердить бюджет"
        )
    cost = float(cost)
    if answer["choices"][0].get("finish_reason") != "stop":
        raise RuntimeError(
            "Ответ обрезан; raw и стоимость сохранены, не повторяем автоматически"
        )
    return text.strip(), usage, cost, answer.get("id")


def export_answers(state):
    answers = js_data(["data/demo-ai.js"], "CCDemoAI")
    # У этих разделов пример открывает готовую сцену, текстовые заглушки не используются.
    for section in ("3", "4", "11"):
        answers["shad"]["example"].pop(section, None)
    for r in state["calls"]:
        if not r.get("success"):
            continue
        if r["lecture"] == "chat":
            answers["shad"]["chat"][r["section"]] = r["output"]
        else:
            answers[r["lecture"]][r["action"]][r["section"]] = r["output"]
    count = len(
        {
            (r["lecture"], r["section"], r["action"])
            for r in state["calls"]
            if r.get("success")
        }
    )
    answers["meta"] = {
        "model": MODEL,
        "date": datetime.now(timezone.utc).date().isoformat(),
        "prompt": SYSTEM + "\n" + json.dumps(PROMPTS, ensure_ascii=False),
        "prompt_sha256": state["prompt_sha256"],
        "complete": count == len(list(jobs())),
        "generated": count,
        "expected": len(list(jobs())),
        "run": "provenance/demo-ai/run.json",
    }
    output = ROOT / "data/demo-ai.js"
    output.write_text(
        "/* Первый успешный дубль OpenRouter. Не редактировать ответы вручную. */\nwindow.CCDemoAI = "
        + json.dumps(answers, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--only", help="Раздел shad:4 или physics:2; один чат-вопрос chat:0")
    p.add_argument(
        "--budget",
        type=float,
        default=0.10,
        help="Максимальные суммарные расходы в USD",
    )
    p.add_argument(
        "--retry-failed",
        action="store_true",
        help="После сверки raw явно повторить только обрезанные ответы",
    )
    p.add_argument(
        "--export-only",
        action="store_true",
        help="Собрать только уже сохранённые ответы, без сети",
    )
    args = p.parse_args()
    if not math.isfinite(args.budget) or args.budget <= 0:
        p.error("--budget должен быть конечным и больше нуля")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    provenance = ROOT / "provenance/demo-ai"
    (provenance / "raw").mkdir(parents=True, exist_ok=True)
    (provenance / "prompt.md").write_text(
        "\n\n".join([f"# {key}\n\n{value}" for key, value in PROMPTS.items()])
        + "\n\n## System\n"
        + SYSTEM
        + "\n",
        encoding="utf-8",
    )
    manifest = provenance / "run.json"
    state = (
        json.loads(manifest.read_text(encoding="utf-8"))
        if manifest.exists()
        else {
            "model": MODEL,
            "temperature": TEMPERATURE,
            "started": datetime.now(timezone.utc).isoformat(),
            "calls": [],
        }
    )
    digest = hashlib.sha256(PROMPT_FILE.read_bytes()).hexdigest()
    if state.get("prompt_sha256", digest) != digest or state["model"] != MODEL:
        raise RuntimeError(
            "Параметры оплаченного прогона изменились, не перезаписываем"
        )
    state["prompt_sha256"] = digest
    if args.export_only:
        export_answers(state)
        return
    key = delegate_client().load_key()
    # Сначала сверяем все оплаченные raw, включая length без принятого текста.
    for call in state["calls"]:
        if call.get("success"):
            continue
        name = f"{call['lecture']}-{call['section']}-{call['action']}"
        raw = provenance / "raw" / call.get("raw", name + ".json")
        if raw.exists():
            data = json.loads(raw.read_text())
            usage = Usage.model_validate(data["usage"])
            call.update(
                usage=data["usage"],
                cost_usd=usage.cost,
                request_id=data["id"],
                finish_reason=data["choices"][0]["finish_reason"],
            )
            if args.retry_failed and call["finish_reason"] == "length":
                call["reviewed"] = True
    manifest.write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if any(not r.get("success") and not r.get("reviewed") for r in state["calls"]):
        raise RuntimeError(
            "Незавершённый вызов требует сверки raw и стоимости; автоматический повтор запрещён"
        )
    with urlopen("https://openrouter.ai/api/v1/models", timeout=30) as resp:
        pricing = next(
            m["pricing"] for m in json.load(resp)["data"] if m["id"] == MODEL
        )
    already = {
        (r["lecture"], r["section"], r["action"])
        for r in state["calls"]
        if r.get("success")
    }
    work = [
        x
        for x in jobs()
        if not args.only or f"{x[0]}:{x[1]}" == args.only or x[0] == args.only
    ]
    if not work:
        p.error(f"Раздел не найден: {args.only}")
    # Никогда не затираем уже полученные ответы: это первый успешный дубль.
    spent = sum(
        float(r.get("cost_usd") or r.get("cost_upper_bound_usd") or 0)
        for r in state["calls"]
    )
    for lecture, section, action, context in work:
        if (lecture, section, action) in already:
            continue
        if STOP_REQUESTED:
            export_answers(state)
            raise SystemExit(2)
        success = sum(bool(r.get("success")) for r in state["calls"])
        if success >= 8 and spent / success * len(list(jobs())) > args.budget:
            export_answers(state)
            raise RuntimeError(
                "Оценка полного прогона превышает бюджет; требуется решение пользователя"
            )
        if spent >= args.budget:
            raise RuntimeError(f"Бюджет ${args.budget:.2f} исчерпан")
        variables = PromptVariables(instruction=PROMPTS[action], context=context)
        prompt = CONFIG["template"].format(**variables.model_dump())
        # Байты UTF-8 ограничивают сверху число токенов. Резервируем весь выход до запроса.
        reserve = (len((SYSTEM + prompt).encode()) + 256) * float(
            pricing["prompt"]
        ) + MAX_TOKENS * float(pricing["completion"])
        if spent + reserve > args.budget:
            raise RuntimeError(
                f"Не хватает остатка бюджета: потрачено ${spent:.6f}, резерв ${reserve:.6f}"
            )
        stamp = {
            "lecture": lecture,
            "section": section,
            "action": action,
            "prompt": prompt,
            "model": MODEL,
            "temperature": TEMPERATURE,
        }
        name = f"{lecture}-{section}-{action}"
        count = sum(
            r["lecture"] == lecture
            and r["section"] == section
            and r["action"] == action
            for r in state["calls"]
        )
        raw = (
            provenance
            / "raw"
            / f"{name}{'-attempt' + str(count + 1) if count else ''}.json"
        )
        if raw.exists():
            raise RuntimeError("Raw уже существует без завершённой записи: " + name)
        stamp["raw"] = raw.name
        stamp["max_tokens"] = MAX_TOKENS
        stamp["reasoning"] = {"effort": "low"}
        stamp["reserved_usd"] = reserve
        state["calls"].append(stamp)
        manifest.write_text(
            json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (provenance / "raw" / f"{name}.prompt.txt").write_text(prompt, encoding="utf-8")
        try:
            text, usage, cost, req_id = request_one(key, prompt, raw)
            (provenance / "raw" / f"{name}.txt").write_text(text, encoding="utf-8")
            stamp.update(
                success=True,
                retries=0,
                usage=usage,
                cost_usd=cost,
                request_id=req_id,
                output=text,
            )
            spent += cost
            LOG.info("%s: tokens=%s cost=%s", name, usage.get("total_tokens"), cost)
        except (
            HTTPError,
            URLError,
            TimeoutError,
            ValueError,
            RuntimeError,
            KeyError,
            IndexError,
        ) as exc:
            detail = (
                exc.read().decode(errors="replace")[:1000]
                if isinstance(exc, HTTPError)
                else str(exc)
            )
            LOG.error("%s: %s", name, detail)
            stamp.update(success=False, retries=0, error=detail)
            if raw.exists():
                data = json.loads(raw.read_text())
                stamp.update(
                    usage=data.get("usage"),
                    cost_usd=data.get("usage", {}).get("cost"),
                    request_id=data.get("id"),
                    finish_reason=data.get("choices", [{}])[0].get("finish_reason"),
                )
        manifest.write_text(
            json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        export_answers(state)
        if not stamp.get("success"):
            raise RuntimeError("Генерация прервана: " + name)
        if spent > args.budget:
            raise RuntimeError(f"Лимит превышен после ответа: ${spent:.5f}")
    export_answers(state)
    manifest.write_text(
        json.dumps(
            {
                **state,
                "ended": datetime.now(timezone.utc).isoformat(),
                "reported_total_usd": sum(
                    r.get("cost_usd") or 0 for r in state["calls"]
                ),
                "known_total_usd": sum(r.get("cost_usd") or 0 for r in state["calls"]),
                "total_upper_bound_usd": spent,
                "expected_calls": len(list(jobs())),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    LOG.info(
        "Готово %s / %s; расходы с резервами: $%.5f",
        len([r for r in state["calls"] if r.get("success")]),
        len(list(jobs())),
        spent,
    )


if __name__ == "__main__":
    main()
