"""The language model behind cookOverflow's AI features: the Sous-chef chat, reply drafts and post drafts.

Two providers, chosen with AI_PROVIDER:
- "gemini" (the default): Google's Gemini API. Reads photos and video, sound included. A free key from Google AI
  Studio works, and it's the same GEMINI_API_KEY as the fridge scan.
- "openai": any OpenAI-compatible chat endpoint, such as GitHub Models, Groq, OpenRouter or Ollama on your own
  machine (no key needed). Reads photos; for a video the app sends frames the browser picked out.

Callers start a conversation with user() and assistant() turns and extend it with the turns generate() and
results() hand back. Turns stay in the provider's own format, so a model's turn goes back exactly as it came:
Gemini 3 rejects a function call whose thought signature was dropped.
"""
import base64
import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass

from django.conf import settings

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_THINKING = re.compile(r"<think>.*?</think>", re.S)  # reasoning some open models put before their answer


class LLMError(Exception):
    """The model couldn't be reached or gave no usable answer."""


@dataclass(frozen=True)
class Media:
    mime: str
    data: bytes


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict  # JSON Schema for the arguments: type, properties, items, enum, required, description


@dataclass(frozen=True)
class Call:
    id: str
    name: str
    args: dict


@dataclass
class Reply:
    text: str
    calls: list
    turn: dict  # the model's turn in the provider's format, for the history of the next request


def client():
    """The configured model, or None when no provider is set up on this server."""
    if settings.AI_PROVIDER == "openai":
        if not (settings.AI_BASE_URL and settings.AI_MODEL):
            return None
        return OpenAICompatible(settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL, settings.AI_TIMEOUT)
    if settings.AI_PROVIDER == "gemini" and settings.AI_API_KEY and settings.AI_MODEL:
        return Gemini(settings.AI_API_KEY, settings.AI_MODEL, settings.AI_TIMEOUT)
    return None


def loads_json(text):
    """The JSON object in a model's answer, tolerating code fences or a sentence around it."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        raise LLMError("no JSON object in the answer")
    try:
        value = json.loads(text[start:end + 1])
    except ValueError as error:
        raise LLMError(f"invalid JSON in the answer: {error}") from error
    if not isinstance(value, dict):
        raise LLMError("the answer isn't a JSON object")
    return value


def _post(url, body, headers, timeout):
    request = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", **headers})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise LLMError(f"HTTP {error.code}: {error.read()[:300]!r}") from error
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        raise LLMError(f"unreachable: {error}") from error


def _gemini_schema(schema):
    """JSON Schema -> Gemini's schema dialect, which spells types in capitals."""
    out = dict(schema)
    if "type" in out:
        out["type"] = out["type"].upper()
    if "properties" in out:
        out["properties"] = {name: _gemini_schema(value) for name, value in out["properties"].items()}
    if "items" in out:
        out["items"] = _gemini_schema(out["items"])
    return out


class Gemini:
    name = "gemini"
    video = True

    def __init__(self, key, model, timeout):
        self.key, self.model, self.timeout = key, model, timeout

    def user(self, text, media=()):
        parts = [{"inlineData": {"mimeType": m.mime, "data": base64.b64encode(m.data).decode()}} for m in media]
        return {"role": "user", "parts": [*parts, {"text": text}]}

    def assistant(self, text):
        return {"role": "model", "parts": [{"text": text}]}

    def results(self, outputs):
        """[(call, output dict)] -> the turns that hand the tools' answers back to the model."""
        parts = []
        for call, output in outputs:
            response = {"name": call.name, "response": output}
            if call.id:
                response["id"] = call.id
            parts.append({"functionResponse": response})
        return [{"role": "user", "parts": parts}]

    def generate(self, system, turns, tools=(), schema=None, allow_calls=True):
        body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": turns}
        if tools:
            body["tools"] = [{"functionDeclarations": [
                {"name": t.name, "description": t.description, "parameters": _gemini_schema(t.parameters)}
                for t in tools
            ]}]
            if not allow_calls:
                body["toolConfig"] = {"functionCallingConfig": {"mode": "NONE"}}
        if schema:
            body["generationConfig"] = {"responseMimeType": "application/json", "responseSchema": _gemini_schema(schema)}
        payload = _post(GEMINI_ENDPOINT.format(model=self.model), body, {"x-goog-api-key": self.key}, self.timeout)
        try:
            content = payload["candidates"][0]["content"]
            parts = content["parts"]
        except (KeyError, IndexError, TypeError) as error:
            reason = None
            if isinstance(payload, dict):
                reason = (payload.get("promptFeedback") or {}).get("blockReason")
                reason = reason or next(iter(payload.get("candidates") or []), {}).get("finishReason")
            raise LLMError(f"no usable answer ({reason or 'empty response'})") from error
        text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        calls = [Call(fc.get("id", ""), fc.get("name", ""), fc.get("args") or {})
                 for part in parts if (fc := part.get("functionCall"))]
        return Reply(text.strip(), calls, content)


class OpenAICompatible:
    name = "openai"
    video = False

    def __init__(self, base_url, key, model, timeout):
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.key, self.model, self.timeout = key, model, timeout

    def user(self, text, media=()):
        if not media:
            return {"role": "user", "content": text}
        images = [{"type": "image_url", "image_url": {"url": f"data:{m.mime};base64,{base64.b64encode(m.data).decode()}"}}
                  for m in media if m.mime.startswith("image/")]
        return {"role": "user", "content": [{"type": "text", "text": text}, *images]}

    def assistant(self, text):
        return {"role": "assistant", "content": text}

    def results(self, outputs):
        return [{"role": "tool", "tool_call_id": call.id, "content": json.dumps(output)} for call, output in outputs]

    def generate(self, system, turns, tools=(), schema=None, allow_calls=True):
        if schema:
            # Few OpenAI-compatible servers enforce a schema, but most honour json_object.
            system += f"\n\nAnswer with only a JSON object that follows this JSON Schema:\n{json.dumps(schema)}"
        body = {"model": self.model, "messages": [{"role": "system", "content": system}, *turns]}
        if tools:
            body["tools"] = [{"type": "function", "function": {
                "name": t.name, "description": t.description, "parameters": t.parameters}} for t in tools]
            if not allow_calls:
                body["tool_choice"] = "none"
        if schema:
            body["response_format"] = {"type": "json_object"}
        headers = {"Authorization": f"Bearer {self.key}"} if self.key else {}
        payload = _post(self.url, body, headers, self.timeout)
        try:
            message = payload["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as error:
            raise LLMError(f"no usable answer ({str(payload)[:200]})") from error
        calls, tool_calls = [], []
        for number, tool_call in enumerate(message.get("tool_calls") or []):
            tool_call = {**tool_call, "id": tool_call.get("id") or f"call_{number}", "type": "function"}
            function = tool_call.get("function") or {}
            try:
                args = json.loads(function.get("arguments") or "{}")
            except (TypeError, ValueError):
                args = {}
            calls.append(Call(tool_call["id"], function.get("name", ""), args if isinstance(args, dict) else {}))
            tool_calls.append(tool_call)
        text = _THINKING.sub("", message.get("content") or "")
        turn = {"role": "assistant", "content": message.get("content")}
        if tool_calls:
            turn["tool_calls"] = tool_calls
        return Reply(text.strip(), calls, turn)
