// Testseite für den Darstellungstest der Demo-Szenarien
// (tools/szenarien-pruefen.cjs). Zeigt die echte Zentrale; die Daten
// kommen aus abgefangenen Anfragen, nicht aus der Datenbank.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '../src/index.css';
import { AuthProvider } from '../src/hooks/use-auth';
import { Zentrale } from '../src/components/Zentrale';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider><BrowserRouter>
      {/* overflow-x-clip wie der Inhaltsbereich in src/pages/Index.tsx:
          das Luftbild im Kopf reicht absichtlich über den Rand. */}
      <div className="min-h-screen overflow-x-clip bg-background px-4 pt-6 pb-16 sm:p-10"><Zentrale /></div>
    </BrowserRouter></AuthProvider>
  </QueryClientProvider>,
);
