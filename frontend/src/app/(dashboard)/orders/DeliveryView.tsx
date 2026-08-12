'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  CheckCircle2,
  Phone,
  User,
  Package,
  Clock,
  Trash2,
  X,
  Printer,
  ShoppingBag,
  BadgeCheck,
  MapPin,
  Car,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'KOT' | 'READY' | 'COMPLETED';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
}

interface CartItem {
  menuItem: MenuItem;
  qty: number;
  note: string;
}

interface DeliveryOrder {
  id: string;
  runningOrderId: string;
  token: string;
  customerName: string;
  customerPhone: string;
  address: string;
  channel: 'ZOMATO' | 'SWIGGY' | 'DIRECT';
  items: CartItem[];
  status: OrderStatus;
  createdAt: string;
  total: number;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; badge: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pending',   color: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700',  icon: <Clock className="h-3 w-3" /> },
  CONFIRMED: { label: 'Confirmed', color: 'border-blue-200 bg-blue-50',     badge: 'bg-blue-100 text-blue-700',      icon: <CheckCircle2 className="h-3 w-3" /> },
  KOT:       { label: 'In Kitchen',color: 'border-orange-200 bg-orange-50', badge: 'bg-orange-100 text-orange-700',  icon: <Clock className="h-3 w-3" /> },
  READY:     { label: 'Ready/Out', color: 'border-green-200 bg-green-50',   badge: 'bg-green-100 text-green-700',    icon: <Package className="h-3 w-3" /> },
  COMPLETED: { label: 'Delivered', color: 'border-gray-200 bg-gray-50',     badge: 'bg-gray-100 text-gray-600',      icon: <BadgeCheck className="h-3 w-3" /> },
};

