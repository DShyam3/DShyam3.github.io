/**
 * One question, answered: ask the model, run whatever tools it asks for, hand
 * back the results, and repeat until it answers in prose.
 *
 * Pure in the way the rest of `lib` is. The two things that touch the world --
 * sending a request and running a tool -- are passed in, so this file holds
 * only the order of operations and the limits on it, and a test can drive the
 * whole loop with a scripted model.
 */

import {
  assistantMessage,
  buildRequest,
  parseReply,
  toolResultMessages,
  userMessage,
  type LlmProtocol,
  type LlmToolCall,
  type ToolSchema,
} from './protocol';

/**
 * Model calls allowed for one question. A question that needs more tool
 * rounds than this is a model going in circles, and each round is billed.
 */
export const MAX_MODEL_CALLS = 5;

/**
 * History allowed before the next question starts a fresh conversation. Sits
 * under the Edge Function's message cap with room for one question's tool
 * rounds.
 *
 * Full means start again, never trim. A model's thinking blocks stay valid
 * only while everything sent before them is unchanged, so dropping the oldest
 * turns -- the obvious way to cap a history -- is an edit the provider can
 * refuse. History here is only ever appended to, or discarded whole.
 */
export const MAX_HISTORY_MESSAGES = 24;

/**
 * The same rule by size: tool results are JSON and some are long, and the
 * Edge Function refuses a body over its character cap. Half of that cap
 * leaves the turn being built room to grow.
 */
export const MAX_HISTORY_CHARS = 128 * 1024;

export interface AskOptions {
  protocol: LlmProtocol;
  model: string;
  system: string;
  tools: readonly ToolSchema[];
  /** The conversation so far, in the protocol's own message shape. */
  history: readonly unknown[];
  question: string;
  /** Sends one request body and resolves the provider's raw response body. */
  send: (body: Record<string, unknown>) => Promise<unknown>;
  /** Runs one tool call. A tool that throws is reported to the model as an error. */
  runTool: (call: LlmToolCall) => unknown | Promise<unknown>;
  maxTokens?: number;
}

export interface AskResult {
  /** The model's prose answer. Empty when it never gave one. */
  text: string;
  /** The history to send with the next question. */
  history: unknown[];
  /** Tool names in the order they ran, for showing what an answer rests on. */
  toolsUsed: string[];
  /** True when the call limit ended the turn before the model answered. */
  stoppedEarly: boolean;
  /** True when the history was full, so this question started a fresh conversation. */
  restarted: boolean;
  /**
   * True when the model's last turn did not finish (`LlmReply.incomplete`).
   * `text` is then empty and `history` is the history from before the
   * question, so a half-made turn is never sent again.
   */
  incomplete: boolean;
}

/**
 * Asks one question. Rejects only when `send` rejects; everything a model or
 * a tool can get wrong comes back as data instead.
 */
export async function ask(options: AskOptions): Promise<AskResult> {
  const { protocol, model, system, tools, send, runTool, maxTokens } = options;
  const restarted = options.history.length >= MAX_HISTORY_MESSAGES
    || JSON.stringify(options.history).length > MAX_HISTORY_CHARS;
  const before = restarted ? [] : [...options.history];
  const messages: unknown[] = [...before, userMessage(options.question)];
  const toolsUsed: string[] = [];

  for (let call = 0; call < MAX_MODEL_CALLS; call += 1) {
    const raw = await send(buildRequest(protocol, model, system, [...messages], tools, maxTokens));
    const reply = parseReply(protocol, raw);

    if (reply.incomplete) {
      return { text: '', history: before, toolsUsed, stoppedEarly: false, restarted, incomplete: true };
    }
    if (!reply.wantsTools || reply.toolCalls.length === 0) {
      messages.push(assistantMessage(protocol, raw));
      return { text: reply.text, history: messages, toolsUsed, stoppedEarly: false, restarted, incomplete: false };
    }

    const results: { call: LlmToolCall; output: unknown }[] = [];
    for (const toolCall of reply.toolCalls) {
      toolsUsed.push(toolCall.name);
      let output: unknown;
      try {
        output = await runTool(toolCall);
      } catch {
        // The detail of a failed read is not the model's business, and the
        // conversation should survive it.
        output = { tool: toolCall.name, error: 'the tool failed to run' };
      }
      results.push({ call: toolCall, output });
    }
    messages.push(...toolResultMessages(protocol, raw, results));
  }

  return { text: '', history: messages, toolsUsed, stoppedEarly: true, restarted, incomplete: false };
}
