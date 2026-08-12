'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { usePOSStore } from '@/store/usePOSStore';
import Link from 'next/link';

const loginSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters long'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = usePOSStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'demo.cashier@canwepos.com',
      password: 'demo_pos_cashier_pass',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      await login({ email: data.email, password: data.password });
      toast.success('Access Granted! Welcome back.');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Invalid credentials.', {
        icon: <ShieldAlert className="text-danger h-5 w-5" />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden px-4">
      
      {/* Dynamic ambient background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      {/* Main glassmorphism card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 shadow-2xl rounded-2xl text-white">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30 mb-4">
              C
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 font-heading">
              Canwe POS <Sparkles className="h-4.5 w-4.5 text-yellow-500 fill-yellow-500 animate-pulse" />
            </h2>
            <p className="text-slate-400 text-xs mt-1.5">
              Enterprise Restaurant Billing & Management Platform
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email input field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="h-4 w-4 text-slate-500 absolute left-3" />
                <Input
                  type="email"
                  placeholder="name@restaurant.com"
                  {...register('email')}
                  className="pl-9 bg-slate-950/40 border-slate-800 text-white focus-visible:border-primary focus-visible:ring-primary/20 placeholder:text-slate-600 rounded-xl h-11 text-sm w-full"
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-danger font-semibold">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password input field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-blue-400 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock className="h-4 w-4 text-slate-500 absolute left-3" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  className="pl-9 pr-10 bg-slate-950/40 border-slate-800 text-white focus-visible:border-primary focus-visible:ring-primary/20 placeholder:text-slate-600 rounded-xl h-11 text-sm w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[10px] text-danger font-semibold">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Login button submission */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 h-11 text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Sign In to POS'
              )}
            </Button>
          </form>

          {/* Guest sign in / Help widget footer */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-slate-500 text-[11px] leading-relaxed">
              For evaluation, use the pre-filled cashier account.<br />
              Need deployment support?{' '}
              <a href="#" className="text-slate-300 font-semibold hover:underline">
                Call +91 9099912383
              </a>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
