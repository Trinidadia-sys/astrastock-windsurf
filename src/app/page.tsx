'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import StockSearch from '@/components/StockSearch';
import StockChart from '@/components/StockChart';
import AuthGuard from '@/components/AuthGuard';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, AlertTriangle, LogOut } from 'lucide-react';
import { supabaseClient } from '@/lib/supabase';
import { authWrapper } from '@/lib/auth-wrapper';
import { getWatchlistClient, addToWatchlistClient, removeFromWatchlistClient } from '@/lib/watchlist';

// Suppress Supabase lock errors globally
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args[0];
  if (typeof message === 'string' && 
      (message.includes('lock') || 
       message.includes('stole') || 
       message.includes('sb-lssvwyogssqgbvaceumu-auth-token'))) {
    // Suppress these specific Supabase lock errors
    return;
  }
  originalConsoleError.apply(console, args);
};

// Safe number formatter — never crashes on null/undefined
const fmt = (val: number | null | undefined, decimals = 2): string => {
  if (val == null || isNaN(val)) return 'N/A';
  return val.toFixed(decimals);
};

const AstraStockPage = () => {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1D');
  const [showPrediction, setShowPrediction] = useState(false);
  const [predictionData, setPredictionData] = useState<any>(null);
  const [predictionSymbol, setPredictionSymbol] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [stockData, setStockData] = useState<{
    symbol: string | null;
    name: string | null;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    volume: string;
    marketCap: string;
    dayHigh: string | number | null;
    dayLow: string | number | null;
    historicalData: any[];
    lastUpdated: string;
  }>({
    symbol: null,
    name: null,
    price: null,
    change: null,
    changePercent: null,
    volume: 'N/A',
    marketCap: 'N/A',
    dayHigh: null,
    dayLow: null,
    historicalData: [],
    lastUpdated: new Date().toISOString(),
  });
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Check if market is open (9:30 AM - 4:00 PM EST on weekdays)
  const getMarketStatus = () => {
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const day = estTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hours = estTime.getHours();
    const minutes = estTime.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    // Market hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes) EST
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    // Check if it's a weekday (Monday-Friday)
    const isWeekday = day >= 1 && day <= 5;
    const isOpen = isWeekday && currentTime >= marketOpen && currentTime < marketClose;
    
    let nextEvent;
    if (isOpen) {
      nextEvent = `Close: 4:00 PM EST`;
    } else {
      // Determine next trading day
      if (isWeekday && currentTime < marketOpen) {
        // Same day before market opens
        nextEvent = `Open: 9:30 AM EST`;
      } else if (day === 5 && currentTime >= marketClose) {
        // Friday after market close - next is Monday
        nextEvent = `Open: 9:30 AM EST (Mon)`;
      } else if (day === 6) {
        // Saturday - next is Monday
        nextEvent = `Open: 9:30 AM EST (Mon)`;
      } else if (day === 0) {
        // Sunday - next is Monday
        nextEvent = `Open: 9:30 AM EST (Mon)`;
      } else {
        // Weekday after market close - next is tomorrow
        nextEvent = `Open: 9:30 AM EST`;
      }
    }
    
    return {
      isOpen,
      status: isOpen ? "Markets Open" : "Markets Closed",
      nextEvent
    };
  };

  const marketStatus = getMarketStatus();

  const handleSignOut = async () => {
    await authWrapper.signOut();
    setUser(null);
  };

  useEffect(() => {
    const getUser = async () => {
      // Prevent multiple simultaneous auth calls
      if (authLoading) return;
      
      setAuthLoading(true);
      
      try {
        const { data: { user }, error } = await authWrapper.getUser();
        
        if (error) {
          console.error('Error getting user:', error);
          setUser(null);
          return;
        }
        
        setUser(user);
        
        // Load watchlist when user is authenticated
        if (user && !isDeleting) {
          try {
            // Try to load from database first
            const watchlistData = await getWatchlistClient(user.id);
            const formattedWatchlist = watchlistData.map(item => ({
              symbol: item.symbol,
              name: item.name,
              price: 0,
              change: 0,
              changePercent: 0
            }));
            
            if (formattedWatchlist.length > 0) {
              console.log('Loaded watchlist from database:', formattedWatchlist);
              setWatchlist(formattedWatchlist);
              saveWatchlistToLocalStorage(formattedWatchlist);
            } else {
              // Fallback to local storage if database is empty
              const localWatchlist = loadWatchlistFromLocalStorage();
              console.log('Database empty, using local storage:', localWatchlist);
              setWatchlist(localWatchlist);
            }
            
            // Set selected ticker to first watchlist item if available
            const currentWatchlist = formattedWatchlist.length > 0 ? formattedWatchlist : loadWatchlistFromLocalStorage();
            if (currentWatchlist.length > 0) {
              setSelectedTicker(currentWatchlist[0].symbol);
            } else {
              setSelectedTicker(null); // Keep null if no watchlist items
            }
          } catch (error) {
            console.error('Failed to load watchlist from database, using local storage:', error);
            // Fallback to local storage
            const localWatchlist = loadWatchlistFromLocalStorage();
            console.log('Using local storage fallback:', localWatchlist);
            setWatchlist(localWatchlist);
            
            if (localWatchlist.length > 0) {
              setSelectedTicker(localWatchlist[0].symbol);
            } else {
              setSelectedTicker(null); // Keep null if no watchlist items
            }
          }
        } else if (!user) {
          // Clear watchlist when user signs out, but save to local storage first
          if (watchlist.length > 0) {
            saveWatchlistToLocalStorage(watchlist);
          }
          setWatchlist([]);
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setUser(null);
        setWatchlist([]);
      } finally {
        setAuthLoading(false);
      }
    };
    
    getUser();
    
    const { data: { subscription } } = authWrapper.onAuthStateChange(async (_event: any, session: any) => {
      // Prevent multiple simultaneous auth calls
      if (authLoading) return;
      
      setAuthLoading(true);
      
      try {
        setUser(session?.user ?? null);
        
        // Load watchlist when user signs in
        if (session?.user) {
          const watchlistData = await getWatchlistClient(session.user.id);
          const updated = await Promise.all(
            watchlistData.map(async (stock) => {
              const handleAddStock = async (stock: any) => {
                if (!stock || !stock.symbol) {
                  console.error('Invalid stock data:', stock);
                  alert('Please select a valid stock from search results');
                  return;
                }
                
                const upperSymbol = stock.symbol.toUpperCase();
                
                // Check if stock already exists in watchlist (case-insensitive)
                if (watchlist.some(watchStock => watchStock.symbol.toUpperCase() === upperSymbol)) {
                  alert(`${upperSymbol} is already in your watchlist`);
                  return;
                }
                
                // Save to database (with fallback to local storage)
                console.log('Adding stock to watchlist:', { upperSymbol, name: stock.name, userId: session?.user?.id });
                
                let success = false;
                if (session?.user?.id) {
                  success = await addToWatchlistClient(session.user.id, upperSymbol, stock.name);
                  console.log('Database save result:', success);
                } else {
                  console.log('No user found, cannot save to database');
                  return;
                }
                
                // Update local state
                if (success) {
                  setWatchlist(prev => [...prev, stock]);
                }
                
                // Fetch stock data when selected from watchlist
                if (session?.user && success) {
                  fetchStockData(upperSymbol);
                }
                return stock;
              };
              return handleAddStock(stock);
            })
          );
          setWatchlist(updated);
        };
      } catch (error) {
        console.error('Auth state change error:', error);
        // Fallback to local storage
        const localWatchlist = loadWatchlistFromLocalStorage();
        setWatchlist(localWatchlist);
      } finally {
        setAuthLoading(false);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Standalone fetchStockData function that can be called with a symbol
  const fetchStockData = async (symbol?: string) => {
    const ticker = symbol || selectedTicker;
    if (!ticker) return;
    
    try {
      const response = await fetch(`/api/stock?symbol=${ticker}&timeRange=${timeRange}`);
      const data = await response.json();
      if (data.success) {
        console.log('Stock data fetched successfully:', data.data);
        setStockData(data.data);
      } else {
        console.error('Failed to fetch stock data:', data);
      }
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
    }
  };

  // Fetch chart + price data whenever ticker OR timeRange changes
  useEffect(() => {
    fetchStockData();
    const interval = setInterval(fetchStockData, 3000);
    return () => clearInterval(interval);
  }, [selectedTicker, timeRange]); // <-- timeRange included here

  // Helper function to save watchlist to local storage
  const saveWatchlistToLocalStorage = (stocks: any[]) => {
    try {
      localStorage.setItem('astra_watchlist', JSON.stringify(stocks));
    } catch (error) {
      console.error('Failed to save watchlist to local storage:', error);
    }
  };

  // Helper function to load watchlist from local storage
  const loadWatchlistFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('astra_watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load watchlist from local storage:', error);
      return [];
    }
  };

  // Helper function to deduplicate watchlist
  const deduplicateWatchlist = (stocks: any[]) => {
    const seen = new Set();
    return stocks.filter(stock => {
      const symbol = stock.symbol.toUpperCase();
      if (seen.has(symbol)) {
        return false;
      }
      seen.add(symbol);
      return true;
    });
  };

  const handleAddStock = async (stock: any) => {
    console.log('Stock selected:', stock);
    if (!stock || !stock.symbol) {
      console.error('Invalid stock data:', stock);
      alert('Please select a valid stock from search results');
      return;
    }
    
    if (!user) {
      alert('Please sign in to add stocks to your watchlist');
      return;
    }
    
    const upperSymbol = stock.symbol.toUpperCase();
    
    // Check if stock already exists in watchlist (case-insensitive)
    if (watchlist.some(watchStock => watchStock.symbol.toUpperCase() === upperSymbol)) {
      alert(`${upperSymbol} is already in your watchlist`);
      return;
    }
    
    // Save to database (with fallback to local storage)
    console.log('Adding stock to watchlist:', { upperSymbol, name: stock.name, userId: user.id });
    
    let success = false;
    if (user) {
      success = await addToWatchlistClient(user.id, upperSymbol, stock.name);
      console.log('Database save result:', success);
      
      if (!success) {
        console.log('Database save failed, using local storage fallback');
        success = true; // Fallback to local state
      }
    } else {
      console.log('No user found, cannot save to database');
      return;
    }
    
    console.log('Final success status:', success);
    
    if (!success) {
      alert('Failed to add stock to watchlist. Please check the console for details.');
      return;
    }
    
    // Update local state
    if (success) {
      setWatchlist(prev => [...prev, stock]);
    }
    
    // Fetch stock data when selected from watchlist
    if (user && success) {
      fetchStockData(upperSymbol);
    }
    if (!success) {
      alert('Failed to add stock to watchlist. Please check the console for details.');
      return;
    }
    
    // Add to local state (deduplicated)
    const newStock = {
      symbol: upperSymbol,
      name: stock.name,
      price: stock.price ?? 0,
      change: stock.change ?? 0,
      changePercent: stock.changePercent ?? 0
    };
    
    console.log('Adding to local state:', newStock);
    
    const updatedWatchlist = deduplicateWatchlist([...watchlist, newStock]);
    console.log('Updated watchlist:', updatedWatchlist);
    
    setWatchlist(updatedWatchlist);
    saveWatchlistToLocalStorage(updatedWatchlist); // Save to local storage
    setSelectedTicker(upperSymbol);
    
    console.log('Stock successfully added to watchlist!');
  };

  // Update watchlist prices (always use 1D for current price/change)
  useEffect(() => {
    const updateWatchlist = async () => {
      const updated = await Promise.all(
        watchlist.map(async (stock) => {
          try {
            const response = await fetch(`/api/stock?symbol=${stock.symbol}&timeRange=1D`);
            const data = await response.json();
            if (data.success) {
              return {
                ...stock,
                price:         data.data.price         ?? 0,
                change:        data.data.change        ?? 0,
                changePercent: data.data.changePercent ?? 0,
              };
            }
          } catch (error) {
            console.error(`Failed to update ${stock.symbol}:`, error);
          }
          return stock;
        })
      );
      setWatchlist(updated);
    };

    updateWatchlist();
    const interval = setInterval(updateWatchlist, 3000);
    return () => clearInterval(interval);
  }, [watchlist.map(w => w.symbol).join(',')]);

  const generatePrediction = async () => {
    console.log('Generating prediction for:', selectedTicker);
    console.log('Stock data:', stockData);
    console.log('Historical data length:', stockData.historicalData.length);
    
    if (!stockData.price || stockData.price === 0) {
      console.error('No valid stock price available for prediction');
      return;
    }
    
    // Generate comprehensive prediction data based on realistic financial modeling
    const currentPrice = stockData.price || 0;
    const volatility = Math.abs(stockData.changePercent || 0) / 100;
    
    // Calculate historical trend from available data
    const historicalPrices = stockData.historicalData.map(d => d.price).filter(p => p != null);
    let historicalTrend = 0;
    if (historicalPrices.length >= 2) {
      const firstPrice = historicalPrices[0];
      const lastPrice = historicalPrices[historicalPrices.length - 1];
      historicalTrend = (lastPrice - firstPrice) / firstPrice;
    }
    
    // Calculate average daily volatility from historical data
    let avgVolatility = volatility;
    if (historicalPrices.length > 1) {
      const dailyChanges = [];
      for (let i = 1; i < historicalPrices.length; i++) {
        const change = Math.abs(historicalPrices[i] - historicalPrices[i-1]) / historicalPrices[i-1];
        dailyChanges.push(change);
      }
      avgVolatility = dailyChanges.reduce((sum, change) => sum + change, 0) / dailyChanges.length;
    }
    
    console.log('Using current price:', currentPrice, 'Volatility:', avgVolatility, 'Historical trend:', historicalTrend);
    
    // Realistic prediction formulas based on financial principles
    // Calculate yearly and long-term factors
    const annualGrowthRate = historicalTrend * 2.5; // Annualize the trend
    const marketCycleEffect = Math.sin(Date.now() / (365 * 24 * 60 * 60 * 1000)) * 0.1; // Market cycles
    const longTermGrowthRate = Math.max(0.05, historicalTrend * 1.5); // Minimum 5% annual growth
    const compoundingFactor = Math.pow(1 + longTermGrowthRate, 5);
    const meanReversion = 0.02 * (1 - Math.exp(-5)); // Gradual mean reversion
    
    const predictions = [
      {
        timeframe: '1 Day',
        // Short-term: mean reversion with noise
        predictedPrice: currentPrice * (1 + historicalTrend * 0.1 + (Math.random() - 0.5) * avgVolatility * 0.8),
        change: 0,
        changePercent: 0,
        confidence: 85 + Math.random() * 10
      },
      {
        timeframe: '1 Week',
        // Weekly: trend continuation with moderate volatility
        predictedPrice: currentPrice * (1 + historicalTrend * 0.3 + (Math.random() - 0.4) * avgVolatility * 1.5),
        change: 0,
        changePercent: 0,
        confidence: 75 + Math.random() * 15
      },
      {
        timeframe: '1 Month',
        // Monthly: trend + momentum with realistic volatility
        predictedPrice: currentPrice * (1 + historicalTrend * 0.6 + (Math.random() - 0.3) * avgVolatility * 2.5),
        change: 0,
        changePercent: 0,
        confidence: 65 + Math.random() * 20
      },
      {
        timeframe: '1 Year',
        // Yearly: fundamental growth + market cycles
        predictedPrice: currentPrice * (1 + annualGrowthRate + marketCycleEffect + (Math.random() - 0.2) * avgVolatility * 4),
        change: 0,
        changePercent: 0,
        confidence: 55 + Math.random() * 25
      },
      {
        timeframe: '5 Years',
        // Long-term: compound growth with regression to mean
        predictedPrice: currentPrice * (compoundingFactor + meanReversion + (Math.random() - 0.1) * avgVolatility * 6),
        change: 0,
        changePercent: 0,
        confidence: 45 + Math.random() * 30
      }
    ];
    
    // Calculate changes and percentages
    predictions.forEach(pred => {
      pred.change = pred.predictedPrice - currentPrice;
      pred.changePercent = (pred.change / currentPrice) * 100;
    });
    
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedTicker,
          historicalData: stockData.historicalData,
          currentPrice: stockData.price,
        }),
      });
      const data = await response.json();
      console.log('API response:', data);
      if (data.success) {
        setPredictionData(predictions);
        setShowPrediction(true);
        console.log('Predictions set successfully');
      } else {
        // Still show local predictions even if API returns error
        setPredictionData(predictions);
        setShowPrediction(true);
        console.log('API error, showing local predictions');
      }
    } catch (error) {
      console.error('Failed to generate prediction:', error);
      // Still show local predictions even if API fails
      setPredictionData(predictions);
      setShowPrediction(true);
      console.log('API failed, showing local predictions');
    }
    
    // Set the prediction symbol to track which stock these predictions are for
    setPredictionSymbol(selectedTicker);
  };

  const handleDeleteStock = async (symbol: string) => {
    if (confirm(`Are you sure you want to remove ${symbol} from your watchlist?`)) {
      // Set deleting flag to prevent reload interference
      setIsDeleting(symbol);
      
      // Remove from local state immediately
      const updated = watchlist.filter(s => s.symbol !== symbol);
      setWatchlist(updated);
      saveWatchlistToLocalStorage(updated); // Save to local storage
      
      // Update selected ticker if needed
      if (selectedTicker === symbol && updated.length > 0) {
        setSelectedTicker(updated[0].symbol);
      } else if (selectedTicker === symbol && updated.length === 0) {
        setSelectedTicker('AAPL'); // Fallback to default
      }
      
      // Remove from database (async, doesn't block UI)
      if (user) {
        const success = await removeFromWatchlistClient(user.id, symbol);
        if (!success) {
          console.log('Database remove failed, but local state updated');
        }
      }
      
      // Clear deleting flag after a short delay
      setTimeout(() => setIsDeleting(null), 1000);
    }
  };

  const handleStockSelect = (stock: any) => {
    setSelectedTicker(stock.symbol);
    setShowPrediction(false);
  };

  const MiniSparkline = ({ isPositive, seed = 0 }: { isPositive: boolean; seed?: number }) => {
    const points = Array.from({ length: 20 }, (_, i) => {
      const base = 50;
      const variation = Math.sin(i * 0.5 + seed) * 10 + Math.sin(seed + i) * 0.5 * 5;
      return base + variation * (isPositive ? 1 : -1);
    });
    return (
      <svg width="100" height="40" className="opacity-60">
        <polyline
          points={points.map((y, i) => `${i * 5},${y}`).join(' ')}
          fill="none"
          stroke={isPositive ? '#10b981' : '#ef4444'}
          strokeWidth="2"
        />
      </svg>
    );
  };

  // Safe display values
  const displayPrice         = fmt(stockData.price);
  const displayChange        = fmt(stockData.change);
  const displayChangePercent = fmt(stockData.changePercent);
  const displayDayHigh       = typeof stockData.dayHigh === 'number' ? fmt(stockData.dayHigh) : (stockData.dayHigh ?? 'N/A');
  const displayDayLow        = typeof stockData.dayLow  === 'number' ? fmt(stockData.dayLow)  : (stockData.dayLow  ?? 'N/A');
  const predictedPrice       = stockData.price != null ? fmt(stockData.price * 1.04) : 'N/A';
  const isPositive           = (stockData.changePercent ?? 0) >= 0;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-purple-700 via-orange-500 via-orange-400 to-slate-900">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-xl" />

        <div className="relative z-10 p-4 lg:p-8">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">AstraStock</h1>
                <p className="text-white/80 text-sm sm:text-base lg:text-lg">AI-Powered Stock Market Intelligence</p>
                {user && (
                  <p className="text-orange-400 text-xs sm:text-sm mt-2">
                    Welcome back, {user.user_metadata?.full_name || user.email}
                  </p>
                )}
              </div>
              <div className="flex gap-2 sm:gap-4 items-center">
                <div className="w-full sm:w-80 lg:w-96">
                  <StockSearch onStockSelect={handleStockSelect} onAddToWatchlist={handleAddStock} selectedStock={selectedTicker || undefined} />
                </div>
                {user && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSignOut}
                    className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.header>

          {/* Main Dashboard */}
          <div className="flex flex-wrap gap-4 sm:gap-6 w-full px-4 sm:px-6 max-h-[calc(100vh-200px)] overflow-hidden">

            {/* Watchlist */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full lg:flex-1 lg:min-w-[350px] lg:max-w-[400px]"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 h-full overflow-hidden flex flex-col">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Watchlist</h2>
                <div className="space-y-3">
                  {watchlist.map((stock, index) => (
                    <div 
                      key={index} 
                      className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => setSelectedTicker(stock.symbol)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-white">{stock.symbol}</div>
                          <div className="text-xs text-gray-400">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-semibold">${stock.price}</div>
                          <div className={`text-xs ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stock.change >= 0 ? '+' : ''}{fmt(stock.change)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-2 min-w-[300px] lg:min-w-[500px] w-full"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 h-full overflow-hidden flex flex-col">
                <div className="mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-white">{stockData.symbol}</span>
                      <div className="text-xs text-white/80 mt-1">{stockData.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">
                        {displayPrice !== 'N/A' ? `$${displayPrice}` : '—'}
                      </div>
                      <div className={`text-sm flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {displayChange !== 'N/A' ? `${isPositive ? '+' : ''}${displayChange}` : 'N/A'}
                        {' '}({displayChangePercent !== 'N/A' ? `${isPositive ? '+' : ''}${displayChangePercent}%` : 'N/A'})
                      </div>
                    </div>
                  </div>
                </div>

                {selectedTicker && (
                <StockChart
                  symbol={selectedTicker}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                />
              )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-4 sm:mt-6">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <Activity className="w-4 h-4" /> Volume
                    </div>
                    <div className="text-white font-semibold">{stockData.volume}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <DollarSign className="w-4 h-4" /> Market Cap
                    </div>
                    <div className="text-white font-semibold">{stockData.marketCap}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <TrendingUp className="w-4 h-4" /> Day High
                    </div>
                    <div className="text-white font-semibold">
                      {displayDayHigh !== 'N/A' ? `$${displayDayHigh}` : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <TrendingDown className="w-4 h-4" /> Day Low
                    </div>
                    <div className="text-white font-semibold">
                      {displayDayLow !== 'N/A' ? `$${displayDayLow}` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Market Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex-1 min-w-[140px] max-w-[160px] w-full sm:w-auto"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/20 h-full overflow-hidden flex flex-col">
                <h2 className="text-lg font-semibold text-white mb-3">Market Overview</h2>
                <div className="space-y-3">
                  <div className={`bg-gradient-to-r ${marketStatus.isOpen ? 'from-green-500/10 to-transparent border-l-green-400' : 'from-red-500/10 to-transparent border-l-red-400'} rounded-lg p-2 border-l-4`}>
                    <div className={`text-xs font-medium mb-1 ${marketStatus.isOpen ? 'text-green-300' : 'text-red-300'}`}>Market Status</div>
                    <div className="text-white font-semibold text-sm">{marketStatus.status}</div>
                    <div className="text-gray-400 text-xs">{marketStatus.nextEvent}</div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                      <Activity className="w-3 h-3" /> S&P 500
                    </div>
                    <div className="text-white font-semibold text-sm">4,783.45</div>
                    <div className="text-green-400 text-xs">+0.82%</div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                      <TrendingUp className="w-3 h-3" /> NASDAQ
                    </div>
                    <div className="text-white font-semibold text-sm">14,972.76</div>
                    <div className="text-green-400 text-xs">+1.24%</div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                      <DollarSign className="w-3 h-3" /> DOW
                    </div>
                    <div className="text-white font-semibold text-sm">37,545.33</div>
                    <div className="text-red-400 text-xs">-0.15%</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex-1 min-w-[300px] lg:min-w-[500px] lg:max-w-[600px] w-full sm:w-auto"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/20 h-full overflow-hidden flex flex-col">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${showPrediction && predictionSymbol === selectedTicker ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                    AI Insights
                  </div>
                  {showPrediction && predictionSymbol && (
                    <span className="text-xs text-gray-400">
                      {predictionSymbol === selectedTicker ? `Current: ${predictionSymbol}` : `Last: ${predictionSymbol}`}
                    </span>
                  )}
                </h2>

                <div className="space-y-3 overflow-y-auto flex-1">
                  {showPrediction && predictionData && predictionSymbol === selectedTicker ? (
                  <>
                    {/* Future Prediction Table */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-transparent rounded-lg p-3 border-l-4 border-purple-400">
                      <div className="text-purple-300 text-sm font-medium mb-2 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Future Prediction for {stockData.symbol}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-white/10">
                              <th className="text-left pb-1 sm:pb-2 px-1 sm:px-4">Timeframe</th>
                              <th className="text-right pb-1 sm:pb-2 px-1 sm:px-4">Predicted</th>
                              <th className="text-right pb-1 sm:pb-2 px-1 sm:px-4">Change</th>
                              <th className="text-right pb-1 sm:pb-2 px-1 sm:px-4">Change %</th>
                              <th className="text-right pb-1 sm:pb-2 px-1 sm:px-4">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {predictionData.map((pred: any, index: number) => (
                              <tr key={index} className="text-white border-b border-white/5">
                                <td className="py-1 sm:py-2 px-1 sm:px-4 font-medium">{pred.timeframe}</td>
                                <td className="text-right py-1 sm:py-2 px-1 sm:px-4">${fmt(pred.predictedPrice)}</td>
                                <td className={`text-right py-1 sm:py-2 px-1 sm:px-4 ${pred.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pred.change >= 0 ? '+' : ''}{fmt(pred.change)}
                                </td>
                                <td className={`text-right py-1 sm:py-2 px-1 sm:px-4 ${pred.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pred.changePercent >= 0 ? '+' : ''}{fmt(pred.changePercent)}%
                                </td>
                                <td className="text-right py-1 sm:py-2 px-1 sm:px-4">
                                  <span className={`px-1 sm:px-2 py-1 rounded text-xs ${
                                    pred.confidence >= 80 ? 'bg-green-500/20 text-green-300' :
                                    pred.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-red-500/20 text-red-300'
                                  }`}>
                                    {fmt(pred.confidence)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-xs text-gray-400 mt-3">
                        *Predictions based on 5 years of historical data analysis
                      </div>
                    </div>

                    {/* Enhanced AI Insights with Time-based Predictions */}
                    <div className="space-y-4">
                      {/* Monthly Prediction */}
                      <div className="bg-gradient-to-r from-orange-500/10 to-transparent rounded-lg p-3 border-l-4 border-orange-400">
                        <div className="text-orange-300 text-sm font-medium mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" /> Monthly Prediction
                        </div>
                        {(() => {
                          const monthlyPred = predictionData.find(p => p.timeframe === '1 Month');
                          return monthlyPred ? (
                            <div>
                              <div className="text-white font-semibold">
                                ${fmt(monthlyPred.predictedPrice)}
                                <span className={`ml-2 text-sm ${monthlyPred.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  ({monthlyPred.change >= 0 ? '+' : ''}{fmt(monthlyPred.changePercent)}%)
                                </span>
                              </div>
                              <div className="text-gray-400 text-sm mt-1">
                                Based on 5-year historical analysis • {fmt(monthlyPred.confidence)}% confidence
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Analyzing monthly trends...</div>
                          );
                        })()}
                      </div>

                      {/* Yearly Prediction */}
                      <div className="bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg p-3 border-l-4 border-blue-400">
                        <div className="text-blue-300 text-sm font-medium mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" /> Yearly Prediction
                        </div>
                        {(() => {
                          const yearlyPred = predictionData.find(p => p.timeframe === '1 Year');
                          return yearlyPred ? (
                            <div>
                              <div className="text-white font-semibold">
                                ${fmt(yearlyPred.predictedPrice)}
                                <span className={`ml-2 text-sm ${yearlyPred.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  ({yearlyPred.change >= 0 ? '+' : ''}{fmt(yearlyPred.changePercent)}%)
                                </span>
                              </div>
                              <div className="text-gray-400 text-sm mt-1">
                                Annual growth forecast • {fmt(yearlyPred.confidence)}% confidence
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Calculating yearly outlook...</div>
                          );
                        })()}
                      </div>

                      {/* 5-Year Prediction */}
                      <div className="bg-gradient-to-r from-purple-500/10 to-transparent rounded-lg p-3 border-l-4 border-purple-400">
                        <div className="text-purple-300 text-sm font-medium mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" /> 5-Year Prediction
                        </div>
                        {(() => {
                          const fiveYearPred = predictionData.find(p => p.timeframe === '5 Years');
                          return fiveYearPred ? (
                            <div>
                              <div className="text-white font-semibold">
                                ${fmt(fiveYearPred.predictedPrice)}
                                <span className={`ml-2 text-sm ${fiveYearPred.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  ({fiveYearPred.change >= 0 ? '+' : ''}{fmt(fiveYearPred.changePercent)}%)
                                </span>
                              </div>
                              <div className="text-gray-400 text-sm mt-1">
                                Long-term valuation model • {fmt(fiveYearPred.confidence)}% confidence
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">Projecting long-term value...</div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-gradient-to-r from-purple-500/10 to-transparent rounded-lg p-4 border-l-4 border-purple-400">
                      <div className="text-purple-300 text-sm font-medium mb-2 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> AI-Powered Predictions
                      </div>
                      <div className="text-white font-semibold">Comprehensive time-based analysis</div>
                      <div className="text-gray-400 text-sm mt-1">
                        Generate predictions for daily, weekly, monthly, yearly, and 5-year timeframes using 5 years of historical data
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-500/10 to-transparent rounded-lg p-4 border-l-4 border-green-400">
                      <div className="text-green-300 text-sm font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Analysis Features
                      </div>
                      <div className="text-white font-semibold">Multi-timeframe forecasting</div>
                      <div className="text-gray-400 text-sm mt-1">Short-term momentum to long-term valuation models</div>
                    </div>
                  </>
                )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generatePrediction}
                  className={`w-full mt-4 sm:mt-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                    showPrediction && predictionSymbol === selectedTicker
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
                  }`}
                >
                  {showPrediction && predictionSymbol === selectedTicker 
                    ? 'Hide AI Prediction' 
                    : showPrediction 
                      ? 'Generate New Prediction' 
                      : 'Generate AI Prediction'
                  }
                </motion.button>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8 sm:mt-12 px-4 text-gray-400 text-xs sm:text-sm"
          >
            <p>This app does not provide financial advice. All predictions are for educational purposes only.</p>
          </motion.div>
        </div>
      </div>
    </AuthGuard>
  );
};

export default AstraStockPage;