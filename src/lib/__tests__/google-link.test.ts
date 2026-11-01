import { describe, expect, it } from 'vitest';
import { googleLink } from '@/components/Karte';

describe('Google-Maps-Adressen', () => {
  it('Karte und Street View nach den offiziellen Maps-URLs', () => {
    expect(googleLink([47.3769, 8.5417], false)).toBe('https://www.google.com/maps/search/?api=1&query=47.376900,8.541700');
    expect(googleLink([47.3769, 8.5417], true)).toBe('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=47.376900,8.541700');
  });
});
