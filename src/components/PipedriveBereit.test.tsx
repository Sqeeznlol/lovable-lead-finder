/**
 * Ein Abschnitt, der sich versteckt, solange er leer ist, ist nicht zu
 * finden -- genau das ist mit "Post" passiert. Dieser Test haelt fest,
 * dass beide Abschnitte auch ohne einen einzigen Eintrag dastehen.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-properties', () => ({
  useBereitFuerPipedrive: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useUebertragen: () => ({ data: [] }),
  usePostObjekte: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));

import { PipedriveBereit } from './PipedriveBereit';

describe('Pipedrive-Reiter', () => {
  it('zeigt Post und das Archiv auch dann, wenn beide leer sind', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <PipedriveBereit />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Post — Brief statt Anruf/)).toBeTruthy();
    expect(screen.getByText(/Bereits gepusht/)).toBeTruthy();
    expect(screen.getByText(/Noch kein Brief fällig/)).toBeTruthy();
  });
});
