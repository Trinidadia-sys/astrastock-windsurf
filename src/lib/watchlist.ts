import { supabaseClient, WatchlistItem } from './supabase';

// Database functions for watchlist management

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  try {
    const { data, error } = await supabaseClient
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching watchlist:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getWatchlist:', error);
    return [];
  }
}

export async function addToWatchlist(userId: string, symbol: string, name: string): Promise<boolean> {
  try {
    const { data: existing } = await supabaseClient
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .single();

    if (existing) {
      console.log('Stock already in watchlist:', symbol);
      return false;
    }

    const { error } = await supabaseClient
      .from('watchlist')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        name,
      });

    if (error) {
      console.error('Error adding to watchlist:', error);
      return false;
    }

    console.log('Added to watchlist:', symbol);
    return true;
  } catch (error) {
    console.error('Error in addToWatchlist:', error);
    return false;
  }
}

export async function removeFromWatchlist(userId: string, symbol: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);

    if (error) {
      console.error('Error removing from watchlist:', error);
      return false;
    }

    console.log('Removed from watchlist:', symbol);
    return true;
  } catch (error) {
    console.error('Error in removeFromWatchlist:', error);
    return false;
  }
}

// Client-side functions for React components
export async function getWatchlistClient(userId: string): Promise<WatchlistItem[]> {
  try {
    console.log('Fetching watchlist for user:', userId);

    const { data, error } = await supabaseClient
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Watchlist database unavailable, using local storage:', error.message);

      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.info('Watchlist table does not exist. Please run the database migration from database/setup.sql in Supabase SQL Editor.');
      }

      return [];
    }

    console.log('Successfully fetched watchlist:', data);
    return data || [];
  } catch (error) {
    console.error('Error in getWatchlistClient:', error);
    return [];
  }
}

export async function addToWatchlistClient(userId: string, symbol: string, name: string): Promise<boolean> {
  try {
    console.log('Adding to watchlist:', { userId, symbol, name });

    const { data: existing, error: checkError } = await supabaseClient
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing stock:', checkError);
      return false;
    }

    if (existing) {
      console.log('Stock already in watchlist:', symbol);
      return false;
    }

    const { data, error } = await supabaseClient
      .from('watchlist')
      .insert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        name,
      })
      .select()
      .single();

    if (error) {
      console.warn('Watchlist database unavailable for add operation:', error.message);
      return false;
    }

    console.log('Successfully added to watchlist:', data);
    return true;
  } catch (error) {
    console.error('Error in addToWatchlistClient:', error);
    return false;
  }
}

export async function removeFromWatchlistClient(userId: string, symbol: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);

    if (error) {
      console.warn('Watchlist database unavailable for remove operation:', error.message);
      return false;
    }

    console.log('Removed from watchlist:', symbol);
    return true;
  } catch (error) {
    console.error('Error in removeFromWatchlistClient:', error);
    return false;
  }
}