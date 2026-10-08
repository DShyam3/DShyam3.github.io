/**
 * The provider registry, and the rebuilding of each request body before it
 * leaves.
 *
 * Adding a provider is a row here: id, wire protocol, endpoint, model, and
 * the name of the secret holding its key. The browser names an id, never a
 * URL -- a client that could name a URL would turn a key-holding proxy into
 * an SSRF hole -- and a row only answers when its secret is set.
 *
 * The browser builds the body with `src/lib/assistant/protocol.ts`; this file
 * does not trust it. It copies the few fields each protocol needs into a new
 * object, caps them, and sets the model itself, so a client cannot raise
 * `max_tokens`, switch on streaming, or name a costlier model. Tools are
 * rebuilt from name, description and schema, so no server-side tool (a web
 * search, a fetch) can be switched on, and message content is limited to
 * text, tool calls, tool results and thinking -- no image or document block,
 * whose `source` could name a URL for the provider to fetch.
 *
 * Pure: the environment is passed in, so the rules are tested without one.
 */

export type Protocol = 'anthropic' | 'openai'

export interface ProviderRow {
  id: string
  /** Shown in the panel: "Answered by ...". */
  label: string
  protocol: Protocol
  /** The one URL this row may reach. */
  url: string
  /** Overridable per deployment with ASSISTANT_MODEL_<ID>, without a code change. */
  model: string
  /** The Supabase secret holding the key. */
  secret: string
  /** Extra request headers, fixed per row. */
  headers?: Record<string, string>
  /** Extra body fields, fixed per row. Never overrides the fields set below. */
  extraBody?: Record<string, unknown>
}

/**
 * In order of preference: the first row with its secret set is the one the
 * panel uses. The non-Anthropic model names are defaults, not checked against
 * those vendors at the time of writing; set ASSISTANT_MODEL_<ID> to change one.
 */
export const PROVIDERS: readonly ProviderRow[] = [
  {
    id: 'anthropic',
    label: 'Claude',
    protocol: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-opus-5-5',
    secret: 'ANTHROPIC_API_KEY',
    // A request the model's safety classifier declines is re-run server-side
    // on the model Anthropic recommends for that category, inside the same
    // call, rather than coming back as a refusal.
    headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    extraBody: { fallbacks: 'default' },
  },
  {
    id: 'moonshot',
    label: 'Kimi',
    protocol: 'openai',
    url: 'https://api.moonshot.ai/v1/chat/completions',
    model: 'kimi-k2-0905-preview',
    secret: 'MOONSHOT_API_KEY',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    secret: 'DEEPSEEK_API_KEY',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    protocol: 'openai',
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
    secret: 'MISTRAL_API_KEY',
  },
]

export const LIMITS = {
  /** Per model call. The browser asks for this; anything above is cut to it. */
  maxTokens: 8192,
  /** Above the browser's own restart point plus one question's tool rounds. */
  maxMessages: 64,
  maxTools: 16,
  maxSystemChars: 8_000,
  /** The whole request as received, in characters, before parsing. */
  maxBodyChars: 256 * 1024,
} as const

type Env = (name: string) => string | undefined

const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,100}$/

export function resolveModel(row: ProviderRow, env: Env): string {
  const override = env(`ASSISTANT_MODEL_${row.id.toUpperCase()}`)?.trim()
  return override && MODEL_NAME.test(override) ? override : row.model
}

