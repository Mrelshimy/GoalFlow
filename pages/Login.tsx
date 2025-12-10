import React, { useState } from 'react';
import { useAuth } from '../App';
import { User, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, signup } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
        if (isSignup) {
            if (name && email && password) {
                await signup(name, email, password);
            }
        } else {
            if (email && password) {
                await login(email, password);
            }
        }
    } catch (err: any) {
        setError(err.message || 'Authentication failed');
    } finally {
        setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
      setIsSignup(!isSignup);
      setName('');
      setEmail('');
      setPassword('');
      setError('');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-100 animate-fade-in">
        <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">G</div>
            <h1 className="text-2xl font-bold text-gray-800">{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
            <p className="text-gray-500 text-sm mt-2">{isSignup ? 'Start tracking your career growth' : 'Sign in to GoalFlow'}</p>
        </div>

        {error && (
            <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-primary outline-none" placeholder="John Doe" required={isSignup} />
                    </div>
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-primary outline-none" placeholder="you@company.com" required />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-primary outline-none" placeholder="••••••••" required />
                </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition-colors shadow-sm mt-2 flex justify-center items-center gap-2 disabled:opacity-70">
                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                {isSignup ? 'Sign Up' : 'Sign In'}
            </button>
        </form>

        <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
                {isSignup ? "Already have an account? " : "Don't have an account? "}
                <button onClick={toggleMode} className="text-primary font-semibold hover:underline">
                    {isSignup ? 'Sign In' : 'Sign Up'}
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;