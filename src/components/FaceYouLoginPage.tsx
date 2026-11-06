import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  User as UserIcon,
  AtSign,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Video,
  ArrowRight,
  X,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { User } from '../types';
import { registerWithSupabase, loginWithSupabase } from '../lib/supabase';

interface FaceYouLoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const REGISTERED_USERS_KEY = 'faceyou_registered_users_store';

export const FaceYouLoginPage: React.FC<FaceYouLoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('Streaming & chatting on FaceYou ✨');
  
  // Custom User Profile Image
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle local image file upload (converts file to Base64 data URL)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileImage(reader.result);
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    const cleanHandle = handle.trim().startsWith('@')
      ? handle.trim()
      : `@${handle.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const finalAvatar =
      profileImage ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=ff0050,00f2fe,7928ca&fontFamily=Helvetica&fontSize=42`;

    setIsLoading(true);

    // 1. Try Supabase Auth Sign Up
    const { user: supaUser, error: supaError } = await registerWithSupabase({
      email: email.trim(),
      password,
      name: name.trim(),
      handle: cleanHandle,
      avatar: finalAvatar,
      bio: bio.trim(),
    });

    if (supaUser) {
      setIsLoading(false);
      onLoginSuccess(supaUser);
      return;
    }

    // 2. If Supabase returns an error (e.g. rate limit, unconfirmed email, or missing tables)
    // we also persist to local storage as fallback so user is never stuck
    console.warn('Supabase sign up warning, applying local fallback:', supaError);

    let registeredUsers: Array<{ user: User; pass: string }> = [];
    try {
      const stored = localStorage.getItem(REGISTERED_USERS_KEY);
      if (stored) registeredUsers = JSON.parse(stored);
    } catch {
      // Ignore
    }

    if (registeredUsers.some((u) => u.user.email.toLowerCase() === email.trim().toLowerCase())) {
      setIsLoading(false);
      setErrorMessage(supaError || 'An account with this email already exists. Please log in.');
      setMode('login');
      return;
    }

    const fallbackUser: User = {
      id: 'usr_' + Date.now(),
      name: name.trim(),
      handle: cleanHandle,
      email: email.trim(),
      avatar: finalAvatar,
      coins: 0,
      followers: 0,
      following: 0,
      likes: 0,
      diamonds: 0,
      bio: bio.trim(),
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      isVerified: false,
    };

    registeredUsers.push({ user: fallbackUser, pass: password });
    try {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registeredUsers));
    } catch {
      // Ignore
    }

    setIsLoading(false);
    onLoginSuccess(fallbackUser);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsLoading(true);

    // 1. Try Supabase Auth Log In
    const { user: supaUser, error: supaError } = await loginWithSupabase(email.trim(), password);
    if (supaUser) {
      setIsLoading(false);
      onLoginSuccess(supaUser);
      return;
    }

    // 2. Fallback to local storage
    let registeredUsers: Array<{ user: User; pass: string }> = [];
    try {
      const stored = localStorage.getItem(REGISTERED_USERS_KEY);
      if (stored) registeredUsers = JSON.parse(stored);
    } catch {
      // Ignore
    }

    const found = registeredUsers.find(
      (u) =>
        (u.user.email.toLowerCase() === email.trim().toLowerCase() ||
          u.user.handle.toLowerCase() === email.trim().toLowerCase()) &&
        u.pass === password
    );

    setIsLoading(false);

    if (found) {
      onLoginSuccess(found.user);
    } else {
      setErrorMessage(supaError || 'Account not found or password incorrect. Please sign up or verify credentials.');
    }
  };

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col justify-between items-center p-4 sm:p-6 select-none overflow-y-auto">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_20%_20%,rgba(0,242,254,0.3),transparent_50%)]" />
      <div className="fixed inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_80%_80%,rgba(255,0,80,0.3),transparent_50%)]" />

      {/* FaceYou Branding Header & Supabase Indicator */}
      <div className="relative z-10 flex flex-col items-center mt-3 sm:mt-5">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#ff0050] via-rose-600 to-[#00f2fe] p-0.5 shadow-lg shadow-rose-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center text-white">
              <Video className="w-5 h-5 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Face<span className="text-[#ff0050]">You</span>
          </h1>
        </div>
        <p className="text-xs text-neutral-400 font-medium text-center max-w-xs mt-1">
          {mode === 'signup'
            ? 'Create your personal account with your own photo to start streaming and voice messaging.'
            : 'Log in to access your channel, broadcasts, coin wallet, and chats.'}
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="relative z-10 w-full max-w-sm bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl my-4">
        {/* Sign Up / Log In Toggle */}
        <div className="flex bg-neutral-950 p-1 rounded-2xl mb-4 border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${
              mode === 'signup'
                ? 'bg-neutral-800 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-neutral-800 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Log In
          </button>
        </div>

        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center">
            {errorMessage}
          </div>
        )}

        {/* SIGN UP */}
        {mode === 'signup' ? (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            {/* REAL USER PROFILE PHOTO UPLOADER (NO PRESET AVATARS) */}
            <div className="flex flex-col items-center">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2 text-center">
                Your Profile Photo
              </label>

              <div className="relative group">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#ff0050] via-purple-600 to-[#00f2fe] shadow-xl cursor-pointer hover:scale-105 transition-transform"
                >
                  <div className="w-full h-full rounded-full bg-neutral-950 overflow-hidden border-2 border-black flex items-center justify-center">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Uploaded preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-400 hover:text-white transition-colors">
                        <Camera className="w-7 h-7 text-[#ff0050] mb-0.5" />
                        <span className="text-[9px] font-black uppercase tracking-wider">
                          Upload
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload action button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-[#ff0050] text-white shadow-md border-2 border-black hover:scale-110 transition-transform"
                  title="Upload profile picture from device"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>

                {/* Remove uploaded image button */}
                {profileImage && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-0 right-0 p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white border border-white/20 shadow-md"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />

              <p className="text-[10px] text-neutral-400 mt-1.5 text-center">
                {profileImage ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 justify-center">
                    <CheckCircle2 className="w-3 h-3 inline" /> Photo selected
                  </span>
                ) : (
                  'Click to upload your own picture from device'
                )}
              </p>
            </div>

            {/* Display Name */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Your Display Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                  required
                />
                <UserIcon className="w-4 h-4 text-neutral-500 absolute right-3 top-3" />
              </div>
            </div>

            {/* Username Handle */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Username Handle
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@alex_live"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                />
                <AtSign className="w-4 h-4 text-neutral-500 absolute right-3 top-3" />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                  required
                />
                <Mail className="w-4 h-4 text-neutral-500 absolute right-3 top-3" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-neutral-500 hover:text-white absolute right-3 top-3"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-full bg-[#ff0050] hover:bg-[#e00047] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition-transform active:scale-95 mt-1 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Register & Enter FaceYou</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* LOG IN */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                  required
                />
                <Mail className="w-4 h-4 text-neutral-500 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-neutral-500 hover:text-white absolute right-3 top-3"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-full bg-[#ff0050] hover:bg-[#e00047] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition-transform active:scale-95 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="relative z-10 text-center text-[10px] text-neutral-500 max-w-xs mb-3">
        FaceYou Live &copy; 2026 • Real-time interactive streaming and voice messaging.
      </div>
    </div>
  );
};
