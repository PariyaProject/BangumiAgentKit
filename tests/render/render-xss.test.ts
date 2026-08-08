import { describe, it, expect } from 'vitest';
import { renderHtmlTemplate, SubjectCardViewModel } from '@bangumi-agent-kit/renderer';

describe('PR-5 Renderer XSS Regression (R08, R30)', () => {
  it('R08 & R30: Malicious script/DOM injection in ViewModel is escaped as pure text', () => {
    const maliciousVm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 666,
        name: '<script>alert("xss-name")</script>',
        nameCn: '"><svg onload=alert(1)>',
        type: 'anime',
        summary: '</style><script>alert("xss-summary")</script><img src="http://127.0.0.1/evil.jpg" onerror="alert(1)">',
        tags: ['"><svg onload=alert(1)>', '<script>fetch("http://attacker")</script>'],
      },
      source: { label: '"><script>alert(1)</script>' },
    };

    const html = renderHtmlTemplate(maliciousVm);

    // 1. Should not contain unescaped executable script tags or SVG elements
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<script>fetch');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<img src="http://127.0.0.1/evil.jpg" onerror');

    // 2. Should contain properly HTML-escaped text entities
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;&gt;&lt;svg');
    expect(html).toContain('&lt;/style&gt;&lt;script&gt;');

    // 3. Verification: CSP header present
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("script-src 'none'");
  });
});
