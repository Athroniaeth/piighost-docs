"""A chat over the piighost documentation and code, through two MCP servers.

A stand-in for the chatbot the documentation site will carry. It answers from
the documentation (the docs MCP server) and from the code graph (graphify's MCP
server), through a LiteLLM proxy that holds the budget. It is not connected to
piighost: it explains, and sends whoever wants to try to the test applications.
"""

import hmac
import json
import os
from contextlib import AsyncExitStack
from typing import Any

import chainlit as cl
from chainlit.input_widget import Select
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from openai import AsyncOpenAI

LLM = AsyncOpenAI(
    base_url=os.environ["LITELLM_URL"].rstrip("/") + "/v1",
    api_key=os.environ["LITELLM_API_KEY"],
)

MODELS = ["anthropic/claude-sonnet-4-6", "anthropic/claude-haiku-4-5", "openai/gpt-5.4-mini"]
"""The models a reader can pick, the default first: Haiku and GPT-5.4 mini cost less,
and follow the code graph less well."""

SERVERS = {
    "docs": os.environ.get("DOCS_MCP_URL", "http://piighost-docs-mcp:8000/mcp"),
    "code": os.environ.get("GRAPHIFY_MCP_URL", "http://piighost-graphify-mcp:8080/mcp"),
}
"""The MCP servers, by the prefix their tools take."""

HIDDEN_TOOLS = {"list_prs", "get_pr_impact", "triage_prs"}
"""graphify tools that need the gh CLI and a checkout, absent from the server."""

MAX_ROUNDS = 8
"""Tool rounds per answer, a bound on what one question costs."""

LAST_ROUND = (
    "No tool call is left for this question. Answer now from what the tools returned, "
    "with its links, and say what you could not confirm."
)
"""What the last round is told, so it answers rather than announcing another search."""

MAX_RESULT = 24_000
"""Characters of a tool result the model reads."""

TEST_APPS = os.environ.get(
    "TEST_APPS",
    "https://proofreader.piighost.dev (de-identify a document and correct it), "
    "https://piighost-wasm.athroniaeth.cloud (de-identification in the browser)",
)

SYSTEM = f"""You answer questions about piighost, a Python library that de-identifies \
confidential data before it reaches an LLM and restores it in the reply.

Answer from the tools, never from memory:
- docs__search_docs, then docs__read_page on the pages you rely on. The technical guide \
(space "guide") says how to use the library, the wiki (space "wiki", in French) says \
which business rules each process follows, as BR-, DPO-, DEV-, OPS-, USER- identifiers.
- docs__get_id for an identifier: what it says, its page, and for a rule its code and tests.
- code__* to look into the code: code__query_graph for a question, code__get_node and \
code__get_neighbors for one function or class, code__shortest_path between two. \
Two or three code calls usually suffice: answer once you know the function and its file.
For where a behaviour lives in the code, search the wiki first: its process pages list the \
file and function behind each rule, and docs__get_id gives their callers and tests.

Answer in the language of the question, briefly, with code when it helps. Cite every page \
you used as a Markdown link to its URL, and a file of the code as a link to \
https://github.com/Athroniaeth/piighost/blob/master/<file>#L<line>. If the documentation does not say, say so rather \
than guess. You cannot run piighost: to try it, point to {TEST_APPS}."""


@cl.password_auth_callback
def auth(username: str, password: str) -> cl.User | None:
    """One shared account while the chat is a preview."""
    expected = os.environ["CHAT_PASSWORD"]
    if username == os.environ.get("CHAT_USERNAME", "piighost") and hmac.compare_digest(password, expected):
        return cl.User(identifier=username)
    return None


@cl.set_starters
async def starters(user: cl.User | None = None, language: str | None = None) -> list[cl.Starter]:
    return [
        cl.Starter(label="Premier pipeline", message="Comment dé-identifier un texte puis le restaurer avec piighost ?"),
        cl.Starter(label="Règle BR-MSG-05", message="Que dit la règle BR-MSG-05 et où vit-elle dans le code ?"),
        cl.Starter(label="LangChain streaming", message="How do I restore placeholders while streaming a LangChain agent's reply?"),
        cl.Starter(label="Production", message="How do I deploy a thread pipeline with Redis and encrypted storage?"),
    ]


