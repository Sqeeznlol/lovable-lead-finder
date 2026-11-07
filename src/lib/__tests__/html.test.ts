import { describe, expect, it } from 'vitest';
import { sicher } from '@/lib/html';

describe('sicher', () => {
  it('macht aus Markup reinen Text', () => {
    expect(sicher('<img src=x onerror=alert(1)>')).toBe('&#60;img src=x onerror=alert(1)&#62;');
    expect(sicher(`"a" & 'b'`)).toBe('&#34;a&#34; &#38; &#39;b&#39;');
    expect(sicher(null)).toBe('');
  });
});
