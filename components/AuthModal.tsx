"use client";

import { useState } from "react";
import { X, Mail } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

import { useEffect } from "react";
import { useTaskStore } from "@/store/useTaskStore";

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { user } = useTaskStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);

  // Auto-close the modal if the user becomes authenticated while it's open
  useEffect(() => {
    if (isOpen && user) {
      onClose();
      onSuccess?.();
    }
  }, [user, isOpen, onClose, onSuccess]);

  // Reset transient error state when modal opens/closes for clean UX
  useEffect(() => {
    if (!isOpen) {
      setAuthError(null);
      setEmail("");
      setPassword("");
      setLoading(false);
      setMode('signin');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If the user is already signed in when the modal opens, show a simple state
  if (user) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div 
          className="glass w-full max-w-md rounded-3xl p-8 relative text-center"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onClose} aria-label="Close sign in modal" className="absolute top-5 right-5 text-[#71717a] hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">You're already signed in</h2>
          <p className="text-[#a1a1aa]">{user.email}</p>
        </div>
      </div>
    );
  }

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      // Demo mode
      setTimeout(() => {
        setLoading(false);
        toast.success(mode === 'signin' ? "Demo sign in successful" : "Demo account created");
        onClose();
        onSuccess?.();
      }, 600);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setAuthError(error.message || "Sign in failed. Please check your credentials.");
          toast.error("Sign in failed", { description: error.message });
        } else {
          // Success - the useEffect above will auto-close when user appears
          toast.success("Signed in successfully");
        }
      } else {
        // Sign up
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          setAuthError(error.message || "Sign up failed. Please try again.");
          toast.error("Sign up failed", { description: error.message });
        } else {
          toast.success("Account created! You are now signed in.");
          // Auto-close will happen via the user useEffect
        }
      }
    } catch (err: any) {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Authentication error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="glass w-full max-w-md rounded-3xl p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close sign in modal" className="absolute top-5 right-5 text-[#71717a] hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
            <Mail className="h-6 w-6 text-black" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tighter">Welcome back</h2>
          <p className="text-[#a1a1aa] mt-2 text-sm">
            {mode === 'signin' ? 'Sign in with email and password' : 'Create an account'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-6">
          <button
            onClick={() => { setMode('signin'); setAuthError(null); }}
            className={`flex-1 py-2 text-sm rounded-lg transition ${mode === 'signin' ? 'bg-white/10 font-medium' : 'text-[#a1a1aa]'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setAuthError(null); }}
            className={`flex-1 py-2 text-sm rounded-lg transition ${mode === 'signup' ? 'bg-white/10 font-medium' : 'text-[#a1a1aa]'}`}
          >
            Create Account
          </button>
        </div>

        {/* Inline auth error */}
        {authError && (
          <div className="mb-4 rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
            {authError}
          </div>
        )}

        <form onSubmit={handleEmailPassword} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (authError) setAuthError(null); }}
            placeholder="you@founder.com"
            className="input w-full px-4 py-3 rounded-2xl text-base"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (authError) setAuthError(null); }}
            placeholder="Password"
            className="input w-full px-4 py-3 rounded-2xl text-base"
            required
            minLength={6}
          />

          <button 
            type="submit" 
            disabled={loading || !email || !password}
            className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading 
              ? (mode === 'signin' ? "Signing in..." : "Creating account...") 
              : (mode === 'signin' ? "Sign In" : "Create Account")}
          </button>
        </form>

        <p className="text-center text-xs text-[#71717a] mt-6">
          By continuing you agree to our (future) Terms &amp; Privacy.
        </p>

        {!isSupabaseConfigured() && (
          <div className="mt-4 text-[11px] text-center text-[#ff00aa]">
            Currently in demo mode — real auth activates after you add Supabase keys.
          </div>
        )}
      </div>
    </div>
  );
}
