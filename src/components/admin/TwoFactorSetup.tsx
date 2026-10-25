import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'on' }
  | { kind: 'off' }
  | { kind: 'pending'; factorId: string; qrCode: string; secret: string };

// Whether a verified authenticator is enrolled. The server enforces the second
// step; this only decides which controls to show.
async function loadPhase(): Promise<Phase> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error('Could not list authentication factors:', error.message);
    return { kind: 'error' };
  }
  return { kind: data.totp.length > 0 ? 'on' : 'off' };
}

export const TwoFactorSetup = () => {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    void loadPhase().then((next) => {
      if (!cancelled) setPhase(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      // An abandoned setup leaves an unverified factor behind, and enrolling
      // again under the same name is refused while it exists.
      const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const factor of listed.all) {
        if (factor.status === 'unverified' && factor.factor_type === 'totp') {
          const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (error) throw error;
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator',
      });
      if (error) throw error;
      setCode('');
      setPhase({ kind: 'pending', factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (error) {
      console.error('Could not start two-factor setup:', error);
      toast({ title: 'Error', description: 'Could not start two-factor setup.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase.kind !== 'pending') return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: phase.factorId, code });
      if (error) {
        console.error('Two-factor confirmation failed:', error.message);
        toast({ title: 'Invalid code', description: 'Check the code and try again.', variant: 'destructive' });
        setCode('');
        return;
      }
      toast({ title: 'Two-factor authentication is on' });
      setCode('');
      setPhase(await loadPhase());
    } catch (error) {
      console.error('Two-factor confirmation error:', error);
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (phase.kind !== 'pending') return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: phase.factorId });
      if (error) throw error;
      setCode('');
      setPhase({ kind: 'off' });
    } catch (error) {
      console.error('Could not cancel two-factor setup:', error);
      toast({ title: 'Error', description: 'Could not cancel two-factor setup.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === 'loading') {
    return (
      <div className="flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phase.kind === 'error') {
    return <p className="text-sm text-muted-foreground">Could not check two-factor authentication.</p>;
  }

  if (phase.kind === 'on') {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Two-factor authentication is on.</p>
        <p className="text-xs text-muted-foreground">
          To remove it, use the Supabase dashboard (Authentication {'->'} Users).
        </p>
      </div>
    );
  }

  if (phase.kind === 'off') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Two-factor authentication is off.</p>
        <Button
          variant="outline"
          onClick={startSetup}
          disabled={busy}
          className="w-full rounded-lg h-12 border-primary/20"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set up two-factor'}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <p id="two-factor-confirm-hint" className="text-sm text-muted-foreground">
        Scan this code with your authenticator app, then enter the 6-digit code it shows.
      </p>
      {/* White and padded because a QR code needs light modules on a dark
          ground to be read; the dark theme would otherwise swallow it. The
          image comes from the server as a data URL and is never injected as
          markup. */}
      <div className="flex justify-center">
        <img
          src={phase.qrCode}
          alt="QR code for your authenticator app"
          className="w-44 h-44 rounded-lg bg-white p-2"
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Or enter this key manually</p>
        <p className="font-mono text-sm break-all select-all">{phase.secret}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="two-factor-confirm-code" className="sr-only">
          Authentication code
        </label>
        <Input
          id="two-factor-confirm-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          aria-describedby="two-factor-confirm-hint"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="h-12 bg-background/50 border-primary/20 rounded-lg px-4 focus-visible:ring-primary/30"
          // The setup button this replaces has unmounted; without this,
          // focus falls back to the page body.
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cancel}
          disabled={busy}
          className="w-full h-12 rounded-lg border-primary/20"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};
