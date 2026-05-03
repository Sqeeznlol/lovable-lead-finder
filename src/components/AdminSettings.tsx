import { useState, useEffect } from 'react';
import { Shield, Trash2, Users, Activity, Zap, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAutomationSettings, useUpdateAutomationSettings } from '@/hooks/use-app-settings';
import { getMyPhone, setMyPhone } from '@/hooks/use-eigentuemer-lookup';

interface UserWithRoles {
  user_id: string;
  email: string;
  display_name: string;
  roles: string[];
}

export function AdminSettings() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { data: automation } = useAutomationSettings();
  const updateAutomation = useUpdateAutomationSettings();
  const [myPhone, setMyPhoneState] = useState(getMyPhone());

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');

      const userMap: Record<string, UserWithRoles> = {};
      (profiles || []).forEach(p => {
        userMap[p.user_id] = {
          user_id: p.user_id,
          email: p.email || '',
          display_name: p.display_name || '',
          roles: [],
        };
      });
      (roles || []).forEach(r => {
        if (userMap[r.user_id]) {
          userMap[r.user_id].roles.push(r.role);
        }
      });
      setUsers(Object.values(userMap));
    } catch {
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const addRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: role as 'admin' | 'office' | 'mobile_swipe' });
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Rolle "${role}" hinzugefügt` });
      fetchUsers();
    }
  };

  const removeRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('user_roles').delete()
      .eq('user_id', userId)
      .eq('role', role as 'admin' | 'office' | 'mobile_swipe');
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Rolle "${role}" entfernt` });
      fetchUsers();
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'office': return 'bg-primary/10 text-primary border-primary/20';
      case 'mobile_swipe': return 'bg-accent/10 text-accent border-accent/20';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Admin & Einstellungen
        </h2>
        <p className="text-muted-foreground mt-1">Benutzer, Rollen und Systemkonfiguration</p>
      </div>

      {/* Automation toggles */}
      <Card className="border-none shadow-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Automatisierung</h3>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 space-y-1.5">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Meine Telefonnummer</p>
            </div>
            <p className="text-xs text-muted-foreground">Wird automatisch ins ZH-Portal eingefüllt für SMS-Verifikation. Nur lokal gespeichert.</p>
            <Input
              type="tel"
              placeholder="+41 79 123 45 67"
              value={myPhone}
              onChange={e => { setMyPhoneState(e.target.value); setMyPhone(e.target.value); }}
              className="h-9"
            />
          </div>
          {[
            { key: 'auto_advance' as const, label: 'Smart Auto-Advance', desc: 'Nach Auto-Export automatisch zur nächsten Liegenschaft (2s Countdown)' },
            { key: 'auto_eigentuemer_lookup' as const, label: 'Auto-Eigentümer-Lookup', desc: 'Bei Stage „Interessant" automatisch ZH-Portal öffnen und Eigentümer abrufen' },
            { key: 'sms_auto_confirm' as const, label: 'SMS-Bestätigung (Twilio)', desc: 'Sendet automatisch eine Bestätigungs-SMS nach Pipedrive-Push (benötigt Twilio-Connector)' },
            { key: 'daily_digest' as const, label: 'Tägliches Digest (08:00)', desc: 'Versendet morgens eine Zusammenfassung des Vortags' },
          ].map(item => (
            <div key={item.key} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch
                checked={!!(automation as unknown as Record<string, unknown>)?.[item.key]}
                onCheckedChange={v => updateAutomation.mutate({ [item.key]: v })}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Follow-up nach (Tage)</p>
              <Input type="number" min={1} max={30}
                value={automation?.follow_up_days ?? 3}
                onChange={e => updateAutomation.mutate({ follow_up_days: Number(e.target.value) || 3 })}
                className="h-9 mt-1" />
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Stagniert nach (Tage)</p>
              <Input type="number" min={1} max={60}
                value={automation?.stagnation_days ?? 7}
                onChange={e => updateAutomation.mutate({ stagnation_days: Number(e.target.value) || 7 })}
                className="h-9 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="border-none shadow-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Benutzer & Rollen</h3>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Laden...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine Benutzer gefunden</p>
          ) : (
            <div className="space-y-3">
              {users.map(user => (
                <div key={user.user_id} className="flex items-center gap-4 bg-muted/30 rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.display_name || user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.roles.map(role => (
                      <Badge key={role} className={`${roleColor(role)} text-xs gap-1`}>
                        {role}
                        <button onClick={() => removeRole(user.user_id, role)} className="ml-1 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Select
                      value={newRole[user.user_id] || ''}
                      onValueChange={v => {
                        setNewRole(prev => ({ ...prev, [user.user_id]: v }));
                        addRole(user.user_id, v);
                      }}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Rolle hinzufügen" />
                      </SelectTrigger>
                      <SelectContent>
                        {['admin', 'office', 'mobile_swipe']
                          .filter(r => !user.roles.includes(r))
                          .map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-none shadow-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">System</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground">Stack</p>
              <p className="text-sm font-medium">React + Supabase</p>
            </div>
            <div className="bg-muted/50 rounded-lg px-4 py-3">
              <p className="text-xs text-muted-foreground">Pipedrive</p>
              <p className="text-sm font-medium">Verbunden</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