/** The rows whose key is set, in registry order. */
export function configuredProviders(env: Env): ProviderRow[] {
  return PROVIDERS.filter((row) => Boolean(env(row.secret)?.trim()))
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const ROLES: Record<Protocol, ReadonlySet<string>> = {
  anthropic: new Set(['user', 'assistant']),
  openai: new Set(['system', 'user', 'assistant', 'tool']),
}

/**
 * Content block types a message may carry on the Anthropic protocol. `fallback`
 * is the marker a server-side fallback leaves in a reply, echoed back as it
 * came. Anything else -- an image, a document, a server tool's call -- is
 * refused rather than dropped, because dropping a block from an earlier turn
 * edits a history the provider checks.
 */
const ANTHROPIC_BLOCKS: ReadonlySet<string> = new Set([
  'text', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking', 'fallback',
])

const anthropicContentOk = (content: unknown): boolean => {
  if (typeof content === 'string') return true
  if (!Array.isArray(content)) return false
  return content.every((block) =>
    isObject(block)
    && typeof block.type === 'string'
    && ANTHROPIC_BLOCKS.has(block.type)
    // A tool result is the JSON string the browser made; an array here could
    // carry an image block.
    && (block.type !== 'tool_result' || typeof block.content === 'string'))
}

/** The distinct block types in some content, for a log line. Short strings only. */
const blockTypes = (content: unknown): string =>
  Array.isArray(content)
    ? [...new Set(content.map((b) => (isObject(b) && typeof b.type === 'string' ? b.type.slice(0, 40) : typeof b)))].join(',')
    : typeof content

/** OpenAI-compatible content is a string, or null beside tool calls. No parts array: a part can be an image URL. */
const openaiMessageOk = (message: Json): boolean => {
  if (!(typeof message.content === 'string' || (message.content === null && message.role === 'assistant'))) return false
  if (message.tool_calls === undefined) return true
  return message.role === 'assistant'
    && Array.isArray(message.tool_calls)
    && message.tool_calls.every((call) => isObject(call) && call.type === 'function' && isObject(call.function))
}

/** Each tool rebuilt from the three fields a client tool has. A `type` means a server tool, and is refused. */
const rebuildTools = (protocol: Protocol, tools: unknown[]): Json[] | null => {
  const rebuilt: Json[] = []
  for (const tool of tools) {
    if (!isObject(tool)) return null
    if (protocol === 'anthropic') {
      if (tool.type !== undefined) return null
      const { name, description, input_schema } = tool
      if (typeof name !== 'string' || typeof description !== 'string' || !isObject(input_schema)) return null
      rebuilt.push({ name, description, input_schema })
    } else {
      const fn = tool.function
      if (tool.type !== 'function' || !isObject(fn)) return null
      const { name, description, parameters } = fn
      if (typeof name !== 'string' || typeof description !== 'string' || !isObject(parameters)) return null
      rebuilt.push({ type: 'function', function: { name, description, parameters } })
    }
  }
  return rebuilt
}

const clampTokens = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : LIMITS.maxTokens
  return Math.min(Math.max(n, 1), LIMITS.maxTokens)
}

/**
 * The body to send upstream, rebuilt field by field from what the browser
 * sent, or the reason it was refused. The reason is for the function log
 * only; the caller answers a refusal with a generic 400.
 */
export function buildUpstreamBody(
  row: ProviderRow,
  model: string,
  request: unknown,
): { body: Json } | { error: string } {
  if (!isObject(request)) return { error: 'request is not an object' }

  const { messages, tools } = request
  if (!Array.isArray(messages) || messages.length === 0) return { error: 'messages missing' }
  if (messages.length > LIMITS.maxMessages) return { error: 'too many messages' }
  const roles = ROLES[row.protocol]
  if (!messages.every((m) => isObject(m) && typeof m.role === 'string' && roles.has(m.role))) {
    return { error: 'a message has an unknown role' }
  }
  if (tools !== undefined && (!Array.isArray(tools) || tools.length > LIMITS.maxTools)) {
    return { error: 'tools malformed' }
  }
  const rebuiltTools = tools === undefined ? undefined : rebuildTools(row.protocol, tools)
  if (rebuiltTools === null) return { error: 'a tool is not a plain client tool' }

  if (row.protocol === 'anthropic') {
    const { system } = request
    if (system !== undefined && (typeof system !== 'string' || system.length > LIMITS.maxSystemChars)) {
      return { error: 'system malformed' }
    }
    const refused = messages.find((m) => !anthropicContentOk((m as Json).content))
    if (refused) {
      // The type only -- never the content -- so the log names what to allow
      // if a provider starts sending a block this list does not know.
      return { error: `a message carries a block type that is not allowed: ${blockTypes((refused as Json).content)}` }
    }
    return {
      body: {
        ...row.extraBody,
        model,
        max_tokens: clampTokens(request.max_tokens),
        ...(system !== undefined ? { system } : {}),
        messages,
        ...(rebuiltTools !== undefined ? { tools: rebuiltTools } : {}),
      },
    }
  }

  if (!messages.every((m) => openaiMessageOk(m as Json))) {
    return { error: 'a message carries content that is not allowed' }
  }

  // OpenAI-compatible: a system prompt is a message, and only the first may
  // be one.
  const systemMessages = messages.filter((m) => (m as Json).role === 'system')
  if (systemMessages.length > 1 || (systemMessages.length === 1 && (messages[0] as Json).role !== 'system')) {
    return { error: 'system message misplaced' }
  }
  const first = messages[0] as Json
  if (first.role === 'system' && (typeof first.content !== 'string' || first.content.length > LIMITS.maxSystemChars)) {
    return { error: 'system malformed' }
  }
  return {
    body: {
      ...row.extraBody,
      model,
      max_tokens: clampTokens(request.max_tokens),
      messages,
      ...(rebuiltTools !== undefined ? { tools: rebuiltTools } : {}),
    },
  }
}

/** Headers for the upstream call: the key in the protocol's own place. */
export function upstreamHeaders(row: ProviderRow, key: string): Record<string, string> {
  if (row.protocol === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      ...row.headers,
    }
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    ...row.headers,
  }
}
