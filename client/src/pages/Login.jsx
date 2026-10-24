import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Crown,
  Code2,
  ShieldAlert
} from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  const executeLogin = async (userEmail, userPassword) => {
    setErrorMessage('');
    try {
      setLoading(true);
      await login({ email: userEmail, password: userPassword });
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please fill in both email and password');
      return;
    }
    await executeLogin(email, password);
  };

  const handleQuickDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    executeLogin(demoEmail, demoPassword);
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        {/* Brand Logo & Name */}
        <div className="inline-flex items-center justify-center space-x-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">DevCollab</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-200">Welcome back</h2>
        <p className="mt-1 text-sm text-gray-400">Sign in to coordinate workspaces, projects, and tasks</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-[#0f1422]/90 backdrop-blur-xl border border-gray-800/80 py-8 px-6 sm:px-8 rounded-2xl shadow-2xl shadow-black/60">
          
          {/* Quick Demo Credentials Autofill Banner */}
          <div className="mb-6 p-3.5 bg-gray-900/80 border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Recruiter & Demo Quick Access
              </span>
              <span className="text-[10px] text-gray-400">One-click sign in</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemo('ayush@example.com', 'Password123')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/50 text-indigo-200 transition-all cursor-pointer group disabled:opacity-50"
              >
                <Crown className="w-3.5 h-3.5 text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-semibold">Admin</span>
                <span className="text-[9px] text-gray-400">Owner</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemo('sarah.dev@example.com', 'Password123')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 text-cyan-200 transition-all cursor-pointer group disabled:opacity-50"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-semibold">Member</span>
                <span className="text-[9px] text-gray-400">Collaborator</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemo('alex.viewer@example.com', 'Password123')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-200 transition-all cursor-pointer group disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-semibold">Viewer</span>
                <span className="text-[9px] text-gray-400">Read-only</span>
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start space-x-3 text-rose-300 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Password
                </label>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#161c2e] border border-gray-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-400">
              Don't have an account yet?{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
