const fs = require('fs');
const path = require('path');

const message = process.env.SLACK_MESSAGE || '';
const xmlPath = path.resolve('reports/junit-report.xml');

let fullMessage = message;

try {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const testcaseRegex = /<testcase[^>]*>[\s\S]*?<\/testcase>/g;
  const failures = [];
  let match;

  while ((match = testcaseRegex.exec(xml)) !== null) {
    const block = match[0];
    if (/<failure[\s>]/.test(block)) {
      const nameMatch = block.match(/(?:^|[\s<])name="([^"]*)"/);
      if (nameMatch) {
        failures.push(`- ${nameMatch[1]}`);
      }
    }
  }

  if (failures.length > 0) {
    fullMessage += `\nFailed tests:\n${failures.join('\n')}`;
  }
} catch (_) {
  // No XML file or parse error — use base message as-is
}

process.stdout.write(JSON.stringify({ text: fullMessage }));
