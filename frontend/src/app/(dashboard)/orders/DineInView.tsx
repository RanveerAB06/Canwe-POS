'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Minus,
  Printer,
  UtensilsCrossed,
  Search,
  ChefHat,
  ReceiptText,
  FileText,
  Users,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShoppingCart,
  Merge,
  Unlink,
  Link2,
  Check,
  Edit3,
  MessageCircle,
} from 'lucide-react';

import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';
import { WhatsAppModal } from '@/components/billing/WhatsAppModal';

// ─── Types ───────────────────────────────────────────────────────────────────
type TableStatus = 'AVAILABLE' | 'RUNNING' | 'PRINTED' | 'KOT' | 'READY' | 'MERGED';

interface OrderItem {
  id: string; // Dynamic MenuItem ID
  name: string;
  price: number;
  qty: number;
  category: string;
}

interface TableData {
  id: string;
  label: string;
  section: string;
  seats: number;
  status: TableStatus;
  orders: OrderItem[];
  kotSentAt?: string;
  billPrintedAt?: string;
  guestCount?: number;
  mergedWith?: string[];    // parent only: list of child table IDs
  mergeParentId?: string;   // child only: parent table ID
  runningOrderId?: string;  // Active database order ID
}

const SECTIONS = ['A/C DINING AREA', 'NON A/C AREA', 'ROOFTOP'];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TableStatus, { label: string; bar: string; card: string; text: string; badge: string }> = {
  AVAILABLE: {
    label: 'AVAILABLE',
    bar: 'bg-emerald-500',
    card: 'border-border hover:border-primary/40 hover:shadow-md cursor-pointer',
    text: 'text-muted-foreground',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  RUNNING: {
    label: 'RUNNING',
    bar: 'bg-orange-400',
    card: 'border-orange-300 bg-orange-50/50 cursor-pointer shadow-md',
    text: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-700',
  },
  KOT: {
    label: 'KOT SENT',
    bar: 'bg-blue-500',
    card: 'border-blue-300 bg-blue-50/50 cursor-pointer shadow-md',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  PRINTED: {
    label: 'BILL PRINTED',
    bar: 'bg-purple-500',
    card: 'border-purple-300 bg-purple-50/40 cursor-pointer shadow-md',
    text: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-700',
  },
  MERGED: {
    label: 'MERGED',
    bar: 'bg-violet-400',
    card: 'border-violet-300 bg-violet-50/40 cursor-pointer shadow-md',
    text: 'text-violet-600',
    badge: 'bg-violet-100 text-violet-700',
  },
  READY: {
    label: 'ORDER READY',
    bar: 'bg-emerald-500',
    card: 'border-emerald-400 bg-emerald-50/60 cursor-pointer shadow-md shadow-emerald-100',
    text: 'text-emerald-700 font-bold',
    badge: 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcSubtotal(items: OrderItem[]) { return items.reduce((s, i) => s + i.price * i.qty, 0); }
function calcGST(s: number) {
  const taxes = usePOSStore.getState().taxes;
  const cgst = taxes?.cgstRate !== undefined ? Number(taxes.cgstRate) : 2.5;
  const sgst = taxes?.sgstRate !== undefined ? Number(taxes.sgstRate) : 2.5;
  const rate = cgst + sgst;
  return Math.round((s * rate) / 100);
}

function calcTotal(items: OrderItem[]) { const s = calcSubtotal(items); return s + calcGST(s); }
function nowStr() { return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }

// ─── Add Table Modal ──────────────────────────────────────────────────────────
function AddTableModal({
  onClose,
  onSuccess,
  branchId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
}) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [floor, setFloor] = useState(SECTIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!tableNumber.trim()) {
      setError('Table number is required');
      return;
    }
    if (capacity < 1) {
      setError('Capacity must be at least 1');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/tables', {
        branchId,
        number: tableNumber.trim(),
        capacity,
        floor,
      });
      toast.success(`Table ${tableNumber} added successfully!`, { icon: '🪑' });
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message;
      setError(msg);
      toast.error('Failed to add table: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-emerald-500/10 to-emerald-600/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Plus className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-base">Add New Table</h3>
                <p className="text-[11px] text-muted-foreground">Create a new dining table</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Table Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table Number</label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. T7, A1, VIP-1"
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>

          {/* Floor / Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Section / Floor</label>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => (
                <button
                  key={section}
                  onClick={() => setFloor(section)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
                    floor === section
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200'
                      : 'bg-background border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>
          </div>

          {/* Capacity */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seating Capacity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCapacity(Math.max(1, capacity - 1))}
                className="h-10 w-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-2xl font-bold text-foreground">{capacity}</span>
                <p className="text-[10px] text-muted-foreground">seats</p>
              </div>
              <button
                onClick={() => setCapacity(capacity + 1)}
                className="h-10 w-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-200 active:scale-[0.98]"
          >
            {submitting ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Table
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Remove Table Modal ───────────────────────────────────────────────────────
function RemoveTableModal({
  onClose,
  onSuccess,
  tables,
}: {
  onClose: () => void;
  onSuccess: () => void;
  tables: TableData[];
}) {
  const removableTables = tables.filter(
    (t) => t.status === 'AVAILABLE' && !t.mergeParentId && !(t.mergedWith && t.mergedWith.length > 0)
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRemove = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one table to remove');
      return;
    }
    setSubmitting(true);
    try {
      for (const id of selectedIds) {
        await api.delete(`/api/tables/${id}`);
      }
      toast.success(`${selectedIds.length} table${selectedIds.length > 1 ? 's' : ''} removed successfully`, { icon: '🗑️' });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error('Failed to remove table: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-red-500/10 to-red-600/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base">Remove Tables</h3>
                <p className="text-[11px] text-muted-foreground">Select available tables to remove</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {removableTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No removable tables</p>
              <p className="text-xs opacity-60 mt-1">Only available (empty) tables can be removed</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  {removableTables.length} available table{removableTables.length > 1 ? 's' : ''}
                </p>
                {removableTables.length > 1 && (
                  <button
                    onClick={() =>
                      setSelectedIds((prev) =>
                        prev.length === removableTables.length
                          ? []
                          : removableTables.map((t) => t.id)
                      )
                    }
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    {selectedIds.length === removableTables.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {removableTables.map((table) => {
                  const isSelected = selectedIds.includes(table.id);
                  return (
                    <motion.button
                      key={table.id}
                      layout
                      onClick={() => toggleSelect(table.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-red-400 bg-red-50/80 shadow-sm'
                          : 'border-border hover:border-red-200 hover:bg-muted/30'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-red-500 border-red-500'
                            : 'border-muted-foreground/40 bg-background'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{table.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {table.section} · {table.seats} seats
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        AVAILABLE
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          {removableTables.length > 0 && (
            <button
              onClick={handleRemove}
              disabled={submitting || selectedIds.length === 0}
              className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-red-200 active:scale-[0.98]"
            >
              {submitting ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── KOT Print Modal ─────────────────────────────────────────────────────────
function KOTPrintModal({ table, onClose }: { table: TableData; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
        className="bg-white rounded-2xl shadow-2xl w-72 p-6 text-center font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl mb-2">🍽️</div>
        <h3 className="font-bold text-base mb-1">KOT SENT TO KITCHEN</h3>
        <p className="text-xs text-gray-500 mb-3">Kitchen Order Ticket</p>
        <div className="border-t border-dashed border-gray-300 py-3 text-left space-y-1">
          <div className="flex justify-between text-xs font-bold">
            <span>Table: {table.label}{table.mergedWith && table.mergedWith.length > 0 ? ` (Merged)` : ''}</span>
            <span>{nowStr()}</span>
          </div>
          {table.orders.map((o) => (
            <div key={o.id} className="flex justify-between text-xs text-gray-800">
              <span>{o.qty}x {o.name}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-gray-300 pt-2 text-[10px] text-gray-400 mb-3">Printing to Kitchen Printer...</div>
        <div className="flex justify-center">
          <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
            <motion.div className="h-full bg-green-500 rounded-full" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.6 }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


// ─── Bill Print Modal ─────────────────────────────────────────────────────────
function BillPrintModal({
  table,
  bill,
  onClose,
  onConfirm,
  onSaveOnly,
  onWhatsAppSent,
}: {
  table: TableData;
  bill: any;
  onClose: () => void;
  onConfirm: () => void;
  onSaveOnly?: () => void;
  onWhatsAppSent?: () => void;
}) {
  const mergedCount = (table.mergedWith?.length ?? 0) + 1;
  const user = usePOSStore((state) => state.user);
  const restaurantProfile = usePOSStore((state) => state.restaurantProfile);
  const invoiceSettings = usePOSStore((state) => state.invoice);
  const restaurantName = restaurantProfile?.name || user?.restaurantName || 'My Restaurant';
  const restaurantAddress = restaurantProfile?.address || '';
  const billHeader = invoiceSettings?.invoiceHeader;
  const billFooter = invoiceSettings?.invoiceFooter || 'Thank you! Visit again 🙏';
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const calculatedSubtotal = table.orders.reduce((s, i) => s + i.price * i.qty, 0);
  const subtotal = bill?.grandTotal ? (Number(bill.grandTotal) - (Number(bill.taxAmount) || 0)) : calculatedSubtotal;
  const taxAmount = Number(bill?.taxAmount || 0);
  const grandTotal = Number(bill?.grandTotal || calculatedSubtotal);

  const whatsappDetails = {
    restaurantName,
    restaurantAddress,
    invoiceNumber: bill?.invoiceNumber || `${invoiceSettings?.invoicePrefix || 'INR-'}${invoiceSettings?.startingNumber || '1'}`,
    tableName: table.label,
    orderType: 'Dine-In',
    items: table.orders.map((o) => ({
      name: o.name,
      quantity: o.qty,
      price: o.price,
    })),
    subtotal,
    taxAmount,
    grandTotal,
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
          className="bg-white rounded-2xl shadow-2xl w-84 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0F172A] text-white p-5 text-center">
            <div className="text-2xl mb-1">🍽️</div>
            <h3 className="font-bold text-base uppercase tracking-tight">{restaurantName}</h3>
            {restaurantAddress && <p className="text-[11px] text-white/60 truncate">{restaurantAddress}</p>}
            {billHeader && <p className="text-[10px] text-emerald-400 font-semibold italic mt-1">{billHeader}</p>}
            {mergedCount > 1 && (
              <div className="mt-1.5 inline-flex items-center gap-1 bg-violet-500/30 rounded-full px-2.5 py-0.5 text-[10px] text-violet-200">
                <Link2 className="h-3 w-3" /> {mergedCount} Merged Tables
              </div>
            )}
          </div>

          <div className="p-4 font-mono text-xs">
            <div className="flex justify-between mb-1 text-gray-500">
              <span>Table: <b className="text-gray-800">{table.label}</b></span>
              <span>{nowStr()}</span>
            </div>
            <div className="flex justify-between text-gray-500 mb-3">
              <span>Bill No: {bill?.invoiceNumber || `${invoiceSettings?.invoicePrefix || 'INR-'}${invoiceSettings?.startingNumber || '1'}`}</span>
              <span>Covers: {table.guestCount || 2}</span>
            </div>

            <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5 mb-3">
              {table.orders.map((o) => (
                <div key={o.id} className="flex justify-between text-gray-800">
                  <span>{o.qty}x {o.name}</span>
                  <span>₹{(o.price * o.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>GST ({((Number(usePOSStore.getState().taxes?.cgstRate) || 2.5) + (Number(usePOSStore.getState().taxes?.sgstRate) || 2.5))}%)</span>
                <span>₹{taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200">
                <span>TOTAL</span>
                <span className="text-slate-900">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-3 border-t border-dashed border-gray-200 pt-2">Thank you! Visit again 🙏</p>
          </div>
          <div className="px-4 pb-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={onSaveOnly || onConfirm}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FileText className="h-3.5 w-3.5" /> Generate Bill (Save Only)
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowWhatsApp(true)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>


      <WhatsAppModal
        isOpen={showWhatsApp}
        onClose={() => setShowWhatsApp(false)}
        details={whatsappDetails}
        onSent={() => {
          if (onWhatsAppSent) onWhatsAppSent();
        }}
      />
    </>
  );
}

// ─── Order Panel ──────────────────────────────────────────────────────────────
function OrderPanel({
  table, allTables, menuCategories, menuItems, onClose, onSave, onSendKOT, onPrintBill, onUnmerge,
}: {
  table: TableData;
  allTables: TableData[];
  menuCategories: string[];
  menuItems: any[];
  onClose: () => void;
  onSave: (table: TableData, cart: OrderItem[], guestCount: number) => Promise<void>;
  onSendKOT: (table: TableData, cart: OrderItem[], guestCount: number) => Promise<void>;
  onPrintBill: (table: TableData, cart: OrderItem[], guestCount: number) => Promise<void>;
  onUnmerge: (tableId: string) => Promise<void>;
}) {
  const [cart, setCart] = useState<OrderItem[]>(table.orders);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [guestCount, setGuestCount] = useState(table.guestCount || 2);
  const [showKOT, setShowKOT] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [currentBill, setCurrentBill] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'MENU' | 'CART'>('MENU');


  // Compute merged children info
  const mergedChildren = (table.mergedWith ?? [])
    .map((cid) => allTables.find((t) => t.id === cid))
    .filter(Boolean) as TableData[];

  const totalSeats = table.seats + mergedChildren.reduce((s, t) => s + t.seats, 0);
  const mergedLabel = mergedChildren.length > 0
    ? `${table.label} + ${mergedChildren.map((t) => t.label).join(' + ')}`
    : table.label;

  const filtered = menuItems.filter((item) => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addItem = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, category: item.category }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  };

  const getQty = (id: string) => cart.find((c) => c.id === id)?.qty || 0;

  const handleSave = async () => {
    if (cart.length === 0) { toast.error('Add at least one item'); return; }
    setActionLoading(true);
    try {
      await onSave(table, cart, guestCount);
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendKOT = async () => {
    if (cart.length === 0) { toast.error('Add items before sending KOT'); return; }
    setActionLoading(true);
    try {
      await onSendKOT(table, cart, guestCount);
      setShowKOT(true);
      setTimeout(() => {
        setShowKOT(false);
        onClose();
      }, 800);

    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintBill = async () => {
    if (cart.length === 0) { toast.error('No items in order'); return; }
    setActionLoading(true);
    try {
      // 1. If order doesn't exist yet, save it first!
      let orderId = table.runningOrderId;
      if (!orderId) {
        const orderRes = await api.post('/api/orders', {
          tableId: table.id,
          orderType: 'DINE_IN',
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
        orderId = orderRes.data?.data?.order?.id;
        table.runningOrderId = orderId;
      } else {
        // Update order items before generating the bill
        await api.put(`/api/orders/${orderId}`, {
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
      }

      // 2. Generate the bill (or retrieve existing unpaid bill)
      const res = await api.post('/api/bills', {
        orderId: orderId,
        discountAmount: discount,
      });

      if (res.data && res.data.success) {
        setCurrentBill(res.data.data.bill);
        setShowBill(true);
      } else {
        toast.error('Failed to generate bill');
      }
    } catch (e: any) {
      toast.error('Billing error: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPrint = async () => {
    if (!currentBill) return;
    try {
      const orderId = table.runningOrderId || currentBill.orderId;
      if (orderId) {
        await api.put(`/api/orders/${orderId}`, { status: 'COMPLETED', tableId: null });
        try { await api.delete(`/api/kots/order/${orderId}`); } catch (e) {}
      }
      await api.put(`/api/tables/${table.id}/status`, { status: 'AVAILABLE' });
      const childIds = table.mergedWith || [];
      for (const childId of childIds) {
        await api.post('/api/tables/split', { tableId: childId });
      }
      if (typeof window !== 'undefined') {
        window.print();
      }
      setShowBill(false);
      await onPrintBill(table, cart, guestCount);
      onClose();
      toast.success(`Bill printed, KOTs deleted & Table ${table.label} reset to Available! 🎉`);
    } catch (e: any) {
      toast.error('Failed to clear table: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleWhatsAppComplete = async () => {
    try {
      const orderId = table.runningOrderId || currentBill?.orderId;
      if (orderId) {
        await api.put(`/api/orders/${orderId}`, { status: 'COMPLETED', tableId: null });
        try { await api.delete(`/api/kots/order/${orderId}`); } catch (e) {}
      }
      await api.put(`/api/tables/${table.id}/status`, { status: 'AVAILABLE' });
      const childIds = table.mergedWith || [];
      for (const childId of childIds) {
        await api.post('/api/tables/split', { tableId: childId });
      }
      setShowBill(false);
      await onPrintBill(table, cart, guestCount);
      onClose();
      toast.success(`WhatsApp bill sent & Table ${table.label} reset to Available! 💬🎉`);
    } catch (e: any) {
      toast.error('Failed to clear table: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleClearTable = async () => {
    setActionLoading(true);
    try {
      // 1. Complete order if runningOrderId exists
      const orderId = table.runningOrderId;
      if (orderId) {
        try {
          await api.put(`/api/orders/${orderId}`, { status: 'COMPLETED', tableId: null });
        } catch (_) {}
        try {
          await api.delete(`/api/kots/order/${orderId}`);
        } catch (_) {}
      }

      // 2. Set table status to AVAILABLE in DB
      await api.put(`/api/tables/${table.id}/status`, { status: 'AVAILABLE' });

      // 3. Unmerge any child tables merged into this table
      const childIds = table.mergedWith || [];
      for (const childId of childIds) {
        try {
          await api.post('/api/tables/split', { tableId: childId });
        } catch (_) {}
      }

      // 4. Update UI local state and show toast
      table.status = 'AVAILABLE';
      table.runningOrderId = null;
      table.orders = [];
      table.mergedWith = [];
      await onPrintBill(table, cart, guestCount);
      toast.success(`Table ${table.label} cleared & reset to Available! 🧹🎉`);
      onClose();
    } catch (e: any) {
      toast.error('Failed to clear table: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };


  const handleSaveOnlyFromModal = async () => {
    try {
      const orderId = table.runningOrderId || currentBill?.orderId;
      if (orderId) {
        await api.put(`/api/orders/${orderId}`, { status: 'COMPLETED', tableId: null });
        try { await api.delete(`/api/kots/order/${orderId}`); } catch (e) {}
      }
      await api.put(`/api/tables/${table.id}/status`, { status: 'AVAILABLE' });
      const childIds = table.mergedWith || [];
      for (const childId of childIds) {
        await api.post('/api/tables/split', { tableId: childId });
      }
      setShowBill(false);
      await onPrintBill(table, cart, guestCount);
      onClose();
      toast.success(`Bill generated & Table ${table.label} reset to Available! 📄🎉`);
    } catch (e: any) {
      toast.error('Failed to complete bill: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleGenerateBillOnly = async () => {
    if (cart.length === 0) { toast.error('No items in order'); return; }
    setActionLoading(true);
    try {
      let orderId = table.runningOrderId;
      if (!orderId) {
        const orderRes = await api.post('/api/orders', {
          tableId: table.id,
          orderType: 'DINE_IN',
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
        orderId = orderRes.data?.data?.order?.id;
        table.runningOrderId = orderId;
      } else {
        await api.put(`/api/orders/${orderId}`, {
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
      }

      const res = await api.post('/api/bills', {
        orderId: orderId,
        discountAmount: discount,
      });

      if (res.data && res.data.success) {
        const invNum = res.data.data.bill?.invoiceNumber || '';
        if (orderId) {
          await api.put(`/api/orders/${orderId}`, { status: 'COMPLETED', tableId: null });
          try { await api.delete(`/api/kots/order/${orderId}`); } catch (_) {}
        }
        await api.put(`/api/tables/${table.id}/status`, { status: 'AVAILABLE' });
        const childIds = table.mergedWith || [];
        for (const childId of childIds) {
          await api.post('/api/tables/split', { tableId: childId });
        }
        await onPrintBill(table, cart, guestCount);
        toast.success(`Bill ${invNum} generated & Table ${table.label} reset to Available! 📄🎉`);
        onClose();
      }
    } catch (e: any) {
      toast.error('Billing error: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };



  const subtotal = calcSubtotal(cart);
  const gst = calcGST(subtotal);
  const total = Math.max(0, subtotal + gst - discount);
  const cartTotalVal = total;
  const totalItemQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const tableForBill: TableData = { ...table, orders: cart, guestCount };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" />

      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-5xl bg-background z-50 flex flex-col md:flex-row shadow-2xl overflow-hidden">

        {/* Mobile top tab bar control (<768px) */}
        <div className="md:hidden flex border-b border-border bg-card p-2 flex-shrink-0 gap-2 items-center justify-between z-10">
          <div className="flex gap-1 bg-muted p-1 rounded-xl flex-1">
            <button
              onClick={() => setMobileTab('MENU')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mobileTab === 'MENU' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground'
              }`}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" /> Dishes Menu
            </button>
            <button
              onClick={() => setMobileTab('CART')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mobileTab === 'CART' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground'
              }`}
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Cart {totalItemQty > 0 && `(${totalItemQty})`}
            </button>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* LEFT: Menu selector */}
        <div className={`w-full md:w-[55%] flex flex-col bg-muted/20 border-b md:border-b-0 md:border-r border-border h-full ${mobileTab !== 'MENU' ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-5 pt-5 pb-3 border-b border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base">{mergedLabel}</h2>
                  {mergedChildren.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                      <Link2 className="h-2.5 w-2.5" /> Merged
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{table.section} · {totalSeats} Total Seats</p>
              </div>
              <div className="flex items-center gap-2">
                {table.status !== 'AVAILABLE' && (
                  <button
                    onClick={handleClearTable}
                    disabled={actionLoading}
                    className="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Clear Table
                  </button>
                )}
                <div className="flex items-center gap-1.5 bg-muted rounded-xl px-3 py-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground font-bold text-lg leading-none">-</button>
                  <span className="text-sm font-bold w-5 text-center">{guestCount}</span>
                  <button onClick={() => setGuestCount(guestCount + 1)} className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground font-bold text-lg leading-none">+</button>
                </div>
                <button onClick={onClose} className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Merged tables banner */}
            {mergedChildren.length > 0 && (
              <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 mb-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs text-violet-700 font-medium">
                    Merged: {mergedChildren.map((t) => t.label).join(', ')} → billing on {table.label}
                  </span>
                </div>
                <button
                  onClick={() => { onUnmerge(table.id); }}
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Unlink className="h-3 w-3" /> Unmerge
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes…"
                className="w-full pl-8 pr-4 h-9 rounded-xl border border-border text-sm outline-none focus:border-primary/40 transition-colors bg-muted/30" />
            </div>
          </div>

          {/* Categories bar */}
          <div className="flex gap-2 px-5 py-3 border-b border-border overflow-x-auto flex-shrink-0 bg-card/50">
            {menuCategories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${activeCategory === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start">
            {filtered.map((item) => {
              const qty = getQty(item.id);
              return (
                <motion.div key={item.id} layout
                  className={`relative bg-card rounded-xl border transition-all p-3 ${qty > 0 ? 'border-primary/50 shadow-sm' : 'border-border hover:shadow-sm'}`}>
                  {qty > 0 && (
                    <span className="absolute top-2 right-2 h-5 w-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">{qty}</span>
                  )}
                  <div className="mb-2">
                    <p className="text-xs font-semibold leading-tight pr-5">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">₹{item.price}</span>
                    {qty === 0 ? (
                      <button onClick={() => addItem(item)}
                        className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors">
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(item.id, -1)} className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{qty}</span>
                        <button onClick={() => addItem(item)} className="h-6 w-6 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground">
                <UtensilsCrossed className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No items found</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Cart + actions */}
        <div className={`w-full md:w-[45%] flex flex-col bg-card h-full ${mobileTab !== 'CART' ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">Order — {mergedLabel}</h3>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_CONFIG[table.status].badge}`}>
                {STATUS_CONFIG[table.status].label}
              </div>
            </div>
            {mergedChildren.length > 0 && (
              <p className="text-[10px] text-violet-600 mt-1 flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Combined bill for {(table.mergedWith?.length ?? 0) + 1} tables
              </p>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <AnimatePresence>
              {cart.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Cart is empty</p>
                  <p className="text-xs text-muted-foreground">Click menu items on the left to add</p>
                </motion.div>
              ) : (
                cart.map((item) => (
                  <motion.div key={item.id} layout
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-xs font-semibold truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">₹{item.price} x {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mr-3">
                      <button onClick={() => changeQty(item.id, -1)} className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => changeQty(item.id, 1)} className="h-6 w-6 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-xs font-bold text-primary w-12 text-right">
                      ₹{(item.price * item.qty).toLocaleString()}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Bill summary */}
          {cart.length > 0 && (
            <div className="px-5 py-4 border-t border-border bg-muted/10 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>GST ({((Number(usePOSStore.getState().taxes?.cgstRate) || 2.5) + (Number(usePOSStore.getState().taxes?.sgstRate) || 2.5))}%)</span><span>₹{gst.toLocaleString()}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">Discount (₹)</span>
                <input type="number" min={0} max={subtotal + gst} value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Math.min(subtotal + gst, Number(e.target.value))))}
                  className="w-20 h-7 px-2 rounded-lg border border-border bg-background text-xs text-right font-mono outline-none focus:border-primary/40" />
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
                <span>Total</span><span className="text-primary">₹{total.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* 4 action buttons */}
          <div className="p-4 border-t border-border space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleSave} disabled={actionLoading}
                className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-emerald-200 active:scale-[0.98]">
                {actionLoading ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save Order
              </button>
              <button onClick={handleSendKOT} disabled={actionLoading || cart.length === 0}
                className="h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-orange-200 active:scale-[0.98]">
                {actionLoading ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />} Send KOT
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleGenerateBillOnly} disabled={actionLoading || cart.length === 0}
                className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]">
                {actionLoading ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Generate Bill
              </button>
              <button onClick={handlePrintBill} disabled={actionLoading || cart.length === 0}
                className="h-10 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]">
                {actionLoading ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print Bill
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showKOT && <KOTPrintModal table={{ ...table, orders: cart }} onClose={() => setShowKOT(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showBill && currentBill && (
          <BillPrintModal
            table={tableForBill}
            bill={currentBill}
            onClose={() => setShowBill(false)}
            onConfirm={confirmPrint}
            onSaveOnly={handleSaveOnlyFromModal}
            onWhatsAppSent={handleWhatsAppComplete}
          />
        )}
      </AnimatePresence>

    </>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({
  table, onClick, mergeMode, isSelected, isSelectable,
}: {
  table: TableData;
  onClick: () => void;
  mergeMode: boolean;
  isSelected: boolean;
  isSelectable: boolean;
}) {
  const cfg = STATUS_CONFIG[table.status];

  // Merge mode display
  const isChild = !!table.mergeParentId;
  const isMergeParent = table.mergedWith && table.mergedWith.length > 0;

  return (
    <motion.div layout whileHover={{ y: mergeMode ? 0 : -2 }} onClick={onClick}
      className={`relative rounded-xl border-2 transition-all select-none overflow-hidden
        ${mergeMode
          ? isSelectable
            ? isSelected
              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 cursor-pointer scale-105'
              : 'border-border hover:border-primary/60 hover:bg-muted/30 cursor-pointer'
            : 'border-border opacity-40 cursor-not-allowed'
          : cfg.card
        }`}
      style={{ width: 130, minHeight: 100 }}
    >
      {/* Status bottom bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${cfg.bar}`} />

      {/* Merge mode selection ring */}
      {mergeMode && isSelectable && (
        <div className={`absolute top-2 right-2 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all
          ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-background'}`}>
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>
      )}

      {/* Merged indicator badge */}
      {!mergeMode && isMergeParent && (
        <div className="absolute top-1.5 right-1.5 bg-violet-500 rounded-full p-0.5">
          <Link2 className="h-2.5 w-2.5 text-white" />
        </div>
      )}
      {!mergeMode && isChild && (
        <div className="absolute top-1.5 right-1.5 bg-violet-400 rounded-full p-0.5">
          <Link2 className="h-2.5 w-2.5 text-white" />
        </div>
      )}

      <div className="p-3 flex flex-col items-center justify-center min-h-[90px]">
        <p className="font-bold text-2xl tracking-tight">{table.label}</p>
        <p className={`text-[10px] font-semibold tracking-wide mt-0.5 ${cfg.text}`}>{cfg.label}</p>
        {isChild && !mergeMode && (
          <p className="text-[9px] text-violet-500 font-medium mt-0.5">→ see parent</p>
        )}
        {isMergeParent && !mergeMode && (
          <p className="text-[9px] text-violet-500 font-medium mt-0.5">+{table.mergedWith!.length} merged</p>
        )}
        {table.status !== 'AVAILABLE' && table.status !== 'MERGED' && table.orders.length > 0 && !isChild && (
          <div className="mt-1.5 flex flex-col items-center">
            <p className="text-[10px] text-muted-foreground">{table.orders.length} items</p>
            <p className={`text-[11px] font-bold ${cfg.text}`}>₹{calcTotal(table.orders).toLocaleString()}</p>
          </div>
        )}
        {table.kotSentAt && (
          <div className="flex items-center gap-0.5 mt-1">
            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">{table.kotSentAt}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DineInView() {
  const user = usePOSStore((state) => state.user);
  const [tables, setTables] = useState<TableData[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>(['All']);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTable, setActiveTable] = useState<TableData | null>(null);
  const [filterStatus, setFilterStatus] = useState<TableStatus | 'ALL'>('ALL');

  // Merge mode state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  // ── Fetch POS Data from Backend ──
  const fetchPOSData = useCallback(async () => {
    if (!user || !user.branchId) return;
    try {
      const [tablesRes, ordersRes, categoriesRes, itemsRes] = await Promise.all([
        api.get(`/api/tables?branchId=${user.branchId}`),
        api.get('/api/orders/running'),
        api.get('/api/menu/categories'),
        api.get('/api/menu/items'),
      ]);

      const dbTables = tablesRes.data?.data?.tables || [];
      const runningOrders = ordersRes.data?.data?.orders || [];
      const dbCategories = categoriesRes.data?.data?.categories || [];
      const dbItems = itemsRes.data?.data?.items || [];

      // Map Categories
      setMenuCategories(['All', ...dbCategories.map((c: any) => c.name)]);

      // Map Menu Items
      const mappedItems = dbItems.map((item: any) => {
        const cat = dbCategories.find((c: any) => c.id === item.categoryId);
        return {
          id: item.id,
          name: item.name,
          price: Number(item.price),
          category: cat ? cat.name : 'Other',
          isVeg: item.isVeg,
        };
      });
      setMenuItems(mappedItems);

      // Map Tables
      const mappedTables = dbTables.map((t: any) => {
        const order = runningOrders.find(
          (ord: any) =>
            ord.tableId === t.id &&
            ord.status !== 'BILLED' &&
            ord.status !== 'PAID' &&
            ord.status !== 'COMPLETED' &&
            ord.status !== 'CANCELLED'
        );

        let status: TableStatus = 'AVAILABLE';
        let orders: OrderItem[] = [];
        let kotSentAt = undefined;
        let billPrintedAt = undefined;
        let runningOrderId = undefined;

        if (t.mergedToId) {
          status = 'MERGED';
        } else if (order) {
          runningOrderId = order.id;
          if (order.status === 'READY') {
            status = 'READY';
          } else if (order.status === 'KOT_SENT') {
            status = 'KOT';
            kotSentAt = new Date(order.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          } else {
            status = 'RUNNING';
          }

          // Map order items inside running order
          orders = (order.items || []).map((oi: any) => ({
            id: oi.menuItemId, // Use menuItemId as cart matching key
            name: oi.menuItem?.name || 'Unknown Item',
            price: Number(oi.price),
            qty: oi.quantity,
            category: oi.menuItem ? dbCategories.find((c: any) => c.id === oi.menuItem.categoryId)?.name || 'Other' : 'Other',
          }));
        } else if (t.status === 'OCCUPIED' || t.status === 'RESERVED') {
          status = 'RUNNING';
        } else {
          status = 'AVAILABLE';
        }

        const childIds = (t.mergedFrom || []).map((child: any) => child.id);

        return {
          id: t.id,
          label: t.number,
          section: t.floor,
          seats: t.capacity,
          status,
          orders,
          kotSentAt,
          billPrintedAt,
          mergedWith: childIds.length > 0 ? childIds : undefined,
          mergeParentId: t.mergedToId || undefined,
          runningOrderId,
        };
      });

      setTables(mappedTables);
      
      // Update active table details if currently open to prevent stale cart
      if (activeTable) {
        const updatedActive = mappedTables.find((t: any) => t.id === activeTable.id);
        if (updatedActive) {
          setActiveTable(updatedActive);
        }
      }
    } catch (e: any) {
      toast.error('Failed to load POS data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, activeTable]);

  useEffect(() => {
    if (user?.branchId) {
      fetchPOSData();
    }
  }, [user?.branchId]);

  // ── Open table (if child → redirect to parent) ──
  const openTable = (table: TableData) => {
    if (mergeMode) {
      if (table.status !== 'AVAILABLE' && !selectedForMerge.includes(table.id)) return;
      if (table.mergeParentId || (table.mergedWith && table.mergedWith.length > 0)) return;
      setSelectedForMerge((prev) =>
        prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id]
      );
      return;
    }
    if (table.mergeParentId) {
      const parent = tables.find((t) => t.id === table.mergeParentId);
      if (parent) { setActiveTable(parent); return; }
    }
    setActiveTable(table);
  };

  const closePanel = () => setActiveTable(null);

  // ── Merge handler ──
  const handleMerge = async () => {
    if (selectedForMerge.length < 2) { toast.error('Select at least 2 tables to merge'); return; }
    const [targetTableId, ...sourceTableIds] = selectedForMerge;

    try {
      for (const sourceId of sourceTableIds) {
        await api.post('/api/tables/merge', {
          sourceTableId: sourceId,
          targetTableId: targetTableId,
        });
      }

      await fetchPOSData();
      const parentLabel = tables.find((t) => t.id === targetTableId)?.label;
      const childLabels = sourceTableIds.map((id) => tables.find((t) => t.id === id)?.label).join(', ');
      toast.success(`Tables merged: ${childLabels} → billed under ${parentLabel}`, { icon: '🔗' });
      setMergeMode(false);
      setSelectedForMerge([]);
    } catch (e: any) {
      toast.error('Failed to merge tables: ' + (e.response?.data?.message || e.message));
    }
  };

  // ── Unmerge handler ──
  const handleUnmerge = useCallback(async (tableId: string) => {
    try {
      const parentTable = tables.find((t) => t.id === tableId);
      if (!parentTable) return;

      const childIds = parentTable.mergedWith || [];
      for (const childId of childIds) {
        await api.post('/api/tables/split', {
          tableId: childId,
        });
      }

      await fetchPOSData();
      closePanel();
      toast.success('Tables unmerged successfully', { icon: '🔓' });
    } catch (e: any) {
      toast.error('Failed to split tables: ' + (e.response?.data?.message || e.message));
    }
  }, [tables, fetchPOSData]);

  // ── Order callbacks ──
  const handleSave = useCallback(async (table: TableData, cart: OrderItem[], guestCount: number) => {
    try {
      if (!table.runningOrderId) {
        // Create new order
        await api.post('/api/orders', {
          tableId: table.id,
          orderType: 'DINE_IN',
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
      } else {
        // Update existing order
        await api.put(`/api/orders/${table.runningOrderId}`, {
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
      }
      await fetchPOSData();
      toast.success('Order saved successfully!', { icon: '💾' });
    } catch (e: any) {
      toast.error('Failed to save order: ' + (e.response?.data?.message || e.message));
    }
  }, [fetchPOSData]);

  const handleSendKOT = useCallback(async (table: TableData, cart: OrderItem[], guestCount: number) => {
    try {
      let orderId = table.runningOrderId;
      if (!orderId) {
        const res = await api.post('/api/orders', {
          tableId: table.id,
          orderType: 'DINE_IN',
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
        orderId = res.data.data.order.id;
      } else {
        await api.put(`/api/orders/${orderId}`, {
          items: cart.map(i => ({ menuItemId: i.id, quantity: i.qty }))
        });
      }

      await api.post('/api/kots', { orderId });
      await fetchPOSData();
      toast.success('KOT sent to kitchen!');
    } catch (e: any) {
      toast.error('Failed to send KOT: ' + (e.response?.data?.message || e.message));
    }
  }, [fetchPOSData]);

  const handlePrintBill = useCallback(async (table: TableData, cart: OrderItem[], guestCount: number) => {
    // Local updates are handled on confirmation in OrderPanel.
    // Just refresh data.
    await fetchPOSData();
  }, [fetchPOSData]);

  // ── Filter + counts ──
  const counts = {
    ALL: tables.length,
    AVAILABLE: tables.filter((t) => t.status === 'AVAILABLE').length,
    KOT: tables.filter((t) => t.status === 'KOT').length,
    RUNNING: tables.filter((t) => t.status === 'RUNNING').length,
    READY: tables.filter((t) => t.status === 'READY').length,
    PRINTED: tables.filter((t) => t.status === 'PRINTED').length,
    MERGED: tables.filter((t) => t.status === 'MERGED').length,
  };

  const filteredTables = filterStatus === 'ALL' ? tables : tables.filter((t) => t.status === filterStatus);

  const isSelectableForMerge = (t: TableData) =>
    t.status === 'AVAILABLE' && !t.mergeParentId && !(t.mergedWith && t.mergedWith.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading tables and active orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-1 scrollbar-thin">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Table View</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.AVAILABLE} available · {counts.KOT + counts.RUNNING} occupied · {counts.MERGED} merged
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!mergeMode ? (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all shadow-sm shadow-emerald-200"
              >
                <Plus className="h-3.5 w-3.5" /> Add Table
              </button>
              <button
                onClick={() => setShowRemoveModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all shadow-sm shadow-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove Table
              </button>
              <button
                onClick={() => { setMergeMode(true); setSelectedForMerge([]); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-all shadow-sm shadow-violet-200"
              >
                <Merge className="h-3.5 w-3.5" /> Merge Tables
              </button>
              <button
                onClick={fetchPOSData}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </>
          ) : (
            /* Merge mode toolbar */
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2">
              <Link2 className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-semibold text-violet-700">
                {selectedForMerge.length === 0
                  ? 'Click AVAILABLE tables to select'
                  : `${selectedForMerge.length} table${selectedForMerge.length > 1 ? 's' : ''} selected`}
              </span>
              {selectedForMerge.length >= 2 && (
                <button
                  onClick={handleMerge}
                  className="ml-2 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" /> Merge {selectedForMerge.length} Tables
                </button>
              )}
              <button
                onClick={() => { setMergeMode(false); setSelectedForMerge([]); }}
                className="ml-1 px-3 py-1.5 rounded-xl border border-violet-300 text-xs text-violet-600 hover:bg-violet-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Merge mode instructions banner */}
      <AnimatePresence>
        {mergeMode && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Merge className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-violet-800">Merge Mode Active</p>
              <p className="text-xs text-violet-600 mt-0.5">
                Select 2 or more <b>Available</b> tables. All billing will be combined under the <b>first selected</b> (primary) table.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'ALL', label: 'All Tables', count: counts.ALL, active: 'bg-foreground text-background border-foreground', inactive: 'border-border text-muted-foreground' },
          { key: 'AVAILABLE', label: 'Available', count: counts.AVAILABLE, active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'border-emerald-200 text-emerald-700' },
          { key: 'RUNNING', label: 'Running', count: counts.RUNNING, active: 'bg-orange-500 text-white border-orange-500', inactive: 'border-orange-200 text-orange-700' },
          { key: 'KOT', label: 'KOT Sent', count: counts.KOT, active: 'bg-blue-500 text-white border-blue-500', inactive: 'border-blue-200 text-blue-700' },
          { key: 'READY', label: 'Order Ready', count: counts.READY, active: 'bg-emerald-600 text-white border-emerald-600 font-bold', inactive: 'border-emerald-300 text-emerald-800 bg-emerald-50 font-bold' },
          { key: 'MERGED', label: 'Merged', count: counts.MERGED, active: 'bg-violet-500 text-white border-violet-500', inactive: 'border-violet-200 text-violet-700' },
        ].map(({ key, label, count, active, inactive }) => (
          <button key={key} onClick={() => setFilterStatus(key as typeof filterStatus)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${filterStatus === key ? active : `bg-background ${inactive} hover:opacity-80`}`}>
            {label}
            <span className={`text-[10px] font-bold px-1 rounded-full ${filterStatus === key ? 'bg-white/20' : 'bg-muted'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Floor sections */}
      {SECTIONS.map((section) => {
        const sectionTables = filteredTables.filter((t) => t.section === section);
        if (sectionTables.length === 0) return null;
        return (
          <div key={section} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-4 rounded-full bg-primary" />
              <h2 className="font-bold text-sm tracking-wide">{section}</h2>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {tables.filter((t) => t.section === section && t.status !== 'AVAILABLE' && t.status !== 'MERGED').length} occupied / {tables.filter((t) => t.section === section).length} total
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {sectionTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={() => openTable(table)}
                  mergeMode={mergeMode}
                  isSelected={selectedForMerge.includes(table.id)}
                  isSelectable={isSelectableForMerge(table)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filteredTables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm">No tables match this filter</p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tables', value: tables.length, icon: '🪑', color: 'text-foreground' },
          { label: 'Available', value: counts.AVAILABLE, icon: '✅', color: 'text-emerald-600' },
          { label: 'KOT Sent', value: counts.KOT, icon: '🍽️', color: 'text-blue-600' },
          { label: 'Merged Groups', value: tables.filter((t) => t.mergedWith && t.mergedWith.length > 0).length, icon: '🔗', color: 'text-violet-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">{stat.icon}</span>
            <div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Order Panel */}
      <AnimatePresence>
        {activeTable && (
          <OrderPanel
            key={activeTable.id}
            table={activeTable}
            allTables={tables}
            menuCategories={menuCategories}
            menuItems={menuItems}
            onClose={closePanel}
            onSave={handleSave}
            onSendKOT={handleSendKOT}
            onPrintBill={handlePrintBill}
            onUnmerge={handleUnmerge}
          />
        )}
      </AnimatePresence>

      {/* Add Table Modal */}
      <AnimatePresence>
        {showAddModal && user?.branchId && (
          <AddTableModal
            onClose={() => setShowAddModal(false)}
            onSuccess={fetchPOSData}
            branchId={user.branchId}
          />
        )}
      </AnimatePresence>

      {/* Remove Table Modal */}
      <AnimatePresence>
        {showRemoveModal && (
          <RemoveTableModal
            onClose={() => setShowRemoveModal(false)}
            onSuccess={fetchPOSData}
            tables={tables}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
