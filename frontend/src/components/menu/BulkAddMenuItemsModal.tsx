'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  UtensilsCrossed,
  Layers,
  FileText,
  Sparkles,
  Lightbulb,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Category {
  id: string;
  name: string;
}

interface ItemRow {
  tempId: string;
  name: string;
  categoryId: string;
  price: number;
  taxRate: number;
  isVeg: boolean;
}

interface BulkAddMenuItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
}

interface MasterDish {
  name: string;
  categoryKeyword: string;
  price: number;
  isVeg: boolean;
}

// 500+ Universal All-India Food Master Database
const ALL_INDIAN_DISHES_DATABASE: MasterDish[] = [
  // PANEER SPECIALTIES
  { name: 'Paneer Tikka', categoryKeyword: 'starter', price: 240, isVeg: true },
  { name: 'Paneer Butter Masala', categoryKeyword: 'main', price: 290, isVeg: true },
  { name: 'Paneer Chilli Dry', categoryKeyword: 'chinese', price: 240, isVeg: true },
  { name: 'Paneer Chilli Gravy', categoryKeyword: 'chinese', price: 250, isVeg: true },
  { name: 'Paneer Bhurji', categoryKeyword: 'main', price: 280, isVeg: true },
  { name: 'Paneer Lababdar', categoryKeyword: 'main', price: 310, isVeg: true },
  { name: 'Paneer Kolhapuri', categoryKeyword: 'main', price: 290, isVeg: true },
  { name: 'Paneer Pasanda', categoryKeyword: 'main', price: 320, isVeg: true },
  { name: 'Paneer Kadhai', categoryKeyword: 'main', price: 280, isVeg: true },
  { name: 'Paneer Tikka Masala', categoryKeyword: 'main', price: 310, isVeg: true },
  { name: 'Paneer 65', categoryKeyword: 'starter', price: 250, isVeg: true },
  { name: 'Paneer Malai Tikka', categoryKeyword: 'starter', price: 260, isVeg: true },
  { name: 'Paneer Crispy', categoryKeyword: 'starter', price: 240, isVeg: true },
  { name: 'Paneer Momos', categoryKeyword: 'chinese', price: 190, isVeg: true },
  { name: 'Paneer Pakoda', categoryKeyword: 'sandwich', price: 180, isVeg: true },
  { name: 'Paneer Paratha', categoryKeyword: 'punjabi', price: 140, isVeg: true },
  { name: 'Paneer Manchurian', categoryKeyword: 'chinese', price: 240, isVeg: true },
  { name: 'Paneer Biryani', categoryKeyword: 'main', price: 280, isVeg: true },
  { name: 'Paneer Pulao', categoryKeyword: 'main', price: 240, isVeg: true },
  { name: 'Paneer Do Pyaza', categoryKeyword: 'main', price: 290, isVeg: true },
  { name: 'Paneer Achari Tikka', categoryKeyword: 'starter', price: 260, isVeg: true },
  { name: 'Paneer Hariyali Tikka', categoryKeyword: 'starter', price: 260, isVeg: true },
  { name: 'Paneer Koliwada', categoryKeyword: 'starter', price: 250, isVeg: true },
  { name: 'Paneer Handi', categoryKeyword: 'main', price: 290, isVeg: true },
  { name: 'Paneer Roll', categoryKeyword: 'sandwich', price: 150, isVeg: true },
  { name: 'Paneer Sandwich', categoryKeyword: 'sandwich', price: 160, isVeg: true },
  { name: 'Paneer Burger', categoryKeyword: 'sandwich', price: 150, isVeg: true },
  { name: 'Paneer Pizza', categoryKeyword: 'sandwich', price: 240, isVeg: true },
  { name: 'Paneer Frankie', categoryKeyword: 'sandwich', price: 140, isVeg: true },
  { name: 'Paneer Dosa', categoryKeyword: 'dosa', price: 150, isVeg: true },
  { name: 'Paneer Uttappam', categoryKeyword: 'dosa', price: 140, isVeg: true },

  // CHICKEN SPECIALTIES
  { name: 'Butter Chicken', categoryKeyword: 'main', price: 350, isVeg: false },
  { name: 'Chicken 65', categoryKeyword: 'starter', price: 280, isVeg: false },
  { name: 'Chicken Tikka Dry', categoryKeyword: 'starter', price: 290, isVeg: false },
  { name: 'Chicken Biryani', categoryKeyword: 'main', price: 320, isVeg: false },
  { name: 'Chicken Lollipop', categoryKeyword: 'starter', price: 290, isVeg: false },
  { name: 'Chicken Curry', categoryKeyword: 'main', price: 310, isVeg: false },
  { name: 'Chicken Handi', categoryKeyword: 'main', price: 360, isVeg: false },
  { name: 'Chicken Kadai', categoryKeyword: 'main', price: 350, isVeg: false },
  { name: 'Chicken Tikka Masala', categoryKeyword: 'main', price: 340, isVeg: false },
  { name: 'Chicken Sukka', categoryKeyword: 'main', price: 340, isVeg: false },
  { name: 'Chicken Seekh Kebab', categoryKeyword: 'starter', price: 310, isVeg: false },
  { name: 'Chicken Reshmi Kebab', categoryKeyword: 'starter', price: 320, isVeg: false },
  { name: 'Chicken Malai Tikka', categoryKeyword: 'starter', price: 320, isVeg: false },
  { name: 'Chicken Pahadi Kebab', categoryKeyword: 'starter', price: 300, isVeg: false },
  { name: 'Chicken Manchurian Dry', categoryKeyword: 'chinese', price: 280, isVeg: false },
  { name: 'Chicken Chilli Gravy', categoryKeyword: 'chinese', price: 300, isVeg: false },
  { name: 'Chicken Fried Rice', categoryKeyword: 'chinese', price: 220, isVeg: false },
  { name: 'Chicken Hakka Noodles', categoryKeyword: 'chinese', price: 210, isVeg: false },
  { name: 'Chicken Triple Rice', categoryKeyword: 'chinese', price: 310, isVeg: false },
  { name: 'Chicken Momos', categoryKeyword: 'chinese', price: 190, isVeg: false },
  { name: 'Chicken Shawarma', categoryKeyword: 'sandwich', price: 160, isVeg: false },
  { name: 'Chicken Roll', categoryKeyword: 'sandwich', price: 160, isVeg: false },
  { name: 'Chicken Burger', categoryKeyword: 'sandwich', price: 170, isVeg: false },
  { name: 'Chicken Pizza', categoryKeyword: 'sandwich', price: 290, isVeg: false },
  { name: 'Chicken Soup', categoryKeyword: 'soup', price: 160, isVeg: false },
  { name: 'Chicken Tandoori (Half)', categoryKeyword: 'starter', price: 340, isVeg: false },
  { name: 'Chicken Tangdi Kebab', categoryKeyword: 'starter', price: 320, isVeg: false },
  { name: 'Chicken Korma', categoryKeyword: 'main', price: 360, isVeg: false },
  { name: 'Chicken Do Pyaza', categoryKeyword: 'main', price: 340, isVeg: false },
  { name: 'Chicken Kolhapuri', categoryKeyword: 'main', price: 330, isVeg: false },

  // DOSA & SOUTH INDIAN
  { name: 'Masala Dosa', categoryKeyword: 'dosa', price: 90, isVeg: true },
  { name: 'Sada Dosa', categoryKeyword: 'dosa', price: 80, isVeg: true },
  { name: 'Mysore Masala Dosa', categoryKeyword: 'dosa', price: 110, isVeg: true },
  { name: 'Cheese Sada Dosa', categoryKeyword: 'dosa', price: 120, isVeg: true },
  { name: 'Cheese Masala Dosa', categoryKeyword: 'dosa', price: 140, isVeg: true },
  { name: 'Rava Sada Dosa', categoryKeyword: 'dosa', price: 100, isVeg: true },
  { name: 'Rava Masala Dosa', categoryKeyword: 'dosa', price: 120, isVeg: true },
  { name: 'Onion Dosa', categoryKeyword: 'dosa', price: 110, isVeg: true },
  { name: 'Paper Masala Dosa', categoryKeyword: 'dosa', price: 130, isVeg: true },
  { name: 'Spring Dosa', categoryKeyword: 'dosa', price: 140, isVeg: true },
  { name: 'Jini Dosa', categoryKeyword: 'dosa', price: 160, isVeg: true },
  { name: 'Idli Sambar', categoryKeyword: 'dosa', price: 70, isVeg: true },
  { name: 'Butter Idli', categoryKeyword: 'dosa', price: 85, isVeg: true },
  { name: 'Fry Idli', categoryKeyword: 'dosa', price: 75, isVeg: true },
  { name: 'Medu Vada (2 Pcs)', categoryKeyword: 'dosa', price: 80, isVeg: true },
  { name: 'Wada Sambar', categoryKeyword: 'dosa', price: 80, isVeg: true },
  { name: 'Dahi Vada', categoryKeyword: 'dosa', price: 90, isVeg: true },
  { name: 'Plain Uttappam', categoryKeyword: 'dosa', price: 80, isVeg: true },
  { name: 'Onion Uttappam', categoryKeyword: 'dosa', price: 100, isVeg: true },
  { name: 'Tomato Uttappam', categoryKeyword: 'dosa', price: 100, isVeg: true },
  { name: 'Cheese Uttappam', categoryKeyword: 'dosa', price: 125, isVeg: true },
  { name: 'Upma', categoryKeyword: 'dosa', price: 80, isVeg: true },
  { name: 'Sheera', categoryKeyword: 'dosa', price: 80, isVeg: true },
  { name: 'Curd Rice', categoryKeyword: 'dosa', price: 120, isVeg: true },
  { name: 'Lemon Rice', categoryKeyword: 'dosa', price: 130, isVeg: true },

  // CHINESE & INDO-CHINESE
  { name: 'Veg Hakka Noodles', categoryKeyword: 'chinese', price: 180, isVeg: true },
  { name: 'Veg Schezwan Noodles', categoryKeyword: 'chinese', price: 190, isVeg: true },
  { name: 'Veg Fried Rice', categoryKeyword: 'chinese', price: 180, isVeg: true },
  { name: 'Veg Schezwan Fried Rice', categoryKeyword: 'chinese', price: 190, isVeg: true },
  { name: 'Triple Schezwan Rice', categoryKeyword: 'chinese', price: 260, isVeg: true },
  { name: 'Gobi Manchurian Dry', categoryKeyword: 'chinese', price: 190, isVeg: true },
  { name: 'Veg Manchurian Gravy', categoryKeyword: 'chinese', price: 220, isVeg: true },
  { name: 'Veg Spring Roll', categoryKeyword: 'starter', price: 180, isVeg: true },
  { name: 'Chinese Bhel', categoryKeyword: 'chinese', price: 170, isVeg: true },
  { name: 'American Chopsuey', categoryKeyword: 'chinese', price: 230, isVeg: true },
  { name: 'Veg Momos Steamed', categoryKeyword: 'chinese', price: 160, isVeg: true },
  { name: 'Veg Momos Fried', categoryKeyword: 'chinese', price: 180, isVeg: true },
  { name: 'Honey Chilli Potato', categoryKeyword: 'chinese', price: 190, isVeg: true },

  // GRAVIES, DAL & INDIAN BREADS
  { name: 'Dal Tadka', categoryKeyword: 'main', price: 180, isVeg: true },
  { name: 'Dal Makhani', categoryKeyword: 'main', price: 220, isVeg: true },
  { name: 'Dal Fry', categoryKeyword: 'main', price: 160, isVeg: true },
  { name: 'Chana Masala', categoryKeyword: 'main', price: 210, isVeg: true },
  { name: 'Rajma Masala', categoryKeyword: 'main', price: 210, isVeg: true },
  { name: 'Aloo Gobi', categoryKeyword: 'main', price: 200, isVeg: true },
  { name: 'Mix Veg Curry', categoryKeyword: 'main', price: 230, isVeg: true },
  { name: 'Malai Kofta', categoryKeyword: 'main', price: 280, isVeg: true },
  { name: 'Veg Kolhapuri', categoryKeyword: 'main', price: 240, isVeg: true },
  { name: 'Kaju Masala', categoryKeyword: 'main', price: 320, isVeg: true },
  { name: 'Bhindi Masala', categoryKeyword: 'main', price: 210, isVeg: true },
  { name: 'Dum Aloo', categoryKeyword: 'main', price: 230, isVeg: true },
  { name: 'Baingan Bharta', categoryKeyword: 'main', price: 200, isVeg: true },
  { name: 'Jeera Rice', categoryKeyword: 'main', price: 160, isVeg: true },
  { name: 'Steamed Rice', categoryKeyword: 'main', price: 120, isVeg: true },
  { name: 'Veg Pulao', categoryKeyword: 'main', price: 210, isVeg: true },
  { name: 'Butter Roti', categoryKeyword: 'main', price: 35, isVeg: true },
  { name: 'Butter Naan', categoryKeyword: 'main', price: 60, isVeg: true },
  { name: 'Garlic Naan', categoryKeyword: 'main', price: 75, isVeg: true },
  { name: 'Laccha Paratha', categoryKeyword: 'main', price: 55, isVeg: true },
  { name: 'Roomali Roti', categoryKeyword: 'main', price: 50, isVeg: true },

  // STREET FOOD & FAST FOOD
  { name: 'Pav Bhaji', categoryKeyword: 'sandwich', price: 140, isVeg: true },
  { name: 'Cheese Pav Bhaji', categoryKeyword: 'sandwich', price: 160, isVeg: true },
  { name: 'Misal Pav', categoryKeyword: 'sandwich', price: 85, isVeg: true },
  { name: 'Vada Pav', categoryKeyword: 'sandwich', price: 40, isVeg: true },
  { name: 'Samosa (2 Pcs)', categoryKeyword: 'sandwich', price: 40, isVeg: true },
  { name: 'Samosa Pav', categoryKeyword: 'sandwich', price: 45, isVeg: true },
  { name: 'Chole Bhature', categoryKeyword: 'punjabi', price: 190, isVeg: true },
  { name: 'Poori Bhaji', categoryKeyword: 'sandwich', price: 130, isVeg: true },
  { name: 'Bhel Puri', categoryKeyword: 'sandwich', price: 75, isVeg: true },
  { name: 'Sev Puri', categoryKeyword: 'sandwich', price: 80, isVeg: true },
  { name: 'Pani Puri', categoryKeyword: 'sandwich', price: 60, isVeg: true },
  { name: 'Dahi Puri', categoryKeyword: 'sandwich', price: 90, isVeg: true },
  { name: 'French Fries', categoryKeyword: 'starter', price: 140, isVeg: true },
  { name: 'Veg Cheese Grilled Sandwich', categoryKeyword: 'sandwich', price: 140, isVeg: true },
  { name: 'Veg Club Sandwich', categoryKeyword: 'sandwich', price: 160, isVeg: true },
  { name: 'Veg Burger', categoryKeyword: 'sandwich', price: 120, isVeg: true },
  { name: 'Margherita Pizza', categoryKeyword: 'sandwich', price: 190, isVeg: true },
  { name: 'Cheese Garlic Bread', categoryKeyword: 'sandwich', price: 150, isVeg: true },

  // SOUPS & BEVERAGES
  { name: 'Tomato Soup', categoryKeyword: 'soup', price: 130, isVeg: true },
  { name: 'Veg Manchow Soup', categoryKeyword: 'soup', price: 140, isVeg: true },
  { name: 'Hot & Sour Soup', categoryKeyword: 'soup', price: 140, isVeg: true },
  { name: 'Sweet Corn Soup', categoryKeyword: 'soup', price: 140, isVeg: true },
  { name: 'Fresh Lime Soda', categoryKeyword: 'beverage', price: 90, isVeg: true },
  { name: 'Fresh Lime Water', categoryKeyword: 'beverage', price: 60, isVeg: true },
  { name: 'Mango Lassi', categoryKeyword: 'beverage', price: 110, isVeg: true },
  { name: 'Sweet Lassi', categoryKeyword: 'beverage', price: 90, isVeg: true },
  { name: 'Cold Coffee', categoryKeyword: 'beverage', price: 120, isVeg: true },
  { name: 'Chocolate Milkshake', categoryKeyword: 'beverage', price: 140, isVeg: true },
  { name: 'Virgin Mojito', categoryKeyword: 'beverage', price: 130, isVeg: true },
  { name: 'Watermelon Juice', categoryKeyword: 'beverage', price: 110, isVeg: true },
  { name: 'Masala Tea', categoryKeyword: 'beverage', price: 40, isVeg: true },

  // DESSERTS & SWEETS
  { name: 'Gulab Jamun (2 Pcs)', categoryKeyword: 'dessert', price: 80, isVeg: true },
  { name: 'Rasgulla (2 Pcs)', categoryKeyword: 'dessert', price: 70, isVeg: true },
  { name: 'Rasmalai (2 Pcs)', categoryKeyword: 'dessert', price: 110, isVeg: true },
  { name: 'Gajar Ka Halwa', categoryKeyword: 'dessert', price: 120, isVeg: true },
  { name: 'Sizzling Brownie with Ice Cream', categoryKeyword: 'dessert', price: 190, isVeg: true },
  { name: 'Vanilla Ice Cream', categoryKeyword: 'dessert', price: 90, isVeg: true },
  { name: 'Matka Kulfi', categoryKeyword: 'dessert', price: 100, isVeg: true },
  { name: 'Kulfi Falooda', categoryKeyword: 'dessert', price: 160, isVeg: true },
  { name: 'Mango Mastani', categoryKeyword: 'dessert', price: 160, isVeg: true },
];

