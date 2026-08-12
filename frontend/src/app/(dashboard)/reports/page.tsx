'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  FileSpreadsheet,
  Download,
  Calendar,
  Sparkles,
  BarChart2,
  DollarSign,
  PieChart as PieIcon,
  Percent,
  RefreshCw,
  Award,
  Receipt,
  ArrowUpRight,
  Utensils,
  Smartphone,
  CreditCard,
  Wallet,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type TimeframeType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface ChartPoint {
  label: string;
  sales: number;
  tax: number;
  profit: number;
  orders: number;
}

interface PaymentDistributionItem {
  name: string;
  value: number;
  count?: number;
  percentage: number;
  color: string;
}

interface PaymentTransaction {
  id: string;
  invoiceNumber: string;
  orderId: string;
  tableLabel: string;
  orderType: string;
  paymentMethod: 'UPI' | 'CASH' | 'CARD' | 'WALLET' | string;
  amount: number;
  createdAt: string;
}

interface WaiterPerformanceItem {
  name: string;
  sales: number;
  count: number;
}

interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

interface ReportData {
  timeframe: TimeframeType;
  startDate: string;
  endDate: string;
  summary: {
    totalSales: number;
    totalTax: number;
    totalSubtotal: number;
    totalDiscount: number;
    totalExpenses: number;
    netProfit: number;
    orderCount: number;
    avgOrderValue: number;
    paymentBreakdown?: {
      upi: { amount: number; count: number };
      cash: { amount: number; count: number };
      card: { amount: number; count: number };
      wallet: { amount: number; count: number };
    };
  };
  chartData: ChartPoint[];
  paymentDistribution: PaymentDistributionItem[];
  paymentTransactions?: PaymentTransaction[];
  waiterPerformance: WaiterPerformanceItem[];
}

