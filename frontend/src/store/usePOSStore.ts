import { create } from 'zustand';
import { api } from '@/lib/api';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'RESTAURANT_OWNER' | 'MANAGER' | 'CASHIER' | 'CAPTAIN';
  restaurantId: string | null;
  branchId: string | null;
  restaurantName: string;
}

export interface RestaurantProfile {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
  logoUrl?: string;
}

export interface TaxSettings {
  cgstRate: number;
  sgstRate: number;
  serviceCharge: number;
  packingCharge: number;
  enableServiceCharge: boolean;
  applyPackingTakeaway: boolean;
  roundOff: boolean;
}

export interface InvoiceSettings {
  invoiceHeader: string;
  invoiceFooter: string;
  invoicePrefix: string;
  startingNumber: string;
  showQR: boolean;
  printDuplicate: boolean;
  showTaxes: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: 'info' | 'warning' | 'success' | 'danger';
}

interface POSState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  user: UserProfile | null;
  tokens: { accessToken: string; refreshToken: string } | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;

  // Global Restaurant & Settings State
  restaurantProfile: RestaurantProfile;
  taxes: TaxSettings;
  invoice: InvoiceSettings;
  printer: any;
  appearance: any;
  notificationsSettings: any;

  fetchSettings: () => Promise<void>;
  updateRestaurantProfileStore: (prof: Partial<RestaurantProfile>) => void;
  updateSettingStore: (key: string, val: any) => void;
  calcBillTotals: (
    subtotal: number,
    orderType?: 'dine_in' | 'takeaway' | 'delivery'
  ) => {
    subtotal: number;
    cgst: number;
    sgst: number;
    totalGst: number;
    serviceChargeAmount: number;
    packingChargeAmount: number;
    grandTotal: number;
  };

  notifications: NotificationItem[];
  markAllRead: () => void;
  addNotification: (notif: Omit<NotificationItem, 'id' | 'unread' | 'time'>) => void;
}

const DEFAULT_PROFILE: RestaurantProfile = {
  name: 'Canwe Technologies Cafe',
  phone: '9099912383',
  email: 'contact@canwepos.com',
  address: 'Pride Icon, Kharadi, Pune, Maharashtra 411014',
  gstNumber: '27AAAAA1111A1Z1',
};

const DEFAULT_TAXES: TaxSettings = {
  cgstRate: 2.5,
  sgstRate: 2.5,
  serviceCharge: 2.0,
  packingCharge: 20,
  enableServiceCharge: true,
  applyPackingTakeaway: true,
  roundOff: true,
};

const DEFAULT_INVOICE: InvoiceSettings = {
  invoiceHeader: 'Welcome to Canwe Cafe!',
  invoiceFooter: 'Thank you for dining with us! Visit again.',
  invoicePrefix: 'INV-',
  startingNumber: '1001',
  showQR: true,
  printDuplicate: false,
  showTaxes: true,
};

