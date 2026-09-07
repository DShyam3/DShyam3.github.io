import { describe, expect, it } from 'vitest';
import { buildRequest, parseReply, toolResultMessages, toolsForProtocol } from './llm';
import { TOOL_SCHEMAS } from './tools';

describe('toolsForProtocol', () => {
  it('hands Anthropic the schemas unchanged', () => {
    expect(toolsForProtocol('anthropic')).toEqual([...TOOL_SCHEMAS]);
  });

  it('rewraps the same JSON Schema for OpenAI-compatible providers', () => {
    const tools = toolsForProtocol('openai') as Array<{
      type: string;
      function: { name: string; description: string; parameters: unknown };
    }>;
    expect(tools).toHaveLength(TOOL_SCHEMAS.length);
    expect(tools[0].type).toBe('function');
    expect(tools[0].function.name).toBe(TOOL_SCHEMAS[0].name);
    // The body is the same object either way -- that is the whole point.
    expect(tools[0].function.parameters).toEqual(TOOL_SCHEMAS[0].input_schema);
  });
});

describe('parseReply — anthropic', () => {
  it('reads text and tool calls out of the content blocks', () => {
    const reply = parseReply('anthropic', {
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'Let me check. ' },
        { type: 'tool_use', id: 'tu_1', name: 'get_position', input: {} },
      ],
    });
    expect(reply.text).toBe('Let me check. ');
    expect(reply.toolCalls).toEqual([{ id: 'tu_1', name: 'get_position', args: {} }]);
    expect(reply.wantsTools).toBe(true);
  });

  it('joins several text blocks and reports no tools wanted', () => {
    const reply = parseReply('anthropic', {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }],
    });
    expect(reply.text).toBe('ab');
    expect(reply.wantsTools).toBe(false);
  });
});

describe('parseReply — openai-compatible', () => {
  it('reads tool calls and parses the argument string', () => {
    const reply = parseReply('openai', {
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call_1',
            function: { name: 'run_spend_scenario', arguments: '{"amount":250}' },
          }],
        },
      }],
    });
    expect(reply.toolCalls).toEqual([
      { id: 'call_1', name: 'run_spend_scenario', args: { amount: 250 } },
    ]);
    expect(reply.wantsTools).toBe(true);
    expect(reply.text).toBe('');
  });

  it('reads a plain answer', () => {
    const reply = parseReply('openai', { choices: [{ message: { content: 'You have £412.' } }] });
    expect(reply).toEqual({ text: 'You have £412.', toolCalls: [], wantsTools: false });
  });

  it('survives malformed argument JSON rather than throwing mid-loop', () => {
    const reply = parseReply('openai', {
      choices: [{ message: { tool_calls: [{ id: 'c', function: { name: 'x', arguments: '{oops' } }] } }],
    });
    expect(reply.toolCalls[0].args).toEqual({});
  });
});

describe('parseReply — unexpected shapes', () => {
  it('returns an empty reply rather than throwing', () => {
    for (const body of [null, undefined, {}, { choices: [] }, { content: 'not-an-array' }, 42]) {
      for (const protocol of ['openai', 'anthropic'] as const) {
        const reply = parseReply(protocol, body);
        expect(reply.toolCalls).toEqual([]);
        expect(reply.wantsTools).toBe(false);
      }
    }
  });
});

describe('toolResultMessages', () => {
  const call = { id: 'x1', name: 'get_position', args: {} };

  it('echoes the assistant turn then the results, for anthropic', () => {
    const assistant = { content: [{ type: 'tool_use', id: 'x1', name: 'get_position', input: {} }] };
    const [echoed, results] = toolResultMessages('anthropic', assistant, [
      { call, output: { netWorth: 10 } },
    ]) as [{ role: string; content: unknown }, { role: string; content: Array<Record<string, unknown>> }];
    expect(echoed.role).toBe('assistant');
    expect(echoed.content).toEqual(assistant.content);
    expect(results.role).toBe('user');
    expect(results.content[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'x1',
      content: JSON.stringify({ netWorth: 10 }),
    });
  });

  it('echoes the message then one tool message each, for openai', () => {
    const assistant = { choices: [{ message: { role: 'assistant', tool_calls: [] } }] };
    const msgs = toolResultMessages('openai', assistant, [
      { call, output: { netWorth: 10 } },
    ]) as Array<Record<string, unknown>>;
    expect(msgs[0]).toEqual({ role: 'assistant', tool_calls: [] });
    expect(msgs[1]).toEqual({
      role: 'tool',
      tool_call_id: 'x1',
      name: 'get_position',
      content: JSON.stringify({ netWorth: 10 }),
    });
  });
});

describe('buildRequest', () => {
  it('gives Anthropic a top-level system field', () => {
    const body = buildRequest('anthropic', 'some-model', 'be brief', [{ role: 'user', content: 'hi' }]);
    expect(body.system).toBe('be brief');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.max_tokens).toBe(1024);
  });

  it('folds the system prompt into the messages for openai-compatible', () => {
    const body = buildRequest('openai', 'kimi-k2', 'be brief', [{ role: 'user', content: 'hi' }]);
    expect(body.system).toBeUndefined();
    expect(body.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('passes the model through untouched, whatever it is', () => {
    expect(buildRequest('openai', 'deepseek-chat', '', []).model).toBe('deepseek-chat');
    expect(buildRequest('anthropic', 'claude-opus-5', '', []).model).toBe('claude-opus-5');
  });
});
