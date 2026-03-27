import { supabaseClient } from './supabase';

// Wrapper to handle Supabase auth lock conflicts gracefully
export const authWrapper = {
  async getUser() {
    try {
      if (!supabaseClient) {
        return { data: { user: null }, error: new Error('Supabase client not available') };
      }
      return await supabaseClient.auth.getUser();
    } catch (error: any) {
      // Handle lock conflicts gracefully
      if (error.message?.includes('lock') || error.message?.includes('stole')) {
        console.log('Auth lock conflict detected, retrying...');
        // Wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          if (!supabaseClient) {
            return { data: { user: null }, error: new Error('Supabase client not available') };
          }
          return await supabaseClient.auth.getUser();
        } catch (retryError) {
          console.error('Auth retry failed:', retryError);
          return { data: { user: null }, error: retryError };
        }
      }
      throw error;
    }
  },

  async signInWithPassword(email: string, password: string) {
    try {
      if (!supabaseClient) {
        return { data: { user: null, session: null }, error: new Error('Supabase client not available') };
      }
      return await supabaseClient.auth.signInWithPassword({ email, password });
    } catch (error: any) {
      if (error.message?.includes('lock') || error.message?.includes('stole')) {
        console.log('Auth lock conflict detected during sign in, retrying...');
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          if (!supabaseClient) {
            return { data: { user: null, session: null }, error: new Error('Supabase client not available') };
          }
          return await supabaseClient.auth.signInWithPassword({ email, password });
        } catch (retryError) {
          console.error('Sign in retry failed:', retryError);
          return { data: { user: null, session: null }, error: retryError };
        }
      }
      throw error;
    }
  },

  async signOut() {
    try {
      if (!supabaseClient) {
        return { error: new Error('Supabase client not available') };
      }
      return await supabaseClient.auth.signOut();
    } catch (error: any) {
      if (error.message?.includes('lock') || error.message?.includes('stole')) {
        console.log('Auth lock conflict detected during sign out, retrying...');
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          if (!supabaseClient) {
            return { error: new Error('Supabase client not available') };
          }
          return await supabaseClient.auth.signOut();
        } catch (retryError) {
          console.error('Sign out retry failed:', retryError);
          return { error: retryError };
        }
      }
      throw error;
    }
  },

  onAuthStateChange(callback: any) {
    if (!supabaseClient) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};
