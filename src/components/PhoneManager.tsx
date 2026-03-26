import { useState } from 'react';
import { Phone, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePhoneNumbers, useAddPhone, useDeletePhone, useResetPhoneQueries } from '@/hooks/use-phones';
import { useToast } from '@/hooks/use-toast';

export function PhoneManager() {
  const { data: phones, isLoading } = usePhoneNumbers();
  const addPhone = useAddPhone();
  const deletePhone = useDeletePhone();
  const resetQueries = useResetPhoneQueries();
  const { toast } = useToast();
  const [newNumber, setNewNumber] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newNumber.trim()) return;
    addPhone.mutate(
      { number: newNumber.trim(), label: newLabel.trim() || undefined },
      {
        onSuccess: () => { setNewNumber(''); setNewLabel(''); toast({ title: 'Nummer hinzugefügt' }); },
        onError: (err) => toast({ title: 'Fehler', description: String(err), variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Telefonnummern</h2>
        <p className="text-muted-foreground mt-1">Verwalte die Nummern für die Portal-Abfragen (5 pro Nummer/Tag)</p>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Input placeholder="+41 79 123 45 67" value={newNumber} onChange={e => setNewNumber(e.target.value)} className="flex-1" />
            <Input placeholder="Bezeichnung (optional)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-48" />
            <Button onClick={handleAdd} disabled={addPhone.isPending}>
              <Plus className="h-4 w-4 mr-2" /> Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Laden...</p>
        ) : (phones || []).length === 0 ? (
          <Card className="col-span-full border-none shadow-sm">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Noch keine Nummern hinzugefügt</p>
            </CardContent>
          </Card>
        ) : (phones || []).map(phone => (
          <Card key={phone.id} className="border-none shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold font-mono">{phone.number}</p>
                  {phone.label && <p className="text-sm text-muted-foreground">{phone.label}</p>}
                </div>
                <Badge variant={phone.daily_queries_used >= 5 ? 'destructive' : 'secondary'}>
                  {phone.daily_queries_used}/5
                </Badge>
              </div>
              <Progress value={(phone.daily_queries_used / 5) * 100} className="h-2" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  resetQueries.mutate(phone.id, { onSuccess: () => toast({ title: 'Zurückgesetzt' }) });
                }}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  deletePhone.mutate(phone.id, { onSuccess: () => toast({ title: 'Gelöscht' }) });
                }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
