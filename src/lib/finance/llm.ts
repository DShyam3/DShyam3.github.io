/**
 * Talking to any model, without a branch per model.
 *
 * There are not N provider integrations to write -- there are two wire
 * protocols, and a list. Almost every vendor speaks OpenAI's
 * `/chat/completions` shape: Moonshot (Kimi), DeepSeek, Mistral, Groq, xAI,
 * Together, Fireworks, OpenRouter, and anything local behind Ollama or vLLM.
 * Anthropic speaks its own `/v1/messages`. Google has a third, but also
 * publishes an OpenAI-compatible endpoint, so it can arrive as a list entry
 * rather than as code.
 *
 * So adding a provider is a row in a registry -- id, protocol, base URL,
 * model, which secret holds its key -- and never an edit here. This file
 * handles only the translation the two protocols need, and it is pure: no
 * fetch, no keys, no environment. The registry itself lives server-side,
 * because a client that could name a URL rather than an id would be an SSRF
 * hole with a friendly name.
 */

import { TOOL_SCHEMAS } from './tools';

export type LlmProtocol = 'openai' | 'anthropic';

/** One tool the model asked to run. */
export interface LlmToolCall {
  /** Correlates the result back to the call. Anthropic and OpenAI both need it. */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmReply {
  /** Prose the model produced. Empty when it only called tools. */
  text: string;
  toolCalls: LlmToolCall[];
  /** True when the model wants tool results before continuing. */
  wantsTools: boolean;
}

/**
 * The tool list in the shape a protocol expects.
 *
 * The JSON Schema body is identical either way; only the envelope differs,
 * which is the whole reason this is a rename rather than an integration.
 */
export function toolsForProtocol(protocol: LlmProtocol): unknown[] {
  // TOOL_SCHEMAS is already Anthropic's shape, so this protocol needs no work.
  if (protocol === 'anthropic') return [...TOOL_SCHEMAS];
  return TOOL_SCHEMAS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

/** Arguments arrive as a JSON string on OpenAI and as an object on Anthropic. */
const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // A model can emit malformed JSON. An empty object lets the tool reject it
    // on its own terms, which is a better error than a thrown parse.
    return {};
  }
};

type Json = Record<string, unknown>;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asObject = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

/**
 * Normalise a raw response body into text plus tool calls.
 *
 * Written against the response actually being unknown: a provider that returns
 * a shape we did not expect yields empty text and no calls, rather than
 * throwing inside the chat loop.
 */
export function parseReply(protocol: LlmProtocol, body: unknown): LlmReply {
  const root = asObject(body);

  if (protocol === 'anthropic') {
    const blocks = asArray(root.content).map(asObject);
    const text = blocks
      .filter(b => b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text as string)
      .join('');
    const toolCalls = blocks
      .filter(b => b.type === 'tool_use')
      .map(b => ({
        id: String(b.id ?? ''),
        name: String(b.name ?? ''),
        args: parseArgs(b.input),
      }));
    return { text, toolCalls, wantsTools: root.stop_reason === 'tool_use' || toolCalls.length > 0 };
  }

  const message = asObject(asObject(asArray(root.choices)[0]).message);
  const toolCalls = asArray(message.tool_calls).map(asObject).map(call => {
    const fn = asObject(call.function);
    return {
      id: String(call.id ?? ''),
      name: String(fn.name ?? ''),
      args: parseArgs(fn.arguments),
    };
  });
  return {
    text: typeof message.content === 'string' ? message.content : '',
    toolCalls,
    wantsTools: toolCalls.length > 0,
  };
}

/**
 * The messages to append after running a tool: the model's own turn, then the
 * results. Both protocols need the assistant turn echoed back, or the result
 * refers to a call the conversation has no record of.
 */
export function toolResultMessages(
  protocol: LlmProtocol,
  assistantRaw: unknown,
  results: { call: LlmToolCall; output: unknown }[],
): unknown[] {
  if (protocol === 'anthropic') {
    return [
      { role: 'assistant', content: asObject(assistantRaw).content ?? [] },
      {
        role: 'user',
        content: results.map(({ call, output }) => ({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(output),
        })),
      },
    ];
  }

  const message = asObject(asObject(asArray(asObject(assistantRaw).choices)[0]).message);
  return [
    message,
    ...results.map(({ call, output }) => ({
      role: 'tool',
      tool_call_id: call.id,
      name: call.name,
      content: JSON.stringify(output),
    })),
  ];
}

/** The request body for one turn, minus the key and the URL. */
export function buildRequest(
  protocol: LlmProtocol,
  model: string,
  system: string,
  messages: unknown[],
  maxTokens = 1024,
): Json {
  if (protocol === 'anthropic') {
    return { model, system, messages, tools: toolsForProtocol(protocol), max_tokens: maxTokens };
  }
  // OpenAI-compatible carries the system prompt as the first message instead
  // of as its own field.
  return {
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    tools: toolsForProtocol(protocol),
    max_tokens: maxTokens,
  };
}
