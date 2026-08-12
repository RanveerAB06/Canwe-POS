'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  ReceiptText,
  CheckCircle2,
  Phone,
  User,
  Package,
  Clock,
  UtensilsCrossed,
  X,
  Printer,
  ShoppingBag,
  BadgeCheck,
  AlertCircle,
  Edit2,
  Save,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';
import { WhatsAppModal } from '@/components/billing/WhatsAppModal';

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'KOT' | 'READY' | 'COMPLETED';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  isVeg: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  qty: number;
  note: string;
}

interface TakeawayOrder {
  id: string;           // Local temporary ID or Backend Order ID
  runningOrderId?: string; // Backend order ID
  token: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  status: OrderStatus;
  createdAt: string;
  discount: number;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; badge: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pending',   color: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700',  icon: <Clock className="h-3 w-3" /> },
  CONFIRMED: { label: 'Confirmed', color: 'border-blue-200 bg-blue-50',     badge: 'bg-blue-100 text-blue-700',      icon: <CheckCircle2 className="h-3 w-3" /> },
  KOT:       { label: 'In Kitchen',color: 'border-orange-200 bg-orange-50', badge: 'bg-orange-100 text-orange-700',  icon: <ChefHat className="h-3 w-3" /> },
  READY:     { label: 'Ready',     color: 'border-green-200 bg-green-50',   badge: 'bg-green-100 text-green-700',    icon: <Package className="h-3 w-3" /> },
  COMPLETED: { label: 'Completed', color: 'border-gray-200 bg-gray-50',     badge: 'bg-gray-100 text-gray-600',      icon: <BadgeCheck className="h-3 w-3" /> },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
