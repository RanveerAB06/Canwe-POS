'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  RefreshCw,
  UtensilsCrossed,
  Timer,
  AlertCircle,
  Check,
  Zap,
  History,
  ReceiptText,
  Plus,
  Printer,
  Trash2,
  CheckCheck,
  Grid,
  List,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
type KotStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';

interface KotItem {
  id?: string;
  menuItemId?: string;
  menuItemName?: string;
  name?: string;
  quantity: number;
  notes?: string;
  category?: string;
  menuItem?: {
    name: string;
    category: string;
  };
}

interface KOT {
  id: string;
  kotNumber: string;
  status: KotStatus;
  notes?: string;
  createdAt: string;
  order: {
    id: string;
    orderType: string;
    table?: { number: string; floor?: string } | null;
    items: KotItem[];
  };
}

interface KotBatch {
  passNumber: number;
  createdAt: string;
  items: { name: string; quantity: number; notes?: string; category?: string }[];
}

interface GroupedKOTOrder {
  orderId: string;
  kotNumber: string;
  tableNumber?: string;
  orderType: string;
  kotCount: number;
  status: 'PREPARING' | 'READY' | 'RED_ALERT';
  createdAt: string;
  notes?: string;
  batches: KotBatch[];
  latestKotId: string;
  allKotIds: string[];
}

function formatAge(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// Group KOT passes into 1 order card per table with Yellow -> Green -> Red state logic
function groupKotsByOrder(kotsList: KOT[]): GroupedKOTOrder[] {
  const map: Record<string, GroupedKOTOrder> = {};

  const sorted = kotsList.slice().sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const kot of sorted) {
    const orderId = kot.order?.id || kot.id;
    const tableNumber = kot.order?.table?.number;
    const orderType = kot.order?.orderType || 'DINE_IN';

    const kotItems = (kot.order?.items || []).map((i: any) => ({
      name: i.menuItem?.name || i.menuItemName || i.name || 'Item',
      quantity: Number(i.quantity) || 1,
      notes: i.notes,
      category: i.menuItem?.category || i.category || 'Other',
    }));

    if (!map[orderId]) {
      // First KOT Pass: Default status PREPARING (Yellow)
      let initialStatus: 'PREPARING' | 'READY' | 'RED_ALERT' = 'PREPARING';
      if (kot.status === 'READY') initialStatus = 'READY';

      map[orderId] = {
        orderId,
        kotNumber: kot.kotNumber,
        tableNumber,
        orderType,
        kotCount: 1,
        status: initialStatus,
        createdAt: kot.createdAt,
        notes: kot.notes,
        batches: [
          {
            passNumber: 1,
            createdAt: kot.createdAt,
            items: kotItems,
          },
        ],
        latestKotId: kot.id,
        allKotIds: [kot.id],
      };
    } else {
      // Additional KOT Pass added to order!
      const existing = map[orderId];
      existing.kotCount += 1;
      existing.allKotIds.push(kot.id);
      existing.latestKotId = kot.id;

      existing.batches.push({
        passNumber: existing.kotCount,
        createdAt: kot.createdAt,
        items: kotItems,
      });

      // If newly added pass is READY -> READY (Green); if pending -> RED_ALERT (Red)
      if (kot.status === 'READY') {
        existing.status = 'READY';
      } else {
        existing.status = 'RED_ALERT';
      }
    }
  }

  // Final Pass Check: If all KOT passes for an order are READY, overall status turns GREEN (READY)
  for (const group of Object.values(map)) {
    const allKotsForOrder = sorted.filter((k) => (k.order?.id || k.id) === group.orderId);
    const allReady = allKotsForOrder.length > 0 && allKotsForOrder.every((k) => k.status === 'READY');
    if (allReady) {
      group.status = 'READY';
    }
  }

  return Object.values(map);
}