export const usePOSStore = create<POSState>((set, get) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  user: null,
  tokens: null,

  restaurantProfile: DEFAULT_PROFILE,
  taxes: DEFAULT_TAXES,
  invoice: DEFAULT_INVOICE,
  printer: {},
  appearance: {},
  notificationsSettings: {},

  // Fetch live profile & settings from backend and update global state
  fetchSettings: async () => {
    try {
      const profRes = await api.get('/api/restaurant');
      if (profRes.data?.data?.restaurant) {
        const r = profRes.data.data.restaurant;
        const newProf: RestaurantProfile = {
          id: r.id,
          name: r.name || DEFAULT_PROFILE.name,
          phone: r.phone || DEFAULT_PROFILE.phone,
          email: r.email || DEFAULT_PROFILE.email,
          address: r.address || DEFAULT_PROFILE.address,
          gstNumber: r.gstNumber || DEFAULT_PROFILE.gstNumber,
          logoUrl: r.logoUrl,
        };
        set({ restaurantProfile: newProf });
      }

      const settingsRes = await api.get('/api/restaurant/settings');
      if (settingsRes.data?.data?.settings) {
        const s = settingsRes.data.data.settings;
        if (s.taxes) {
          set({
            taxes: {
              cgstRate: Number(s.taxes.cgstRate) || DEFAULT_TAXES.cgstRate,
              sgstRate: Number(s.taxes.sgstRate) || DEFAULT_TAXES.sgstRate,
              serviceCharge: Number(s.taxes.serviceCharge) || DEFAULT_TAXES.serviceCharge,
              packingCharge: Number(s.taxes.packingCharge) || DEFAULT_TAXES.packingCharge,
              enableServiceCharge: s.taxes.enableServiceCharge ?? DEFAULT_TAXES.enableServiceCharge,
              applyPackingTakeaway: s.taxes.applyPackingTakeaway ?? DEFAULT_TAXES.applyPackingTakeaway,
              roundOff: s.taxes.roundOff ?? DEFAULT_TAXES.roundOff,
            },
          });
        }
        if (s.invoice) {
          set({
            invoice: {
              invoiceHeader: s.invoice.invoiceHeader || DEFAULT_INVOICE.invoiceHeader,
              invoiceFooter: s.invoice.invoiceFooter || DEFAULT_INVOICE.invoiceFooter,
              invoicePrefix: s.invoice.invoicePrefix || DEFAULT_INVOICE.invoicePrefix,
              startingNumber: s.invoice.startingNumber || DEFAULT_INVOICE.startingNumber,
              showQR: s.invoice.showQR ?? DEFAULT_INVOICE.showQR,
              printDuplicate: s.invoice.printDuplicate ?? DEFAULT_INVOICE.printDuplicate,
              showTaxes: s.invoice.showTaxes ?? DEFAULT_INVOICE.showTaxes,
            },
          });
        }
        if (s.printer) set({ printer: s.printer });
        if (s.appearance) set({ appearance: s.appearance });
        if (s.notifications) set({ notificationsSettings: s.notifications });
      }
    } catch (e) {
      console.warn('Could not sync store settings with server:', e);
    }
  },

  updateRestaurantProfileStore: (prof) =>
    set((state) => ({
      restaurantProfile: { ...state.restaurantProfile, ...prof },
    })),

  updateSettingStore: (key, val) =>
    set((state) => ({
      [key]: typeof val === 'object' ? { ...(state as any)[key], ...val } : val,
    })),

  // Dynamically calculate bill totals based on live settings
  calcBillTotals: (subtotal, orderType = 'dine_in') => {
    const { taxes } = get();

    const cgst = Math.round((subtotal * taxes.cgstRate) / 100);
    const sgst = Math.round((subtotal * taxes.sgstRate) / 100);
    const totalGst = cgst + sgst;

    let serviceChargeAmount = 0;
    if (orderType === 'dine_in' && taxes.enableServiceCharge) {
      serviceChargeAmount = Math.round((subtotal * taxes.serviceCharge) / 100);
    }

    let packingChargeAmount = 0;
    if (orderType === 'takeaway' && taxes.applyPackingTakeaway) {
      packingChargeAmount = taxes.packingCharge;
    }

    let grandTotal = subtotal + totalGst + serviceChargeAmount + packingChargeAmount;

    if (taxes.roundOff) {
      grandTotal = Math.round(grandTotal);
    }

    return {
      subtotal,
      cgst,
      sgst,
      totalGst,
      serviceChargeAmount,
      packingChargeAmount,
      grandTotal,
    };
  },

  login: async (credentials) => {
    try {
      const res = await api.post('/api/auth/login', credentials);
      if (res.data && res.data.success) {
        const { user, restaurant, tokens } = res.data.data;
        const profile: UserProfile = {
          ...user,
          restaurantName: restaurant ? restaurant.name : 'Canwe POS',
        };
        localStorage.setItem('canwe_pos_tokens', JSON.stringify(tokens));
        localStorage.setItem('canwe_pos_user', JSON.stringify(profile));
        set({ user: profile, tokens });
        get().fetchSettings();
      } else {
        throw new Error(res.data?.message || 'Login failed');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(errorMsg);
    }
  },

  logout: () => {
    localStorage.removeItem('canwe_pos_tokens');
    localStorage.removeItem('canwe_pos_user');
    set({ user: null, tokens: null });
  },

  checkAuth: async () => {
    if (typeof window !== 'undefined') {
      const storedTokens = localStorage.getItem('canwe_pos_tokens');
      const storedUser = localStorage.getItem('canwe_pos_user');
      if (storedTokens && storedUser) {
        try {
          const tokens = JSON.parse(storedTokens);
          const user = JSON.parse(storedUser);
          set({ user, tokens });
          get().fetchSettings();

          // Background validation of token
          const res = await api.get('/api/auth/me');
          if (res.data && res.data.success) {
            const { user: refreshedUser } = res.data.data;
            const updatedProfile = {
              ...user,
              ...refreshedUser,
              restaurantName: refreshedUser.restaurant ? refreshedUser.restaurant.name : 'Canwe POS',
            };
            localStorage.setItem('canwe_pos_user', JSON.stringify(updatedProfile));
            set({ user: updatedProfile });
          }
        } catch (e) {
          console.error('Session verification failed, logging out', e);
          get().logout();
        }
      }
    }
  },

  notifications: [
    {
      id: '1',
      title: 'Low Stock Alert',
      description: 'Margarita Pizza Dough level is down to 4 units.',
      time: '5m ago',
      unread: true,
      type: 'warning',
    },
    {
      id: '2',
      title: 'Online Order Ingested',
      description: 'New Zomato delivery order #ZOM-9824 received.',
      time: '12m ago',
      unread: true,
      type: 'success',
    },
  ],
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, unread: false })),
    })),
  addNotification: (notif) =>
    set((state) => ({
      notifications: [
        {
          ...notif,
          id: Math.random().toString(),
          unread: true,
          time: 'Just now',
        },
        ...state.notifications,
      ],
    })),
}));
