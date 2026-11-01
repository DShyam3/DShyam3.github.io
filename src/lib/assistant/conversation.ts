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
 * under the Edge Function's message cap with room for a typical question's
 * tool rounds. Not every question's: on the OpenAI protocol each parallel
 * call's result is a message of its own, so one question has no fixed size,
 * and `ask` checks each request against the caps before sending it.
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

/**
 * The Edge Function's caps on one request (`LIMITS` in
 * supabase/functions/assistant/providers.ts), mirrored so a request it would
 * refuse is never sent. Refused, the question fails and the chat starts over;
 * caught here, the question can start afresh and still be answered.
 */
export const MAX_REQUEST_MESSAGES = 64;
export const MAX_REQUEST_CHARS = 256 * 1024;

/** Room for the envelope the client wraps a request body in. */
const ENVELOPE_CHARS = 1024;

const withinFunctionCaps = (body: Record<string, unknown>) =>
  (Array.isArray(body.messages) ? body.messages.length : 0) <= MAX_REQUEST_MESSAGES
  && JSON.stringify(body).length + ENVELOPE_CHARS <= MAX_REQUEST_CHARS;

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
  /**
   * True when the turn ended before the model answered: the call limit was
   * reached, or the next request would pass the Edge Function's caps and
   * starting afresh could not help.
   */
  stoppedEarly: boolean;
  /**
   * True when the history was discarded: it was full before the question, or
   * the question's own tool rounds outgrew the room it left and the question
   * was answered on its own. A question that fails after the second kind of
   * restart reports false, so the caller keeps the history it had -- it was
   * still a valid prefix, and only this question was too big for it.
   */
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
  const historyFull = options.history.length >= MAX_HISTORY_MESSAGES
    || JSON.stringify(options.history).length > MAX_HISTORY_CHARS;
  const start = historyFull ? [] : [...options.history];
  let before = start;
  let restarted = historyFull;
  let messages: unknown[] = [...before, userMessage(options.question)];
  let toolsUsed: string[] = [];
  const request = (turns: unknown[]) => buildRequest(protocol, model, system, [...turns], tools, maxTokens);

  for (let call = 0; call < MAX_MODEL_CALLS; call += 1) {
    let body = request(messages);
    if (!withinFunctionCaps(body)) {
      // This question's tool rounds outgrew the room the history left.
      // Discarding the history whole, as the check above does, and asking
      // again on its own helps only when there is history to drop, the
      // question's own turns would fit without it, and calls remain for a
      // tool round and an answer. Calls already made still count.
      const ownTurns = messages.slice(before.length);
      const canRestart = before.length > 0
        && MAX_MODEL_CALLS - call >= 2
        && withinFunctionCaps(request(ownTurns));
      if (!canRestart) {
        return { text: '', history: messages, toolsUsed, stoppedEarly: true, restarted: historyFull, incomplete: false };
      }
      restarted = true;
      before = [];
      messages = [userMessage(options.question)];
      toolsUsed = [];
      body = request(messages);
    }

    const raw = await send(body);
    const reply = parseReply(protocol, raw);

    if (reply.incomplete) {
      return { text: '', history: start, toolsUsed, stoppedEarly: false, restarted: historyFull, incomplete: true };
    }
    if (!reply.wantsTools || reply.toolCalls.length === 0) {
      messages.push(assistantMessage(protocol, raw));
      // An empty answer is a failed question, so a restart it made does not
      // count against the history the caller already had.
      const answered = reply.text.trim() !== '';
      return { text: reply.text, history: messages, toolsUsed, stoppedEarly: false, restarted: answered ? restarted : historyFull, incomplete: false };
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

  return { text: '', history: messages, toolsUsed, stoppedEarly: true, restarted: historyFull, incomplete: false };
}
