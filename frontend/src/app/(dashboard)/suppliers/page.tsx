'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Search,
  Plus,
  Phone,
  Mail,
  User,
  DollarSign,
  Package,
  Edit2,
  Trash2,
  RefreshCw,
  FilePlus,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Calendar,
  X,
  FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface PurchaseOrder {
  id: string;
  branchId: string;
  supplierId: string;
  supplier?: {
    name: string;
    contactPerson?: string;
  };
  status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number | string;
  createdAt: string;
}

interface SupplierItem {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
  purchaseOrders?: PurchaseOrder[];
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'PURCHASE_ORDERS'>('DIRECTORY');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [showPoModal, setShowPoModal] = useState(false);
  const [selectedSupplierForPo, setSelectedSupplierForPo] = useState<SupplierItem | null>(null);

  // Supplier Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Purchase Order Form State
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poAmount, setPoAmount] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Fetch Suppliers and Purchase Orders
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, poRes] = await Promise.all([
        api.get('/api/inventory/suppliers').catch(() => ({ data: { data: { suppliers: [] } } })),
        api.get('/api/inventory/purchase-orders').catch(() => ({ data: { data: { purchaseOrders: [] } } })),
      ]);

      if (supRes.data?.data?.suppliers) {
        setSuppliers(supRes.data.data.suppliers);
      }
      if (poRes.data?.data?.purchaseOrders) {
        setPurchaseOrders(poRes.data.data.purchaseOrders);
      }
    } catch (e: any) {
      toast.error('Failed to load supplier data: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Edit Modal
  const openEditModal = (supplier: SupplierItem) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setContactPerson(supplier.contactPerson || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
  };

  // Open Create PO Modal
  const openCreatePoModal = (supplier?: SupplierItem) => {
    setSelectedSupplierForPo(supplier || null);
    setPoSupplierId(supplier ? supplier.id : suppliers[0]?.id || '');
    setPoAmount('');
    setShowPoModal(true);
  };

  // Handle Save (Create or Update) Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Supplier / Company Name is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        // Update existing supplier
        const res = await api.put(`/api/inventory/suppliers/${editingSupplier.id}`, {
          name,
          contactPerson,
          phone,
          email,
        });
        toast.success(`Supplier updated: ${name}`);
        setEditingSupplier(null);
      } else {
        // Create new supplier
        await api.post('/api/inventory/suppliers', {
          name,
          contactPerson,
          phone,
          email,
        });
        toast.success(`Supplier registered: ${name}`);
        setShowAddModal(false);
      }
      fetchData();
      resetSupplierForm();
    } catch (e: any) {
      toast.error('Failed to save supplier: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async (supplier: SupplierItem) => {
    if (!confirm(`Are you sure you want to delete "${supplier.name}"?`)) return;
    try {
      await api.delete(`/api/inventory/suppliers/${supplier.id}`);
      toast.success(`Supplier "${supplier.name}" deleted.`);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to delete supplier: ' + (e.response?.data?.message || e.message));
    }
  };

  // Handle Create Purchase Order
  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSupplierId = poSupplierId || selectedSupplierForPo?.id;
    if (!targetSupplierId) {
      toast.error('Please select a supplier.');
      return;
    }
    if (!poAmount || isNaN(Number(poAmount)) || Number(poAmount) <= 0) {
      toast.error('Please enter a valid total amount.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/inventory/purchase-orders', {
        supplierId: targetSupplierId,
        totalAmount: Number(poAmount),
      });
      toast.success('Purchase Order created successfully!');
      setShowPoModal(false);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to create Purchase Order: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Update Purchase Order Status
  const handleUpdatePoStatus = async (poId: string, status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED') => {
    try {
      await api.put(`/api/inventory/purchase-orders/${poId}/status`, { status });
      toast.success(`PO status updated to ${status}!`);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to update PO status: ' + (e.response?.data?.message || e.message));
    }
  };

  const resetSupplierForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search))
  );

  // Compute live KPIs
  const totalSuppliers = suppliers.length;
  const activePos = purchaseOrders.filter((po) => po.status === 'DRAFT' || po.status === 'SENT').length;
  const fulfilledPoValue = purchaseOrders
    .filter((po) => po.status === 'RECEIVED')
    .reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Supplier & PO Portal
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage raw ingredient vendors, contacts, and track active purchase orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            className="rounded-xl h-9 text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => openCreatePoModal()}
            className="rounded-xl h-9 text-xs px-3.5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FilePlus className="h-4 w-4" /> Create PO
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetSupplierForm();
              setShowAddModal(true);
            }}
            className="rounded-xl h-9 text-xs px-3.5 gap-1.5"
          >
            <Plus className="h-4 w-4" /> Register Supplier
          </Button>
        </div>
      </div>

      {/* Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Registered Suppliers
          </span>
          <div className="flex items-center justify-between mt-2">
            <h4 className="text-2xl font-bold font-heading">{totalSuppliers}</h4>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Purchase Orders
          </span>
          <div className="flex items-center justify-between mt-2">
            <h4 className="text-2xl font-bold font-heading">{activePos} POs</h4>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Fulfilled PO Value
          </span>
          <div className="flex items-center justify-between mt-2">
            <h4 className="text-2xl font-bold font-heading">
              ₹{fulfilledPoValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h4>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tab switcher */}
        <div className="flex bg-muted rounded-xl p-1 border border-border self-start">
          <button
            onClick={() => setActiveTab('DIRECTORY')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'DIRECTORY'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            Suppliers Directory ({suppliers.length})
          </button>
          <button
            onClick={() => setActiveTab('PURCHASE_ORDERS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'PURCHASE_ORDERS'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            Purchase Orders ({purchaseOrders.length})
          </button>
        </div>

        {/* Search bar */}
        {activeTab === 'DIRECTORY' && (
          <div className="relative flex items-center max-w-sm w-full">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
            <Input
              type="text"
              placeholder="Search suppliers by name, contact or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-card border-border"
            />
          </div>
        )}
      </div>

      {/* ─── TAB 1: SUPPLIERS DIRECTORY ──────────────────────────────────── */}
      {activeTab === 'DIRECTORY' && (
        <Card className="border border-border overflow-hidden rounded-2xl bg-card shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-muted-foreground">Loading suppliers...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Truck className="h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm font-bold text-foreground">No Suppliers Found</p>
              <p className="text-xs mt-1 opacity-60">Register your first vendor to begin issuing Purchase Orders.</p>
              <Button
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="mt-4 rounded-xl h-8 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Supplier
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="p-4">Supplier Name</th>
                    <th className="p-4">Contact Representative</th>
                    <th className="p-4">Phone Number</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Active POs</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSuppliers.map((s) => {
                    const poCount = (s.purchaseOrders || []).filter(
                      (p) => p.status === 'DRAFT' || p.status === 'SENT'
                    ).length;

                    return (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {s.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span>{s.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {s.contactPerson || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          <span className="flex items-center gap-1.5 font-mono">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {s.phone || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {s.email || 'N/A'}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-bold rounded-full border-0 ${
                              poCount > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {poCount} POs Active
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openCreatePoModal(s)}
                              title="Create Purchase Order"
                              className="h-8 px-2 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg gap-1"
                            >
                              <FilePlus className="h-3.5 w-3.5" /> +PO
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(s)}
                              title="Edit Supplier"
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSupplier(s)}
                              title="Delete Supplier"
                              className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── TAB 2: PURCHASE ORDERS LIST ─────────────────────────────────── */}
      {activeTab === 'PURCHASE_ORDERS' && (
        <Card className="border border-border overflow-hidden rounded-2xl bg-card shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-muted-foreground">Loading purchase orders...</p>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Package className="h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm font-bold text-foreground">No Purchase Orders</p>
              <p className="text-xs mt-1 opacity-60">Create a Purchase Order to order inventory items from your vendors.</p>
              <Button
                size="sm"
                onClick={() => openCreatePoModal()}
                className="mt-4 rounded-xl h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FilePlus className="h-3.5 w-3.5" /> Create First PO
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                    <th className="p-4">PO Reference</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Order Date</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchaseOrders.map((po) => {
                    let statusBadge = 'bg-yellow-100 text-yellow-800 border-yellow-300';
                    if (po.status === 'SENT') statusBadge = 'bg-blue-100 text-blue-800 border-blue-300';
                    if (po.status === 'RECEIVED') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                    if (po.status === 'CANCELLED') statusBadge = 'bg-red-100 text-red-800 border-red-300';

                    return (
                      <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-mono font-bold text-foreground">
                          PO-{po.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          {po.supplier?.name || 'Unknown Supplier'}
                        </td>
                        <td className="p-4 text-muted-foreground font-mono">
                          {new Date(po.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-4 font-mono font-bold text-foreground">
                          ₹{Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${statusBadge}`}>
                            {po.status === 'RECEIVED' && <CheckCircle2 className="h-3 w-3" />}
                            {po.status === 'SENT' && <Clock className="h-3 w-3" />}
                            {po.status === 'CANCELLED' && <XCircle className="h-3 w-3" />}
                            {po.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <select
                            value={po.status}
                            onChange={(e) => handleUpdatePoStatus(po.id, e.target.value as any)}
                            className="text-xs bg-muted/40 border border-border rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="SENT">SENT</option>
                            <option value="RECEIVED">RECEIVED (Fulfilled)</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── MODAL 1: REGISTER / EDIT SUPPLIER ─────────────────────────── */}
      {(showAddModal || editingSupplier) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border max-w-md w-full rounded-2xl p-6 shadow-2xl relative text-foreground space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold font-heading">
                {editingSupplier ? 'Edit Supplier' : 'Register New Vendor / Supplier'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSupplier(null);
                }}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Company / Vendor Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pune Flour & Dairy Distributors"
                  required
                  className="rounded-xl text-xs bg-muted/20 border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Contact Representative Person</label>
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="rounded-xl text-xs bg-muted/20 border-border"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="rounded-xl text-xs bg-muted/20 border-border font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sales@puneflour.com"
                  type="email"
                  className="rounded-xl text-xs bg-muted/20 border-border"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSupplier(null);
                  }}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="rounded-xl text-xs px-5">
                  {submitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ─── MODAL 2: CREATE PURCHASE ORDER ───────────────────────────── */}
      {showPoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border max-w-md w-full rounded-2xl p-6 shadow-2xl relative text-foreground space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold font-heading">Create Purchase Order</h3>
              </div>
              <button
                onClick={() => setShowPoModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Target Supplier / Vendor *</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full h-10 text-xs rounded-xl bg-muted/20 border border-border px-3 font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson || s.phone || 'No Contact'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Total Purchase Order Value (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={poAmount}
                  onChange={(e) => setPoAmount(e.target.value)}
                  placeholder="e.g. 5400.00"
                  required
                  className="rounded-xl text-xs bg-muted/20 border-border font-mono text-base font-bold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPoModal(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="rounded-xl text-xs px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? 'Creating PO...' : 'Create Purchase Order'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

