'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabaseClient } from '@/lib/supabase';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Prevent hydration mismatch by setting mounted state on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!supabaseClient) {
      setError('Authentication service is unavailable. Please try again later.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth`
          }
        });

        if (error) throw error;
        
        // Show success popup for email confirmation
        setShowSuccessPopup(true);
        console.log('User signed up:', data);
      } else {
        // Sign in
        console.log('Attempting sign in with:', email);
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        console.log('Sign in response:', { data, error });

        if (error) {
          if (error.message.includes('Email not confirmed') || error.message.includes('Invalid login credentials')) {
            setError('Please check your email and confirm your account before signing in');
          } else {
            console.error('Sign in error:', error);
            setError(error.message || 'Authentication failed');
          }
        } else {
          console.log('Sign in successful:', data);
          // Force a brief delay to ensure session is established
          setTimeout(() => {
            window.location.href = '/';
          }, 500);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.message.includes('Email not confirmed') || error.message.includes('Invalid login credentials')) {
        setError('Please check your email and confirm your account before signing in');
      } else {
        setError(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-xl" />
      
      {mounted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Astra<span className="text-purple-400">Stock</span>
            </h1>
            <p className="text-gray-400">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </p>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
                  placeholder="••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className={`p-3 rounded-lg border ${
                error.includes('Please check your email') 
                  ? 'bg-green-500/20 border-green-400/30' 
                  : 'bg-red-500/20 border-red-400/30'
              }`}>
                <p className={`text-sm ${
                  error.includes('Please check your email') 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>{error}</p>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </motion.button>
          </form>

          {/* Toggle Auth Mode */}
          <div className="mt-6 text-center">
            <p className="text-gray-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="ml-2 text-purple-400 hover:text-purple-300 transition-colors"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
        </motion.div>
      )}
      
      {/* Success Popup */}
      {showSuccessPopup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-purple-900/90 to-blue-900/90 backdrop-blur-xl p-8 rounded-2xl border border-purple-500/20 max-w-md w-full text-center"
          >
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Check Your Email!</h3>
              <p className="text-gray-300 mb-6">
                We've sent a verification email to <span className="text-purple-400 font-medium">{email}</span>. 
                Please check your inbox and click the verification link to activate your account.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                After verifying your email, come back to this page to sign in.
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  setIsSignUp(false);
                  setError('');
                  setEmail('');
                  setPassword('');
                  setFullName('');
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Go to Sign In
              </button>
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Auth;