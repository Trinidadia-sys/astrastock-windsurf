'use client';

import React, { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';

interface ChartData {
  date: string;
  price: number;
  prediction?: number;
  confidenceUpper?: number;
  confidenceLower?: number;
}

interface PredictionData {
  timeframe: string;
  prediction: number;
  change: number;
  changePercent: number;
  confidence: string;
}

interface StockChartProps {
  symbol: string;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  showPrediction?: boolean;
}

const StockChart: React.FC<StockChartProps> = ({
  symbol,
  timeRange,
  onTimeRangeChange,
  showPrediction = false,
}) => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [showPredictionTable, setShowPredictionTable] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);

  // Fetch real chart data from our API
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);

    const fetchChart = async () => {
      try {
        const res = await fetch(`/api/stock?symbol=${symbol}&timeRange=${timeRange}`);
        const json = await res.json();

        if (json.success && json.data.historicalData?.length > 0) {
          const chartData: ChartData[] = json.data.historicalData.map((d: any) => ({
            date: d.date,
            price: d.price,
          }));
          setData(chartData);
          setCurrentPrice(json.data.price);
        }
      } catch (err) {
        console.error('Chart fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChart();
  }, [symbol, timeRange]);

  // Fetch real AI predictions from our API
  const handleGeneratePredictions = async () => {
    if (showPredictionTable) {
      setShowPredictionTable(false);
      return;
    }

    if (predictions.length > 0) {
      setShowPredictionTable(true);
      return;
    }

    if (!currentPrice || data.length === 0) return;

    setPredictionLoading(true);

    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          historicalData: data,
          currentPrice,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const pd = json.data;

        // Build prediction table from GPT-4 response
        const builtPredictions: PredictionData[] = [
          {
            timeframe: '1 Day',
            prediction: currentPrice * (1 + (pd.shortTermPrediction.targetPrice - currentPrice) / currentPrice / 7),
            change: 0,
            changePercent: 0,
            confidence: pd.shortTermPrediction.confidence >= 70 ? 'High' : pd.shortTermPrediction.confidence >= 50 ? 'Medium' : 'Low',
          },
          {
            timeframe: '1 Week',
            prediction: pd.shortTermPrediction.targetPrice,
            change: 0,
            changePercent: 0,
            confidence: pd.shortTermPrediction.confidence >= 70 ? 'High' : pd.shortTermPrediction.confidence >= 50 ? 'Medium' : 'Low',
          },
          {
            timeframe: '1 Month',
            prediction: pd.midTermPrediction.targetPrice,
            change: 0,
            changePercent: 0,
            confidence: pd.midTermPrediction.confidence >= 70 ? 'High' : pd.midTermPrediction.confidence >= 50 ? 'Medium' : 'Low',
          },
          {
            timeframe: '1 Year',
            prediction: pd.midTermPrediction.targetPrice * 1.08, // conservative annual extrapolation
            change: 0,
            changePercent: 0,
            confidence: 'Low',
          },
        ].map(p => ({
          ...p,
          change: parseFloat((p.prediction - currentPrice).toFixed(2)),
          changePercent: parseFloat(((p.prediction - currentPrice) / currentPrice * 100).toFixed(2)),
          prediction: parseFloat(p.prediction.toFixed(2)),
        }));

        setPredictions(builtPredictions);
        setAiInsights(pd);
        setShowPredictionTable(true);
      }
    } catch (err) {
      console.error('Prediction error:', err);
    } finally {
      setPredictionLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 backdrop-blur-md border border-white/20 rounded-lg p-3">
          <div className="text-white font-semibold">{payload[0].payload.date}</div>
          {payload.map((p: any) => (
            <div key={p.dataKey} className={p.dataKey === 'prediction' ? 'text-blue-400' : 'text-green-400'}>
              {p.dataKey === 'prediction' ? 'Prediction' : 'Price'}: ${Number(p.value).toFixed(2)}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
      {/* Time Range Selector */}
      <div className="flex gap-2 mb-6">
        {['1D', '1W', '1M', '1Y', '5Y'].map((range) => (
          <motion.button
            key={range}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onTimeRangeChange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              timeRange === range
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {range}
          </motion.button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-white/10">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse text-center">
              <div className="w-12 h-12 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-gray-400">Loading chart data...</div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={384}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tick={{ fill: '#9ca3af' }} />
              <YAxis stroke="#9ca3af" fontSize={12} tick={{ fill: '#9ca3af' }} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorPrice)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      
            {(showPredictionTable || aiInsights) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-gradient-to-br from-blue-500/10 to-green-500/10 rounded-xl p-6 border border-white/10"
        >
          <h3 className="text-xl font-bold text-white mb-4 text-center">
            AI Insights for {symbol}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Current Analysis
              </h4>
              <div className="text-gray-300 text-sm space-y-2">
                <p>• Current price: <span className="text-white font-medium">${currentPrice?.toFixed(2) ?? 'N/A'}</span></p>
                <p>• Short-term trend: <span className="text-green-400 font-medium">{aiInsights.technicalAnalysis?.trend ?? 'N/A'}</span></p>
                <p>• Momentum: <span className="text-yellow-400 font-medium">{aiInsights.technicalAnalysis?.momentum ?? 'N/A'}</span></p>
                <p>• Support level: <span className="text-blue-400 font-medium">${aiInsights.technicalAnalysis?.supportLevel?.toFixed(2) ?? 'N/A'}</span></p>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                Risk Assessment
              </h4>
              <div className="text-gray-300 text-sm space-y-2">
                <p>• Risk level: <span className="text-orange-400 font-medium">{aiInsights.riskAssessment?.level ?? 'N/A'}</span></p>
                <p>• Volatility: <span className="text-yellow-400 font-medium">{aiInsights.riskAssessment?.volatility ?? 'N/A'}</span></p>
                <p>• Resistance: <span className="text-red-400 font-medium">${aiInsights.technicalAnalysis?.resistanceLevel?.toFixed(2) ?? 'N/A'}</span></p>
                <p>• Key factor: <span className="text-green-400 font-medium">{aiInsights.keyFactors?.[0] ?? 'N/A'}</span></p>
              </div>
            </div>
          </div>

          {/* Future Predictions Table */}
          {predictions.length > 0 && (
            <div className="mt-6 bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                Future Predictions
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-white">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-3 px-4 text-gray-300">Timeframe</th>
                      <th className="text-right py-3 px-4 text-gray-300">Predicted Price</th>
                      <th className="text-right py-3 px-4 text-gray-300">Change</th>
                      <th className="text-right py-3 px-4 text-gray-300">Change %</th>
                      <th className="text-center py-3 px-4 text-gray-300">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((pred) => (
                      <tr key={pred.timeframe} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-medium">{pred.timeframe}</td>
                        <td className="py-3 px-4 text-right font-semibold">${pred.prediction.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right ${pred.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pred.change >= 0 ? '+' : ''}{pred.change.toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 text-right ${pred.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pred.changePercent >= 0 ? '+' : ''}{pred.changePercent.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pred.confidence === 'High' ? 'bg-green-500/20 text-green-400' :
                            pred.confidence === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            pred.confidence === 'Low' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {pred.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aiInsights.shortTermPrediction?.reasoning && (
            <div className="mt-4 bg-white/5 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">AI Reasoning</h4>
              <p className="text-gray-300 text-sm">{aiInsights.shortTermPrediction.reasoning}</p>
            </div>
          )}
          <p className="mt-4 text-center text-gray-400 text-sm">
            🤖 AI insights are generated using GPT-4 analysis. Always conduct your own research before making investment decisions.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StockChart;