export default function DeliveryView() {
  const user = usePOSStore((state) => state.user);

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null;

  // ── Fetch active delivery orders ──
  const fetchDeliveryOrders = useCallback(async () => {
    if (!user?.branchId) return;
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        api.get('/api/orders/running'),
        api.get('/api/menu/items'),
      ]);

      const runningOrders = ordersRes.data?.data?.orders || [];
      const dbItems = itemsRes.data?.data?.items || [];

      const mappedOrders = runningOrders
        .filter((o: any) => o.orderType === 'DELIVERY')
        .map((o: any, idx: number) => {
          let status: OrderStatus = 'PENDING';
          if (o.status === 'PENDING') status = 'PENDING';
          else if (o.status === 'KOT_SENT') status = 'KOT';
          else if (o.status === 'BILLED') status = 'READY';
          else if (o.status === 'PAID') status = 'COMPLETED';

          const mappedCartItems = (o.items || []).map((oi: any) => {
            const dbItem = dbItems.find((mi: any) => mi.id === oi.menuItemId);
            return {
              menuItem: {
                id: oi.menuItemId,
                name: dbItem ? dbItem.name : oi.menuItem?.name || 'Unknown Item',
                category: 'Other',
                price: Number(oi.price),
              },
              qty: oi.quantity,
              note: oi.notes || '',
            };
          });

          // Infer integration channel based on notes or defaults
          let channel: 'ZOMATO' | 'SWIGGY' | 'DIRECT' = 'DIRECT';
          const lowerNotes = (o.notes || '').toLowerCase();
          if (lowerNotes.includes('zomato')) channel = 'ZOMATO';
          else if (lowerNotes.includes('swiggy')) channel = 'SWIGGY';

          return {
            id: o.id,
            runningOrderId: o.id,
            token: `DEL-${200 + idx}`,
            customerName: o.customer?.name || 'Home Delivery Guest',
            customerPhone: o.customer?.phone || '',
            address: o.customer?.notes || 'Pride Icon, Kharadi, Pune',
            channel,
            items: mappedCartItems,
            status,
            createdAt: new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            total: Number(o.total),
          };
        });

      setOrders(mappedOrders);
    } catch (e: any) {
      toast.error('Failed to load delivery orders: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.branchId) {
      fetchDeliveryOrders();
    }
  }, [user?.branchId]);

  // ── Accept Delivery Order / Move Status ──
  const handleAcceptOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      await api.put(`/api/orders/${orderId}`, {
        status: 'KOT_SENT',
      });
      await fetchDeliveryOrders();
      toast.success('Delivery order accepted and sent to kitchen KOT queue!');
    } catch (e: any) {
      toast.error('Failed to accept order: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Dispatch Order / Mark Ready ──
  const handleDispatchOrder = async (orderId: string) => {
    setActionLoading(true);
    try {
      await api.put(`/api/orders/${orderId}`, {
        status: 'BILLED',
      });
      // Generate unpaid bill in database so it saves
      await api.post('/api/bills', {
        orderId,
      });

      await fetchDeliveryOrders();
      toast.success('Order dispatched! Invoice generated in the Billing section. 🛵');
    } catch (e: any) {
      toast.error('Failed to dispatch order: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Settle Order / Settle Payment ──
  const handleSettleOrder = async (order: DeliveryOrder) => {
    setActionLoading(true);
    try {
      // 1. Generate bill
      const billRes = await api.post('/api/bills', {
        orderId: order.runningOrderId,
      });
      const billId = billRes.data?.data?.bill?.id;
      const grandTotal = Number(billRes.data?.data?.bill?.grandTotal);

      // 2. Pay bill in full (Zomato/Swiggy orders are prepaid card/UPI, Direct can be cash)
      const payMethod = order.channel === 'DIRECT' ? 'CASH' : 'UPI';
      await api.post(`/api/bills/${billId}/payments`, {
        payments: [
          {
            method: payMethod,
            amount: grandTotal,
          },
        ],
      });

      setActiveOrderId(null);
      await fetchDeliveryOrders();
      toast.success(`Delivery order settled successfully via ${payMethod}!`);
    } catch (e: any) {
      toast.error('Failed to settle payment: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this delivery order?')) return;
    setActionLoading(true);
    try {
      await api.put(`/api/orders/${id}`, {
        status: 'CANCELLED',
        items: [],
      });
      if (activeOrderId === id) setActiveOrderId(null);
      await fetchDeliveryOrders();
      toast.success('Order cancelled successfully.');
    } catch (e: any) {
      toast.error('Failed to cancel order: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const statusMatch = filterStatus === 'ALL' || o.status === filterStatus;
    const searchMatch =
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.token.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 text-muted-foreground">
        <div className="h-7 w-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs">Loading delivery queue...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      
      {/* LEFT: Orders Queue */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search delivery queue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 h-9 rounded-xl border border-border text-xs outline-none bg-card focus:border-primary/45"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {(['ALL', 'PENDING', 'KOT', 'READY', 'COMPLETED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                filterStatus === s
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background border-border text-muted-foreground hover:border-foreground/30'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s as OrderStatus].label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
          <AnimatePresence>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                No delivery orders found.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status];
                const isActive = activeOrderId === order.id;
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setActiveOrderId(order.id)}
                    className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : `${cfg.color} hover:shadow-sm`
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold font-mono">{order.token}</span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                              order.channel === 'ZOMATO'
                                ? 'bg-red-100 text-red-700'
                                : order.channel === 'SWIGGY'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {order.channel}
                          </span>
                        </div>
                        <p className="text-xs font-bold truncate text-slate-800">{order.customerName}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" /> {order.address}
                        </p>
                      </div>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-2">
                      <span className="font-semibold text-slate-700">₹{order.total.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {order.createdAt}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT: Selected Order Detail / Actions */}
      <div className="flex-1 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden">
        {activeOrder ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header info */}
            <div className="border-b border-border pb-4 mb-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-800">{activeOrder.customerName}</h3>
                  <span className="text-xs font-mono font-semibold text-muted-foreground">{activeOrder.token}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {activeOrder.customerPhone || 'No Phone'}
                  <span>·</span>
                  <span className="font-semibold">{activeOrder.channel} Delivery</span>
                </p>
                <p className="text-[10px] text-slate-600 mt-2 bg-muted/40 p-2.5 rounded-lg border border-border/40 flex items-start gap-1.5 leading-relaxed">
                  <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <span><strong>Deliver to:</strong> {activeOrder.address}</span>
                </p>
              </div>
              <button
                onClick={() => handleCancelOrder(activeOrder.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {activeOrder.items.map((item) => (
                <div key={item.menuItem.id} className="flex justify-between items-center p-3 bg-muted/20 border border-border/40 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{item.menuItem.name}</p>
                    <p className="text-[10px] text-muted-foreground">₹{item.menuItem.price} × {item.qty}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-800">₹{(item.menuItem.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Total & Action bar */}
            <div className="border-t border-border pt-4 mt-4 space-y-4">
              <div className="flex justify-between font-bold text-sm text-slate-800">
                <span>Grand Total</span>
                <span className="text-primary text-base">₹{activeOrder.total.toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {activeOrder.status === 'PENDING' && (
                  <button
                    onClick={() => handleAcceptOrder(activeOrder.id)}
                    disabled={actionLoading}
                    className="col-span-2 h-10 bg-primary hover:bg-primary/95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                  >
                    Accept Order & Send KOT
                  </button>
                )}

                {activeOrder.status === 'KOT' && (
                  <button
                    onClick={() => handleDispatchOrder(activeOrder.id)}
                    disabled={actionLoading}
                    className="col-span-2 h-10 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                  >
                    <Car className="h-4 w-4" /> Dispatch / Out for Delivery
                  </button>
                )}

                {activeOrder.status === 'READY' && (
                  <button
                    onClick={() => handleSettleOrder(activeOrder)}
                    disabled={actionLoading}
                    className="col-span-2 h-10 bg-success hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                  >
                    <BadgeCheck className="h-4 w-4" /> Mark as Delivered & Settle Bill
                  </button>
                )}

                {activeOrder.status === 'COMPLETED' && (
                  <div className="col-span-2 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Settled and Delivered Successfully
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center">
            <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-xs font-semibold">No active delivery selected</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Select a card from the left queue to view details</p>
          </div>
        )}
      </div>

    </div>
  );
}
