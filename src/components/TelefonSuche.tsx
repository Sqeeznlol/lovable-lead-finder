import { useState } from 'react';
import { Search, Phone, Check, ArrowRight, SkipForward, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useProperties, useUpdateProperty } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';

export function TelefonSuche() {
  const { data: result, refetch } = useProperties({ statusFilter: 'Eigentümer ermittelt', pageSize: 200 });
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [processing, setProcessing] = useState(false);

  const items = (result?.data || []).filter(p => p.owner_name && !p.owner_phone);
  const current = items[currentIndex];

  const telSearchUrl = (name: string, ort?: string) =>
    `https://tel.search.ch/?was=${encodeURIComponent([name, ort].filter(Boolean).join(' '))}`;

  const opendiUrl = (name: string) =>
    `https://www.opendi.ch/q?q=${encodeURIComponent(name)}`;

  const moveToNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
      setPhone1(''); setPhone2('');
    } else {
      refetch();
      setCurrentIndex(0);
      setPhone1(''); setPhone2('');
    }
  };

  const handleSave = async () => {
    if (!current) return;
    setProcessing(true);
    try {
      const updates: Record<string, unknown> = {
        id: current.id,
        owner_phone: phone1 || null,
        status: phone1 ? 'Telefon gefunden' : 'Eigentümer ermittelt',
      };
      if (phone2 && current.owner_name_2) {
        updates.owner_phone_2 = phone2;
      }
      await updateProp.mutateAsync(updates as any);
      toast({ title: phone1 ? '✅ Telefonnummer gespeichert' : '✅ Übersprungen' });
      moveToNext();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (!current) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg max-w-md w-full">
          <CardContent className="p-12 text-center space-y-4">
            <Phone className="h-16 w-16 mx-auto text-accent" />
            <h3 className="text-xl font-bold">Keine offenen Nummern-Suchen</h3>
            <p className="text-muted-foreground">Alle ermittelten Eigentümer haben bereits eine Telefonnummer.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ort = current.plz_ort || current.gemeinde || '';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Telefonnummern-Suche</h2>
          <p className="text-muted-foreground text-sm">{items.length} Eigentümer ohne Telefonnummer</p>
        </div>
        <Badge variant="outline">{currentIndex + 1} / {items.length}</Badge>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {/* Property info */}
          <div className="p-6 bg-gradient-to-br from-card to-muted/30 border-b">
            <p className="text-sm text-muted-foreground">{current.address}</p>
            <p className="text-xs text-muted-foreground">{ort}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {current.zone && <Badge variant="outline" className="text-xs">{current.zone}</Badge>}
              {current.baujahr && <Badge variant="outline" className="text-xs">Bj. {current.baujahr}</Badge>}
            </div>
          </div>

          {/* Owner 1 */}
          <div className="p-6 space-y-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Eigentümer 1</Label>
                <p className="text-lg font-bold mt-1">{current.owner_name}</p>
                {current.owner_address && <p className="text-sm text-muted-foreground">{current.owner_address}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1"
                onClick={() => window.open(telSearchUrl(current.owner_name!, ort), '_blank')}>
                <Search className="h-3.5 w-3.5" /> tel.search.ch
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="gap-1"
                onClick={() => window.open(opendiUrl(current.owner_name!), '_blank')}>
                <Search className="h-3.5 w-3.5" /> Opendi
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Telefonnummer</Label>
              <Input placeholder="+41 ..." value={phone1} onChange={e => setPhone1(e.target.value)} className="h-10" autoFocus />
            </div>
          </div>

          {/* Owner 2 if exists */}
          {current.owner_name_2 && (
            <div className="p-6 space-y-3 border-b">
              <div>
                <Label className="text-sm font-semibold">Eigentümer 2</Label>
                <p className="text-lg font-bold mt-1">{current.owner_name_2}</p>
                {current.owner_address_2 && <p className="text-sm text-muted-foreground">{current.owner_address_2}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(telSearchUrl(current.owner_name_2!, ort), '_blank')}>
                  <Search className="h-3.5 w-3.5" /> tel.search.ch
                </Button>
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(opendiUrl(current.owner_name_2!), '_blank')}>
                  <Search className="h-3.5 w-3.5" /> Opendi
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefonnummer</Label>
                <Input placeholder="+41 ..." value={phone2} onChange={e => setPhone2(e.target.value)} className="h-10" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-5 bg-muted/30 flex gap-3">
            <Button variant="outline" onClick={moveToNext} disabled={processing}>
              <SkipForward className="h-4 w-4 mr-2" /> Überspringen
            </Button>
            <Button onClick={handleSave} disabled={processing} className="ml-auto h-11 px-6" size="lg">
              <Check className="h-5 w-5 mr-2" />
              {phone1 ? 'Speichern & Nächstes' : 'Ohne Nummer weiter'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
