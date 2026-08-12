'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu as MenuIcon,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Edit2,
  Trash2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  FileSpreadsheet,
  Save,
  X,
  PlusCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';
import { MenuCardScannerModal } from '@/components/menu/MenuCardScannerModal';
import { BulkAddMenuItemsModal } from '@/components/menu/BulkAddMenuItemsModal';

interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  taxRate: number;
  isVeg: boolean;
  isActive: boolean;
  description?: string;
}

interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export default function MenuPage() {
  const user = usePOSStore((state) => state.user);

  // Lists state
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Search/Filters state
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('0');
  const [formTax, setFormTax] = useState('5');
  const [formIsVeg, setFormIsVeg] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  // Category Form state
  const [newCategoryName, setNewCategoryName] = useState('');

  // ── Fetch Categories & Items ──
  const fetchMenuData = useCallback(async () => {
    if (!user?.branchId) return;
    setLoading(true);
    try {
      const [catsRes, itemsRes] = await Promise.all([
        api.get('/api/menu/categories'),
        api.get('/api/menu/items'),
      ]);

      const dbCats = catsRes.data?.data?.categories || [];
      const dbItems = itemsRes.data?.data?.items || [];

      setCategories(dbCats);

      const mappedItems = dbItems.map((itm: any) => {
        const cat = dbCats.find((c: any) => c.id === itm.categoryId);
        return {
          id: itm.id,
          name: itm.name,
          categoryId: itm.categoryId,
          categoryName: cat ? cat.name : 'Other',
          price: Number(itm.price),
          taxRate: Number(itm.taxRate) || 0,
          isVeg: itm.isVeg,
          isActive: itm.isActive,
          description: itm.description || '',
        };
      });

      setItems(mappedItems);
    } catch (e: any) {
      toast.error('Failed to load menu: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.branchId) {
      fetchMenuData();
    }
  }, [user?.branchId]);

  // Set form values on edit selection
  useEffect(() => {
    if (editItem) {
      setFormName(editItem.name);
      setFormCategory(editItem.categoryId);
      setFormPrice(String(editItem.price));
      setFormTax(String(editItem.taxRate));
      setFormIsVeg(editItem.isVeg);
      setFormDescription(editItem.description || '');
      setShowAddModal(true);
    } else {
      setFormName('');
      // Default to first category if available
      if (categories.length > 0) {
        setFormCategory(categories[0].id);
      } else {
        setFormCategory('');
      }
      setFormPrice('0');
      setFormTax('5');
      setFormIsVeg(true);
      setFormDescription('');
    }
  }, [editItem, showAddModal, categories]);

  // ── Toggle Availability ──
  const toggleAvailability = async (item: MenuItem) => {
    try {
      const targetState = !item.isActive;
      await api.put(`/api/menu/items/${item.id}`, {
        isActive: targetState,
      });

      setItems((prev) =>
        prev.map((itm) =>
          itm.id === item.id ? { ...itm, isActive: targetState } : itm
        )
      );
      toast.success(`${item.name} availability is now ${targetState ? 'Available' : 'Suspended'}`);
    } catch (e: any) {
      toast.error('Failed to update availability: ' + e.message);
    }
  };

  // ── Save or Edit Item ──
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCategory) {
      toast.error('Please fill in required fields');
      return;
    }
    const priceNum = Number(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Price must be greater than zero');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: formName.trim(),
        categoryId: formCategory,
        price: priceNum,
        taxRate: Number(formTax) || 0,
        isVeg: formIsVeg,
        description: formDescription.trim() || undefined,
      };

      if (editItem) {
        // Edit action
        await api.put(`/api/menu/items/${editItem.id}`, payload);
        toast.success(`Menu item "${formName}" updated successfully`);
      } else {
        // Create action
        await api.post('/api/menu/items', payload);
        toast.success(`New item "${formName}" added successfully`);
      }

      setShowAddModal(false);
      setEditItem(null);
      await fetchMenuData();
    } catch (e: any) {
      toast.error('Failed to save menu item: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Delete Item ──
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the menu?`)) return;
    try {
      await api.delete(`/api/menu/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(`"${name}" removed from menu catalog`);
    } catch (e: any) {
      toast.error('Failed to delete item: ' + (e.response?.data?.message || e.message));
    }
  };

  // ── Create Category ──
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setActionLoading(true);
    try {
      await api.post('/api/menu/categories', {
        name: newCategoryName.trim(),
      });
      toast.success(`Category "${newCategoryName}" created successfully!`);
      setNewCategoryName('');
      setShowCategoryModal(false);
      await fetchMenuData();
    } catch (e: any) {
      toast.error('Failed to create category: ' + (e.response?.data?.message || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Menu Items
  const filteredItems = items.filter((itm) => {
    const searchMatch = itm.name.toLowerCase().includes(search.toLowerCase());
    const categoryMatch = activeCategoryId === 'ALL' || itm.categoryId === activeCategoryId;
    return searchMatch && categoryMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading text-slate-900">Menu & Categories</h2>
          <p className="text-xs text-muted-foreground">
            Manage food catalog, prices, categories, and real-time item availability.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScannerModal(true)}
            className="rounded-lg h-9 text-xs px-4 gap-1.5 font-semibold bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/30 text-primary hover:bg-primary/15 transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-primary animate-pulse" /> Scan Menu Card (AI)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCategoryModal(true)}
            className="rounded-lg h-9 text-xs px-4 gap-1.5 font-semibold"
          >
            <PlusCircle className="h-4 w-4" /> Add Category
          </Button>
          <Button
            size="sm"
            onClick={() => setShowBulkAddModal(true)}
            className="rounded-lg h-9 text-xs px-4 gap-1.5 font-semibold"
          >
            <Plus className="h-4 w-4" /> Add Menu Items
          </Button>
        </div>
      </div>

      {/* Categories Horizontal filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <Button
          size="sm"
          variant={activeCategoryId === 'ALL' ? 'default' : 'outline'}
          onClick={() => setActiveCategoryId('ALL')}
          className="rounded-xl text-xs h-8 px-4 flex-shrink-0"
        >
          All Items
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={activeCategoryId === cat.id ? 'default' : 'outline'}
            onClick={() => setActiveCategoryId(cat.id)}
            className="rounded-xl text-xs h-8 px-4 flex-shrink-0"
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Search */}
      <Card className="p-4 border-border flex items-center gap-3">
        <div className="relative flex items-center flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3" />
          <Input
            type="text"
            placeholder="Search items by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-muted/30 border-border/85"
          />
        </div>
      </Card>

      {/* Main Catalog Menu Table */}
      <Card className="border border-border overflow-hidden rounded-2xl bg-card">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-muted-foreground">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading food catalog...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold">
                  <th className="p-4">Food Item Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Tax SGST/CGST</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((itm) => (
                  <tr key={itm.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">{itm.name}</td>
                    <td className="p-4 text-muted-foreground">{itm.categoryName}</td>
                    <td className="p-4 font-bold text-foreground">₹{itm.price.toLocaleString()}</td>
                    <td className="p-4 text-muted-foreground">{itm.taxRate}%</td>
                    <td className="p-4">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold rounded-md border-0 uppercase ${
                          itm.isVeg ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                        }`}
                      >
                        {itm.isVeg ? 'Veg' : 'Non-Veg'}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleAvailability(itm)}
                        className="cursor-pointer focus:outline-none"
                      >
                        {itm.isActive ? (
                          <span className="text-success flex items-center justify-center gap-1 font-bold text-[10px]">
                            <ToggleRight className="h-6 w-6" /> Available
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center justify-center gap-1 font-bold text-[10px]">
                            <ToggleLeft className="h-6 w-6" /> Suspended
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditItem(itm)}
                          className="h-8 w-8 text-slate-400 hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(itm.id, itm.name)}
                          className="h-8 w-8 text-slate-400 hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No menu items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Menu Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border max-w-md w-full rounded-2xl p-6 shadow-2xl relative text-foreground"
          >
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditItem(null);
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            
            <h3 className="text-base font-bold mb-4 font-heading">
              {editItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h3>
            
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Item Name *</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Garlic Bread Modifiers"
                  className="rounded-lg text-xs bg-muted/20 border-border/80"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs h-9 bg-card border border-border/80 rounded-lg px-2 outline-none"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Price (₹) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="rounded-lg text-xs bg-muted/20 border-border/80"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Tax Rate (%)</label>
                  <Input
                    type="number"
                    value={formTax}
                    onChange={(e) => setFormTax(e.target.value)}
                    className="rounded-lg text-xs bg-muted/20 border-border/80"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter item description..."
                  className="w-full rounded-lg text-xs p-3 bg-muted/20 border border-border/85 min-h-16 outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border/60 rounded-xl">
                <div>
                  <p className="text-xs font-semibold">Vegetarian Indicator</p>
                  <p className="text-[10px] text-muted-foreground">Mark this item as pure vegetarian (Green badge)</p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsVeg}
                  onChange={(e) => setFormIsVeg(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditItem(null);
                  }}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  size="sm"
                  className="rounded-lg text-xs bg-primary hover:bg-primary/95 text-white font-semibold flex items-center gap-1.5"
                >
                  {actionLoading && <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Save Item
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add New Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border max-w-sm w-full rounded-2xl p-6 shadow-2xl relative text-foreground"
          >
            <button
              onClick={() => {
                setShowCategoryModal(false);
                setNewCategoryName('');
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            
            <h3 className="text-base font-bold mb-4 font-heading">Add New Category</h3>
            
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Category Name *</label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Starters"
                  className="rounded-lg text-xs bg-muted/20 border-border/80"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  size="sm"
                  className="rounded-lg text-xs bg-primary hover:bg-primary/95 text-white font-semibold flex items-center gap-1.5"
                >
                  {actionLoading && <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Create Category
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Bulk Add Multiple Items Modal */}
      <BulkAddMenuItemsModal
        isOpen={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        categories={categories}
        onSuccess={fetchMenuData}
      />

      {/* Menu Card Scanner Modal */}
      <MenuCardScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        existingCategories={categories}
        onImportSuccess={fetchMenuData}
      />

    </div>
  );
}
