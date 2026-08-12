'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Award,
  Calendar,
  CheckCircle,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  joinedDate: string;
  ltv: number; // Life Time Value
}

const initialCustomers: CustomerItem[] = [
  { id: '1', name: 'Ranveer Bhosale', phone: '9099912383', email: 'ranveer@gmail.com', loyaltyPoints: 420, joinedDate: '2026-01-10', ltv: 342.50 },
  { id: '2', name: 'Amit Kumar Patel', phone: '9876543210', email: 'amit@gmail.com', loyaltyPoints: 180, joinedDate: '2026-03-15', ltv: 128.00 },
  { id: '3', name: 'Suresh Iyer', phone: '9123456789', email: 'suresh@gmail.com', loyaltyPoints: 95, joinedDate: '2026-05-20', ltv: 95.00 },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>(initialCustomers);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New customer inputs
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      toast.error('Please enter name and phone number.');
      return;
    }

    const newCustomer: CustomerItem = {
      id: Math.random().toString(),
      name: newName,
      phone: newPhone,
      email: newEmail || 'N/A',
      loyaltyPoints: 10, // 10 welcome points
      joinedDate: new Date().toISOString().split('T')[0],
      ltv: 0,
    };

    setCustomers([...customers, newCustomer]);
    setShowAddModal(false);
    toast.success(`Customer profile created for ${newName}!`);

    // Reset inputs
    setNewName('');
    setNewPhone('');
    setNewEmail('');
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading">Customer CRM</h2>
          <p className="text-xs text-muted-foreground">
            Manage guest records, order history analytics, and loyalty point milestones.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success('Customer CSV exported.')}
            className="rounded-lg h-9 text-xs px-4 gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="rounded-lg h-9 text-xs px-4 gap-1.5"
          >
            <Plus className="h-4 w-4" /> Register Guest
          </Button>
        </div>
      </div>

      {/* KPI Stats widgets grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Registered Guests</span>
          <div className="flex items-center justify-between mt-2">
            <h4 className="text-2xl font-bold font-heading">{customers.length}</h4>
            <Users className="h-9 w-9 text-primary/10" />
          </div>
        </Card>
        <Card className="p-5 border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Avg Customer Points</span>
          <div className="flex items-center justify-between mt-2">
            <h4 className="text-2xl font-bold font-heading">
              {Math.round(customers.reduce((acc, c) => acc + c.loyaltyPoints, 0) / customers.length)} pts
            </h4>
            <Award className="h-9 w-9 text-success/10" />
          </div>
        </Card>
        <Card className="p-5 border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Estimated LTV Pool</span>
          <div className="flex items-center justify-between mt-2">
            <h4 className="text-2xl font-bold font-heading">
              ${customers.reduce((acc, c) => acc + c.ltv, 0).toFixed(2)}
            </h4>
            <TrendingUp className="h-9 w-9 text-warning/10" />
          </div>
        </Card>
      </div>

      {/* Filters bar */}
      <Card className="p-4 border-border flex items-center gap-3 bg-card">
        <div className="relative flex items-center flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
          <Input
            type="text"
            placeholder="Filter guests by name or phone code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-muted/30 border-border/85"
          />
        </div>
      </Card>

      {/* Guests table card */}
      <Card className="border border-border overflow-hidden rounded-2xl bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold">
                <th className="p-4">Customer Name</th>
                <th className="p-4">Contact Phone</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Loyalty Points</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Lifetime Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-semibold text-foreground">{c.name}</td>
                  <td className="p-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" /> {c.phone}</span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" /> {c.email}</span>
                  </td>
                  <td className="p-4 font-bold text-foreground">
                    <span className="flex items-center gap-1"><Award className="h-4.5 w-4.5 text-yellow-500" /> {c.loyaltyPoints} pts</span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-slate-400" /> {c.joinedDate}</span>
                  </td>
                  <td className="p-4 text-right font-extrabold text-foreground">${c.ltv.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add new customer modal dialog */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border max-w-md w-full rounded-2xl p-6 shadow-2xl relative text-foreground"
          >
            <h3 className="text-base font-bold mb-4 font-heading">Register New Guest Profile</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Guest Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="rounded-lg text-xs bg-muted/20 border-border/85"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="rounded-lg text-xs bg-muted/20 border-border/85"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email Address (Optional)</label>
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. ramesh@gmail.com"
                  type="email"
                  className="rounded-lg text-xs bg-muted/20 border-border/85"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="rounded-lg text-xs">
                  Register Guest
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
