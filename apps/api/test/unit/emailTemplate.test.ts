import { describe, expect, it } from 'vitest';
import { buildHtmlEmail, escapeHtml } from '../../src/services/emailService';

describe('email template', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe(
      '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;',
    );
  });

  it('never injects raw user content into the alert table', () => {
    const html = buildHtmlEmail([
      { type: 'ITP_EXPIRING', title: '<img src=x onerror=alert(1)>', message: '<b>Truck</b>' },
    ]);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Truck</b>');
    expect(html).toContain('&lt;b&gt;Truck&lt;/b&gt;');
  });
});