// ─── KOT Print Modal ────────────────────────────────────────────────────────
function PrintKOTModal({ group, onClose }: { group: GroupedKOTOrder; onClose: () => void }) {
  const tableLabel = group.tableNumber ? `Table ${group.tableNumber}` : group.orderType;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white text-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-orange-600" />
            <h3 className="font-bold text-base">Thermal KOT Ticket</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Receipt Mockup */}
        <div className="font-mono text-xs border border-dashed border-slate-300 p-4 rounded-xl bg-slate-50 space-y-2">
          <div className="text-center border-b border-dashed border-slate-300 pb-2">
            <p className="font-bold text-sm">CANWE POS RESTAURANT</p>
            <p className="text-[10px] text-slate-500">KITCHEN ORDER TICKET</p>
            <p className="font-bold mt-1 text-slate-900">{tableLabel} • {group.kotNumber}</p>
            <p className="text-[10px] text-slate-500">{new Date(group.createdAt).toLocaleTimeString('en-IN')}</p>
          </div>

          <div className="space-y-1.5 py-1">
            {group.batches.map((batch, bIdx) => (
              <div key={bIdx} className={bIdx > 0 ? 'pt-1.5 border-t border-dashed border-slate-300' : ''}>
                {bIdx > 0 && <p className="text-[10px] font-bold text-red-600">+ Pass #{batch.passNumber}</p>}
                {batch.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex justify-between items-start">
                    <span>{item.quantity}x {item.name}</span>
                    {item.notes && <span className="text-[9px] italic text-slate-500">({item.notes})</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {group.notes && (
            <div className="border-t border-dashed border-slate-300 pt-1 text-[10px] italic">
              Note: {group.notes}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              window.print();
              toast.success(`Printed KOT for ${tableLabel}!`);
            }}
            className="flex-1 h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
          >
            <Printer className="h-4 w-4" /> Print Thermal Ticket
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Grouped KOT Card ────────────────────────────────────────────────────────
function GroupedKOTCard({
  group,
  preferenceIndex,
  isCompact,
  onStatusUpdate,
}: {
  group: GroupedKOTOrder;
  preferenceIndex: number;
  isCompact?: boolean;
  onStatusUpdate: (kotId: string, status: KotStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [ageStr, setAgeStr] = useState(formatAge(group.createdAt));

  useEffect(() => {
    const timer = setInterval(() => setAgeStr(formatAge(group.createdAt)), 10000);
    return () => clearInterval(timer);
  }, [group.createdAt]);

  let headerBg = 'bg-yellow-400 text-slate-900 font-extrabold';
  let cardBg = 'bg-yellow-50/95 border-yellow-400 text-yellow-950';
  let badgeBg = 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold';
  let statusText = 'Preparing';

  if (group.status === 'READY') {
    headerBg = 'bg-emerald-500 text-white font-extrabold';
    cardBg = 'bg-emerald-50/95 border-emerald-400 text-emerald-950 shadow-emerald-100 shadow-md';
    badgeBg = 'bg-emerald-200 text-emerald-900 border-emerald-400 font-bold';
    statusText = 'Ready';
  } else if (group.status === 'RED_ALERT') {
    headerBg = 'bg-red-500 text-white font-extrabold animate-pulse';
    cardBg = 'bg-red-50/95 border-red-400 text-red-950 shadow-red-100 shadow-md ring-2 ring-red-400';
    badgeBg = 'bg-red-200 text-red-900 border-red-400 font-extrabold';
    statusText = 'New Items Added';
  }

  const tableLabel = group.tableNumber
    ? `Table ${group.tableNumber}`
    : group.orderType === 'TAKEAWAY'
    ? 'Takeaway'
    : 'Delivery';

  // Mark order as Ready -> Changes status to READY and card color turns GREEN!
  const handleMarkAsReady = async () => {
    if (loading) return;
    setLoading(true);
    try {
      for (const kotId of group.allKotIds) {
        await api.put(`/api/kots/${kotId}/status`, { status: 'READY' });
      }
      onStatusUpdate(group.latestKotId, 'READY');
      toast.success(`Order for ${tableLabel} marked as READY!`, { icon: '✅' });
    } catch (e: any) {
      toast.error('Failed to update status: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  // Clear / Serve order -> Removes order card from Live Display to History!
  const handleClearOrder = async () => {
    if (loading) return;
    setLoading(true);
    try {
      for (const kotId of group.allKotIds) {
        await api.put(`/api/kots/${kotId}/status`, { status: 'SERVED' });
      }
      onStatusUpdate(group.latestKotId, 'SERVED');
      toast.success(`Cleared order for ${tableLabel}! Moved to KOT History.`, { icon: '🧹' });
    } catch (e: any) {
      toast.error('Failed to clear order: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`border-2 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all ${cardBg}`}
      >
        {/* Header with Preference #1, #2, #3 and Print option */}
        <div className={`${headerBg} px-3.5 py-2.5 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="h-5 px-1.5 rounded bg-black/20 text-white font-black text-xs flex items-center justify-center border border-white/20">
              #{preferenceIndex}
            </span>
            <span className="font-bold text-sm font-mono tracking-tight">{tableLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {group.kotCount > 1 && (
              <span className="text-[10px] font-black bg-black/20 text-white px-2 py-0.5 rounded-full border border-white/20">
                {group.kotCount} P
              </span>
            )}
            <span className="text-[10px] opacity-80 flex items-center gap-0.5">
              <Timer className="h-3 w-3" />
              {ageStr}
            </span>
            {/* Small Print KOT Icon Button */}
            <button
              onClick={() => setShowPrintModal(true)}
              title="Print KOT Ticket"
              className="h-6 w-6 rounded bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors ml-1"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="px-3.5 pt-2.5 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
            {group.status === 'PREPARING' && <Flame className="h-3 w-3 text-yellow-900" />}
            {group.status === 'READY' && <CheckCircle2 className="h-3 w-3 text-emerald-700" />}
            {group.status === 'RED_ALERT' && <AlertCircle className="h-3 w-3 text-red-700 animate-bounce" />}
            {statusText}
          </span>
          <span className="text-[10px] font-mono opacity-60">{group.kotNumber}</span>
        </div>

        {/* Items List */}
        <div className={`flex-1 px-3.5 ${isCompact ? 'py-2 space-y-1.5' : 'py-3 space-y-2.5'}`}>
          {group.batches.map((batch, bIdx) => (
            <div key={bIdx} className={bIdx > 0 ? 'pt-2 border-t-2 border-dashed border-red-300' : ''}>
              {bIdx > 0 && (
                <div className="flex items-center gap-1.5 mb-1.5 bg-red-100/90 text-red-950 px-2 py-0.5 rounded-lg border border-red-300">
                  <span className="font-black text-xs text-red-600">+</span>
                  <span className="text-[10px] font-black uppercase text-red-950">
                    Added Order (Pass #{batch.passNumber})
                  </span>
                </div>
              )}
              <div className={`space-y-1 ${bIdx > 0 ? 'pl-1.5 border-l-2 border-red-400' : ''}`}>
                {batch.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-start gap-1.5">
                    <span className={`text-sm font-black min-w-[22px] leading-tight ${bIdx > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                      {item.quantity}×
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`${isCompact ? 'text-xs font-bold' : 'text-sm font-bold'} leading-tight ${bIdx > 0 ? 'text-red-950 font-black' : 'text-slate-900'}`}>
                        {item.name}
                      </p>
                      {item.notes && (
                        <p className="text-[9px] italic text-orange-600 font-medium leading-tight">
                          📌 {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {group.notes && (
            <div className="mt-1 px-2.5 py-1 bg-yellow-100 rounded-lg border border-yellow-200">
              <p className="text-[9px] text-yellow-900 font-semibold">📝 Note: {group.notes}</p>
            </div>
          )}
        </div>

        {/* Clear / Small Action Options Bar */}
        <div className="px-3.5 pb-3 pt-1 flex items-center gap-2">
          {group.status !== 'READY' ? (
            <>
              <button
                onClick={handleMarkAsReady}
                disabled={loading}
                className="flex-1 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready
                  </>
                )}
              </button>
              {/* Clear Small Option */}
              <button
                onClick={handleClearOrder}
                disabled={loading}
                title="Clear KOT & Mark Served"
                className="h-9 px-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-[0.98] text-slate-800 text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5 text-slate-700" />
                <span>Clear</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 h-9 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Order Ready</span>
              </div>
              {/* Clear Small Option */}
              <button
                onClick={handleClearOrder}
                disabled={loading}
                title="Clear Finished KOT"
                className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Clear KOT</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Print Thermal Ticket Modal */}
      {showPrintModal && (
        <PrintKOTModal group={group} onClose={() => setShowPrintModal(false)} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KOTScreenPage() {
  const [kots, setKots] = useState<KOT[]>([]);
  const [historyKots, setHistoryKots] = useState<KOT[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'HISTORY'>('LIVE');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PREPARING' | 'READY' | 'RED_ALERT'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKOTs = useCallback(async () => {
    try {
      const res = await api.get('/api/kots');
      if (res.data?.data?.kots) {
        setKots(res.data.data.kots);
      }
    } catch (e: any) {
      toast.error('Failed to load live KOTs: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/kots?history=true');
      if (res.data?.data?.kots) {
        setHistoryKots(res.data.data.kots);
      }
    } catch (e: any) {
      console.warn('Failed to fetch KOT history', e);
    }
  }, []);

  useEffect(() => {
    fetchKOTs();
    fetchHistory();
  }, [fetchKOTs, fetchHistory]);

  // Auto-refresh every 10s for live KOT updates
  useEffect(() => {
    if (!autoRefresh || activeTab !== 'LIVE') return;
    const interval = setInterval(fetchKOTs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchKOTs]);

  const handleStatusUpdate = (kotId: string, newStatus: KotStatus) => {
    fetchKOTs();
    fetchHistory();
  };

  // Group KOTs into 1 order card per table
  const groupedOrders = groupKotsByOrder(kots);

  const displayedGroups = (
    filterStatus === 'ALL' ? groupedOrders : groupedOrders.filter((g) => g.status === filterStatus)
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const counts = {
    ALL: groupedOrders.length,
    PREPARING: groupedOrders.filter((g) => g.status === 'PREPARING').length,
    READY: groupedOrders.filter((g) => g.status === 'READY').length,
    RED_ALERT: groupedOrders.filter((g) => g.status === 'RED_ALERT').length,
  };

  // Clear all ready (green) KOTs in one click
  const handleClearAllReady = async () => {
    const readyGroups = groupedOrders.filter((g) => g.status === 'READY');
    if (readyGroups.length === 0) return;
    setActionLoading(true);
    try {
      for (const group of readyGroups) {
        for (const kotId of group.allKotIds) {
          await api.put(`/api/kots/${kotId}/status`, { status: 'SERVED' });
        }
      }
      toast.success(`Cleared all ${readyGroups.length} ready KOT orders!`, { icon: '✨' });
      fetchKOTs();
      fetchHistory();
    } catch (e: any) {
      toast.error('Failed to clear ready orders: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">

      {/* ─── Header Bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-200">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">KOT Display</h1>
            <p className="text-[11px] text-muted-foreground">
              Kitchen Display & Preference Queue
              {autoRefresh && activeTab === 'LIVE' && <span className="ml-1.5 text-emerald-600 font-semibold">● Auto-Sync</span>}
            </p>
          </div>
          {counts.RED_ALERT > 0 && activeTab === 'LIVE' && (
            <div className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-bold px-3 py-1 rounded-full animate-pulse shadow-sm">
              <AlertCircle className="h-3.5 w-3.5" />
              {counts.RED_ALERT} New Added Orders!
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Main Tab Switcher: Live vs History */}
          <div className="flex bg-muted rounded-xl p-1 border border-border">
            <button
              onClick={() => setActiveTab('LIVE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'LIVE'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Live Kitchen ({groupedOrders.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('HISTORY');
                fetchHistory();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="h-3.5 w-3.5 text-blue-500" />
              KOT History ({historyKots.length})
            </button>
          </div>

          {/* View mode toggle: Standard vs Small Compact */}
          <div className="flex bg-muted rounded-xl p-1 border border-border">
            <button
              onClick={() => setIsCompact(false)}
              title="Standard View"
              className={`h-7 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                !isCompact ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span className="text-[10px]">Normal</span>
            </button>
            <button
              onClick={() => setIsCompact(true)}
              title="Small Compact View"
              className={`h-7 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                isCompact ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="text-[10px]">Compact</span>
            </button>
          </div>

          <button
            onClick={() => {
              fetchKOTs();
              fetchHistory();
            }}
            className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors hover:border-foreground/30"
            title="Refresh KOTs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ─── LIVE KOTs TAB ────────────────────────────────────────── */}
      {activeTab === 'LIVE' && (
        <>
          {/* Status filter chips & Clear All Ready bulk option */}
          <div className="flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'ALL', label: 'All Orders', color: 'bg-foreground text-background border-foreground' },
                { key: 'PREPARING', label: 'Preparing (Yellow)', color: 'bg-yellow-400 text-slate-900 border-yellow-400' },
                { key: 'READY', label: 'Ready (Green)', color: 'bg-emerald-500 text-white border-emerald-500' },
                { key: 'RED_ALERT', label: 'New Added Orders (Red)', color: 'bg-red-500 text-white border-red-500' },
              ] as const).map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key as typeof filterStatus)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                    filterStatus === key
                      ? color
                      : 'bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  {label}
                  <span className={`text-[10px] font-bold px-1.5 rounded-full ${filterStatus === key ? 'bg-black/20' : 'bg-muted'}`}>
                    {key === 'ALL' ? counts.ALL : counts[key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Clear All Ready (Green) Orders Option */}
            {counts.READY > 0 && (
              <button
                onClick={handleClearAllReady}
                disabled={actionLoading}
                className="h-8 px-3 rounded-full bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                Clear All Ready ({counts.READY})
              </button>
            )}
          </div>

          {/* Grid of Preference Queue KOT Cards */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading kitchen queue...</p>
              </div>
            ) : displayedGroups.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-32 text-muted-foreground"
              >
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <UtensilsCrossed className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-sm font-bold text-foreground">Kitchen Queue Clear! 🎉</p>
                <p className="text-xs mt-1 opacity-60">No active orders. New orders will appear in preference order #1, #2, #3.</p>
              </motion.div>
            ) : (
              <motion.div
                layout
                className={`grid gap-3 pb-4 ${
                  isCompact
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}
              >
                <AnimatePresence mode="popLayout">
                  {displayedGroups.map((group, index) => (
                    <GroupedKOTCard
                      key={group.orderId}
                      group={group}
                      preferenceIndex={index + 1}
                      isCompact={isCompact}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </>
      )}

      {/* ─── KOT HISTORY TAB ──────────────────────────────────────── */}
      {activeTab === 'HISTORY' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
            <div>
              <h2 className="font-bold text-sm">Completed & Billed KOT History</h2>
              <p className="text-[11px] text-muted-foreground">Archived orders after bill printing or cleared confirmation</p>
            </div>
            <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-full">{historyKots.length} records</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {historyKots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <ReceiptText className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-xs font-semibold">No KOT history recorded yet</p>
                <p className="text-[10px] opacity-60">Completed and printed bills will appear in this history tab.</p>
              </div>
            ) : (
              historyKots.map((hKot) => (
                <div
                  key={hKot.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-mono font-bold text-xs border border-slate-200">
                      {hKot.order.table?.number ? `T${hKot.order.table.number}` : 'TKW'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground font-mono">{hKot.kotNumber}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                          Served / Cleared
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hKot.order.items.map((i) => `${i.quantity}x ${i.menuItem?.name || i.name || 'Item'}`).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground font-mono">
                    {new Date(hKot.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
