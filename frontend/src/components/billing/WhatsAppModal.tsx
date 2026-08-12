'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Copy, Check, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { WhatsAppBillDetails, formatWhatsAppBillText, openWhatsAppBill } from '@/lib/whatsapp';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: WhatsAppBillDetails;
  defaultPhone?: string;
  onSent?: () => void;
}

export function WhatsAppModal({
  isOpen,
  onClose,
  details,
  defaultPhone = '',
  onSent,
}: WhatsAppModalProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPhone(defaultPhone || details.customerPhone || '');
  }, [defaultPhone, details.customerPhone, isOpen]);

  if (!isOpen) return null;

  const formattedText = formatWhatsAppBillText(details);

  const handleSend = () => {
    const success = openWhatsAppBill(phone, details);
    if (success) {
      toast.success(
        phone ? `Opening WhatsApp Web for +91 ${phone.replace(/\D/g, '').slice(-10)}...` : 'Opening WhatsApp Web...',
        { icon: '💬' }
      );
      if (onSent) onSent();
      onClose();
    } else {
      toast.error('Could not open WhatsApp link');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    toast.success('Bill receipt text copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white">
                <MessageCircle className="h-5 w-5 fill-white/20" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Send Bill on WhatsApp</h3>
                <p className="text-[11px] text-emerald-100 mt-0.5">
                  {details.restaurantName} • Bill #{details.invoiceNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Phone Input */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                Customer Phone Number
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-muted-foreground border-r border-border pr-2">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 pl-14 pr-3 text-xs rounded-xl bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Receipt message will be pre-filled automatically on WhatsApp.
              </p>
            </div>

            {/* Bill Message Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground">Message Preview</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-foreground font-mono whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto shadow-inner">
                {formattedText}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-muted/30 border-t border-border flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 rounded-xl border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all duration-150 active:scale-95"
            >
              <Send className="h-4 w-4" /> Send on WhatsApp
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
