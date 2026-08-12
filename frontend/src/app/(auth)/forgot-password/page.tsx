'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';

const forgotPasswordSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
});

type ForgotPasswordValues = zod.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setLoading(true);
    // Simulate recovery email send
    setTimeout(() => {
      setLoading(false);
      toast.success('Recovery code dispatched successfully.');
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`);
    }, 1500);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden px-4">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 shadow-2xl rounded-2xl text-white">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 border border-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-heading">
              Recover POS Account
            </h2>
            <p className="text-slate-400 text-xs mt-2 text-center leading-relaxed">
              Provide your registered admin email. We will transmit a 6-digit OTP verification code to reset your password credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Registered Email
              </label>
              <div className="relative flex items-center">
                <Mail className="h-4 w-4 text-slate-500 absolute left-3" />
                <Input
                  type="email"
                  placeholder="admin@restaurant.com"
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 h-11 text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Send Recovery Code'
              )}
            </Button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white transition-colors pt-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
