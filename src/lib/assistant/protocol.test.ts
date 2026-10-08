import { describe, expect, it } from 'vitest';
import {
  assistantMessage, buildRequest, parseReply, toolResultMessages, toolsForProtocol, userMessage,
  type ToolSchema,
} from './protocol';

// Any schema list will do: this module never looks inside one beyond its
// envelope, which is the point of handing them in rather than importing them.
const TOOL_SCHEMAS: readonly ToolSchema[] = [
  {
    name: 'get_position',
    description: 'The current position.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'run_spend_scenario',
    description: 'A hypothetical spend.',
    input_schema: {
      type: 'object',
      properties: { amount: { type: 'number' } },
      required: ['amount'],
    },
  },
];

describe('toolsForProtocol', () => {
  it('hands Anthropic the schemas unchanged', () => {
    expect(toolsForProtocol('anthropic', TOOL_SCHEMAS)).toEqual([...TOOL_SCHEMAS]);
  });

  it('rewraps the same JSON Schema for OpenAI-compatible providers', () => {
    const tools = toolsForProtocol('openai', TOOL_SCHEMAS) as Array<{
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
    expect(reply).toEqual({ text: 'You have £412.', toolCalls: [], wantsTools: false, incomplete: false });
  });

  it('survives malformed argument JSON rather than throwing mid-loop', () => {
    const reply = parseReply('openai', {
      choices: [{ message: { tool_calls: [{ id: 'c', function: { name: 'x', arguments: '{oops' } }] } }],
    });
    expect(reply.toolCalls[0].args).toEqual({});
  });
});

describe('parseReply — cut-off turns', () => {
  it('runs no tool from an anthropic refusal or a hit output cap', () => {
    for (const stop_reason of ['refusal', 'max_tokens']) {
      const reply = parseReply('anthropic', {
        stop_reason,
        content: [{ type: 'tool_use', id: 't', name: 'get_position', input: { partial: true } }],
      });
      expect(reply.toolCalls).toEqual([]);
      expect(reply.wantsTools).toBe(false);
      expect(reply.incomplete).toBe(true);
    }
  });

  it('runs no tool whose arguments were cut off by the length cap, for openai', () => {
    const reply = parseReply('openai', {
      choices: [{
        finish_reason: 'length',
        message: { tool_calls: [{ id: 'c', function: { name: 'get_position', arguments: '{"amou' } }] },
      }],
    });
    expect(reply.wantsTools).toBe(false);
    expect(reply.incomplete).toBe(true);
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
    const toolCalls = [{ id: 'x1', type: 'function', function: { name: 'get_position', arguments: '{}' } }];
    const assistant = { choices: [{ message: { role: 'assistant', content: null, tool_calls: toolCalls } }] };
    const msgs = toolResultMessages('openai', assistant, [
      { call, output: { netWorth: 10 } },
    ]) as Array<Record<string, unknown>>;
    expect(msgs[0]).toEqual({ role: 'assistant', content: null, tool_calls: toolCalls });
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
    const body = buildRequest('anthropic', 'some-model', 'be brief', [{ role: 'user', content: 'hi' }], TOOL_SCHEMAS);
    expect(body.system).toBe('be brief');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.max_tokens).toBe(1024);
  });

  it('folds the system prompt into the messages for openai-compatible', () => {
    const body = buildRequest('openai', 'kimi-k2', 'be brief', [{ role: 'user', content: 'hi' }], TOOL_SCHEMAS);
    expect(body.system).toBeUndefined();
    expect(body.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('passes the model through untouched, whatever it is', () => {
    expect(buildRequest('openai', 'deepseek-chat', '', [], []).model).toBe('deepseek-chat');
    expect(buildRequest('anthropic', 'claude-opus-5', '', [], []).model).toBe('claude-opus-5');
  });
});

describe('buildRequest — tools', () => {
  it('sends exactly the tools it is handed, in the protocol envelope', () => {
    const anthropic = buildRequest('anthropic', 'm', '', [], TOOL_SCHEMAS);
    expect(anthropic.tools).toEqual([...TOOL_SCHEMAS]);
    const openai = buildRequest('openai', 'm', '', [], TOOL_SCHEMAS) as { tools: Array<{ function: { name: string } }> };
    expect(openai.tools.map(t => t.function.name)).toEqual(['get_position', 'run_spend_scenario']);
  });
});

describe('userMessage / assistantMessage', () => {
  it('builds a plain user turn the same way for both protocols', () => {
    expect(userMessage('hi')).toEqual({ role: 'user', content: 'hi' });
  });

  it('echoes an anthropic answer as its content blocks', () => {
    const raw = { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn' };
    expect(assistantMessage('anthropic', raw)).toEqual({ role: 'assistant', content: raw.content });
  });

  it('echoes an openai answer as its message', () => {
    const raw = { choices: [{ message: { role: 'assistant', content: 'done' } }] };
    expect(assistantMessage('openai', raw)).toEqual({ role: 'assistant', content: 'done' });
  });

  it('echoes only the fields the chat format defines, for openai', () => {
    const raw = { choices: [{ message: { role: 'assistant', content: 'done', reasoning_content: 'private', refusal: null } }] };
    expect(assistantMessage('openai', raw)).toEqual({ role: 'assistant', content: 'done' });
  });

  it('never echoes an empty object, which a provider would reject next turn', () => {
    expect(assistantMessage('openai', {})).toEqual({ role: 'assistant', content: '' });
    expect(assistantMessage('anthropic', null)).toEqual({ role: 'assistant', content: [] });
  });
});