@cl.on_chat_start
async def start() -> None:
    cl.user_session.set("history", [])
    cl.user_session.set("model", MODELS[0])
    await cl.ChatSettings([Select(id="model", label="Model", values=MODELS, initial_index=0)]).send()


@cl.on_settings_update
async def settings(values: dict[str, Any]) -> None:
    cl.user_session.set("model", values["model"])


async def _connect(stack: AsyncExitStack) -> tuple[dict[str, ClientSession], list[dict[str, Any]]]:
    """Open every MCP server, and their tools in the OpenAI shape."""
    sessions: dict[str, ClientSession] = {}
    tools: list[dict[str, Any]] = []
    for prefix, url in SERVERS.items():
        read, write, _ = await stack.enter_async_context(streamablehttp_client(url))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        sessions[prefix] = session
        for tool in (await session.list_tools()).tools:
            if tool.name in HIDDEN_TOOLS:
                continue
            function = {"name": f"{prefix}__{tool.name}", "description": tool.description or "", "parameters": tool.inputSchema}
            tools.append({"type": "function", "function": function})
    return sessions, tools


async def _call(sessions: dict[str, ClientSession], name: str, arguments: str) -> str:
    """Run one tool call, its error returned as text for the model to read."""
    prefix, _, tool = name.partition("__")
    async with cl.Step(name=name, type="tool") as step:
        step.input = arguments
        try:
            result = await sessions[prefix].call_tool(tool, json.loads(arguments or "{}"))
            text = "\n".join(getattr(item, "text", "") for item in result.content)
        except Exception as error:  # noqa: BLE001, the model reads the failure and adapts
            text = f"error: {error}"
        step.output = text[:4000]
    return text[:MAX_RESULT]


@cl.on_message
async def message(incoming: cl.Message) -> None:
    history: list[dict[str, Any]] = cl.user_session.get("history")
    turn: list[dict[str, Any]] = [{"role": "user", "content": incoming.content}]
    answer = cl.Message(content="")
    async with AsyncExitStack() as stack:
        sessions, tools = await _connect(stack)
        for round_ in range(MAX_ROUNDS):
            # The last round answers from what the earlier ones gathered.
            last = round_ == MAX_ROUNDS - 1
            messages = [{"role": "system", "content": SYSTEM}, *history, *turn]
            if last:
                messages.append({"role": "user", "content": LAST_ROUND})
            content, calls = await _complete(messages, tools, answer, last)
            if not calls:
                break
            turn.append({"role": "assistant", "content": content or None, "tool_calls": calls})
            for call in calls:
                output = await _call(sessions, call["function"]["name"], call["function"]["arguments"])
                turn.append({"role": "tool", "tool_call_id": call["id"], "content": output})
    await answer.send()
    # The tool results stay in their turn, so a later question does not pay for them again.
    history.extend([turn[0], {"role": "assistant", "content": answer.content}])


async def _complete(
    messages: list[dict[str, Any]], tools: list[dict[str, Any]], answer: cl.Message, last: bool
) -> tuple[str, list[dict[str, Any]]]:
    """Stream one completion into the answer, and gather the tool calls it asks for."""
    stream = await LLM.chat.completions.create(
        model=cl.user_session.get("model"),
        messages=messages,
        tools=tools,
        tool_choice="none" if last else "auto",
        stream=True,
    )
    content = ""
    calls: dict[int, dict[str, Any]] = {}
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta.content:
            content += delta.content
            await answer.stream_token(delta.content)
        for piece in delta.tool_calls or []:
            call = calls.setdefault(piece.index, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
            call["id"] = piece.id or call["id"]
            if piece.function:
                call["function"]["name"] += piece.function.name or ""
                call["function"]["arguments"] += piece.function.arguments or ""
    if content and calls:
        await answer.stream_token("\n\n")
    return content, [calls[index] for index in sorted(calls)]
