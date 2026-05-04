import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth } from './firebase.js';

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.jsx'));

const Fallback = () => (
  <div className="min-h-screen bg-[#FFFBFB] flex flex-col items-center justify-center text-pink-400">
    <Loader2 className="w-10 h-10 animate-spin mb-4" />
    <p className="font-bold tracking-wider uppercase text-xs">Loading...</p>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setAuthError(error.code === 'auth/popup-blocked' ? 'Popup was blocked. Please allow popups for this site.' : 'Could not sign in with Google.');
    }
  };

  const handleGuestLogin = async () => {
    try {
      setAuthError('');
      await signInAnonymously(auth);
    } catch (error) {
      setAuthError('Could not sign in as guest.');
    }
  };

  if (isLoading) return <Fallback />;

  if (!user) return (
    <main className="min-h-screen bg-[#FFFBFB] flex flex-col items-center justify-center p-6 text-center">
      <picture>
        <source srcSet="/PutIt_Icon_display.webp" type="image/webp" />
        <img src="/PutIt_Icon_192.png" alt="PutIt" className="w-24 h-24 rounded-3xl mb-6 shadow-md" width="96" height="96" />
      </picture>
      <h1 className="text-3xl font-extrabold tracking-tight text-stone-800 mb-2">PutIt</h1>
      <p className="text-sm text-stone-500 font-medium mb-10">Stop searching. Start living.</p>
      {authError && (
        <div className="bg-red-50 text-red-500 p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold mb-6 w-full max-w-sm">
          <AlertCircle className="w-4 h-4" /> {authError}
        </div>
      )}
      <button onClick={handleGoogleLogin} className="w-full max-w-sm bg-white border border-pink-100 hover:bg-pink-50 text-stone-700 font-bold py-4 rounded-2xl flex justify-center items-center gap-3 transition-all active:scale-[0.98] mb-4 shadow-sm">
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.58c2.1-1.92 3.31-4.74 3.31-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.58-2.77c-.98.66-2.23 1.06-3.7 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>
      <button onClick={handleGuestLogin} className="w-full max-w-sm bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold py-4 rounded-2xl flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-sm">
        Continue as Guest
      </button>
    </main>
  );

  return (
    <Suspense fallback={<Fallback />}>
      <AuthenticatedApp user={user} />
    </Suspense>
  );
}
