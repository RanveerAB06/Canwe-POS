'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Search,
  CheckCircle,
  CreditCard,
  Smartphone,
  Banknote,
  Percent,
  Plus,
  Minus,
  Printer,
  ChevronDown,
  Sparkles,
  Scissors,
  Shuffle,
  ShieldAlert,
  Calendar,
  Filter,
  Trash2,
  Edit2,
  Save,
  MessageCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';
import { WhatsAppModal } from '@/components/billing/WhatsAppModal';

function PaymentMethodBadge({ method }: { method: string }) {
  const m = String(method || 'CASH').toUpperCase();
  if (m === 'UPI') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 text-[10px] font-black">
        <Smartphone className="h-3 w-3 text-blue-600" /> UPI
      </span>
    );
  }
  if (m === 'CARD') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-black">
        <CreditCard className="h-3 w-3 text-purple-600" /> Card
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
      <Banknote className="h-3 w-3 text-emerald-600" /> Cash
    </span>
  );
}

export default function BillingPage() {
  const user = usePOSStore((state) => state.user);
  const restaurantProfile = usePOSStore((state) => state.restaurantProfile);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Filter states
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [filterStatus, setFilterStatus] = useState<'UNPAID' | 'PAID'>('UNPAID');
  const [search, setSearch] = useState('');

  // Data states
  const [bills, setBills] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<string>('');

  // Edit items state
  const [isEditing, setIsEditing] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Payment states
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState('');

  const selectedBill = bills.find((b) => b.id === selectedBillId);

  // ── Fetch bills and menu items from backend ──
  const fetchBillingData = useCallback(async () => {
    if (!user?.branchId) return;
    setLoading(true);
    try {
      // Create start and end date boundaries for full day querying
      const start = `${selectedDate}T00:00:00.000Z`;
      const end = `${selectedDate}T23:59:59.999Z`;

      const [billsRes, itemsRes] = await Promise.all([
        api.get(`/api/bills?status=${filterStatus}&startDate=${start}&endDate=${end}`),
        api.get('/api/menu/items'),
      ]);

      const dbBills = billsRes.data?.data?.bills || [];
      const dbMenuItems = itemsRes.data?.data?.items || [];

      setBills(dbBills);
      setMenuItems(dbMenuItems);

      // Auto select first bill if list has items and current selection is empty or not in new list
      if (dbBills.length > 0) {
        const stillExists = dbBills.some((b: any) => b.id === selectedBillId);
        if (!stillExists) {
          setSelectedBillId(dbBills[0].id);
        }
      } else {
        setSelectedBillId('');
      }
    } catch (e: any) {
      toast.error('Failed to load billing data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.branchId, selectedDate, filterStatus, selectedBillId]);

  useEffect(() => {
    if (user?.branchId) {
      fetchBillingData();
    }
  }, [user?.branchId, selectedDate, filterStatus]);

  // Sync editable items when bill selection changes or editing toggled
  useEffect(() => {
    if (selectedBill) {
      const items = (selectedBill.order?.items || []).map((oi: any) => ({
        id: oi.id,
        menuItemId: oi.menuItemId,
        name: oi.menuItem?.name || 'Unknown Item',
        price: Number(oi.price),
        qty: oi.quantity,
      }));
      setEditableItems(items);
      setAppliedDiscount(Number(selectedBill.discountAmount) || 0);
      setDiscountInput(String(selectedBill.discountAmount || ''));
    } else {
      setEditableItems([]);
      setAppliedDiscount(0);
      setDiscountInput('');
    }
    setIsEditing(false);
  }, [selectedBillId, bills]);

  // ── Edit items handlers ──
  const changeQty = (menuItemId: string, delta: number) => {
    setEditableItems((prev) =>
      prev
        .map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, qty: item.qty + delta }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const addItemToBill = (menuItem: any) => {
    setEditableItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: Math.random().toString(),
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: Number(menuItem.price),
          qty: 1,
        },
      ];
    });
    toast.success(`Added ${menuItem.name} to bill draft`);
  };

  const handleSaveChanges = async () => {
    if (!selectedBill) return;
    if (editableItems.length === 0) {
      toast.error('Cannot save an empty bill. Void the bill instead.');
      return;
    }
    setActionLoading(true);
    try {
      const discount = Number(discountInput) || 0;

      // 1. Update the order items
      await api.put(`/api/orders/${selectedBill.orderId}`, {
        items: editableItems.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.qty,
        })),
      });

      // 2. Re-generate the bill to recalculate subtotal, tax, and apply optional discount
      await api.post('/api/bills', {
        orderId: selectedBill.orderId,
        discountAmount: discount,
      });

      toast.success('Bill recalculation successful!');
      setIsEditing(false);
      await fetchBillingData();
    } catch (e: any) {
      toast.error('Failed to update bill: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Checkout / Quick Payment handler ──
  const handleQuickPayment = async (
    billToPay: any,
    method: 'CASH' | 'UPI' | 'CARD',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (!billToPay) return;
    setActionLoading(true);
    try {
      const totalAmount = Number(billToPay.grandTotal);
      await api.post(`/api/bills/${billToPay.id}/payments`, {
        payments: [
          {
            method,
            amount: totalAmount,
          },
        ],
      });

      if (billToPay.orderId) {
        try {
          await api.put(`/api/orders/${billToPay.orderId}`, {
            status: 'COMPLETED',
            tableId: null,
          });
          await api.delete(`/api/kots/order/${billToPay.orderId}`);
        } catch (cleanErr) {
          console.warn('Order/KOT cleanup error:', cleanErr);
        }
      }

      if (billToPay.order?.tableId) {
        try {
          await api.put(`/api/tables/${billToPay.order.tableId}/status`, {
            status: 'AVAILABLE',
          });
        } catch (tErr) {
          console.warn('Table release error:', tErr);
        }
      }

      toast.success(`Bill ${billToPay.invoiceNumber} paid via ${method}! Table reset to Available & KOTs deleted 🎉`, {
        icon: <CheckCircle className="text-emerald-500 h-5 w-5 animate-pulse" />,
      });

      // Shift tab to Paid tab to show settled invoice
      setFilterStatus('PAID');
      await fetchBillingData();
    } catch (err: any) {
      toast.error('Payment failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedBill) return;
    await handleQuickPayment(selectedBill, paymentMode);
  };

  const handlePrintReceipt = async () => {
    if (!selectedBill) return;
    if (selectedBill.orderId) {
      try {
        await api.put(`/api/orders/${selectedBill.orderId}`, {
          status: 'COMPLETED',
          tableId: null,
        });
        await api.delete(`/api/kots/order/${selectedBill.orderId}`);
      } catch (cleanErr) {
        console.warn('Order/KOT cleanup error:', cleanErr);
      }
    }
    if (selectedBill.order?.tableId) {
      try {
        await api.put(`/api/tables/${selectedBill.order.tableId}/status`, {
          status: 'AVAILABLE',
        });
      } catch (tErr) {
        console.warn('Table release error:', tErr);
      }
    }
    if (typeof window !== 'undefined') {
      window.print();
    }
    toast.success(`Receipt printed, KOTs deleted & Table reset to Available for ${selectedBill.invoiceNumber}! 🎉`);
    await fetchBillingData();
  };

  const handleWhatsAppSentBilling = async () => {
    if (!selectedBill) return;
    try {
      if (selectedBill.orderId) {
        await api.put(`/api/orders/${selectedBill.orderId}`, {
          status: 'COMPLETED',
          tableId: null,
        });
        try {
          await api.delete(`/api/kots/order/${selectedBill.orderId}`);
        } catch (kErr) {
          console.warn('KOT delete error:', kErr);
        }
      }
      if (selectedBill.order?.tableId) {
        try {
          await api.put(`/api/tables/${selectedBill.order.tableId}/status`, {
            status: 'AVAILABLE',
          });
        } catch (tErr) {
          console.warn('Table release error:', tErr);
        }
      }
      await fetchBillingData();
      toast.success(`WhatsApp bill sent! Table reset to Available & KOTs deleted 💬🎉`);
    } catch (err: any) {
      console.warn('WhatsApp cleanup error:', err);
    }
  };

  // ── Filtered list ──
  const filteredBills = bills.filter((b) =>
    b.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    (b.order?.table?.number || '').toLowerCase().includes(search.toLowerCase()) ||
    b.id.toLowerCase().includes(search.toLowerCase())
  );

  // Calculations for edit mode preview
  const editableSubtotal = editableItems.reduce((s, i) => s + i.price * i.qty, 0);
  const editableGST = Math.round(editableSubtotal * 0.05);
  const editableDiscount = Number(discountInput) || 0;
  const editableTotal = Math.max(0, editableSubtotal + editableGST - editableDiscount);

  // Filtered menu items for adding items
  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative overflow-hidden">
      
      {/* 1. LEFT PANEL: Filters and invoices queue */}
      <div className="w-full lg:w-85 flex-shrink-0 flex flex-col space-y-4">
        
        {/* Date & Search picker */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 flex items-center">
              <Calendar className="h-4 w-4 text-muted-foreground absolute left-3 pointer-events-none" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg bg-card border-border w-full"
              />
            </div>
            <div className="flex bg-muted rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setFilterStatus('UNPAID')}
                className={`flex-1 px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                  filterStatus === 'UNPAID' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Unpaid
              </button>
              <button
                onClick={() => setFilterStatus('PAID')}
                className={`flex-1 px-4 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                  filterStatus === 'PAID' ? 'bg-card shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Paid
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
            <Input
              type="text"
              placeholder="Search invoices (Table/No)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-lg bg-card border-border w-full"
            />
          </div>
        </div>

        {/* Invoice stack */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin max-h-[calc(100vh-220px)] lg:max-h-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px]">Loading bills...</span>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="text-center text-muted-foreground p-6 text-xs">No bills found for this date.</div>
          ) : (
            filteredBills.map((b) => {
              const isSelected = selectedBillId === b.id;
              const dateStr = new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              return (
                <Card
                  key={b.id}
                  onClick={() => {
                    setSelectedBillId(b.id);
                  }}
                  className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/5 border-primary/40 shadow-xs'
                      : 'border-border bg-card hover:border-primary/40 hover:shadow-xs'
                  }`}
                >
                  {/* Header row: Invoice # & Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground tracking-tight truncate">{b.invoiceNumber}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border-transparent flex-shrink-0 ${
                        b.order?.orderType === 'DINE_IN'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : b.order?.orderType === 'DELIVERY'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {b.order?.orderType === 'DINE_IN'
                        ? `Dine In${b.order?.table?.number ? ` - T${b.order.table.number}` : ''}`
                        : b.order?.orderType === 'DELIVERY'
                        ? 'Delivery'
                        : 'Takeaway'}
                    </Badge>
                  </div>

                  {/* Info & Total row */}
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{b.order?.items?.length || 0} {b.order?.items?.length === 1 ? 'item' : 'items'}</span>
                      <span>•</span>
                      <span>{dateStr}</span>
                    </div>
                    <span className="font-black text-sm text-foreground">₹{Number(b.grandTotal).toLocaleString()}</span>
                  </div>

                  {/* Quick Settle pill buttons for Unpaid bills */}
                  {filterStatus === 'UNPAID' && (
                    <div
                      className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-border/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        disabled={actionLoading}
                        onClick={(e) => handleQuickPayment(b, 'CASH', e)}
                        className="h-7 px-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 active:scale-95 text-[10px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <Banknote className="h-3 w-3 flex-shrink-0" /> Cash
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={(e) => handleQuickPayment(b, 'UPI', e)}
                        className="h-7 px-1.5 rounded-lg border border-blue-500/30 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 active:scale-95 text-[10px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <Smartphone className="h-3 w-3 flex-shrink-0" /> UPI
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={(e) => handleQuickPayment(b, 'CARD', e)}
                        className="h-7 px-1.5 rounded-lg border border-purple-500/30 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 active:scale-95 text-[10px] font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <CreditCard className="h-3 w-3 flex-shrink-0" /> Card
                      </button>
                    </div>
                  )}

                  {filterStatus === 'PAID' && (
                    <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[10px] font-medium">Payment Method</span>
                      <PaymentMethodBadge method={b.payments?.[0]?.method || b.paymentMethod || 'CASH'} />
                    </div>
                  )}
                </Card>

              );
            })
          )}
        </div>
      </div>


      {/* 2. CENTER PANEL: Bill items list (Preview / Editor) */}
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden min-h-0">
        {selectedBill ? (
          <Card className="p-6 border border-border bg-card flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center border-b border-border pb-4 mb-4">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 font-heading">
                  <Receipt className="h-4.5 w-4.5 text-primary" /> Bill details
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isEditing ? 'Modify quantities or add new items to recalculate' : 'Review details before processing payment'}
                </p>
              </div>
              {filterStatus === 'UNPAID' && (
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setIsEditing(true)}
                      className="text-[10px] h-7 px-2.5 rounded gap-1 font-semibold"
                    >
                      <Edit2 className="h-3 w-3 text-primary" /> Edit items
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      disabled={actionLoading}
                      onClick={handleSaveChanges}
                      className="text-[10px] h-7 px-2.5 rounded gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {actionLoading ? (
                        <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save & Recalculate
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Bill view */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              
              {/* If in edit mode, show a search box to add items */}
              {isEditing && (
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">Add new item to bill</span>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search menu items to add..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-lg bg-card border-border"
                    />
                  </div>
                  {menuSearch && (
                    <div className="max-h-36 overflow-y-auto divide-y divide-border border border-border rounded-lg bg-card text-xs">
                      {filteredMenuItems.slice(0, 5).map((itm) => (
                        <div key={itm.id} className="p-2.5 flex justify-between items-center hover:bg-muted/40 transition-colors">
                          <div>
                            <p className="font-semibold">{itm.name}</p>
                            <p className="text-[10px] text-muted-foreground">₹{Number(itm.price)}</p>
                          </div>
                          <button
                            onClick={() => addItemToBill(itm)}
                            className="bg-primary hover:bg-primary/95 text-white p-1 rounded-md transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Visualizer */}
              <div className="bg-muted/40 p-4 border border-border/80 rounded-xl space-y-3 font-mono">
                <div className="text-center pb-2 border-b border-dashed border-border/80">
                  <h4 className="font-bold text-xs uppercase tracking-tight">{restaurantProfile?.name || user?.restaurantName || 'My Restaurant'}</h4>
                  {restaurantProfile?.address && <p className="text-[9px] text-muted-foreground">{restaurantProfile.address}</p>}
                  {restaurantProfile?.gstNumber && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">GSTIN: {restaurantProfile.gstNumber}</p>
                  )}
                  {usePOSStore.getState().invoice?.invoiceHeader && (
                    <p className="text-[9px] text-emerald-600 font-semibold italic mt-1">{usePOSStore.getState().invoice.invoiceHeader}</p>
                  )}
                </div>


                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Bill No: {selectedBill.invoiceNumber}</span>
                  <span>Type: {selectedBill.order?.orderType === 'DINE_IN' ? `Dine In (${selectedBill.order?.table?.number || 'Table'})` : selectedBill.order?.orderType === 'DELIVERY' ? 'Delivery' : 'Takeaway'}</span>
                </div>

                {/* Items list */}
                <div className="space-y-3.5 border-t border-b border-dashed border-border/80 py-3.5">
                  {!isEditing ? (
                    // Read-only list
                    (selectedBill.order?.items || []).map((itm: any) => (
                      <div key={itm.id} className="flex justify-between text-xs text-gray-800">
                        <span>{itm.menuItem?.name || 'Unknown Item'} x{itm.quantity}</span>
                        <span className="font-semibold">₹{(Number(itm.price) * itm.quantity).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    // Editable items list
                    editableItems.map((itm) => (
                      <div key={itm.menuItemId} className="flex items-center justify-between text-xs text-gray-800">
                        <span className="w-1/2 truncate pr-2">{itm.name}</span>
                        <div className="flex items-center gap-1.5 bg-muted rounded-md px-1.5 py-0.5">
                          <button onClick={() => changeQty(itm.menuItemId, -1)} className="h-4.5 w-4.5 flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded font-semibold text-sm leading-none">-</button>
                          <span className="text-[11px] font-bold w-4 text-center">{itm.qty}</span>
                          <button onClick={() => changeQty(itm.menuItemId, 1)} className="h-4.5 w-4.5 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 rounded font-semibold text-sm leading-none">+</button>
                        </div>
                        <span className="font-semibold text-right w-24">₹{(itm.price * itm.qty).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Totals values */}
                <div className="space-y-1.5 text-xs font-medium pt-1.5">
                  {!isEditing ? (
                    <>
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal:</span>
                        <span>₹{Number(selectedBill.grandTotal - selectedBill.taxAmount + (Number(selectedBill.discountAmount) || 0)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Tax (GST 5%):</span>
                        <span>₹{Number(selectedBill.taxAmount).toLocaleString()}</span>
                      </div>
                      {Number(selectedBill.discountAmount) > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Discount Applied:</span>
                          <span>-₹{Number(selectedBill.discountAmount).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold border-t border-border/40 pt-2 text-foreground">
                        <span>Invoice total:</span>
                        <span className="text-primary text-base">₹{Number(selectedBill.grandTotal).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal:</span>
                        <span>₹{editableSubtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Tax (GST 5%):</span>
                        <span>₹{editableGST.toLocaleString()}</span>
                      </div>
                      {editableDiscount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>Discount Applied:</span>
                          <span>-₹{editableDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold border-t border-border/40 pt-2 text-foreground">
                        <span>Invoice total (Est):</span>
                        <span className="text-primary text-base">₹{editableTotal.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6 bg-card border border-border rounded-2xl">
            <ShieldAlert className="h-10 w-10 text-muted/60 mb-2 stroke-1" />
            <p className="text-xs font-semibold">No active billing order selected</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Select a bill from the left panel</p>
          </div>
        )}
      </div>

      {/* 3. RIGHT PANEL: Settle Payment */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <Card className="p-5 border border-border bg-card space-y-6">
          <h3 className="font-bold text-sm uppercase text-muted-foreground tracking-wider border-b border-border pb-3">
            Payment Processing
          </h3>

          {/* Discount inputs */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              {isEditing ? 'Enter Discount Amount (₹)' : 'Applied Discount (₹)'}
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="E.g. 100"
                value={discountInput}
                disabled={!isEditing}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="h-9 text-xs rounded-lg bg-muted/20 border-border/80"
              />
            </div>
          </div>

          {/* Payment modes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Select Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMode('CASH')}
                disabled={filterStatus === 'PAID'}
                className={`py-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ${
                  paymentMode === 'CASH'
                    ? 'bg-primary/10 text-primary border-primary/20 shadow-md shadow-primary/5'
                    : 'bg-card border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-[10px] font-bold">Cash</span>
              </button>

              <button
                onClick={() => setPaymentMode('CARD')}
                disabled={filterStatus === 'PAID'}
                className={`py-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ${
                  paymentMode === 'CARD'
                    ? 'bg-primary/10 text-primary border-primary/20 shadow-md shadow-primary/5'
                    : 'bg-card border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-[10px] font-bold">Card</span>
              </button>

              <button
                onClick={() => setPaymentMode('UPI')}
                disabled={filterStatus === 'PAID'}
                className={`py-3.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 ${
                  paymentMode === 'UPI'
                    ? 'bg-primary/10 text-primary border-primary/20 shadow-md shadow-primary/5'
                    : 'bg-card border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                <Smartphone className="h-5 w-5" />
                <span className="text-[10px] font-bold">UPI</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-border space-y-2">
            {filterStatus === 'UNPAID' ? (
              <Button
                onClick={handleCheckout}
                disabled={!selectedBill || isEditing || actionLoading}
                className="w-full bg-success hover:bg-green-600 disabled:opacity-50 text-white font-semibold h-11 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-success/10"
              >
                {actionLoading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="h-4.5 w-4.5" />
                )}
                Settle & Pay Bill
              </Button>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-semibold p-4 rounded-xl text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 font-extrabold text-sm text-emerald-800">
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-600" /> Settled (Fully Paid)
                </div>
                {selectedBill && (
                  <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-800">Payment Made By:</span>
                    <PaymentMethodBadge method={selectedBill.payments?.[0]?.method || selectedBill.paymentMethod || 'CASH'} />
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!selectedBill || actionLoading}
                onClick={handlePrintReceipt}
                className="h-11 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4 text-primary" /> Print Bill
              </Button>
              <Button
                type="button"
                disabled={!selectedBill || actionLoading}
                onClick={() => setShowWhatsAppModal(true)}
                className="h-11 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <MessageCircle className="h-4 w-4" /> Send WhatsApp
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <WhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        details={{
          restaurantName: restaurantProfile?.name || 'Canwe Technologies Cafe',
          restaurantAddress: restaurantProfile?.address || '',
          invoiceNumber: selectedBill?.invoiceNumber || 'INV-001',
          tableName: selectedBill?.order?.table?.number ? `T${selectedBill.order.table.number}` : undefined,
          orderType: selectedBill?.order?.orderType === 'DINE_IN' ? 'Dine In' : selectedBill?.order?.orderType === 'DELIVERY' ? 'Delivery' : 'Takeaway',
          customerName: selectedBill?.customer?.name || selectedBill?.order?.customer?.name,
          customerPhone: selectedBill?.customer?.phone || selectedBill?.order?.customer?.phone,
          items: (selectedBill?.order?.items || []).map((itm: any) => ({
            name: itm.menuItem?.name || 'Item',
            quantity: itm.quantity,
            price: Number(itm.price),
          })),
          subtotal: selectedBill ? Number(selectedBill.grandTotal - selectedBill.taxAmount + (Number(selectedBill.discountAmount) || 0)) : 0,
          taxAmount: selectedBill ? Number(selectedBill.taxAmount) : 0,
          discountAmount: selectedBill ? Number(selectedBill.discountAmount || 0) : 0,
          grandTotal: selectedBill ? Number(selectedBill.grandTotal) : 0,
        }}
        defaultPhone={selectedBill?.customer?.phone || selectedBill?.order?.customer?.phone}
        onSent={handleWhatsAppSentBilling}
      />
    </div>
  );
}
