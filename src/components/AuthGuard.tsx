'use client';

import React, { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Check current auth state
    const getUser = async () => {
      if (!supabaseClient) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabaseClient.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    if (supabaseClient) {
      const { data: { subscription: authSubscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
        console.log('Auth state changed:', { event: _event, session });
        setUser(session?.user ?? null);
        setLoading(false);
      });
      subscription = authSubscription;
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [mounted]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
