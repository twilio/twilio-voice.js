// A stalled reconnect fails as a bare "Timed out" with nothing to show whether
// the SDK ever reached its give-up check, so keep a rolling buffer of the
// browser console and print it when a test fails. The buffer is not cleared
// between tests because a stall often begins in an earlier one.

const BUFFER_LIMIT = 500;
const LEVELS = ['log', 'info', 'warn', 'error'] as const;

const buffer: string[] = [];

const format = (arg: any): string => {
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

Cypress.on('window:before:load', (win: any) => {
  LEVELS.forEach((level) => {
    const original = win.console[level].bind(win.console);
    win.console[level] = (...args: any[]) => {
      original(...args);
      buffer.push(`${new Date().toISOString()} [${level}] ${args.map(format).join(' ')}`);
      if (buffer.length > BUFFER_LIMIT) {
        buffer.shift();
      }
    };
  });
});

afterEach(function(this: Mocha.Context) {
  if (this.currentTest && this.currentTest.state === 'failed' && buffer.length) {
    cy.task('log', [
      `----- browser console (last ${buffer.length}) -----`,
      ...buffer,
      '----- end browser console -----',
    ].join('\n'), { log: false });
  }
});
