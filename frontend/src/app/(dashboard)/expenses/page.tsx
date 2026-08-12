'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Search,
  Plus,
  Filter,
  DollarSign,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  CreditCard,
  Building2,
  Trash2,
  X,
  Tag,
  Receipt,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ExpenseItem {
  id: string;
  title: string;
  category: 'Raw Ingredients' | 'Utilities' | 'Salaries' | 'Packaging' | 'Maintenance' | 'Marketing' | 'Misc';
  amount: number;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'NET_BANKING';
  status: 'PAID' | 'PENDING' | 'PARTIAL';
  vendor?: string;
  date: string;
  notes?: string;
}

const initialExpenses: ExpenseItem[] = [
  {
    id: 'exp-1',
    title: 'Fresh Vegetables & Milk Supply',
    category: 'Raw Ingredients',
    amount: 4850,
    paymentMethod: 'UPI',
    status: 'PAID',
    vendor: 'Pune Agro Wholesale Market',
    date: new Date().toISOString().slice(0, 10),
    notes: 'Daily morning fresh stock delivery',
  },
  {
    id: 'exp-2',
    title: 'Commercial LPG Cylinder Refill (x3)',
    category: 'Utilities',
    amount: 6200,
    paymentMethod: 'CASH',
    status: 'PAID',
    vendor: 'Bharat Gas Agency',
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    notes: '19kg commercial cylinders',
  },
  {
    id: 'exp-3',
    title: 'Monthly Electricity & Water Bill',
    category: 'Utilities',
    amount: 14500,
    paymentMethod: 'NET_BANKING',
    status: 'PENDING',
    vendor: 'MSEDCL Pune',
    date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    notes: 'Due by 15th of this month',
  },
  {
    id: 'exp-4',
    title: 'Custom Printed Pizza & Burger Boxes',
    category: 'Packaging',
    amount: 8200,
    paymentMethod: 'UPI',
    status: 'PAID',
    vendor: 'EcoPack India Ltd',
    date: new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10),
    notes: '500 units burger & pizza containers',
  },
  {
    id: 'exp-5',
    title: 'Kitchen Deep Cleaning & Exterminator',
    category: 'Maintenance',
    amount: 3500,
    paymentMethod: 'CASH',
    status: 'PAID',
    vendor: 'CleanCare Services',
    date: new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10),
    notes: 'Bi-weekly hygiene and pest control',
  },
  {
    id: 'exp-6',
    title: 'Chef & Service Staff Salary Advance',
    category: 'Salaries',
    amount: 12000,
    paymentMethod: 'UPI',
    status: 'PAID',
    vendor: 'Staff Payroll',
    date: new Date(Date.now() - 86400000 * 9).toISOString().slice(0, 10),
    notes: 'Advance payout for mid-month',
  },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseItem['category']>('Raw Ingredients');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ExpenseItem['paymentMethod']>('UPI');
  const [status, setStatus] = useState<ExpenseItem['status']>('PAID');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter an expense title');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }

    const newExpense: ExpenseItem = {
      id: `exp-${Date.now()}`,
      title: title.trim(),
      category,
      amount: parsedAmount,
      paymentMethod,
      status,
      vendor: vendor.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
    };

    setExpenses([newExpense, ...expenses]);
    setShowAddModal(false);
    toast.success(`Expense "${newExpense.title}" recorded successfully! 💸`);

    // Reset form
    setTitle('');
    setAmount('');
    setVendor('');
    setNotes('');
  };

  const handleToggleStatus = (id: string) => {
    setExpenses(
      expenses.map((exp) =>
        exp.id === id ? { ...exp, status: exp.status === 'PAID' ? 'PENDING' : 'PAID' } : exp
      )
    );
    toast.success('Expense status updated successfully!');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter((exp) => exp.id !== id));
    toast.success('Expense entry deleted.');
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.title.toLowerCase().includes(search.toLowerCase()) ||
      (exp.vendor || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || exp.category === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || exp.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidExpense = expenses.filter((e) => e.status === 'PAID').reduce((sum, e) => sum + e.amount, 0);
  const pendingExpense = expenses.filter((e) => e.status === 'PENDING').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Restaurant Expenses Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track daily operating expenses, raw material purchases, utility bills, and staff payouts.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="rounded-xl h-10 text-xs px-4 gap-1.5 bg-primary text-white font-semibold shadow-md shadow-primary/20 hover:bg-primary/95 transition-all"
        >
          <Plus className="h-4 w-4" /> Record New Expense
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5 border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Total Expenses</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black font-mono text-foreground">₹{totalExpense.toLocaleString('en-IN')}</h4>
            <p className="text-[11px] text-muted-foreground mt-1">Recorded across {expenses.length} transactions</p>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Settled / Paid</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black font-mono text-emerald-600">₹{paidExpense.toLocaleString('en-IN')}</h4>
            <p className="text-[11px] text-muted-foreground mt-1">Fully paid & cleared entries</p>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            <span>Pending Liabilities</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black font-mono text-amber-600">₹{pendingExpense.toLocaleString('en-IN')}</h4>
            <p className="text-[11px] text-muted-foreground mt-1">Unpaid or upcoming due bills</p>
          </div>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses by title or vendor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 text-xs rounded-xl bg-card border border-border px-3 text-foreground font-medium outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">All Categories</option>
            <option value="Raw Ingredients">Raw Ingredients</option>
            <option value="Utilities">Utilities</option>
            <option value="Salaries">Salaries</option>
            <option value="Packaging">Packaging</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Marketing">Marketing</option>
            <option value="Misc">Misc</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 text-xs rounded-xl bg-card border border-border px-3 text-foreground font-medium outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">All Payment Status</option>
            <option value="PAID">Paid Only</option>
            <option value="PENDING">Pending Only</option>
          </select>
        </div>
      </div>

      {/* Expense List Table */}
      <Card className="border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Expense Details</th>
                <th className="p-4">Category</th>
                <th className="p-4">Vendor / Entity</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Amount (₹)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-foreground">
                      <div>{exp.title}</div>
                      {exp.notes && (
                        <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{exp.notes}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                        <Tag className="h-3 w-3" /> {exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground font-medium">{exp.vendor || '—'}</td>
                    <td className="p-4 font-mono font-bold text-[10px] text-foreground">
                      <span className="px-2 py-0.5 rounded border border-border bg-muted/40">
                        {exp.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground font-mono text-[11px]">{exp.date}</td>
                    <td className="p-4 text-right font-black font-mono text-sm text-foreground">
                      ₹{exp.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 text-center">
                      {exp.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[10px]">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px]">
                          <Clock className="h-3 w-3 text-amber-600" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleStatus(exp.id)}
                        className="px-2.5 py-1 rounded-lg border border-border bg-muted/30 hover:bg-muted text-[11px] font-semibold text-foreground transition-colors"
                      >
                        {exp.status === 'PAID' ? 'Mark Pending' : 'Mark Paid'}
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete Expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-sm">No expenses found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your filters or record a new expense.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-base">Record New Expense</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Expense Title *</label>
                  <Input
                    placeholder="E.g. Daily Vegetables Stock, Electricity Bill..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-muted/20"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full h-9 rounded-xl border border-border bg-muted/20 px-3 text-xs text-foreground outline-none font-medium"
                    >
                      <option value="Raw Ingredients">Raw Ingredients</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Salaries">Salaries</option>
                      <option value="Packaging">Packaging</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Misc">Misc</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">Amount (₹) *</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-9 text-xs font-mono rounded-xl bg-muted/20"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full h-9 rounded-xl border border-border bg-muted/20 px-3 text-xs text-foreground outline-none font-medium"
                    >
                      <option value="UPI">UPI / GPay</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="NET_BANKING">Net Banking</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full h-9 rounded-xl border border-border bg-muted/20 px-3 text-xs text-foreground outline-none font-medium"
                    >
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Vendor / Payee Name</label>
                  <Input
                    placeholder="E.g. Bharat Gas, Agro Market..."
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-muted/20"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Notes / Description</label>
                  <Input
                    placeholder="Optional remarks or invoice reference..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-muted/20"
                  />
                </div>

                <div className="pt-3 flex gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-10 text-xs rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-10 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/95"
                  >
                    Save Expense Entry
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
