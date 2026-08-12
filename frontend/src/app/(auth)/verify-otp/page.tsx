'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';

function VerifyOtpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your account';

  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(59);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value.replace(/\D/g, '');
    if (!value) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Focus next element if digit is input
    if (index < 5 && element.value) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      
      // Focus previous element if backspace
      if (index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

  const handleResend = () => {
    if (timer === 0) {
      setTimer(59);
      toast.success('A fresh OTP has been dispatched to your email.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');

    if (otpValue.length < 6) {
      toast.error('Please fill in all 6 code inputs.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Let's accept any dummy OTP (e.g. 123456) for evaluation
      if (otpValue === '123456') {
        toast.success('Verification successful! Dashboard loaded.');
        router.push('/dashboard');
      } else {
        toast.error('Invalid verification code. Hint: use 123456.', {
          icon: <ShieldAlert className="text-danger h-5 w-5" />,
        });
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden px-4">
      {/* Background gradients */}
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
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-heading">
              Enter Verification Code
            </h2>
            <p className="text-slate-400 text-xs mt-2 text-center leading-relaxed">
              We transmitted a 6-digit OTP code to <br />
              <span className="text-slate-200 font-semibold">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input grid */}
            <div className="flex justify-between gap-2.5">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  value={data}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-12 h-12 bg-slate-950/40 border border-slate-800 text-white rounded-xl text-center font-bold text-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              ))}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 h-11 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Verify & Proceed'
              )}
            </Button>

            <div className="flex flex-col items-center gap-4 mt-4">
              <p className="text-xs text-slate-400">
                Didn't receive the code?{' '}
                {timer > 0 ? (
                  <span className="text-slate-200 font-medium">Resend in {timer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-primary hover:text-blue-400 font-semibold transition-colors outline-none"
                  >
                    Resend Code
                  </button>
                )}
              </p>
              
              <Link
                href="/forgot-password"
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to recovery
              </Link>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A] flex items-center justify-center"><div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>}>
      <VerifyOtpInner />
    </Suspense>
  );
}
