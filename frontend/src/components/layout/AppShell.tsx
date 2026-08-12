'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePOSStore } from '@/store/usePOSStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Table,
  Menu as MenuIcon,
  ShoppingBag,
  Receipt,
  Box,
  Truck,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  Search,
  Moon,
  Sun,
  Menu as Hamburger,
  X,
  Command,
  ChefHat,
  Wallet,
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard },
  { name: 'Orders',        href: '/orders',        icon: ShoppingBag },
  { name: 'Menu',          href: '/menu',          icon: MenuIcon },
  { name: 'Billing',       href: '/billing',       icon: Receipt },
  { name: 'KOT Screen',    href: '/kot-screen',    icon: ChefHat },
  { name: 'Expenses',      href: '/expenses',      icon: Wallet },
  { name: 'Suppliers',     href: '/suppliers',     icon: Truck },
  { name: 'Reports',       href: '/reports',       icon: FileText },
  { name: 'Settings',      href: '/settings',      icon: Settings },
];

// Generic outside-click hook
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarOpen,
    toggleSidebar,
    user,
    restaurantProfile,
    notifications,
    markAllRead,
    logout,
    checkAuth,
  } = usePOSStore();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown open states
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Refs for outside-click detection
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useOutsideClick(notifRef, () => setNotifOpen(false));
  useOutsideClick(profileRef, () => setProfileOpen(false));

  useEffect(() => {
    const root = window.document.documentElement;
    setTheme(root.classList.contains('dark') ? 'dark' : 'light');

    const verifySession = async () => {
      await checkAuth();
      const storedTokens = localStorage.getItem('canwe_pos_tokens');
      if (!storedTokens) {
        router.push('/login');
      }
    };
    verifySession();
  }, [checkAuth, router]);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('dark');
      setTheme('dark');
    } else {
      root.classList.remove('dark');
      setTheme('light');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'POS Console', href: '/' }];
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/');
      const label = part.charAt(0).toUpperCase() + part.slice(1);
      return { label, href };
    });
  };

  const dropdownVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -8 },
    visible: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden font-sans">

      {/* ─── Sidebar ─── */}
      <aside
        className={`hidden md:flex flex-col bg-card border-r border-border h-full flex-shrink-0 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center px-5 border-b border-border gap-3 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 min-w-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20 overflow-hidden">
              {restaurantProfile?.logoUrl ? (
                <img src={restaurantProfile.logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                (restaurantProfile?.name || 'C').charAt(0)
              )}
            </div>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-bold text-base tracking-tight text-foreground truncate max-w-[160px]"
              >
                {restaurantProfile?.name || user?.restaurantName || 'Canwe POS'}
              </motion.span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.name}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group relative ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/15'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>
                  )}
                  {!sidebarOpen && (
                    <div className="absolute left-16 bg-foreground text-background text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-lg">
                      {item.name}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex-shrink-0">
          <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <div className="h-9 w-9 min-w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.role}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Mobile Drawer ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border z-50 p-6 flex flex-col justify-between md:hidden"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">C</div>
                    <span className="font-bold text-lg">Canwe POS</span>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {sidebarItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link href={item.href} key={item.name} onClick={() => setMobileOpen(false)}>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isActive ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                          <Icon className="h-5 w-5" />
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="pt-4 border-t border-border flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{user ? `${user.firstName} ${user.lastName}` : 'Guest'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="text-muted-foreground hover:text-red-500 p-1">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">

        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 z-30 flex-shrink-0 gap-4">

          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Hamburger className="h-5 w-5" />
            </button>
            <button
              className="hidden md:flex p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              onClick={toggleSidebar}
            >
              <Hamburger className="h-4.5 w-4.5" />
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
              {getBreadcrumbs().map((b, index, arr) => (
                <React.Fragment key={b.href}>
                  <Link href={b.href} className={`hover:text-foreground font-medium transition-colors truncate ${index === arr.length - 1 ? 'text-foreground font-semibold' : ''}`}>
                    {b.label}
                  </Link>
                  {index < arr.length - 1 && <span className="text-xs flex-shrink-0">/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Center: search */}
          <div className="hidden lg:flex items-center relative max-w-sm w-full">
            <Search className="h-4 w-4 absolute left-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search or press ⌘K..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 w-full bg-muted/50 border border-border/80 rounded-lg text-xs outline-none focus:bg-card focus:border-primary/40 transition-all"
            />
            <div className="absolute right-3 flex items-center gap-0.5 text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground pointer-events-none font-mono">
              <Command className="h-3 w-3" />K
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-card">
                    {unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial="hidden" animate="visible" exit="hidden"
                    variants={dropdownVariants}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <span className="font-semibold text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[11px] text-primary hover:underline font-medium">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-border">
                      {notifications.map((n) => (
                        <div key={n.id} className={`p-4 hover:bg-muted/40 transition-colors ${n.unread ? 'bg-primary/5' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-xs">{n.title}</span>
                            <span className="text-[9px] text-muted-foreground ml-2 flex-shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{n.description}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* Profile menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary text-xs font-bold border border-primary/20 hover:border-primary/40 transition-all"
              >
                {user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'}
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial="hidden" animate="visible" exit="hidden"
                    variants={dropdownVariants}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold truncate">{user ? `${user.firstName} ${user.lastName}` : 'Guest'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => { router.push('/settings'); setProfileOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs rounded-lg hover:bg-muted transition-colors text-foreground"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" /> Settings
                      </button>
                      <button
                        onClick={() => { handleLogout(); setProfileOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-red-500"
                      >
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background p-3 sm:p-4 md:p-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="md:hidden flex items-center justify-around bg-card border-t border-border h-14 flex-shrink-0 px-1 z-30">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-colors ${
              pathname === '/dashboard' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5 mb-0.5" />
            <span>Home</span>
          </Link>
          <Link
            href="/orders"
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-colors ${
              pathname === '/orders' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingBag className="h-4.5 w-4.5 mb-0.5" />
            <span>Orders</span>
          </Link>
          <Link
            href="/billing"
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-colors ${
              pathname === '/billing' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Receipt className="h-4.5 w-4.5 mb-0.5" />
            <span>Billing</span>
          </Link>
          <Link
            href="/kot-screen"
            className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-colors ${
              pathname === '/kot-screen' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChefHat className="h-4.5 w-4.5 mb-0.5" />
            <span>KOT</span>
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Hamburger className="h-4.5 w-4.5 mb-0.5" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}

