'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, Plus, Eye } from 'lucide-react';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface StockSearchProps {
  onStockSelect: (stock: Stock) => void;
  onAddToWatchlist?: (stock: Stock) => void;
  selectedStock?: string;
}

const StockSearch: React.FC<StockSearchProps> = ({ onStockSelect, onAddToWatchlist, selectedStock }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddStock = (stock: Stock) => {
    // Validate stock object before processing
    if (!stock || typeof stock !== 'object' || !stock.symbol) {
      console.error('Invalid stock selected:', stock);
      return;
    }
    
    // Add to watchlist if callback provided
    if (onAddToWatchlist) {
      onAddToWatchlist(stock);
    }
    
    // Also select the stock for viewing
    onStockSelect(stock);
    setQuery('');
    setIsOpen(false);
  };

  useEffect(() => {
    if (query.length > 1 && query.trim()) { // Only search if query has more than 1 character and isn't just whitespace
      setLoading(true);
      // Search real stocks via API
      const searchStocks = async () => {
        try {
          const trimmedQuery = query.trim().toUpperCase();
          console.log('Searching for stock:', trimmedQuery);
          
          // Skip invalid queries
          if (!trimmedQuery || trimmedQuery.length < 1) {
            console.log('Skipping invalid query:', trimmedQuery);
            setResults([]);
            return;
          }
          
          // Skip obviously invalid patterns
          if (trimmedQuery.length < 2 || !/^[A-Z]{1,5}$/.test(trimmedQuery)) {
            console.log('Skipping invalid stock symbol format:', trimmedQuery);
            setResults([]);
            return;
          }
          
          const response = await fetch(`/api/stock?symbol=${trimmedQuery}`);
          console.log('API response status:', response.status);
          
          const data = await response.json();
          console.log('API response data:', data);
          
          // Handle different response scenarios
          if (!data.success) {
            console.log('API returned error:', data.error || 'Unknown error');
            setResults([]);
            return;
          }
          
          if (!data.data) {
            console.log('API returned no data for query:', trimmedQuery);
            setResults([]);
            return;
          }
          
          // Validate and transform API data to Stock format
          if (!data.data.symbol || !data.data.name || data.data.price === undefined || data.data.change === undefined || data.data.changePercent === undefined) {
            console.log('Invalid stock symbol or no data found for query:', trimmedQuery);
            setResults([]);
            return;
          }
          
          const stockResults: Stock[] = [{
            symbol: data.data.symbol,
            name: data.data.name,
            price: data.data.price,
            change: data.data.change,
            changePercent: data.data.changePercent
          }];
          setResults(stockResults);
          console.log('Valid stock data processed:', stockResults);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        } finally {
          setLoading(false);
          setIsOpen(true);
        }
      };

      const timer = setTimeout(searchStocks, 500); // Increased debounce to 500ms to prevent rapid calls
      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stocks..."
          className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden z-50 max-h-96 overflow-y-auto"
          >
            {loading ? (
              <div className="p-4 text-center text-gray-400">
                <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : results.length > 0 ? (
              results.map((stock, index) => (
                <motion.div
                  key={stock.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleAddStock(stock)}
                  className={`p-4 hover:bg-white/10 cursor-pointer transition-all border-b border-white/10 last:border-b-0 ${
                    selectedStock === stock.symbol ? 'bg-purple-500/20' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{stock.symbol}</span>
                        <div className="text-xs text-white/80 mt-1">{stock.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white">${stock.price.toFixed(2)}</div>
                        <div className={`text-sm flex items-center gap-1 ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {stock.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStockSelect(stock);
                        }}
                        className="p-2 bg-blue-500/20 hover:bg-blue-600 rounded text-blue-300 transition-colors"
                        title="View stock details"
                      >
                        <Eye className="w-4 h-4" />
                      </motion.button>
                      {onAddToWatchlist && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToWatchlist(stock);
                          }}
                          className="p-2 bg-green-500/20 hover:bg-green-600 rounded text-green-300 transition-colors"
                          title="Add to Watchlist"
                        >
                          <Plus className="w-4 h-4" />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-400">
                No stocks found
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StockSearch;
