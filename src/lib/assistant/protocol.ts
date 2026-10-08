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
 * fetch, no keys, no environment. The registry itself lives server-side, in
 * `supabase/functions/assistant`, because a client that could name a URL
 * rather than an id would be an SSRF hole with a friendly name.
 *
 * It knows nothing about which tools exist. The caller hands in the schemas,
 * so finance, inventory and the watchlist each keep their own beside the data
 * they read, and this file does not grow a line when a tool is added.
 */

export type LlmProtocol = 'openai' | 'anthropic';

/**
 * One tool as the model sees it, in Anthropic's envelope. OpenAI-compatible
 * providers get the same JSON Schema rewrapped by `toolsForProtocol`.
 */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Readonly<Record<string, unknown>>;
    required: readonly string[];
  };
}

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
  /**
   * True when the turn did not finish: a refusal, or the output cap reached.
   * Its text may stop mid-figure, and a tool call in it has no result, so the
   * turn should be neither shown as an answer nor kept in the history.
   */
  incomplete: boolean;
}

/**
 * The tool list in the shape a protocol expects.
 *
 * The JSON Schema body is identical either way; only the envelope differs,
 * which is the whole reason this is a rename rather than an integration.
 */
export function toolsForProtocol(protocol: LlmProtocol, tools: readonly ToolSchema[]): unknown[] {
  // ToolSchema is already Anthropic's shape, so this protocol needs no work.
  if (protocol === 'anthropic') return [...tools];
  return tools.map(tool => ({
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
    // A refusal or a hit output cap can cut a tool call off mid-input, and a
    // truncated input often still parses. Neither turn's tools are run.
    if (root.stop_reason === 'refusal' || root.stop_reason === 'max_tokens') {
      return { text, toolCalls: [], wantsTools: false, incomplete: true };
    }
    const toolCalls = blocks
      .filter(b => b.type === 'tool_use')
      .map(b => ({
        id: String(b.id ?? ''),
        name: String(b.name ?? ''),
        args: parseArgs(b.input),
      }));
    return { text, toolCalls, wantsTools: root.stop_reason === 'tool_use' || toolCalls.length > 0, incomplete: false };
  }

  const choice = asObject(asArray(root.choices)[0]);
  const message = asObject(choice.message);
  const content = typeof message.content === 'string' ? message.content : '';
  // The same rule for the OpenAI shape: arguments cut off by the length cap
  // are not run.
  if (choice.finish_reason === 'length' || choice.finish_reason === 'content_filter') {
    return { text: content, toolCalls: [], wantsTools: false, incomplete: true };
  }
  const toolCalls = asArray(message.tool_calls).map(asObject).map(call => {
    const fn = asObject(call.function);
    return {
      id: String(call.id ?? ''),
      name: String(fn.name ?? ''),
      args: parseArgs(fn.arguments),
    };
  });
  return { text: content, toolCalls, wantsTools: toolCalls.length > 0, incomplete: false };
}

/** A user turn. Plain text content is the same shape on both protocols. */
export function userMessage(text: string): Json {
  return { role: 'user', content: text };
}

/**
 * The model's own turn, echoed back into the history. A reply that called a
 * tool must be echoed before its results, or the result refers to a call the
 * conversation has no record of; a reply that only answered is echoed so the
 * next question has it as context.
 *
 * Anthropic's content goes back exactly as it came, thinking blocks included:
 * a thinking block is valid only while everything before it is unchanged, so
 * this history is only ever appended to. The OpenAI shape is rebuilt from the
 * three fields the chat format defines, because vendors add their own -- and
 * at least one rejects its own reasoning field when it is sent back.
 */
export function assistantMessage(protocol: LlmProtocol, raw: unknown): Json {
  if (protocol === 'anthropic') {
    return { role: 'assistant', content: asObject(raw).content ?? [] };
  }
  const message = asObject(asObject(asArray(asObject(raw).choices)[0]).message);
  const toolCalls = asArray(message.tool_calls);
  return {
    role: 'assistant',
    content: typeof message.content === 'string' ? message.content : toolCalls.length > 0 ? null : '',
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

/**
 * The messages to append after running a tool: the model's own turn, then the
 * results.
 */
export function toolResultMessages(
  protocol: LlmProtocol,
  assistantRaw: unknown,
  results: { call: LlmToolCall; output: unknown }[],
): unknown[] {
  if (protocol === 'anthropic') {
    return [
      assistantMessage(protocol, assistantRaw),
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

  return [
    assistantMessage(protocol, assistantRaw),
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
  tools: readonly ToolSchema[],
  maxTokens = 1024,
): Json {
  if (protocol === 'anthropic') {
    return { model, system, messages, tools: toolsForProtocol(protocol, tools), max_tokens: maxTokens };
  }
  // OpenAI-compatible carries the system prompt as the first message instead
  // of as its own field.
  return {
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    tools: toolsForProtocol(protocol, tools),
    max_tokens: maxTokens,
  };
}
