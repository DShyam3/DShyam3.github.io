import { describe, expect, it } from 'vitest';
import { ask, MAX_HISTORY_CHARS, MAX_HISTORY_MESSAGES, MAX_MODEL_CALLS } from './conversation';
import type { ToolSchema } from './protocol';

const TOOLS: readonly ToolSchema[] = [{
  name: 'get_position',
  description: 'The current position.',
  input_schema: { type: 'object', properties: {}, required: [] },
}];

/** A model that replies from a script, one body per call. */
const scripted = (bodies: unknown[]) => {
  const sent: Record<string, unknown>[] = [];
  const send = async (body: Record<string, unknown>) => {
    sent.push(body);
    const next = bodies.shift();
    if (next === undefined) throw new Error('script ran out');
    return next;
  };
  return { send, sent };
};

const anthropicToolCall = (id: string) => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'get_position', input: {} }],
});
const anthropicAnswer = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

describe('ask', () => {
  it('returns a plain answer and records it in the history', async () => {
    const { send, sent } = scripted([anthropicAnswer('Hello.')]);
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: [],
      question: 'hi', send, runTool: () => ({}),
    });
    expect(result.text).toBe('Hello.');
    expect(result.stoppedEarly).toBe(false);
    expect(result.history).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'Hello.' }] },
    ]);
    expect(sent[0].tools).toEqual([...TOOLS]);
  });

  it('runs a tool, hands the result back, then returns the answer', async () => {
    const { send, sent } = scripted([anthropicToolCall('t1'), anthropicAnswer('You have £10.')]);
    const ran: string[] = [];
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: [],
      question: 'how much?', send,
      runTool: call => { ran.push(call.name); return { netWorth: 10 }; },
    });
    expect(ran).toEqual(['get_position']);
    expect(result.toolsUsed).toEqual(['get_position']);
    expect(result.text).toBe('You have £10.');
    // The second request carries the call and its result.
    const secondMessages = sent[1].messages as Array<{ role: string; content: unknown }>;
    expect(secondMessages).toHaveLength(3);
    expect(secondMessages[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 't1', content: JSON.stringify({ netWorth: 10 }) }],
    });
  });

  it('reports a throwing tool to the model instead of failing the question', async () => {
    const { send, sent } = scripted([anthropicToolCall('t1'), anthropicAnswer('Could not check.')]);
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: [],
      question: 'q', send, runTool: () => { throw new Error('network: secret detail'); },
    });
    expect(result.text).toBe('Could not check.');
    const sentText = JSON.stringify(sent[1]);
    expect(sentText).toContain('the tool failed to run');
    expect(sentText).not.toContain('secret detail');
  });

  it('stops after the call limit rather than looping on tools forever', async () => {
    const bodies = Array.from({ length: MAX_MODEL_CALLS + 2 }, (_, i) => anthropicToolCall(`t${i}`));
    const { send, sent } = scripted(bodies);
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: [],
      question: 'q', send, runTool: () => ({}),
    });
    expect(sent).toHaveLength(MAX_MODEL_CALLS);
    expect(result.stoppedEarly).toBe(true);
    expect(result.text).toBe('');
  });

  it('speaks openai-compatible too', async () => {
    const { send, sent } = scripted([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', function: { name: 'get_position', arguments: '{}' } }] } }] },
      { choices: [{ message: { role: 'assistant', content: 'Done.' } }] },
    ]);
    const result = await ask({
      protocol: 'openai', model: 'm', system: 'sys', tools: TOOLS, history: [],
      question: 'q', send, runTool: () => ({ ok: true }),
    });
    expect(result.text).toBe('Done.');
    const second = sent[1].messages as Array<Record<string, unknown>>;
    expect(second[0]).toEqual({ role: 'system', content: 'sys' });
    expect(second[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  });

  it('rejects when sending fails, so the caller can say so', async () => {
    await expect(ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: [],
      question: 'q', send: async () => { throw new Error('offline'); }, runTool: () => ({}),
    })).rejects.toThrow('offline');
  });
});

describe('ask — history', () => {
  const earlier = [{ role: 'user', content: 'before' }, { role: 'assistant', content: [{ type: 'text', text: 'ok' }] }];

  it('appends to the history it is given, byte for byte', async () => {
    const { send, sent } = scripted([anthropicAnswer('again')]);
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: earlier,
      question: 'next', send, runTool: () => ({}),
    });
    expect((sent[0].messages as unknown[]).slice(0, 2)).toEqual(earlier);
    expect(result.history.slice(0, 2)).toEqual(earlier);
    expect(result.restarted).toBe(false);
  });

  it('starts afresh when the history is full, rather than trimming it', async () => {
    const full = Array.from({ length: MAX_HISTORY_MESSAGES }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `${i}` }));
    const { send, sent } = scripted([anthropicAnswer('fresh')]);
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: full,
      question: 'q', send, runTool: () => ({}),
    });
    expect(sent[0].messages).toEqual([{ role: 'user', content: 'q' }]);
    expect(result.restarted).toBe(true);
  });

  it('starts afresh when the history is too large to send, however few messages', () => {
    const big = [{ role: 'user', content: 'x'.repeat(MAX_HISTORY_CHARS) }, { role: 'assistant', content: 'ok' }];
    const { send, sent } = scripted([anthropicAnswer('fresh')]);
    return ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: big,
      question: 'q', send, runTool: () => ({}),
    }).then(result => {
      expect(result.restarted).toBe(true);
      expect(sent[0].messages).toEqual([{ role: 'user', content: 'q' }]);
    });
  });

  it('never keeps a turn that was cut off, so it is not resent', async () => {
    const cut = { stop_reason: 'max_tokens', content: [
      { type: 'text', text: 'Let me check. You spent £1,2' },
      { type: 'tool_use', id: 't', name: 'get_position', input: {} },
    ] };
    const { send } = scripted([cut]);
    let ran = false;
    const result = await ask({
      protocol: 'anthropic', model: 'm', system: 's', tools: TOOLS, history: earlier,
      question: 'q', send, runTool: () => { ran = true; return {}; },
    });
    expect(ran).toBe(false);
    expect(result.incomplete).toBe(true);
    expect(result.text).toBe('');
    expect(result.history).toEqual(earlier);
  });
});
