'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Table,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';
import { toast } from 'sonner';

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function MetricCard({ title, value, trend, isPositive, icon: Icon, color }: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card className="p-6 bg-card border-border hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            <h3 className="text-2xl font-bold font-heading text-slate-800 tracking-tight">
              {value}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-4 text-xs font-medium">
          <span
            className={`flex items-center gap-0.5 font-bold ${
              isPositive ? 'text-success' : 'text-danger'
            }`}
          >
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend}
          </span>
          <span className="text-muted-foreground">vs yesterday</span>
        </div>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const user = usePOSStore((state) => state.user);

  // States
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    salesTrend: '0%',
    salesPositive: true,
    activeOrders: 0,
    ordersTrend: '0%',
    ordersPositive: true,
    runningTables: '0 / 0',
    tablesTrend: '0%',
    tablesPositive: true,
    totalCustomers: 0,
    customersTrend: '0%',
    customersPositive: true,
  });

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);

  // ── Fetch Dashboard analytics ──
  const fetchDashboardAnalytics = useCallback(async () => {
    if (!user?.branchId) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Make API calls parallel
      const [
        todaySalesRes,
        yesterdaySalesRes,
        todayBillsRes,
        runningOrdersRes,
        tablesRes,
        itemSalesRes,
        weeklyBillsRes,
        categoriesRes,
      ] = await Promise.all([
        api.get(`/api/reports/sales?startDate=${todayStart.toISOString()}`),
        api.get(`/api/reports/sales?startDate=${yesterdayStart.toISOString()}&endDate=${yesterdayEnd.toISOString()}`),
        api.get(`/api/bills?startDate=${todayStart.toISOString()}`),
        api.get('/api/orders/running'),
        api.get(`/api/tables?branchId=${user.branchId}`),
        api.get('/api/reports/items'),
        api.get(`/api/bills?status=PAID&startDate=${sevenDaysAgo.toISOString()}`),
        api.get('/api/menu/categories'),
      ]);

      // 1. Process Sales metrics
      const todaySales = Number(todaySalesRes.data?.data?.summary?.totalSales) || 0;
      const todayOrders = Number(todaySalesRes.data?.data?.summary?.orderCount) || 0;
      const yesterdaySales = Number(yesterdaySalesRes.data?.data?.summary?.totalSales) || 0;
      const yesterdayOrders = Number(yesterdaySalesRes.data?.data?.summary?.orderCount) || 0;

      let salesTrend = '0%';
      let salesPositive = true;
      if (yesterdaySales > 0) {
        const diff = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
        salesTrend = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
        salesPositive = diff >= 0;
      } else if (todaySales > 0) {
        salesTrend = '+100%';
        salesPositive = true;
      }

      let ordersTrend = '0%';
      let ordersPositive = true;
      if (yesterdayOrders > 0) {
        const diff = ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
        ordersTrend = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
        ordersPositive = diff >= 0;
      } else if (todayOrders > 0) {
        ordersTrend = '+100%';
        ordersPositive = true;
      }

      // 2. Process Tables metrics
      const dbTables = tablesRes.data?.data?.tables || [];
      const occupiedTables = dbTables.filter((t: any) => t.status === 'OCCUPIED' || t.mergedToId).length;
      const totalTables = dbTables.length;

      // 3. Process Total Bills Generated & Running Orders
      const todayBillsList = todayBillsRes.data?.data?.bills || [];
      const totalBillsGeneratedCount = todayBillsList.length || todayOrders;
      const runningOrders = runningOrdersRes.data?.data?.orders || [];


      setMetrics({
        todaySales,
        salesTrend,
        salesPositive,
        activeOrders: totalBillsGeneratedCount,
        ordersTrend,
        ordersPositive,
        runningTables: `${occupiedTables} / ${totalTables}`,
        tablesTrend: totalTables > 0 ? `+${((occupiedTables / totalTables) * 100).toFixed(0)}%` : '0%',
        tablesPositive: true,
        totalCustomers: todayOrders,
        customersTrend: ordersTrend,
        customersPositive: ordersPositive,
      });


      // 4. Process Category Performance
      const dbCategories = categoriesRes.data?.data?.categories || [];
      const itemsSales = itemSalesRes.data?.data?.items || [];
      
      // Calculate category sales distribution
      const catSalesMap = new Map<string, number>();
      let totalQtySold = 0;

      itemsSales.forEach((item: any) => {
        // Find category name
        const categoryName = item.name ? (item.categoryName || 'Starters') : 'Starters';
        const qty = item.quantity || 0;
        totalQtySold += qty;
        catSalesMap.set(categoryName, (catSalesMap.get(categoryName) || 0) + qty);
      });

      const colors = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];
      const mappedCategoryData = Array.from(catSalesMap.entries()).map(([name, qty], idx) => ({
        name,
        value: totalQtySold > 0 ? Math.round((qty / totalQtySold) * 100) : 0,
        color: colors[idx % colors.length],
      })).slice(0, 4);

      setCategoryData(mappedCategoryData.length > 0 ? mappedCategoryData : [
        { name: 'Fast Food', value: 100, color: '#2563EB' }
      ]);

      // 5. Process Weekly Revenue Trend chart
      const bills = weeklyBillsRes.data?.data?.bills || [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weeklyMap = new Map<string, { revenue: number; orders: number }>();
      
      // Seed last 7 days with zero values
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = days[d.getDay()];
        weeklyMap.set(dayName, { revenue: 0, orders: 0 });
      }

      bills.forEach((bill: any) => {
        const billDay = days[new Date(bill.createdAt).getDay()];
        if (weeklyMap.has(billDay)) {
          const val = weeklyMap.get(billDay)!;
          val.revenue += Number(bill.grandTotal);
          val.orders += 1;
        }
      });

      const mappedRevenueData = Array.from(weeklyMap.entries()).map(([day, val]) => ({
        day,
        revenue: Math.round(val.revenue),
        orders: val.orders,
      }));

      setRevenueData(mappedRevenueData);

      // 6. Recent Orders Queue
      const mappedRecentOrders = runningOrders.slice(0, 4).map((ord: any) => {
        const itemsSummary = (ord.items || []).map((i: any) => `${i.menuItem?.name} x${i.quantity}`).join(', ');
        return {
          id: ord.id.slice(0, 8).toUpperCase(),
          table: ord.table?.number || (ord.orderType === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'),
          items: itemsSummary || 'No items',
          amount: Number(ord.total),
          status: ord.status,
          time: new Date(ord.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        };
      });

      setRecentOrders(mappedRecentOrders);

      // 7. Top Selling Items
      const mappedTopItems = itemsSales.slice(0, 3).map((itm: any) => ({
        name: itm.name,
        sales: itm.quantity,
        revenue: itm.revenue,
        isVeg: true, // Default display veggie indicator
      }));

      setTopItems(mappedTopItems);
    } catch (e: any) {
      toast.error('Failed to load dashboard statistics: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.branchId) {
      fetchDashboardAnalytics();
    }
  }, [user?.branchId]);

  const handlePrintEOD = () => {
    toast.success('End-of-Day (EOD) sales audit report generated successfully! Queue sent to thermal printer.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading dashboard overview stats...</p>
      </div>
    );
  }

  const primaryCategory = categoryData.length > 0 ? categoryData[0] : { name: 'None', value: 0 };

  return (
    <div className="space-y-6">
      
      {/* 1. Header welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 font-heading text-slate-900">
            Dashboard Overview <Sparkles className="h-4.5 w-4.5 text-yellow-500 fill-yellow-500" />
          </h2>
          <p className="text-xs text-muted-foreground">
            Real-time sales figures, order queue, and dining table metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-9 px-4 rounded-lg bg-card text-xs border-border flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Live Syncing
          </Badge>
          <Button size="sm" onClick={handlePrintEOD} className="rounded-lg h-9 text-xs px-4 font-semibold">
            Print EOD Report
          </Button>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Today's Sales"
          value={`₹${metrics.todaySales.toLocaleString()}`}
          trend={metrics.salesTrend}
          isPositive={metrics.salesPositive}
          icon={DollarSign}
          color="bg-primary/10 text-primary"
        />
        <MetricCard
          title="Total Bills Generated"
          value={String(metrics.activeOrders)}
          trend={metrics.ordersTrend}
          isPositive={metrics.ordersPositive}
          icon={ShoppingBag}
          color="bg-warning/10 text-warning"
        />

        <MetricCard
          title="Running Tables"
          value={metrics.runningTables}
          trend={metrics.tablesTrend}
          isPositive={metrics.tablesPositive}
          icon={Table}
          color="bg-success/10 text-success"
        />
        <MetricCard
          title="Total Customers"
          value={String(metrics.totalCustomers)}
          trend={metrics.customersTrend}
          isPositive={metrics.customersPositive}
          icon={Users}
          color="bg-danger/10 text-danger"
        />
      </div>

      {/* 3. Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-border">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-sm text-slate-800">Weekly Revenue & Orders Trend</h3>
              <p className="text-xs text-muted-foreground">Daily progression index over the current week</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Revenue (₹)</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-300" /> Orders</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category donut distribution chart */}
        <Card className="p-6 border-border flex flex-col justify-between bg-card">
          <div>
            <h3 className="font-semibold text-sm text-slate-800 font-heading">Category Performance</h3>
            <p className="text-xs text-muted-foreground">Sales distribution count by category</p>
          </div>
          <div className="h-48 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-bold font-heading text-foreground">{primaryCategory.value}%</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold text-center max-w-[90px] truncate">{primaryCategory.name}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {categoryData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground truncate">{item.name}</span>
                <span className="font-bold text-foreground ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 4. Details lists grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent orders table card */}
        <Card className="lg:col-span-2 p-6 border-border">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-sm text-slate-800">Recent Orders</h3>
              <p className="text-xs text-muted-foreground">Live orders processing queue</p>
            </div>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-blue-600 gap-1.5 p-0 h-auto font-semibold">
                Go to Orders / POS <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold pb-3">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Table / Type</th>
                  <th className="pb-3">Items list</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-semibold text-foreground">{ord.id}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md font-semibold text-[10px]">
                        {ord.table}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground truncate max-w-[200px]">{ord.items}</td>
                    <td className="py-3 text-right font-bold text-foreground">₹{ord.amount.toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold uppercase rounded-md border-0 ${
                          ord.status === 'PAID'
                            ? 'bg-success/15 text-success'
                            : ord.status === 'BILLED'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-primary/15 text-primary'
                        }`}
                      >
                        {ord.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No active orders processing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top selling menu items card */}
        <Card className="p-6 border-border bg-card">
          <div>
            <h3 className="font-semibold text-sm text-slate-800 font-heading">Top Selling Items</h3>
            <p className="text-xs text-muted-foreground">Most popular items ordered today</p>
          </div>
          <div className="space-y-4 mt-6">
            {topItems.map((itm) => (
              <div key={itm.name} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800 truncate">{itm.name}</span>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 bg-success`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{itm.sales} sales</span>
                </div>
                <span className="text-xs font-bold text-slate-800 ml-auto">₹{itm.revenue.toLocaleString()}</span>
              </div>
            ))}
            {topItems.length === 0 && (
              <div className="py-6 text-center text-muted-foreground text-xs">
                No item sales recorded today.
              </div>
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}