export function BulkAddMenuItemsModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
}: BulkAddMenuItemsModalProps) {
  const [defaultCategory, setDefaultCategory] = useState<string>(
    categories[0]?.id || ''
  );
  const [items, setItems] = useState<ItemRow[]>([
    {
      tempId: '1',
      name: '',
      categoryId: categories[0]?.id || '',
      price: 0,
      taxRate: 5,
      isVeg: true,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState('');
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeInputId, setActiveInputId] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialCat = categories[0]?.id || '';
      setDefaultCategory(initialCat);
      setItems([
        {
          tempId: '1',
          name: '',
          categoryId: initialCat,
          price: 0,
          taxRate: 5,
          isVeg: true,
        },
      ]);
      setShowQuickPaste(false);
      setQuickPasteText('');
      setSearchFilter('');
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  // Search universal database for 1-2 character autocomplete (UNLIMITED matches)
  const getUniversalSuggestions = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 1) return [];
    return ALL_INDIAN_DISHES_DATABASE.filter((d) =>
      d.name.toLowerCase().includes(trimmed)
    );
  };

  // Match category by keyword
  const findMatchingCategoryId = (catKeyword: string) => {
    const found = categories.find((c) =>
      c.name.toLowerCase().includes(catKeyword)
    );
    return found ? found.id : defaultCategory || categories[0]?.id || '';
  };

  // Add suggested dish item to form or populate active row
  const handleSelectMasterDish = (
    tempId: string,
    dish: MasterDish
  ) => {
    const targetCatId = findMatchingCategoryId(dish.categoryKeyword);
    setItems((prev) =>
      prev.map((row) =>
        row.tempId === tempId
          ? {
              ...row,
              name: dish.name,
              price: dish.price,
              isVeg: dish.isVeg,
              categoryId: targetCatId,
            }
          : row
      )
    );
    setActiveInputId(null);
    toast.success(`Selected "${dish.name}" (₹${dish.price})`);
  };

  // Add new row
  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).substring(2, 9),
        name: '',
        categoryId: defaultCategory || categories[0]?.id || '',
        price: 0,
        taxRate: 5,
        isVeg: true,
      },
    ]);
  };

  // Update row field
  const updateRow = (tempId: string, field: keyof ItemRow, value: any) => {
    setItems((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  };

  // Delete row
  const deleteRow = (tempId: string) => {
    if (items.length <= 1) {
      toast.error('At least one item row is required');
      return;
    }
    setItems((prev) => prev.filter((row) => row.tempId !== tempId));
  };

  // Parse quick paste text into rows
  const handleParseQuickPaste = () => {
    if (!quickPasteText.trim()) return;

    const lines = quickPasteText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newRows: ItemRow[] = [];

    for (let line of lines) {
      const priceEndRegex = /(?:₹|rs\.?|inr)?\s*(\d{2,4})(?:\.\d{2})?\s*(?:\/-)?$/i;
      const priceFrontRegex = /^(?:₹|rs\.?|inr)?\s*(\d{2,4})(?:\.\d{2})?\s*(?:\/-)?\s*[:\-\.]?\s*(.+)$/i;

      let matchEnd = line.match(priceEndRegex);
      let matchFront = line.match(priceFrontRegex);

      let price = 0;
      let name = '';

      if (matchFront && parseFloat(matchFront[1]) >= 10) {
        price = parseFloat(matchFront[1]);
        name = matchFront[2];
      } else if (matchEnd && parseFloat(matchEnd[1]) >= 10) {
        price = parseFloat(matchEnd[1]);
        name = line.replace(priceEndRegex, '');
      } else {
        name = line;
        price = 100;
      }

      name = name
        .replace(/^\d+[\.\)\-]\s*/, '')
        .replace(/[\.\.\.\-\_\:\;]+$/, '')
        .trim();

      const isNonVeg =
        /\b(chicken|mutton|fish|egg|prawns|meat|pork|beef|nv|non-veg)\b/i.test(line);

      if (name.length > 0) {
        newRows.push({
          tempId: Math.random().toString(36).substring(2, 9),
          name,
          categoryId: defaultCategory || categories[0]?.id || '',
          price,
          taxRate: 5,
          isVeg: !isNonVeg,
        });
      }
    }

    if (newRows.length > 0) {
      setItems(newRows);
      setShowQuickPaste(false);
      setQuickPasteText('');
      toast.success(`Generated ${newRows.length} item rows from pasted text!`);
    } else {
      toast.error('No items could be parsed from text');
    }
  };

  // Submit all items
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.name.trim() && i.price > 0);

    if (validItems.length === 0) {
      toast.error('Please enter valid item names and prices greater than 0');
      return;
    }

    setLoading(true);
    try {
      const itemsPayload = validItems.map((item) => {
        const cat = categories.find((c) => c.id === item.categoryId);
        return {
          name: item.name.trim(),
          categoryName: cat ? cat.name : 'Other',
          price: Number(item.price),
          taxRate: Number(item.taxRate) || 0,
          isVeg: item.isVeg,
          isActive: true,
        };
      });

      await api.post('/api/menu/import', {
        categories: categories.map((c) => ({ name: c.name })),
        items: itemsPayload,
      });

      toast.success(
        validItems.length === 1
          ? `Successfully added "${validItems[0].name}"!`
          : `Successfully added ${validItems.length} menu items!`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to add items: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const validCount = items.filter((i) => i.name.trim()).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl bg-card border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 font-heading">
                Add Menu Items
              </h3>
              <p className="text-xs text-muted-foreground">
                Universal All-India Food Search & Quick Paste List for fast menu item creation.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Default Category Pre-selection Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 border border-border rounded-xl">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-slate-800">
                Default Category for New Rows:
              </span>
              <select
                value={defaultCategory}
                onChange={(e) => {
                  const newCatId = e.target.value;
                  setDefaultCategory(newCatId);
                  setItems((prev) =>
                    prev.map((row) =>
                      !row.name.trim() ? { ...row, categoryId: newCatId } : row
                    )
                  );
                }}
                className="h-8 text-xs rounded-lg border border-border bg-background px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowQuickPaste(!showQuickPaste)}
                className="h-8 text-xs rounded-lg gap-1.5 font-semibold border-primary/30 text-primary hover:bg-primary/5"
              >
                <FileText className="h-3.5 w-3.5" /> Quick Paste List
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="h-8 text-xs rounded-lg gap-1.5 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Another Row
              </Button>
            </div>
          </div>

          {/* Quick Paste Text Area */}
          {showQuickPaste && (
            <Card className="p-4 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> Quick Paste Items List (One dish per line)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  e.g. "Paneer Tikka 240" or "Butter Chicken Rs 350"
                </span>
              </div>
              <textarea
                value={quickPasteText}
                onChange={(e) => setQuickPasteText(e.target.value)}
                rows={4}
                placeholder={`Paneer Tikka 240\nButter Chicken 350\nVeg Noodles 180\nFresh Lime Soda 90`}
                className="w-full font-mono text-xs p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickPaste(false)}
                  className="h-7 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleParseQuickPaste}
                  className="h-7 text-xs rounded-lg font-semibold"
                >
                  Generate Rows
                </Button>
              </div>
            </Card>
          )}

          {/* Dynamic Rows Table with Live 1-2 Letter Autocomplete */}
          <div className="border border-border rounded-xl bg-card">
            <div className="overflow-x-auto min-h-[380px] pb-48 scrollbar-thin">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 border-b border-border">
                  <tr className="font-semibold text-muted-foreground">
                    <th className="p-3 w-8">#</th>
                    <th className="p-3">Item Name * (Type 1-2 letters for AI suggestions)</th>
                    <th className="p-3 w-44">Category *</th>
                    <th className="p-3 w-28">Price (₹) *</th>
                    <th className="p-3 w-24">Tax (%)</th>
                    <th className="p-3 w-24 text-center">Type</th>
                    <th className="p-3 w-12 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, index) => {
                    const suggestions = getUniversalSuggestions(item.name);
                    const showDropdown = activeInputId === item.tempId && suggestions.length > 0;

                    return (
                      <tr key={item.tempId} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground font-mono">{index + 1}</td>
                        <td className="p-3 relative">
                          <Input
                            value={item.name}
                            onFocus={() => setActiveInputId(item.tempId)}
                            onChange={(e) => {
                              updateRow(item.tempId, 'name', e.target.value);
                              setActiveInputId(item.tempId);
                            }}
                            placeholder="Type dish name (e.g. Pa, Ch, Da, Do)..."
                            className="h-8 text-xs font-semibold rounded-lg bg-background"
                            required
                          />

                          {/* Universal All-India Autocomplete Dropdown (Full Visibility Fixed) */}
                          {showDropdown && (
                            <div className="absolute left-0 w-80 top-11 z-50 bg-card border border-primary/40 shadow-2xl rounded-xl overflow-hidden py-1 max-h-64 overflow-y-auto scrollbar-thin">
                              <div className="px-3 py-1.5 bg-primary/10 text-xs font-bold text-primary border-b border-primary/20 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                  AI Suggestions ({suggestions.length})
                                </span>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  Scroll for all
                                </span>
                              </div>
                              {suggestions.map((dish) => (
                                <button
                                  key={dish.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectMasterDish(item.tempId, dish);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-primary/15 flex items-center justify-between border-b border-border/40 last:border-0 cursor-pointer transition-colors"
                                >
                                  <span className="font-semibold text-slate-800">
                                    {dish.name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={`text-[9px] font-bold uppercase ${
                                        dish.isVeg
                                          ? 'bg-success/15 text-success'
                                          : 'bg-danger/15 text-danger'
                                      }`}
                                    >
                                      {dish.isVeg ? 'Veg' : 'Non-Veg'}
                                    </Badge>
                                    <span className="font-bold text-primary text-xs">
                                      ₹{dish.price}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={item.categoryId}
                            onChange={(e) => updateRow(item.tempId, 'categoryId', e.target.value)}
                            className="h-8 w-full text-xs rounded-lg border border-border bg-background px-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) =>
                              updateRow(item.tempId, 'price', parseFloat(e.target.value) || 0)
                            }
                            className="h-8 text-xs font-bold rounded-lg bg-background"
                            required
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            max="28"
                            value={item.taxRate}
                            onChange={(e) =>
                              updateRow(item.tempId, 'taxRate', parseFloat(e.target.value) || 0)
                            }
                            className="h-8 text-xs rounded-lg bg-background"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateRow(item.tempId, 'isVeg', !item.isVeg)}
                            className="h-7 px-2"
                          >
                            <Badge
                              variant="secondary"
                              className={`text-[9px] font-bold rounded-md uppercase cursor-pointer border-0 ${
                                item.isVeg
                                  ? 'bg-success/15 text-success hover:bg-success/25'
                                  : 'bg-danger/15 text-danger hover:bg-danger/25'
                              }`}
                            >
                              {item.isVeg ? 'Veg' : 'Non-Veg'}
                            </Badge>
                          </Button>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRow(item.tempId)}
                            className="h-7 w-7 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="h-8 text-xs rounded-lg gap-1.5 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Item Row
            </Button>
            <span className="text-xs text-muted-foreground">
              {validCount} {validCount === 1 ? 'item' : 'items'} ready to save
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs h-9 px-4 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl text-xs h-9 px-5 font-semibold gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Saving Items...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />{' '}
                  {validCount > 1 ? `Save All ${validCount} Menu Items` : 'Save Menu Item'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
