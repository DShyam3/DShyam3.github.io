/**
 * The TrueLayer connection: status, connect, disconnect and sync.
 *
 * Both the Home and Wealth surfaces offer a "Sync Bank" control, so this was
 * the last thing keeping them tied to FinancePage (REHAUL_PLAN.md 7.2c-i). As
 * a hook, either can hold its own without either owning the other.
 *
 * `onSynced` is how a caller refreshes the ledger afterwards -- the provider's
 * fetch, in practice -- rather than this hook reaching back into it.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TrueLayerStatus } from '@/features/finance/finance-types';
import { rememberTrueLayerOAuthState } from './truelayer-oauth';

export function useTrueLayer(onSynced: () => void | Promise<void>) {
  const { toast } = useToast();

  // TrueLayer state
  const [trueLayerStatus, setTrueLayerStatus] = useState<TrueLayerStatus | null>(null);

  const [isSyncingTrueLayer, setIsSyncingTrueLayer] = useState(false);

  const [isConnectingTrueLayer, setIsConnectingTrueLayer] = useState(false);

  const callTrueLayerEdgeFunction = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("User session not found. Please log in again.");
    }
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/truelayer-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Server returned status ${response.status}`);
    }
    return data;
  };

  const checkTrueLayerConnection = useCallback(async () => {
    try {
      const data = await callTrueLayerEdgeFunction('check_connection');
      setTrueLayerStatus(data);
    } catch (err) {
      console.error('Error checking TrueLayer connection:', err);
    }
  }, []);

  useEffect(() => {
    void checkTrueLayerConnection();
  }, [checkTrueLayerConnection]);

  const connectTrueLayer = async () => {
    setIsConnectingTrueLayer(true);
    try {
      const redirectUri = `${window.location.origin}/finance`;
      const data = await callTrueLayerEdgeFunction('get_auth_url', {
        redirect_uri: redirectUri,
      });
      
      if (typeof data?.url === 'string' && typeof data?.state === 'string') {
        rememberTrueLayerOAuthState(window.sessionStorage, data.state);
        window.location.href = data.url;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (err) {
      console.error('Error connecting to TrueLayer:', err);
      toast({
        title: "Connection Failed",
        description: (err instanceof Error ? err.message : '') || "Failed to initiate TrueLayer connection",
        variant: "destructive"
      });
    } finally {
      setIsConnectingTrueLayer(false);
    }
  };

  const disconnectTrueLayer = async (connectionId?: string) => {
    try {
      await callTrueLayerEdgeFunction('disconnect', connectionId ? { connection_id: connectionId } : {});
      toast({
        title: "Disconnected",
        description: connectionId ? "Bank connection removed." : "Bank connections removed.",
      });
      checkTrueLayerConnection();
    } catch (err) {
      console.error('Error disconnecting TrueLayer:', err);
      toast({
        title: "Disconnection Failed",
        description: (err instanceof Error ? err.message : '') || "Failed to disconnect",
        variant: "destructive"
      });
    }
  };

  /**
   * Top the merchant-logo cache up after a sync.
   *
   * A sync is the only thing that introduces merchants, so it is the only
   * moment the cache can be out of date. Fire-and-forget and silent on
   * failure: a logo is decoration, every row already draws a monogram without
   * it, and a toast about a missing supermarket icon would be noise on top of
   * a sync the person actually asked for.
   */
  const refreshMerchantLogos = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-logo-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.error('Error refreshing merchant logos:', err);
    }
  };

  const syncTrueLayer = async () => {
    setIsSyncingTrueLayer(true);
    try {
      const data = await callTrueLayerEdgeFunction('sync_transactions');
      
      const banksDesc = data.connections_synced > 1
        ? ` across ${data.connections_synced} banks`
        : '';
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${data.synced_accounts} accounts and ${data.synced_transactions} transactions${banksDesc}.`,
      });

      if (data.errors?.length) {
        toast({
          title: "Partial Sync Warnings",
          description: data.errors.map((e: { provider: string; error: string }) => `${e.provider}: ${e.error}`).join('; '),
          variant: "destructive",
        });
      }

      await onSynced();
      void refreshMerchantLogos();
    } catch (err) {
      console.error('Error syncing TrueLayer:', err);
      toast({
        title: "Sync Failed",
        description: (err instanceof Error ? err.message : '') || "Failed to synchronize transactions",
        variant: "destructive"
      });
    } finally {
      setIsSyncingTrueLayer(false);
    }
  };

  return {
    trueLayerStatus,
    isSyncingTrueLayer,
    isConnectingTrueLayer,
    setIsConnectingTrueLayer,
    checkTrueLayerConnection,
    connectTrueLayer,
    disconnectTrueLayer,
    syncTrueLayer,
    callTrueLayerEdgeFunction,
  };
}
