import { describeError, describeEvent } from './activity';

describe('activity messages', () => {
  it('describes ticket events from untrusted details', () => {
    expect(
      describeEvent('ticket:created', { id: 'HD-1043', summary: 'No Wi-Fi' }),
    ).toBe('Ticket HD-1043 created: No Wi-Fi');
    expect(describeEvent('ticket:created', { id: 'HD-1' })).toBe(
      'Ticket HD-1 created',
    );
    expect(describeEvent('ticket:created', 'nonsense')).toBe(
      'The ticket desk reported "ticket:created"',
    );
  });

  it('describes host and module errors', () => {
    expect(
      describeError({ source: 'host', code: 'timeout', message: 'x' }),
    ).toBe('The ticket desk could not be loaded (timeout).');
    expect(
      describeError({
        source: 'module',
        code: 'tickets-unavailable',
        message: 'HTTP 503',
      }),
    ).toBe('The ticket desk reported a problem: HTTP 503');
  });
});
