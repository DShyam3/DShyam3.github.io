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

  const checkTrueLayerConnection = async () => {
    try {
      const data = await callTrueLayerEdgeFunction('check_connection');
      setTrueLayerStatus(data);
    } catch (err) {
      console.error('Error checking TrueLayer connection:', err);
    }
  };

  const connectTrueLayer = async () => {
    setIsConnectingTrueLayer(true);
    try {
      const state = Math.random().toString(36).substring(2, 15);
      const redirectUri = `${window.location.origin}/finance`;
      
      const data = await callTrueLayerEdgeFunction('get_auth_url', {
        redirect_uri: redirectUri,
        state: state
      });
      
      if (data?.url) {
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

  const disconnectTrueLayer = async () => {
    try {
      await callTrueLayerEdgeFunction('disconnect');
      toast({
        title: "Disconnected",
        description: "Bank connection removed successfully.",
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

  const syncTrueLayer = async () => {
    setIsSyncingTrueLayer(true);
    try {
      const data = await callTrueLayerEdgeFunction('sync_transactions');
      
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${data.synced_accounts} accounts and ${data.synced_transactions} transactions.`,
      });
      await onSynced();
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