let tokenCounter = 101;
function genToken() { return `TKW-${tokenCounter++}`; }
function nowStr() { return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
function calcSubtotal(items: CartItem[]) { return items.reduce((s, i) => s + i.menuItem.price * i.qty, 0); }
function calcGST(s: number) {
  const taxes = usePOSStore.getState().taxes;
  const cgst = taxes?.cgstRate !== undefined ? Number(taxes.cgstRate) : 2.5;
  const sgst = taxes?.sgstRate !== undefined ? Number(taxes.sgstRate) : 2.5;
  const rate = cgst + sgst;
  return Math.round((s * rate) / 100);
}

function calcPackingCharge() {
  const taxes = usePOSStore.getState().taxes;
  if (taxes?.applyPackingTakeaway) {
    return Number(taxes.packingCharge) || 0;
  }
  return 0;
}
function calcTotal(items: CartItem[], discount = 0) {
  const sub = calcSubtotal(items);
  const packing = calcPackingCharge();
  return sub + calcGST(sub) + packing - discount;
}

// ─── KOT Print overlay ────────────────────────────────────────────────────────
function KOTModal({ order, onClose }: { order: TakeawayOrder; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
        className="bg-white rounded-2xl shadow-2xl w-72 p-6 font-mono text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl mb-2">🍽️</div>
        <h3 className="font-bold text-sm mb-0.5">TAKEAWAY KOT</h3>
        <p className="text-[10px] text-gray-500 mb-3">Kitchen Order Ticket — {order.token}</p>
        <div className="border-t border-dashed border-gray-300 py-3 text-left space-y-1">
          <div className="flex justify-between text-xs font-bold">
            <span>Token: {order.token}</span><span>{nowStr()}</span>
          </div>
          <div className="text-xs text-gray-500">Customer: {order.customerName}</div>
          {order.items.map((i) => (
            <div key={i.menuItem.id} className="flex justify-between text-xs text-gray-800">
              <span>{i.qty}x {i.menuItem.name}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-gray-300 pt-2 text-[10px] text-gray-400 mb-3">Printing to Kitchen...</div>
        <div className="flex justify-center">
          <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
            <motion.div className="h-full bg-orange-500 rounded-full" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5 }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Bill Modal ───────────────────────────────────────────────────────────────
function BillModal({
  order,
  onClose,
  onConfirm,
  onSaveOnly,
  onWhatsAppSent,
  discount,
}: {
  order: TakeawayOrder;
  onClose: () => void;
  onConfirm: () => void;
  onSaveOnly?: () => void;
  onWhatsAppSent?: () => void;
  discount: number;
}) {
  const sub = calcSubtotal(order.items);
  const gst = calcGST(sub);
  const packing = calcPackingCharge();
  const total = sub + gst + packing - discount;

  const user = usePOSStore((state) => state.user);
  const restaurantProfile = usePOSStore((state) => state.restaurantProfile);
  const invoiceSettings = usePOSStore((state) => state.invoice);
  const restaurantName = restaurantProfile?.name || user?.restaurantName || 'My Restaurant';
  const restaurantAddress = restaurantProfile?.address || 'Takeaway Order Receipt';
  const billHeader = invoiceSettings?.invoiceHeader;
  const billFooter = invoiceSettings?.invoiceFooter || 'Thank you! Visit again 🙏';
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const whatsappDetails = {
    restaurantName,
    restaurantAddress,
    invoiceNumber: order.token || `TKW-${Date.now().toString().slice(-6)}`,
    orderType: 'Takeaway',
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    items: order.items.map((i) => ({
      name: i.menuItem.name,
      quantity: i.qty,
      price: i.menuItem.price,
    })),
    subtotal: sub,
    taxAmount: gst,
    discountAmount: discount,
    grandTotal: total,
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
          className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#0F172A] text-white p-5 text-center">
            <div className="text-2xl mb-1">📦</div>
            <h3 className="font-bold text-base uppercase tracking-tight">{restaurantName}</h3>
            {restaurantAddress && <p className="text-[11px] text-white/60 mb-1">{restaurantAddress}</p>}
            {billHeader && <p className="text-[10px] text-emerald-400 font-semibold italic mb-2">{billHeader}</p>}
            <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs font-mono">
              <Package className="h-3 w-3" /> {order.token}
            </div>
          </div>

          <div className="p-4 font-mono text-xs">
            <div className="flex justify-between text-gray-500 mb-1">
              <span>Customer</span><span className="font-semibold text-gray-800">{order.customerName}</span>
            </div>
            <div className="flex justify-between text-gray-500 mb-3">
              <span>Phone</span><span>{order.customerPhone || '—'}</span>
            </div>
            <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5 mb-3">
              {order.items.map((i) => (
                <div key={i.menuItem.id} className="flex justify-between text-gray-800">
                  <span>{i.qty}x {i.menuItem.name}</span>
                  <span>₹{(i.menuItem.price * i.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{sub.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-500"><span>GST ({((Number(usePOSStore.getState().taxes?.cgstRate) || 2.5) + (Number(usePOSStore.getState().taxes?.sgstRate) || 2.5))}%)</span><span>₹{gst.toLocaleString()}</span></div>
              {packing > 0 && (
                <div className="flex justify-between text-gray-500"><span>Packaging Charge</span><span>₹{packing.toLocaleString()}</span></div>
              )}
              {discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{discount}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200">
                <span>TOTAL</span><span>₹{total.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-3 border-t border-dashed border-gray-200 pt-2">{billFooter}</p>
          </div>

          <div className="px-4 pb-4 flex flex-col gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setShowWhatsApp(true)}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </button>
              {onSaveOnly && (
                <button
                  type="button"
                  onClick={onSaveOnly}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm"
                >
                  <ReceiptText className="h-3.5 w-3.5" /> Generate Only
                </button>
              )}
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 py-2 rounded-xl bg-[#0F172A] text-white text-[11px] font-semibold flex items-center justify-center gap-1 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" /> Print Bill
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
        defaultPhone={order.customerPhone}
        onSent={() => {
          if (onWhatsAppSent) onWhatsAppSent();
        }}
      />
    </>
  );
}

// ─── New Order Form Modal ─────────────────────────────────────────────────────
function NewOrderModal({ onCreate, onClose }: {
  onCreate: (name: string, phone: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-base">New Takeaway Order</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Enter customer details to begin</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" /> Customer Name *
            </label>
            <input
              ref={nameRef}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), phone.trim()); }}
              placeholder="e.g. Rahul Sharma"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> Mobile Number <span className="text-muted-foreground/60 font-normal">(optional)</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim(), phone.trim()); }}
              placeholder="e.g. 9876543210"
              maxLength={10}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/50 transition-colors font-mono"
            />
          </div>
          <button
            onClick={() => { if (!name.trim()) { toast.error('Customer name required'); return; } onCreate(name.trim(), phone.trim()); }}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all mt-2"
          >
            <ShoppingBag className="h-4 w-4" /> Create Order
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TakeawayView() {
  const user = usePOSStore((state) => state.user);

  const [orders, setOrders] = useState<TakeawayOrder[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Menu state (shared for active order)
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [discount, setDiscount] = useState(0);

  // Database loaded state
  const [menuCategories, setMenuCategories] = useState<string[]>(['All']);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [showKOT, setShowKOT] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');

  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null;

  // ── Fetch remote data from backend ──
  const fetchPOSData = useCallback(async () => {
    if (!user?.branchId) return;
    try {
      const [ordersRes, categoriesRes, itemsRes] = await Promise.all([
        api.get('/api/orders/running'),
        api.get('/api/menu/categories'),
        api.get('/api/menu/items'),
      ]);

      const runningOrders = ordersRes.data?.data?.orders || [];
      const dbCategories = categoriesRes.data?.data?.categories || [];
      const dbItems = itemsRes.data?.data?.items || [];

      // Map Categories
      setMenuCategories(['All', ...dbCategories.map((c: any) => c.name)]);

      // Map Menu Items
      const mappedMenuItems = dbItems.map((item: any) => {
        const cat = dbCategories.find((c: any) => c.id === item.categoryId);
        return {
          id: item.id,
          name: item.name,
          category: cat ? cat.name : 'Other',
          price: Number(item.price),
          isVeg: item.isVeg,
        };
      });
      setMenuItems(mappedMenuItems);

      // Map active Takeaway orders
      const mappedOrders = runningOrders
        .filter((o: any) => o.orderType === 'TAKEAWAY')
        .map((o: any, idx: number) => {
          let status: OrderStatus = 'PENDING';

          const hasReadyKot = (o.kots || []).some((k: any) => k.status === 'READY' || k.status === 'SERVED');
          const hasPreparingKot = (o.kots || []).some((k: any) => k.status === 'PREPARING' || k.status === 'PENDING');

          if (o.status === 'READY' || hasReadyKot || o.status === 'BILLED') {
            status = 'READY';
          } else if (o.status === 'KOT_SENT' || hasPreparingKot) {
            status = 'KOT';
          } else if (o.status === 'PAID' || o.status === 'COMPLETED') {
            status = 'COMPLETED';
          } else if (o.status === 'CANCELLED') {
            status = 'CANCELLED';
          } else {
            status = 'PENDING';
          }


          const mappedCartItems = (o.items || []).map((oi: any) => {
            const mItem = mappedMenuItems.find((mi: any) => mi.id === oi.menuItemId);
            return {
              menuItem: mItem || {
                id: oi.menuItemId,
                name: oi.menuItem?.name || 'Unknown Item',
                price: Number(oi.price),
                category: 'Other',
                isVeg: true,
              },
              qty: oi.quantity,
              note: oi.notes || '',
            };
          });

          return {
            id: o.id,
            runningOrderId: o.id,
            token: `TKW-${100 + idx}`,
            customerName: o.customer?.name || 'Walk-in Customer',
            customerPhone: o.customer?.phone || '',
            items: mappedCartItems,
            status,
            createdAt: new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            discount: Number(o.discount) || 0,
          };
        });

      setOrders(mappedOrders);
    } catch (e: any) {
      toast.error('Failed to load active orders: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.branchId) {
      fetchPOSData();
    }
  }, [user?.branchId]);

  // ── Create local takeaway order ──
  const handleCreate = useCallback((name: string, phone: string) => {
    const newOrder: TakeawayOrder = {
      id: `local-${Date.now()}`,
      token: genToken(),
      customerName: name,
      customerPhone: phone,
      items: [],
      status: 'PENDING',
      createdAt: nowStr(),
      discount: 0,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setActiveOrderId(newOrder.id);
    setDiscount(0);
    setShowNewModal(false);
    toast.success(`Order ${newOrder.token} created for ${name}`);
  }, []);

  // ── Cart actions ──
  const addItem = useCallback((item: MenuItem) => {
    if (!activeOrderId) return;
    setOrders((prev) => prev.map((o) => {
      if (o.id !== activeOrderId) return o;
      const ex = o.items.find((i) => i.menuItem.id === item.id);
      if (ex) return { ...o, items: o.items.map((i) => i.menuItem.id === item.id ? { ...i, qty: i.qty + 1 } : i) };
      return { ...o, items: [...o.items, { menuItem: item, qty: 1, note: '' }] };
    }));
  }, [activeOrderId]);

  const changeQty = useCallback((itemId: string, delta: number) => {
    if (!activeOrderId) return;
    setOrders((prev) => prev.map((o) => {
      if (o.id !== activeOrderId) return o;
      const updated = o.items.map((i) => i.menuItem.id === itemId ? { ...i, qty: i.qty + delta } : i).filter((i) => i.qty > 0);
      return { ...o, items: updated };
    }));
  }, [activeOrderId]);

  const getQty = (itemId: string) => activeOrder?.items.find((i) => i.menuItem.id === itemId)?.qty ?? 0;

  // Find or Create customer inside backend CRM
  const getOrCreateCustomer = async (name: string, phone: string): Promise<string | undefined> => {
    if (!phone) return undefined;
    try {
      // 1. Search customer by phone
      const listRes = await api.get(`/api/crm?search=${phone}`);
      const list = listRes.data?.data?.customers || [];
      if (list.length > 0) {
        return list[0].id;
      }

      // 2. Create customer if not found
      const createRes = await api.post('/api/crm', { name, phone });
      return createRes.data?.data?.customer?.id;
    } catch (e) {
      console.warn('Customer CRM lookup/create skipped:', e);
      return undefined;
    }
  };

  // ── Save Order to backend database ──
  const handleSave = async () => {
    if (!activeOrder?.items.length) { toast.error('Add items first'); return; }
    setActionLoading(true);
    try {
      const customerId = await getOrCreateCustomer(activeOrder.customerName, activeOrder.customerPhone);

      let orderId = activeOrder.runningOrderId;
      if (!orderId) {
        // Create new order
        const res = await api.post('/api/orders', {
          orderType: 'TAKEAWAY',
          customerId: customerId || undefined,
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
        orderId = res.data.data.order.id;
      } else {
        // Update existing order
        await api.put(`/api/orders/${orderId}`, {
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
      }

      await fetchPOSData();
      setActiveOrderId(orderId || null);
      toast.success(`Order token saved successfully!`, { icon: '💾' });
    } catch (e: any) {
      toast.error('Failed to save order: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Send KOT to kitchen ──
  const handleKOT = async () => {
    if (!activeOrder?.items.length) { toast.error('Add items first'); return; }
    setActionLoading(true);
    try {
      const customerId = await getOrCreateCustomer(activeOrder.customerName, activeOrder.customerPhone);

      let orderId = activeOrder.runningOrderId;
      if (!orderId) {
        const res = await api.post('/api/orders', {
          orderType: 'TAKEAWAY',
          customerId: customerId || undefined,
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
        orderId = res.data.data.order.id;
      } else {
        await api.put(`/api/orders/${orderId}`, {
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
      }

      await api.post('/api/kots', { orderId });
      setShowKOT(true);
      await fetchPOSData();
      setActiveOrderId(orderId || null);
      setTimeout(() => setShowKOT(false), 800);

    } catch (e: any) {
      toast.error('Failed to send KOT: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintBill = () => {
    if (!activeOrder?.items.length) { toast.error('No items in order'); return; }
    setShowBill(true);
  };

  // ── Generate Bill Only (No thermal print window) ──
  const handleGenerateBillOnly = async () => {
    if (!activeOrder) return;
    setActionLoading(true);
    try {
      const customerId = await getOrCreateCustomer(activeOrder.customerName, activeOrder.customerPhone);

      let orderId = activeOrder.runningOrderId;
      if (!orderId) {
        const res = await api.post('/api/orders', {
          orderType: 'TAKEAWAY',
          customerId: customerId || undefined,
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
        orderId = res.data.data.order.id;
      } else {
        await api.put(`/api/orders/${orderId}`, {
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
      }

      const res = await api.post('/api/bills', {
        orderId,
        discountAmount: discount,
      });

      const invNum = res.data?.data?.bill?.invoiceNumber || '';

      await api.put(`/api/orders/${orderId}`, {
        status: 'COMPLETED',
      });

      try {
        await api.delete(`/api/kots/order/${orderId}`);
      } catch (kotErr) {}

      setShowBill(false);
      setActiveOrderId(null);
      await fetchPOSData();
      toast.success(`Bill ${invNum} generated & order completed! 📄🎉`);
    } catch (e: any) {
      toast.error('Bill generation failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Settle Bill / Print and Settle cash ──
  const confirmBill = async () => {
    if (!activeOrder) return;
    setActionLoading(true);
    try {
      const customerId = await getOrCreateCustomer(activeOrder.customerName, activeOrder.customerPhone);

      // 1. Ensure order is saved
      let orderId = activeOrder.runningOrderId;
      if (!orderId) {
        const res = await api.post('/api/orders', {
          orderType: 'TAKEAWAY',
          customerId: customerId || undefined,
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
        orderId = res.data.data.order.id;
      } else {
        await api.put(`/api/orders/${orderId}`, {
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
      }


      // 2. Generate bill with discount
      await api.post('/api/bills', {
        orderId,
        discountAmount: discount,
      });

      // 3. Mark order as COMPLETED
      await api.put(`/api/orders/${orderId}`, {
        status: 'COMPLETED',
      });

      // 4. Delete KOTs for this order
      try {
        await api.delete(`/api/kots/order/${orderId}`);
      } catch (kotErr) {
        console.warn('Could not delete KOTs:', kotErr);
      }

      // 5. Trigger print window
      if (typeof window !== 'undefined') {
        window.print();
      }

      setShowBill(false);
      setActiveOrderId(null);
      await fetchPOSData();
      toast.success('Bill printed, KOTs deleted & order completed! 🎉');
    } catch (e: any) {
      toast.error('Checkout failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleWhatsAppComplete = async () => {
    if (!activeOrder) return;
    setActionLoading(true);
    try {
      const customerId = await getOrCreateCustomer(activeOrder.customerName, activeOrder.customerPhone);

      let orderId = activeOrder.runningOrderId;
      if (!orderId) {
        const res = await api.post('/api/orders', {
          orderType: 'TAKEAWAY',
          customerId: customerId || undefined,
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
        orderId = res.data.data.order.id;
      } else {
        await api.put(`/api/orders/${orderId}`, {
          items: activeOrder.items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.qty,
          })),
        });
      }

      await api.post('/api/bills', {
        orderId,
        discountAmount: discount,
      });

      await api.put(`/api/orders/${orderId}`, {
        status: 'COMPLETED',
      });

      try {
        await api.delete(`/api/kots/order/${orderId}`);
      } catch (kotErr) {
        console.warn('Could not delete KOTs:', kotErr);
      }

      setShowBill(false);
      setActiveOrderId(null);
      await fetchPOSData();
      toast.success('WhatsApp bill sent, KOTs deleted & order completed! 💬🎉');
    } catch (e: any) {
      toast.error('Checkout failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete Order / Cancel Order ──
  const deleteOrder = async (id: string) => {
    const isLocal = id.startsWith('local-');
    if (isLocal) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
      if (activeOrderId === id) setActiveOrderId(null);
      toast.success('Local order draft removed');
      return;
    }

    setActionLoading(true);
    try {
      // Cancel/Delete order on backend
      await api.put(`/api/orders/${id}`, {
        status: 'CANCELLED',
      });
      await fetchPOSData();
      if (activeOrderId === id) setActiveOrderId(null);
      toast.success('Order cancelled successfully');
    } catch (e: any) {
      toast.error('Failed to cancel order: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtered menus ──
  const filteredMenu = menuItems.filter((item) => {
    const catMatch = activeCategory === 'All' || item.category === activeCategory;
    const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  });

  const filteredOrders = filterStatus === 'ALL' ? orders : orders.filter((o) => o.status === filterStatus);

  const subtotal = activeOrder ? calcSubtotal(activeOrder.items) : 0;
  const gst = calcGST(subtotal);
  const packing = activeOrder ? calcPackingCharge() : 0;
  const total = subtotal + gst + packing - discount;


  const billOrder: TakeawayOrder | null = activeOrder ? { ...activeOrder, discount } : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading takeaway orders catalog...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 overflow-y-auto lg:overflow-hidden">

      {/* ─── LEFT: Orders Queue ───────────────────────────── */}
      <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3">

        <button
          onClick={() => setShowNewModal(true)}
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-primary/20 flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> New Takeaway Order
        </button>

        <div className="flex gap-1.5 flex-wrap">
          {(['ALL', 'PENDING', 'KOT', 'READY', 'COMPLETED'] as const).map((s) => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${filterStatus === s ? 'bg-foreground text-background border-foreground' : 'bg-background border-border text-muted-foreground hover:border-foreground/30'}`}>
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s as OrderStatus].label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
          <AnimatePresence>
            {filteredOrders.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingBag className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs">No orders yet</p>
                <p className="text-[10px] opacity-60">Click + New Order to start</p>
              </motion.div>
            ) : (
              filteredOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status];
                const isActive = activeOrderId === order.id;
                return (
                  <motion.div key={order.id}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                    onClick={() => { setActiveOrderId(order.id); setDiscount(order.discount); }}
                    className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/5 shadow-sm' : `${cfg.color} hover:shadow-sm`}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold font-mono">{order.token}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${cfg.badge}`}>
                            {cfg.icon}{cfg.label}
                          </span>
                        </div>
                        <p className="text-xs font-semibold truncate text-slate-800">{order.customerName}</p>
                        {order.customerPhone && <p className="text-[10px] text-muted-foreground">{order.customerPhone}</p>}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                          {order.items.length > 0 && (
                            <span className="text-[11px] font-bold text-primary">₹{calcTotal(order.items, order.discount).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-0.5 mt-0.5">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />{order.createdAt}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── MIDDLE: Menu Selector ────────────────────────── */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl overflow-hidden min-w-0">
        <div className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              {activeOrder ? (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-sm">{activeOrder.customerName}</h2>
                    <span className="text-xs font-mono text-muted-foreground">{activeOrder.token}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeOrder.customerPhone || 'No phone'} · Takeaway
                  </p>
                </>
              ) : (
                <div>
                  <h2 className="font-bold text-sm text-muted-foreground">No order selected</h2>
                  <p className="text-[11px] text-muted-foreground">Create or select an order from the left panel</p>
                </div>
              )}
            </div>
            {!activeOrder && (
              <button onClick={() => setShowNewModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="h-3.5 w-3.5" /> New Order
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes…"
              className={`w-full pl-8 pr-4 h-9 rounded-xl border border-border text-sm outline-none focus:border-primary/40 transition-colors bg-muted/30 ${!activeOrder ? 'opacity-50 pointer-events-none' : ''}`} />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-b border-border overflow-x-auto flex-shrink-0 bg-muted/10">
          {menuCategories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              disabled={!activeOrder}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all disabled:opacity-40 ${activeCategory === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className={`flex-1 overflow-y-auto p-4 grid grid-cols-2 xl:grid-cols-3 gap-3 content-start ${!activeOrder ? 'pointer-events-none opacity-40' : ''}`}>
          {filteredMenu.map((item) => {
            const qty = getQty(item.id);
            return (
              <motion.div key={item.id} layout
                className={`relative bg-card rounded-xl border-2 p-3 transition-all ${qty > 0 ? 'border-primary/50 shadow-sm' : 'border-border hover:shadow-sm hover:border-border/80'}`}>
                <div className={`absolute top-2.5 left-2.5 h-3 w-3 rounded-sm border-2 flex items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                </div>
                {qty > 0 && (
                  <span className="absolute top-2 right-2 h-5 w-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">{qty}</span>
                )}
                <div className="mt-4 mb-2">
                  <p className="text-xs font-semibold leading-tight">{item.name}</p>
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
          {filteredMenu.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UtensilsCrossed className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Cart & Summary ────────────────────────── */}
      <div className="w-full lg:w-72 flex-shrink-0 flex flex-col bg-card border border-border rounded-2xl overflow-hidden">

        <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">Order Cart</span>
            </div>
            {activeOrder && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_CONFIG[activeOrder.status].badge}`}>
                {STATUS_CONFIG[activeOrder.status].icon}
                {STATUS_CONFIG[activeOrder.status].label}
              </span>
            )}
          </div>
          {activeOrder && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              <span className="font-mono font-semibold">{activeOrder.token}</span>
              <span>·</span>
              <User className="h-3 w-3" />
              <span className="truncate">{activeOrder.customerName}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
          <AnimatePresence>
            {!activeOrder || activeOrder.items.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingBag className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-[10px] opacity-60 mt-1">{activeOrder ? 'Add items from the menu' : 'Select an order first'}</p>
              </motion.div>
            ) : (
              activeOrder.items.map((item) => (
                <motion.div key={item.menuItem.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-slate-800">{item.menuItem.name}</p>
                    <p className="text-[10px] text-muted-foreground">₹{item.menuItem.price} × {item.qty}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(item.menuItem.id, -1)} className="h-5 w-5 rounded-md bg-muted flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.menuItem.id, 1)} className="h-5 w-5 rounded-md bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-primary w-12 text-right">₹{(item.menuItem.price * item.qty).toLocaleString()}</span>
                  <button onClick={() => changeQty(item.menuItem.id, -item.qty)} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {activeOrder && activeOrder.items.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/10 space-y-1.5 flex-shrink-0">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>GST ({((Number(usePOSStore.getState().taxes?.cgstRate) || 2.5) + (Number(usePOSStore.getState().taxes?.sgstRate) || 2.5))}%)</span><span>₹{gst.toLocaleString()}</span></div>
            {packing > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground"><span>Packaging Charge</span><span>₹{packing.toLocaleString()}</span></div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">Discount (₹)</span>
              <input type="number" min={0} max={subtotal} value={discount}
                onChange={(e) => setDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value))))}
                className="w-20 h-7 px-2 rounded-lg border border-border bg-background text-xs text-right font-mono outline-none focus:border-primary/40" />
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-1">
              <span>Total</span><span className="text-primary">₹{total.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-border space-y-2 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleSave} disabled={!activeOrder || actionLoading}
              className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
              {actionLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save Order
            </button>
            <button onClick={handleKOT} disabled={!activeOrder || actionLoading}
              className="h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
              {actionLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />} Send KOT
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleGenerateBillOnly} disabled={!activeOrder || actionLoading}
              className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
              <ReceiptText className="h-3.5 w-3.5" /> Generate Bill
            </button>
            <button onClick={handlePrintBill} disabled={!activeOrder || actionLoading}
              className="h-10 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
              <Printer className="h-3.5 w-3.5" /> Print Bill
            </button>
          </div>
        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────── */}
      <AnimatePresence>
        {showNewModal && <NewOrderModal onCreate={handleCreate} onClose={() => setShowNewModal(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showKOT && activeOrder && <KOTModal order={{ ...activeOrder, discount }} onClose={() => setShowKOT(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showBill && billOrder && (
          <BillModal
            order={billOrder}
            discount={discount}
            onClose={() => setShowBill(false)}
            onConfirm={confirmBill}
            onSaveOnly={handleGenerateBillOnly}
            onWhatsAppSent={handleWhatsAppComplete}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