export default function ReportsPage() {
  const [timeframe, setTimeframe] = useState<TimeframeType>('MONTHLY');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [gstSummary, setGstSummary] = useState<{ totalTaxCollected: number; cgst: number; sgst: number; totalRevenue: number; billCount: number } | null>(null);

  // Active payment filter for transaction table
  const [selectedPayFilter, setSelectedPayFilter] = useState<'ALL' | 'UPI' | 'CASH' | 'CARD' | 'WALLET'>('ALL');

  // Fetch report analytics for selected timeframe
  const fetchReport = useCallback(async (tf: TimeframeType) => {
    setLoading(true);
    try {
      const [salesRes, itemsRes, gstRes] = await Promise.all([
        api.get(`/api/reports/sales?timeframe=${tf}`).catch(() => ({ data: null })),
        api.get(`/api/reports/items?timeframe=${tf}`).catch(() => ({ data: null })),
        api.get(`/api/reports/gst?timeframe=${tf}`).catch(() => ({ data: null })),
      ]);

      if (salesRes.data?.data) {
        setReportData(salesRes.data.data);
      }
      if (itemsRes.data?.data?.items) {
        setTopItems(itemsRes.data.data.items);
      }
      if (gstRes.data?.data?.gstSummary) {
        setGstSummary(gstRes.data.data.gstSummary);
      }
    } catch (e: any) {
      toast.error('Failed to load report analytics: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(timeframe);
  }, [timeframe, fetchReport]);

  // Export to CSV Spreadsheet
  const handleExportCSV = () => {
    if (!reportData) return;
    const summary = reportData.summary;
    let csvContent = `data:text/csv;charset=utf-8,`;
    csvContent += `Reporting Range,${timeframe}\n`;
    csvContent += `Start Date,${new Date(reportData.startDate).toLocaleString()}\n`;
    csvContent += `End Date,${new Date(reportData.endDate).toLocaleString()}\n\n`;
    csvContent += `Total Sales (INR),${summary.totalSales.toFixed(2)}\n`;
    csvContent += `Total Tax GST (INR),${summary.totalTax.toFixed(2)}\n`;
    csvContent += `Net Profit (INR),${summary.netProfit.toFixed(2)}\n`;
    csvContent += `UPI Total (INR),${summary.paymentBreakdown?.upi.amount || 0}\n`;
    csvContent += `Cash Total (INR),${summary.paymentBreakdown?.cash.amount || 0}\n`;
    csvContent += `Card Total (INR),${summary.paymentBreakdown?.card.amount || 0}\n`;
    csvContent += `Wallet Total (INR),${summary.paymentBreakdown?.wallet.amount || 0}\n\n`;

    csvContent += `Invoice #,Table / Order,Payment Method,Amount (INR),Date\n`;
    (reportData.paymentTransactions || []).forEach((tx) => {
      csvContent += `${tx.invoiceNumber},${tx.tableLabel},${tx.paymentMethod},${tx.amount},${new Date(tx.createdAt).toLocaleString()}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_report_${timeframe.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${timeframe} CSV Report exported successfully!`, { icon: '📊' });
  };

  const handleExportPDF = () => {
    window.print();
    toast.success('Triggered printable report document view!');
  };

  const timeframeLabels: Record<TimeframeType, string> = {
    DAILY: 'Daily (Today)',
    WEEKLY: 'Weekly (Last 7 Days)',
    MONTHLY: 'Monthly (This Month)',
    QUARTERLY: 'Quarterly (Current Qtr)',
    YEARLY: 'Yearly (Annual)',
  };

  const summary = reportData?.summary || {
    totalSales: 0,
    totalTax: 0,
    totalSubtotal: 0,
    totalDiscount: 0,
    totalExpenses: 0,
    netProfit: 0,
    orderCount: 0,
    avgOrderValue: 0,
    paymentBreakdown: {
      upi: { amount: 0, count: 0 },
      cash: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      wallet: { amount: 0, count: 0 },
    },
  };

  const chartData = reportData?.chartData || [];
  const paymentDist = reportData?.paymentDistribution || [];
  const transactions = reportData?.paymentTransactions || [];
  const waiterPerf = reportData?.waiterPerformance || [];

  const filteredTransactions = transactions.filter((tx) => {
    if (selectedPayFilter === 'ALL') return true;
    return tx.paymentMethod.toUpperCase() === selectedPayFilter;
  });

  const payBreakdown = summary.paymentBreakdown || {
    upi: { amount: 0, count: 0 },
    cash: { amount: 0, count: 0 },
    card: { amount: 0, count: 0 },
    wallet: { amount: 0, count: 0 },
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" /> Reports & Revenue Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time financial performance, tax audits, waiter leaderboards, and menu item breakdown.
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReport(timeframe)}
            className="rounded-xl h-9 text-xs px-3 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl h-9 text-xs px-3.5 gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="rounded-xl h-9 text-xs px-3.5 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ─── TIMEFRAME SELECTOR HEADER (Daily, Weekly, Monthly, Quarterly, Yearly) ─── */}
      <Card className="p-4 border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card shadow-sm rounded-2xl">
        <div className="flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-primary" />
          <div>
            <span className="text-xs font-bold text-foreground">
              Reporting Range: <span className="text-primary">{timeframeLabels[timeframe]}</span>
            </span>
            {reportData && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(reportData.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} -{' '}
                {new Date(reportData.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* 5 Timeframe Buttons */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border flex-wrap">
          {(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === t
                  ? 'bg-card text-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {/* ─── SEPARATE PAYMENT METHOD METRICS CARDS (UPI, Cash, Card, Wallet) ─── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-primary" /> Payment Method Breakdown ({timeframe})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* UPI Card */}
          <Card className="p-4 border-border bg-gradient-to-br from-blue-500/5 to-transparent shadow-sm rounded-2xl space-y-2 border-l-4 border-l-blue-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-blue-600" /> UPI Transactions
              </span>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-transparent font-bold">
                {payBreakdown.upi.count} Orders
              </Badge>
            </div>
            <h3 className="text-2xl font-bold font-mono text-foreground">
              ₹{payBreakdown.upi.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Google Pay, PhonePe, Paytm, BHIM UPI
            </p>
          </Card>

          {/* Cash Card */}
          <Card className="p-4 border-border bg-gradient-to-br from-emerald-500/5 to-transparent shadow-sm rounded-2xl space-y-2 border-l-4 border-l-emerald-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-emerald-600" /> Cash Transactions
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-transparent font-bold">
                {payBreakdown.cash.count} Orders
              </Badge>
            </div>
            <h3 className="text-2xl font-bold font-mono text-foreground">
              ₹{payBreakdown.cash.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Cash register collected money
            </p>
          </Card>

          {/* Card Card */}
          <Card className="p-4 border-border bg-gradient-to-br from-amber-500/5 to-transparent shadow-sm rounded-2xl space-y-2 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-amber-500" /> Card (POS Terminal)
              </span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-transparent font-bold">
                {payBreakdown.card.count} Orders
              </Badge>
            </div>
            <h3 className="text-2xl font-bold font-mono text-foreground">
              ₹{payBreakdown.card.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Debit & Credit POS swipe transactions
            </p>
          </Card>

          {/* Wallet Card */}
          <Card className="p-4 border-border bg-gradient-to-br from-purple-500/5 to-transparent shadow-sm rounded-2xl space-y-2 border-l-4 border-l-purple-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-purple-600" /> Wallet / Food Pass
              </span>
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 border-transparent font-bold">
                {payBreakdown.wallet.count} Orders
              </Badge>
            </div>
            <h3 className="text-2xl font-bold font-mono text-foreground">
              ₹{payBreakdown.wallet.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Sodexo, Edenred, Store credit wallets
            </p>
          </Card>
        </div>
      </div>

      {/* ─── PRIMARY REVENUE & PAYMENT CHARTS GRID ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue progress Line Chart */}
        <Card className="lg:col-span-2 p-6 border-border bg-card shadow-sm rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base font-heading">
                Revenue & Profit Trend ({timeframeLabels[timeframe]})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparison of Gross Sales vs Net Profits over time
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-bold bg-primary/5 text-primary border-primary/20">
              {timeframe}
            </Badge>
          </div>

          <div className="h-72 w-full mt-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="h-8 w-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-muted-foreground">Generating analytics chart...</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                No orders recorded for this timeframe
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={3} name="Gross Sales (₹)" activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} name="Net Profit (₹)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Payment mode donut distribution chart */}
        <Card className="p-6 border-border bg-card shadow-sm rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-base font-heading">Payment Gateway Mix</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Percentage breakdown by payment gateway ({timeframe})
            </p>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center">
            {paymentDist.length === 0 || summary.totalSales === 0 ? (
              <div className="text-xs text-muted-foreground flex flex-col items-center justify-center">
                <PieIcon className="h-10 w-10 opacity-20 mb-2" />
                No payment data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            {paymentDist.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{item.percentage}%</span>
                  <span className="font-bold text-foreground font-mono">
                    ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ─── PAYMENT TRANSACTIONS LOG (UPI, Cash, Card Filterable Table) ────── */}
      <Card className="p-6 border-border bg-card shadow-sm rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="font-bold text-base font-heading flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Payment Transactions Audit Log
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Filter and review individual UPI, Cash, Card, and Wallet payment entries separately.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border flex-wrap">
            {(['ALL', 'UPI', 'CASH', 'CARD', 'WALLET'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedPayFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedPayFilter === mode
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'ALL' ? 'All' : mode}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Table / Order</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No transactions found for filter: <span className="font-bold text-foreground">{selectedPayFilter}</span>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">{tx.invoiceNumber}</td>
                    <td className="py-3 px-4 text-muted-foreground">{tx.tableLabel}</td>
                    <td className="py-3 px-4">
                      {tx.paymentMethod === 'UPI' && (
                        <Badge className="bg-blue-500/10 text-blue-700 border-transparent font-bold text-[10px]">
                          📱 UPI
                        </Badge>
                      )}
                      {tx.paymentMethod === 'CASH' && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-transparent font-bold text-[10px]">
                          💵 CASH
                        </Badge>
                      )}
                      {tx.paymentMethod === 'CARD' && (
                        <Badge className="bg-amber-500/10 text-amber-700 border-transparent font-bold text-[10px]">
                          💳 CARD
                        </Badge>
                      )}
                      {tx.paymentMethod === 'WALLET' && (
                        <Badge className="bg-purple-500/10 text-purple-700 border-transparent font-bold text-[10px]">
                          👛 WALLET
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── SECONDARY ANALYTICS GRID: TOP ITEMS & LEADERBOARD & GST ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Menu Items */}
        <Card className="p-6 border-border bg-card shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Utensils className="h-4 w-4 text-orange-500" /> Top Selling Items
              </h3>
              <p className="text-[11px] text-muted-foreground">Most ordered dishes in this range</p>
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">{topItems.length} items</span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {topItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No item sales recorded</p>
            ) : (
              topItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-lg bg-orange-500/10 text-orange-600 font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.quantity} portions sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-foreground">
                    ₹{item.revenue.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Waiter Leaderboard */}
        <Card className="p-6 border-border bg-card shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-500" /> Captain Sales Leaderboard
              </h3>
              <p className="text-[11px] text-muted-foreground">Sales handled by staff in {timeframe}</p>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {waiterPerf.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No captain transactions logged</p>
            ) : (
              waiterPerf.map((w, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{w.name}</p>
                    <p className="text-[10px] text-muted-foreground">{w.count} orders fulfilled</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono text-foreground">
                      ₹{w.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* GST Audit & Tax Summary Card */}
        <Card className="p-6 border-border bg-card shadow-sm rounded-2xl space-y-4">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-emerald-600" /> GST Tax Audit Summary
            </h3>
            <p className="text-[11px] text-muted-foreground">Accounting breakdown for SGST & CGST returns</p>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <span className="text-xs text-muted-foreground">CGST (2.5%)</span>
              <span className="text-xs font-bold font-mono text-foreground">
                ₹{((gstSummary?.cgst || summary.totalTax / 2) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <span className="text-xs text-muted-foreground">SGST (2.5%)</span>
              <span className="text-xs font-bold font-mono text-foreground">
                ₹{((gstSummary?.sgst || summary.totalTax / 2) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300">
              <span className="text-xs font-bold">Total GST Collected</span>
              <span className="text-xs font-black font-mono">
                ₹{summary.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-[11px] text-blue-800 dark:text-blue-300">
            ℹ️ Compliant with 5% flat GST norms. Detailed invoice tax logs are stored under Billing records.
          </div>
        </Card>
      </div>
    </div>
  );
}


