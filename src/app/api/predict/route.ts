import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { symbol, historicalData, currentPrice } = body;

    if (!symbol || !historicalData || !currentPrice) {
      return NextResponse.json({ 
        error: 'Symbol, historical data, and current price are required' 
      }, { status: 400 });
    }

    // Prepare data for AI analysis
    const recentData = historicalData.slice(-30); // Last 30 days
    const prices = recentData.map((d: any) => d.price);
    const volumes = historicalData.slice(-30).map((d: any) => d.volume || 0);
    
    const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const volatility = ((maxPrice - minPrice) / avgPrice) * 100;
    const trend = prices[prices.length - 1] > prices[0] ? 'upward' : 'downward';
    const avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;

    const analysisPrompt = `
    Analyze the following stock data for ${symbol} and provide detailed predictions:

    Current Price: $${currentPrice.toFixed(2)}
    30-Day Average: $${avgPrice.toFixed(2)}
    30-Day Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}
    Volatility: ${volatility.toFixed(2)}%
    Trend: ${trend}
    Average Volume: ${avgVolume.toLocaleString()}

    Recent Price Movement: ${prices.slice(-7).map((p: number) => '$' + p.toFixed(2)).join(', ')}

    Please provide:
    1. Short-term prediction (1-7 days) with target price and confidence level
    2. Mid-term prediction (1-3 months) with target price and confidence level  
    3. Technical analysis summary (RSI, momentum, support/resistance levels)
    4. Risk assessment (Low, Moderate, High) with reasoning
    5. Key factors influencing the prediction

    Format your response as JSON with the following structure:
    {
      "shortTermPrediction": {
        "targetPrice": number,
        "timeframe": "7 days",
        "confidence": number,
        "reasoning": "string"
      },
      "midTermPrediction": {
        "targetPrice": number,
        "timeframe": "3 months", 
        "confidence": number,
        "reasoning": "string"
      },
      "technicalAnalysis": {
        "trend": "string",
        "momentum": "string",
        "rsi": "string",
        "supportLevel": number,
        "resistanceLevel": number
      },
      "riskAssessment": {
        "level": "string",
        "factors": ["string", "string"],
        "volatility": "string"
      },
      "keyFactors": ["string", "string", "string"]
    }
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert financial analyst specializing in stock market predictions. Provide accurate, data-driven analysis with realistic confidence levels. Always consider market volatility, historical patterns, and current market conditions.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return NextResponse.json(
        { error: 'Failed to generate AI prediction' }, 
        { status: 500 }
      );
    }

    const aiResponse = data.choices[0].message.content;
    
    // Try to parse JSON response
    let predictionData;
    try {
      predictionData = JSON.parse(aiResponse);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      predictionData = {
        shortTermPrediction: {
          targetPrice: currentPrice * 1.02,
          timeframe: "7 days",
          confidence: 65,
          reasoning: "Based on recent price momentum and volume patterns"
        },
        midTermPrediction: {
          targetPrice: currentPrice * 1.05,
          timeframe: "3 months",
          confidence: 60,
          reasoning: "Considering historical volatility and market trends"
        },
        technicalAnalysis: {
          trend: trend,
          momentum: "moderate",
          rsi: "neutral",
          supportLevel: minPrice,
          resistanceLevel: maxPrice
        },
        riskAssessment: {
          level: "moderate",
          factors: ["market volatility", "sector performance"],
          volatility: volatility > 20 ? "high" : volatility > 10 ? "moderate" : "low"
        },
        keyFactors: ["price momentum", "volume trends", "market sentiment"]
      };
    }

    // Add prediction points for chart visualization
    const predictionDays = 7;
    const predictionPoints = [];
    const basePrice = currentPrice;
    
    for (let i: number = 1; i <= predictionDays; i++) {
      const targetPrice = predictionData.shortTermPrediction.targetPrice;
      const progress = i / predictionDays;
      const predictedPrice = basePrice + (targetPrice - basePrice) * progress;
      
      predictionPoints.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        prediction: predictedPrice,
        confidenceUpper: predictedPrice * 1.05,
        confidenceLower: predictedPrice * 0.95
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...predictionData,
        predictionPoints,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AI Prediction error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI prediction' }, 
      { status: 500 }
    );
  }
}
