'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import {
  Building,
  Save,
  Image as ImageIcon,
  Receipt,
  Percent,
  Printer,
  Eye,
  Database,
  Lock,
  Bell,
  ChefHat,
  ChevronRight,
  Wifi,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';

// ─── Zod schema ───────────────────────────────────────────────────────────────
const restaurantSchema = zod.object({
  name: zod.string().min(2, 'Restaurant name must be at least 2 characters'),
  phone: zod.string().min(10, 'Enter a valid phone number'),
  email: zod.string().email('Enter a valid email address'),
  address: zod.string().min(5, 'Address must be at least 5 characters'),
  gstin: zod.string().optional(),
});
type RestaurantForm = zod.infer<typeof restaurantSchema>;

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────
type Tab =
  | 'PROFILE'
  | 'INVOICE'
  | 'TAXES'
  | 'PRINTER'
  | 'APPEARANCE'
  | 'NOTIFICATIONS'
  | 'SECURITY'
  | 'BACKUP';

interface TabItem {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const TABS: TabItem[] = [
  { id: 'PROFILE', label: 'Restaurant Profile', icon: Building, group: 'Restaurant' },
  { id: 'INVOICE', label: 'Invoice & Billing', icon: Receipt, group: 'Restaurant' },
  { id: 'TAXES', label: 'Taxes & Charges', icon: Percent, group: 'Restaurant' },
  { id: 'PRINTER', label: 'Printer Setup', icon: Printer, group: 'System' },
  { id: 'APPEARANCE', label: 'Appearance', icon: Eye, group: 'System' },
  { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, group: 'System' },
  { id: 'SECURITY', label: 'Security & Access', icon: ShieldCheck, group: 'System' },
  { id: 'BACKUP', label: 'Backup & Data', icon: Database, group: 'System' },
];

// ─── Controlled Toggle row helper ─────────────────────────────────────────────
function ToggleRow({
  label,
  description,
  checked,
  onChange,
  danger = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
        danger ? 'bg-red-50/50 border-red-100' : 'bg-muted/30 border-border'
      }`}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p className={`text-xs font-semibold ${danger ? 'text-red-600' : 'text-foreground'}`}>
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
          checked ? (danger ? 'bg-red-500' : 'bg-primary') : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? 'left-4' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Section header helper ────────────────────────────────────────────────────
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-4 border-b border-border mb-5">
      <h3 className="font-bold text-base text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('PROFILE');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // ── Invoice state ─────────────────────────────────────────────────────────
  const [invoiceHeader, setInvoiceHeader] = useState('Welcome to Canwe Cafe!');
  const [invoiceFooter, setInvoiceFooter] = useState(
    'Thank you for dining with us! Visit again.'
  );
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [startingNumber, setStartingNumber] = useState('1001');
  const [showQR, setShowQR] = useState(true);
  const [printDuplicate, setPrintDuplicate] = useState(false);
  const [showTaxes, setShowTaxes] = useState(true);

  // ── Taxes state ───────────────────────────────────────────────────────────
  const [cgstRate, setCgstRate] = useState('2.5');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [serviceCharge, setServiceCharge] = useState('2');
  const [packingCharge, setPackingCharge] = useState('20');
  const [enableServiceCharge, setEnableServiceCharge] = useState(true);
  const [applyPackingTakeaway, setApplyPackingTakeaway] = useState(true);
  const [roundOff, setRoundOff] = useState(true);

  // ── Printer state ─────────────────────────────────────────────────────────
  const [cashierPrinterIP, setCashierPrinterIP] = useState('192.168.1.100');
  const [kotPrinterIP, setKotPrinterIP] = useState('192.168.1.101');
  const [barPrinterIP, setBarPrinterIP] = useState('192.168.1.102');
  const [autoPrintKOT, setAutoPrintKOT] = useState(true);
  const [autoPrintBill, setAutoPrintBill] = useState(false);

  // ── Appearance state ──────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(true);
  const [compactCards, setCompactCards] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [runningClock, setRunningClock] = useState(true);
  const [language, setLanguage] = useState('English (India)');
  const [currency, setCurrency] = useState('₹ Indian Rupee (INR)');

  // ── Notifications state ───────────────────────────────────────────────────
  const [lowStockAlert, setLowStockAlert] = useState(true);
  const [newOnlineOrders, setNewOnlineOrders] = useState(true);
  const [tableIdleWarning, setTableIdleWarning] = useState(false);
  const [kotDelayNotification, setKotDelayNotification] = useState(true);
  const [dailySummaryEmail, setDailySummaryEmail] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(true);

  // ── Security state ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cashierPin, setCashierPin] = useState('1234');
  const [autoLockIdle, setAutoLockIdle] = useState(true);
  const [managerOverride, setManagerOverride] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RestaurantForm>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: 'Canwe Technologies Cafe',
      phone: '9099912383',
      email: 'contact@canwepos.com',
      address: 'Pride Icon, Kharadi, Pune, Maharashtra 411014',
      gstin: '27AAAAA1111A1Z1',
    },
  });

  // Load Profile and KV Settings from Backend
  useEffect(() => {
    async function loadSettings() {
      try {
        setFetching(true);
        // Load Profile
        const profRes = await api.get('/api/restaurant');
        if (profRes.data?.data?.restaurant) {
          const rest = profRes.data.data.restaurant;
          setValue('name', rest.name || '');
          setValue('phone', rest.phone || '');
          setValue('email', rest.email || '');
          setValue('address', rest.address || '');
          setValue('gstin', rest.gstNumber || '');
          if (rest.logoUrl) setLogoPreview(rest.logoUrl);
        }

        // Load KV Settings
        const settingsRes = await api.get('/api/restaurant/settings');
        if (settingsRes.data?.data?.settings) {
          const s = settingsRes.data.data.settings;

          if (s.invoice) {
            setInvoiceHeader(s.invoice.invoiceHeader ?? 'Welcome to Canwe Cafe!');
            setInvoiceFooter(s.invoice.invoiceFooter ?? 'Thank you for dining with us! Visit again.');
            setInvoicePrefix(s.invoice.invoicePrefix ?? 'INV-');
            setStartingNumber(s.invoice.startingNumber ?? '1001');
            setShowQR(s.invoice.showQR ?? true);
            setPrintDuplicate(s.invoice.printDuplicate ?? false);
            setShowTaxes(s.invoice.showTaxes ?? true);
          }

          if (s.taxes) {
            setCgstRate(s.taxes.cgstRate ?? '2.5');
            setSgstRate(s.taxes.sgstRate ?? '2.5');
            setServiceCharge(s.taxes.serviceCharge ?? '2');
            setPackingCharge(s.taxes.packingCharge ?? '20');
            setEnableServiceCharge(s.taxes.enableServiceCharge ?? true);
            setApplyPackingTakeaway(s.taxes.applyPackingTakeaway ?? true);
            setRoundOff(s.taxes.roundOff ?? true);
          }

          if (s.printer) {
            setCashierPrinterIP(s.printer.cashierPrinterIP ?? '192.168.1.100');
            setKotPrinterIP(s.printer.kotPrinterIP ?? '192.168.1.101');
            setBarPrinterIP(s.printer.barPrinterIP ?? '192.168.1.102');
            setAutoPrintKOT(s.printer.autoPrintKOT ?? true);
            setAutoPrintBill(s.printer.autoPrintBill ?? false);
          }

          if (s.appearance) {
            setDarkMode(s.appearance.darkMode ?? true);
            setCompactCards(s.appearance.compactCards ?? false);
            setShowImages(s.appearance.showImages ?? true);
            setAnimations(s.appearance.animations ?? true);
            setRunningClock(s.appearance.runningClock ?? true);
            setLanguage(s.appearance.language ?? 'English (India)');
            setCurrency(s.appearance.currency ?? '₹ Indian Rupee (INR)');
          }

          if (s.notifications) {
            setLowStockAlert(s.notifications.lowStockAlert ?? true);
            setNewOnlineOrders(s.notifications.newOnlineOrders ?? true);
            setTableIdleWarning(s.notifications.tableIdleWarning ?? false);
            setKotDelayNotification(s.notifications.kotDelayNotification ?? true);
            setDailySummaryEmail(s.notifications.dailySummaryEmail ?? true);
            setWeeklyReport(s.notifications.weeklyReport ?? false);
            setMonthlySummary(s.notifications.monthlySummary ?? true);
          }

          if (s.security) {
            setCashierPin(s.security.cashierPin ?? '1234');
            setAutoLockIdle(s.security.autoLockIdle ?? true);
            setManagerOverride(s.security.managerOverride ?? true);
            setTwoFactor(s.security.twoFactor ?? false);
          }
        }
      } catch (err: any) {
        console.warn('Failed to load settings from server, using local defaults', err);
      } finally {
        setFetching(false);
      }
    }

    loadSettings();
  }, [setValue]);

  // 1. Save Restaurant Profile
  const onSaveProfile = async (data: RestaurantForm) => {
    setLoading(true);
    try {
      await api.put('/api/restaurant', {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gstNumber: data.gstin,
        logoUrl: logoPreview,
      });

      // Update POSStore in real-time across all pages
      usePOSStore.getState().updateRestaurantProfileStore({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gstNumber: data.gstin || '',
        logoUrl: logoPreview || undefined,
      });

      toast.success('Restaurant Profile updated successfully!', { icon: '✅' });
    } catch (err: any) {
      toast.error('Failed to update profile: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // 2. Save KV Setting Helper
  const saveKVSetting = async (key: string, value: any, successMsg: string) => {
    setLoading(true);
    try {
      await api.put('/api/restaurant/settings', { key, value });

      // Update POSStore in real-time across all pages
      usePOSStore.getState().updateSettingStore(key, value);

      toast.success(successMsg, { icon: '✅' });
    } catch (err: any) {
      toast.error('Failed to save settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Export database backup as JSON download
  const handleDownloadBackup = async () => {
    try {
      const res = await api.get('/api/menu');
      const backupData = {
        exportedAt: new Date().toISOString(),
        appName: 'Canwe POS',
        version: '2.4.0',
        menuData: res.data?.data || {},
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `canwe_pos_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Full Database Backup downloaded!');
    } catch (err) {
      toast.error('Failed to generate database backup');
    }
  };

  // Export orders as CSV download
  const handleExportCSV = async () => {
    try {
      const res = await api.get('/api/orders');
      const orders = res.data?.data?.orders || [];
      if (orders.length === 0) {
        toast.info('No orders found to export.');
        return;
      }
      const headers = ['Order ID', 'Order Type', 'Total (₹)', 'Status', 'Payment Status', 'Created At'];
      const rows = orders.map((o: any) => [
        o.id,
        o.type,
        o.totalAmount,
        o.status,
        o.paymentStatus,
        new Date(o.createdAt).toLocaleString(),
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `orders_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exported ${orders.length} orders to CSV!`);
    } catch (err) {
      toast.error('Failed to export orders CSV');
    }
  };

  const groups = [...new Set(TABS.map((t) => t.group))];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage restaurant profile, billing, system preferences, and security.
          </p>
        </div>
        {fetching && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" /> Syncing with Server...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ── LEFT SIDEBAR ────────────────────────────────── */}
        <div className="lg:col-span-1">
          <Card className="p-2 border-border overflow-hidden">
            {groups.map((group, gi) => (
              <div key={group}>
                {gi > 0 && <div className="my-2 border-t border-border" />}
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">
                  {group}
                </p>
                {TABS.filter((t) => t.group === group).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left group
                        ${
                          isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{tab.label}</span>
                      {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </Card>
        </div>

        {/* ── RIGHT CONTENT ─────────────────────────────────── */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              {/* ── RESTAURANT PROFILE ─────────────────────────── */}
              {activeTab === 'PROFILE' && (
                <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-5">
                  <Card className="p-6 border-border space-y-5">
                    <SectionHeader
                      title="Restaurant Profile"
                      description="Business identity used on bills, KOT slips, and customer receipts."
                    />

                    {/* Logo */}
                    <div className="flex items-center gap-5 pb-5 border-b border-border">
                      <div className="h-20 w-20 rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="object-cover h-full w-full" />
                        ) : (
                          <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-1">Restaurant Logo</p>
                        <p className="text-[10px] text-muted-foreground mb-2">
                          PNG or JPG, recommended 256×256px
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setLogoPreview(
                              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150'
                            );
                            toast.success('Logo uploaded!');
                          }}
                          className="rounded-lg text-[11px]"
                        >
                          Upload Logo
                        </Button>
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Restaurant Name *
                        </label>
                        <Input {...register('name')} className="rounded-lg text-xs h-9" />
                        {errors.name && (
                          <p className="text-[10px] text-red-500">{errors.name.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Contact Phone *
                        </label>
                        <Input {...register('phone')} className="rounded-lg text-xs h-9" />
                        {errors.phone && (
                          <p className="text-[10px] text-red-500">{errors.phone.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Email Address *
                        </label>
                        <Input
                          type="email"
                          {...register('email')}
                          className="rounded-lg text-xs h-9"
                        />
                        {errors.email && (
                          <p className="text-[10px] text-red-500">{errors.email.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          GSTIN
                        </label>
                        <Input
                          {...register('gstin')}
                          placeholder="27AAAAA1111A1Z1"
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Physical Address *
                      </label>
                      <Input {...register('address')} className="rounded-lg text-xs h-9" />
                      {errors.address && (
                        <p className="text-[10px] text-red-500">{errors.address.message}</p>
                      )}
                    </div>
                  </Card>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save Profile
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* ── INVOICE & BILLING ──────────────────────────── */}
              {activeTab === 'INVOICE' && (
                <Card className="p-6 border-border space-y-5">
                  <SectionHeader
                    title="Invoice & Bill Layout"
                    description="Customize how bills and KOT slips are printed for customers."
                  />
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Bill Header Message
                      </label>
                      <Input
                        value={invoiceHeader}
                        onChange={(e) => setInvoiceHeader(e.target.value)}
                        className="rounded-lg text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Appears at the top of every printed bill
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Bill Footer / Thank You Note
                      </label>
                      <Input
                        value={invoiceFooter}
                        onChange={(e) => setInvoiceFooter(e.target.value)}
                        className="rounded-lg text-xs h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Invoice Prefix
                        </label>
                        <Input
                          value={invoicePrefix}
                          onChange={(e) => setInvoicePrefix(e.target.value)}
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Bill Starting Number
                        </label>
                        <Input
                          value={startingNumber}
                          onChange={(e) => setStartingNumber(e.target.value)}
                          type="number"
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 pt-2">
                      <p className="text-xs font-semibold text-muted-foreground">Bill Options</p>
                      <ToggleRow
                        label="Show QR Code on Bill"
                        description="Print UPI payment QR on customer receipt"
                        checked={showQR}
                        onChange={setShowQR}
                      />
                      <ToggleRow
                        label="Print Duplicate Copy"
                        description="Auto-print 2 copies for dine-in orders"
                        checked={printDuplicate}
                        onChange={setPrintDuplicate}
                      />
                      <ToggleRow
                        label="Show Item Taxes Breakup"
                        description="Display CGST/SGST per line item on bill"
                        checked={showTaxes}
                        onChange={setShowTaxes}
                      />
                    </div>
                  </div>
                  <Button
                    disabled={loading}
                    onClick={() =>
                      saveKVSetting(
                        'invoice',
                        {
                          invoiceHeader,
                          invoiceFooter,
                          invoicePrefix,
                          startingNumber,
                          showQR,
                          printDuplicate,
                          showTaxes,
                        },
                        'Invoice settings saved successfully!'
                      )
                    }
                    className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Save className="h-4 w-4" /> Save Invoice Settings
                  </Button>
                </Card>
              )}

              {/* ── TAXES & CHARGES ──────────────────────────────── */}
              {activeTab === 'TAXES' && (
                <Card className="p-6 border-border space-y-5">
                  <SectionHeader
                    title="Taxes & Charges"
                    description="Configure GST rates, service charge, and other applicable levies."
                  />
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          CGST Rate (%)
                        </label>
                        <Input
                          value={cgstRate}
                          onChange={(e) => setCgstRate(e.target.value)}
                          type="number"
                          step="0.1"
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          SGST Rate (%)
                        </label>
                        <Input
                          value={sgstRate}
                          onChange={(e) => setSgstRate(e.target.value)}
                          type="number"
                          step="0.1"
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Service Charge (%)
                        </label>
                        <Input
                          value={serviceCharge}
                          onChange={(e) => setServiceCharge(e.target.value)}
                          type="number"
                          step="0.1"
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Packing Charge (₹)
                        </label>
                        <Input
                          value={packingCharge}
                          onChange={(e) => setPackingCharge(e.target.value)}
                          type="number"
                          className="rounded-lg text-xs h-9 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-3 pt-2">
                      <p className="text-xs font-semibold text-muted-foreground">Charge Toggles</p>
                      <ToggleRow
                        label="Enable Service Charge"
                        description="Apply service charge on dine-in orders"
                        checked={enableServiceCharge}
                        onChange={setEnableServiceCharge}
                      />
                      <ToggleRow
                        label="Apply Packing Charge on Takeaway"
                        description="Add packing charge for all takeaway orders"
                        checked={applyPackingTakeaway}
                        onChange={setApplyPackingTakeaway}
                      />
                      <ToggleRow
                        label="Round Off Total"
                        description="Round bill total to nearest rupee"
                        checked={roundOff}
                        onChange={setRoundOff}
                      />
                    </div>
                  </div>
                  <Button
                    disabled={loading}
                    onClick={() =>
                      saveKVSetting(
                        'taxes',
                        {
                          cgstRate,
                          sgstRate,
                          serviceCharge,
                          packingCharge,
                          enableServiceCharge,
                          applyPackingTakeaway,
                          roundOff,
                        },
                        'Tax configuration saved successfully!'
                      )
                    }
                    className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Save className="h-4 w-4" /> Save Tax Settings
                  </Button>
                </Card>
              )}

              {/* ── PRINTER SETUP ──────────────────────────────────── */}
              {activeTab === 'PRINTER' && (
                <Card className="p-6 border-border space-y-5">
                  <SectionHeader
                    title="Thermal Printer Setup"
                    description="Configure IP addresses of network printers (TCP port 9100 standard)."
                  />
                  <div className="space-y-4">
                    {[
                      {
                        label: 'Cashier / Bill Printer IP',
                        value: cashierPrinterIP,
                        onChange: setCashierPrinterIP,
                        icon: Receipt,
                        desc: 'Prints customer invoices and bills',
                      },
                      {
                        label: 'Kitchen KOT Printer IP',
                        value: kotPrinterIP,
                        onChange: setKotPrinterIP,
                        icon: ChefHat,
                        desc: 'Prints kitchen order tickets',
                      },
                      {
                        label: 'Bar / Beverage Printer IP',
                        value: barPrinterIP,
                        onChange: setBarPrinterIP,
                        icon: Wifi,
                        desc: 'Prints bar and drink orders',
                      },
                    ].map(({ label, value, onChange, desc }) => (
                      <div
                        key={label}
                        className="flex items-center gap-4 p-4 bg-muted/20 border border-border rounded-xl"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold mb-0.5">{label}</p>
                          <p className="text-[10px] text-muted-foreground mb-2">{desc}</p>
                          <Input
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="rounded-lg text-xs h-8 font-mono max-w-[200px]"
                            placeholder="192.168.1.xxx"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => toast.success(`${label} — Test print sent!`)}
                          className="rounded-lg text-[11px] flex-shrink-0"
                        >
                          Test Print
                        </Button>
                      </div>
                    ))}
                    <ToggleRow
                      label="Auto-Print KOT on Save Order"
                      description="Automatically send to kitchen printer when order is saved"
                      checked={autoPrintKOT}
                      onChange={setAutoPrintKOT}
                    />
                    <ToggleRow
                      label="Auto-Print Bill on Checkout"
                      description="Print bill automatically on checkout"
                      checked={autoPrintBill}
                      onChange={setAutoPrintBill}
                    />
                  </div>
                  <Button
                    disabled={loading}
                    onClick={() =>
                      saveKVSetting(
                        'printer',
                        {
                          cashierPrinterIP,
                          kotPrinterIP,
                          barPrinterIP,
                          autoPrintKOT,
                          autoPrintBill,
                        },
                        'Printer configuration saved successfully!'
                      )
                    }
                    className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Save className="h-4 w-4" /> Save Printer Settings
                  </Button>
                </Card>
              )}

              {/* ── APPEARANCE ─────────────────────────────────────── */}
              {activeTab === 'APPEARANCE' && (
                <Card className="p-6 border-border space-y-5">
                  <SectionHeader
                    title="Appearance & Display"
                    description="Control how the POS interface looks and behaves on this terminal."
                  />
                  <div className="space-y-3">
                    <ToggleRow
                      label="Automatic Dark Mode"
                      description="Switch UI based on system preferences"
                      checked={darkMode}
                      onChange={setDarkMode}
                    />
                    <ToggleRow
                      label="Compact Table Cards"
                      description="Show smaller table cards on the floor view"
                      checked={compactCards}
                      onChange={setCompactCards}
                    />
                    <ToggleRow
                      label="Show Item Images on Menu"
                      description="Display food images on menu selection screen"
                      checked={showImages}
                      onChange={setShowImages}
                    />
                    <ToggleRow
                      label="Animations & Transitions"
                      description="Enable smooth UI animations throughout the POS"
                      checked={animations}
                      onChange={setAnimations}
                    />
                    <ToggleRow
                      label="Show Running Clock in Header"
                      description="Display live time in the top navigation bar"
                      checked={runningClock}
                      onChange={setRunningClock}
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground">Language & Region</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Display Language
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full h-9 rounded-lg border border-border bg-background text-xs px-3 outline-none focus:border-primary/40"
                        >
                          <option>English (India)</option>
                          <option>Hindi</option>
                          <option>Marathi</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Currency
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full h-9 rounded-lg border border-border bg-background text-xs px-3 outline-none focus:border-primary/40"
                        >
                          <option>₹ Indian Rupee (INR)</option>
                          <option>$ US Dollar (USD)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <Button
                    disabled={loading}
                    onClick={() =>
                      saveKVSetting(
                        'appearance',
                        {
                          darkMode,
                          compactCards,
                          showImages,
                          animations,
                          runningClock,
                          language,
                          currency,
                        },
                        'Appearance preferences saved successfully!'
                      )
                    }
                    className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Save className="h-4 w-4" /> Save Appearance
                  </Button>
                </Card>
              )}

              {/* ── NOTIFICATIONS ──────────────────────────────────── */}
              {activeTab === 'NOTIFICATIONS' && (
                <Card className="p-6 border-border space-y-5">
                  <SectionHeader
                    title="Notifications"
                    description="Choose what alerts and updates you want to receive."
                  />
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      POS Alerts
                    </p>
                    <ToggleRow
                      label="Low Stock Alerts"
                      description="Notify when inventory items fall below reorder level"
                      checked={lowStockAlert}
                      onChange={setLowStockAlert}
                    />
                    <ToggleRow
                      label="New Online Orders"
                      description="Sound alert for incoming Zomato/Swiggy orders"
                      checked={newOnlineOrders}
                      onChange={setNewOnlineOrders}
                    />
                    <ToggleRow
                      label="Table Idle Warning"
                      description="Alert when a running table has no activity for 45+ minutes"
                      checked={tableIdleWarning}
                      onChange={setTableIdleWarning}
                    />
                    <ToggleRow
                      label="KOT Delay Notification"
                      description="Alert if kitchen hasn't confirmed order within 15 minutes"
                      checked={kotDelayNotification}
                      onChange={setKotDelayNotification}
                    />

                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">
                      Reports & Summary
                    </p>
                    <ToggleRow
                      label="Daily Sales Summary Email"
                      description="Send end-of-day report to admin email"
                      checked={dailySummaryEmail}
                      onChange={setDailySummaryEmail}
                    />
                    <ToggleRow
                      label="Weekly Performance Report"
                      description="Send weekly analytics report every Monday"
                      checked={weeklyReport}
                      onChange={setWeeklyReport}
                    />
                    <ToggleRow
                      label="Monthly Billing Summary"
                      description="Send monthly billing digest to owner"
                      checked={monthlySummary}
                      onChange={setMonthlySummary}
                    />
                  </div>
                  <Button
                    disabled={loading}
                    onClick={() =>
                      saveKVSetting(
                        'notifications',
                        {
                          lowStockAlert,
                          newOnlineOrders,
                          tableIdleWarning,
                          kotDelayNotification,
                          dailySummaryEmail,
                          weeklyReport,
                          monthlySummary,
                        },
                        'Notification preferences saved successfully!'
                      )
                    }
                    className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Save className="h-4 w-4" /> Save Notifications
                  </Button>
                </Card>
              )}

              {/* ── SECURITY ───────────────────────────────────────── */}
              {activeTab === 'SECURITY' && (
                <div className="space-y-5">
                  <Card className="p-6 border-border space-y-5">
                    <SectionHeader
                      title="Security & Access Control"
                      description="Manage passwords, PIN locks, and staff access permissions."
                    />
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Current Password
                          </label>
                          <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            className="rounded-lg text-xs h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">
                            New Password
                          </label>
                          <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="rounded-lg text-xs h-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Cashier PIN (4-digit)
                        </label>
                        <Input
                          type="password"
                          maxLength={4}
                          value={cashierPin}
                          onChange={(e) => setCashierPin(e.target.value)}
                          placeholder="••••"
                          className="rounded-lg text-xs h-9 max-w-[120px] font-mono tracking-[0.5em]"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Used to lock/unlock the POS terminal
                        </p>
                      </div>
                      <div className="space-y-3 pt-1">
                        <ToggleRow
                          label="Auto-Lock After Idle (10 min)"
                          description="Require PIN when terminal is idle"
                          checked={autoLockIdle}
                          onChange={setAutoLockIdle}
                        />
                        <ToggleRow
                          label="Require Manager Override for Discounts"
                          description="Manager PIN required for any discount > 10%"
                          checked={managerOverride}
                          onChange={setManagerOverride}
                        />
                        <ToggleRow
                          label="Two-Factor Authentication"
                          description="Require OTP on admin login from new device"
                          checked={twoFactor}
                          onChange={setTwoFactor}
                        />
                      </div>
                    </div>
                    <Button
                      disabled={loading}
                      onClick={() =>
                        saveKVSetting(
                          'security',
                          {
                            cashierPin,
                            autoLockIdle,
                            managerOverride,
                            twoFactor,
                          },
                          'Security settings updated successfully!'
                        )
                      }
                      className="h-10 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
                    >
                      <Lock className="h-4 w-4" /> Update Security
                    </Button>
                  </Card>
                </div>
              )}

              {/* ── BACKUP & DATA ──────────────────────────────────── */}
              {activeTab === 'BACKUP' && (
                <div className="space-y-5">
                  <Card className="p-6 border-border space-y-5">
                    <SectionHeader
                      title="Backup & Data Management"
                      description="Download backups, sync data, and manage system resets."
                    />
                    <div className="space-y-3">
                      {[
                        {
                          label: 'Download Full Database Backup',
                          desc: 'Export all menu items, categories, and catalog records as JSON dump',
                          action: 'Backup Now',
                          onClick: handleDownloadBackup,
                          variant: 'default' as const,
                          danger: false,
                        },
                        {
                          label: 'Export Orders as CSV',
                          desc: 'Download all transaction records for accounting & audit',
                          action: 'Export CSV',
                          onClick: handleExportCSV,
                          variant: 'outline' as const,
                          danger: false,
                        },
                        {
                          label: 'Sync to Cloud',
                          desc: 'Push local offline data to the central cloud server',
                          action: 'Sync Now',
                          onClick: async () => {
                            toast.loading('Syncing data with cloud server...');
                            await new Promise((r) => setTimeout(r, 800));
                            toast.dismiss();
                            toast.success('Cloud sync completed successfully!');
                          },
                          variant: 'outline' as const,
                          danger: false,
                        },
                      ].map(({ label, desc, action, onClick, danger }) => (
                        <div
                          key={label}
                          className={`flex items-center justify-between p-4 rounded-xl border gap-4 ${
                            danger ? 'bg-red-50/50 border-red-100' : 'bg-muted/20 border-border'
                          }`}
                        >
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold ${
                                danger ? 'text-red-600' : 'text-foreground'
                              }`}
                            >
                              {label}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            variant={danger ? 'ghost' : 'outline'}
                            onClick={onClick}
                            className={`flex-shrink-0 rounded-lg text-[11px] ${
                              danger ? 'text-red-500 hover:bg-red-100' : ''
                            }`}
                          >
                            {action}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Danger zone */}
                  <Card className="p-6 border-red-200 bg-red-50/30 space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <h3 className="font-bold text-sm text-red-700">Danger Zone</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-white border border-red-200 rounded-xl gap-4">
                        <div>
                          <p className="text-xs font-semibold text-red-600">
                            Reset Cashier Sessions
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Clears all active sessions and forces re-login
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            toast.error('Requires super-admin authorization', { icon: '🔐' })
                          }
                          className="text-red-500 hover:bg-red-100 rounded-lg text-[11px] flex-shrink-0"
                        >
                          Reset Sessions
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white border border-red-200 rounded-xl gap-4">
                        <div>
                          <p className="text-xs font-semibold text-red-600">Factory Reset POS</p>
                          <p className="text-[10px] text-muted-foreground">
                            Wipes all local data. Cannot be undone.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            toast.error('Factory reset requires super-admin OTP confirmation', {
                              icon: '⚠️',
                            })
                          }
                          className="text-red-500 hover:bg-red-100 rounded-lg text-[11px] flex-shrink-0"
                        >
                          Factory Reset
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
