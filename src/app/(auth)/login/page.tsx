'use client';

import { useState, useEffect } from 'react';
import { signIn, getCsrfToken } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SiweLoginButton } from '@/components/siwe-login-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    // Get CSRF token
    getCsrfToken().then(token => {
      if (token) setCsrfToken(token);
    });
  }, []);

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: '/onboarding' });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('email-name', {
        email,
        name,
        redirect: false,
        callbackUrl: '/onboarding'
      });

      if (result?.error) {
        toast.error('Login failed: ' + result.error);
      } else if (result?.ok) {
        toast.success('Welcome to eth.ed!');
        setTimeout(() => {
          window.location.href = '/onboarding';
        }, 500);
      } else {
        toast.error('Login failed. Please try again.');
      }
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);

    try {
      const result = await signIn('admin-credentials', {
        email: adminEmail,
        password: adminPassword,
        redirect: false,
        callbackUrl: '/admin'
      });

      if (result?.error) {
        toast.error('Admin login failed');
      } else if (result?.ok) {
        toast.success('Welcome Admin!');
        setTimeout(() => {
          window.location.href = '/admin';
        }, 500);
      }
    } catch {
      toast.error('Admin login failed.');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/40 backdrop-blur-xl border border-white/10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Welcome to eth.ed
          </CardTitle>
          <CardDescription className="text-slate-300">
            Sign in to start your Web3 learning journey
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col h-full">
          <div className="space-y-3 flex-1">
            {/* SIWE Login Button */}
            <SiweLoginButton />
            
            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800/40 text-slate-400">Or continue with</span>
              </div>
            </div>

            {/* OAuth Providers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Google Login */}
              <Button
                onClick={() => handleOAuthSignIn('google')}
                variant="outline"
                className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>

              {/* Apple Login */}
              <Button
                onClick={() => handleOAuthSignIn('apple')}
                variant="outline"
                className="w-full bg-black hover:bg-gray-900 text-white border-gray-700"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple
              </Button>
            </div>

            {/* Email/name fallback form */}
            <form onSubmit={handleEmailLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In with Email'
                )}
              </Button>
            </form>

            {/* Admin Login Link */}
            <div className="mt-6 pt-4 border-t border-slate-600 text-center">
              <button
                onClick={() => setAdminDialogOpen(true)}
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Are you the admin? Sign in here
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Login Dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="bg-slate-800 border border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Admin Access</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter your admin credentials to access the admin dashboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-white">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-white">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700"
              disabled={adminLoading}
            >
              {adminLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Admin Sign In'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}