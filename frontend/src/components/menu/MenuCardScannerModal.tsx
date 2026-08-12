'use client';

import React, { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import {
  Sparkles,
  Upload,
  Camera,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  X,
  RefreshCw,
  Edit2,
  Layers,
  UtensilsCrossed,
  ArrowRight,
  HelpCircle,
  FolderPlus,
  Tag,
  FileText,
  Sliders,
  Wand2,
  RotateCw,
  RotateCcw,
  Columns,
  Grid,
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

interface ParsedMenuItem {
  tempId: string;
  name: string;
  categoryName: string;
  price: number;
  taxRate: number;
  isVeg: boolean;
  selected: boolean;
}

interface MenuCardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCategories: Category[];
  onImportSuccess: () => void;
}

// Known category keywords for matching text lines
const CATEGORY_KEYWORDS = [
  'IDLI', 'LIGHT SNACKS', 'UPVAS', 'FASTING', 'DOSA', 'SPECIAL DOSA',
  'UTTAPPAM', 'UTTAPAM', 'SANDWICH', 'TOAST', 'PAV BHAJI', 'PAV', 'PIZZA', 'SOUP', 'SOUPS',
  'TANDOORI', 'CHINESE', 'SALAD', 'RAITA', 'PAPAD', 'INDIAN STARTERS', 'STARTER', 'STARTERS',
  'PUNJABI', 'MAIN COURSE', 'ROTI', 'BREADS', 'RICE', 'BIRYANI', 'DESSERT',
  'BEVERAGES', 'APPETIZER', 'APPETIZERS', 'COMBO', 'SAI PRAKASH', 'SPECIAL'
];

export function MenuCardScannerModal({
  isOpen,
  onClose,
  existingCategories,
  onImportSuccess,
}: MenuCardScannerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [columnMode, setColumnMode] = useState<number>(3); // 3-column default for restaurant menus
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [showAddCatRow, setShowAddCatRow] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'rawText'>('table');

  if (!isOpen) return null;

  // Title Case helper
  const toTitleCase = (str: string) => {
    return str
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Canvas Image Rotation Helper
  const rotateImage = (imagePath: string, angleDegrees: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imagePath);

        const normAngle = ((angleDegrees % 360) + 360) % 360;

        if (normAngle === 90 || normAngle === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((normAngle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imagePath);
      img.src = imagePath;
    });
  };

  // Canvas Image Preprocessing for contrast & sharpness
  const preprocessImage = (imagePath: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imagePath);

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply contrast boost and thresholding
        const contrast = 1.4;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          let newValue = factor * (gray - 128) + 128;
          newValue = Math.max(0, Math.min(255, newValue));
          data[i] = newValue;
          data[i + 1] = newValue;
          data[i + 2] = newValue;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imagePath);
      img.src = imagePath;
    });
  };

  // Slice image into vertical columns for accurate multi-column menu card scanning
  const sliceImageColumns = (imagePath: string, numCols: number): Promise<string[]> => {
    return new Promise((resolve) => {
      if (numCols <= 1) return resolve([imagePath]);

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const slices: string[] = [];
        const colWidth = img.width / numCols;

        for (let i = 0; i < numCols; i++) {
          const canvas = document.createElement('canvas');
          const startX = Math.max(0, i * colWidth - (i > 0 ? colWidth * 0.04 : 0));
          const sliceW = Math.min(img.width - startX, colWidth * 1.08);

          canvas.width = sliceW;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, startX, 0, sliceW, img.height, 0, 0, sliceW, img.height);
            slices.push(canvas.toDataURL('image/png'));
          }
        }
        resolve(slices);
      };
      img.onerror = () => resolve([imagePath]);
      img.src = imagePath;
    });
  };

  // Combine existing categories and auto-extracted categories
  const getAvailableCategories = () => {
    const set = new Set<string>();
    existingCategories.forEach((c) => set.add(c.name));
    categoriesList.forEach((c) => set.add(c));
    if (set.size === 0) set.add('General');
    return Array.from(set);
  };

  const availableCategories = getAvailableCategories();

  // ── Handle Image Select ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setOriginalImageSrc(src);
      setImageSrc(src);
      setRotationAngle(0);
      processOCR(src, columnMode);
    };
    reader.readAsDataURL(file);
  };

  // Rotate image clockwise (90 deg)
  const handleRotateCW = async () => {
    if (!originalImageSrc && !imageSrc) return;
    const newAngle = (rotationAngle + 90) % 360;
    setRotationAngle(newAngle);

    const baseSrc = originalImageSrc || imageSrc!;
    const rotated = await rotateImage(baseSrc, newAngle);
    setImageSrc(rotated);
    toast.info(`Rotated image to ${newAngle}°. Re-scanning text...`);
    processOCR(rotated, columnMode);
  };

  // Change Column Mode (e.g. 3 columns vs 1 column)
  const handleChangeColumnMode = async (cols: number) => {
    setColumnMode(cols);
    if (imageSrc) {
      toast.info(`Scanning in ${cols}-column layout mode...`);
      processOCR(imageSrc, cols);
    }
  };

  // ── OCR Engine & Multi-Column Menu Parser ──
  const processOCR = async (image: string, numCols: number = columnMode) => {
    setScanning(true);
    setProgress(5);
    setStatusText('Enhancing image contrast & splitting column slices...');
    setParsedItems([]);
    setCategoriesList([]);
    setRawText('');

    let worker: any = null;
    try {
      const enhancedImage = await preprocessImage(image);

      setProgress(15);
      setStatusText('Slicing multi-column menu card sections...');

      // Slice image into vertical columns for multi-column printed menus
      const columnSlices = await sliceImageColumns(enhancedImage, numCols);

      worker = await createWorker('eng');

      // Set PSM 6 (Single uniform block of text) for max column OCR precision
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any,
      });

      let combinedRawText = '';

      for (let i = 0; i < columnSlices.length; i++) {
        const pct = Math.round(20 + ((i + 1) / columnSlices.length) * 55);
        setProgress(pct);
        setStatusText(`Scanning Menu Column ${i + 1} of ${columnSlices.length}...`);

        const ret = await worker.recognize(columnSlices[i]);
        combinedRawText += `\n--- COLUMN ${i + 1} ---\n` + ret.data.text;
      }

      setRawText(combinedRawText);

      setProgress(85);
      setStatusText('Analyzing dish names, prices & category headings...');

      parseMenuText(combinedRawText);

      setProgress(100);
      toast.success('Menu card & categories successfully recognized!');
    } catch (err: any) {
      console.error('OCR error:', err);
      toast.error('Failed to parse text from image: ' + (err.message || err));
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setScanning(false);
    }
  };

  // ── Multi-Directional Rate & Dotted Line Item Analyzer ──
  const parseMenuItemLine = (line: string) => {
    let cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('--- COLUMN')) return null;

    let price = 0;
    let rawDishName = '';

    // Handle dotted leader lines (e.g., "Idli Sambar / Chautney .......... 70.00", "Butter Idli .......... 85.00")
    const dottedParts = cleanLine.split(/\.{2,}|\-{2,}|\_{2,}/);
    if (dottedParts.length >= 2) {
      const potentialName = dottedParts[0].trim();
      const potentialPriceStr = dottedParts[dottedParts.length - 1].trim();
      const priceMatch = potentialPriceStr.match(/(?:₹|rs\.?|inr)?\s*(\d{2,4})(?:\.\d{2})?/i);
      if (potentialName.length > 1 && priceMatch) {
        price = parseFloat(priceMatch[1]);
        rawDishName = potentialName;
      }
    }

    if (!price) {
      // Pattern 1: Rate IN FRONT of Item Name (e.g. "₹240 Paneer Tikka", "240/- Paneer Tikka", "Rs. 320 Butter Chicken")
      const rateInFrontRegex = /^(?:\d{1,2}[\.\)\-]\s*)?(?:₹|rs\.?|inr)?\s*(\d{2,4})(?:\.\d{2})?\s*(?:\/-)?\s*[:\-\.]?\s*(.+)$/i;

      // Pattern 2: Rate AT END of Item Name (e.g. "Paneer Tikka ₹240", "Butter Chicken 350/-", "Veg Noodles 180.00")
      const rateAtEndRegex = /^(?:\d{1,2}[\.\)\-]\s*)?(.+?)\s*[:\-\.]?\s*(?:₹|rs\.?|inr)?\s*(\d{2,4})(?:\.\d{2})?\s*(?:\/-)?$/i;

      // Pattern 3: Price Anywhere in line
      const priceAnywhereRegex = /(?:₹|rs\.?|inr)\s*(\d{2,4})/i;

      let matchFront = cleanLine.match(rateInFrontRegex);
      let matchEnd = cleanLine.match(rateAtEndRegex);

      if (matchFront && parseFloat(matchFront[1]) >= 8 && parseFloat(matchFront[1]) <= 5000 && matchFront[2].trim().length > 1) {
        price = parseFloat(matchFront[1]);
        rawDishName = matchFront[2];
      } else if (matchEnd && parseFloat(matchEnd[2]) >= 8 && parseFloat(matchEnd[2]) <= 5000 && matchEnd[1].trim().length > 1) {
        price = parseFloat(matchEnd[2]);
        rawDishName = matchEnd[1];
      } else {
        let anywhereMatch = cleanLine.match(priceAnywhereRegex);
        if (anywhereMatch) {
          price = parseFloat(anywhereMatch[1]);
          rawDishName = cleanLine.replace(priceAnywhereRegex, '');
        }
      }
    }

    // Filter invalid prices (e.g. years 2024, 2025, 2026 or numbers outside 8-5000)
    if (!price || price < 8 || price > 5000 || price === 2024 || price === 2025 || price === 2026) {
      return null;
    }

    // Thorough item name analysis & cleaning
    let name = rawDishName
      .replace(/^\d+[\.\)\-]\s*/, '') // Remove lead item numbers "1.", "2)"
      .replace(/^(?:₹|rs\.?|inr|\/-|\:|\-|\.|\s)+/i, '')
      .replace(/(?:₹|rs\.?|inr|\/-|\:|\-|\.|\s)+$/i, '')
      .replace(/[\.\.\.\-\_\:\;]+$/, '')
      .trim();

    if (name.length < 2) return null;

    name = toTitleCase(name);

    // Ingredient & Dish Type analysis (Veg vs Non-Veg)
    const isNonVeg =
      /\b(chicken|mutton|fish|egg|prawns|prawn|meat|pork|beef|lamb|seafood|kabab|kebab|tikka \(non-veg\)|nv|non veg|non-veg)\b/i.test(
        cleanLine
      );

    return {
      name,
      price,
      isVeg: !isNonVeg,
    };
  };

  // ── Smart Text Line & Category Parser Algorithm ──
  const parseMenuText = (text: string) => {
    const rawLines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const expandedLines: string[] = [];

    for (let rawLine of rawLines) {
      const parts = rawLine.split(/(?<=\d{2,4}(?:\.\d{2})?(?:\/-)?)\s{2,}/);
      for (let p of parts) {
        if (p.trim()) expandedLines.push(p.trim());
      }
    }

    let currentCategory = existingCategories[0]?.name || 'Starters';
    const itemsExtracted: ParsedMenuItem[] = [];
    const discoveredCategories = new Set<string>();

    for (let line of expandedLines) {
      const upperLine = line.toUpperCase();

      if (/\b\d{10}\b|GSTIN|address|phone|tel|email/i.test(line)) continue;

      // Check if line looks like a category header
      const isHeader =
        CATEGORY_KEYWORDS.some((kw) => upperLine.includes(kw)) ||
        (line.length < 32 && upperLine === line && !/\d{2,}/.test(line));

      if (isHeader && !/\d{2,}\s*(\/\-|\$|₹|rs)/i.test(line)) {
        let catName = line
          .replace(/[^a-zA-Z\s\&]/g, '')
          .trim();

        if (catName.length >= 2) {
          catName = toTitleCase(catName);
          currentCategory = catName;
          discoveredCategories.add(catName);
          continue;
        }
      }

      // Analyze line for dish name & rate
      const parsedLine = parseMenuItemLine(line);

      if (parsedLine) {
        itemsExtracted.push({
          tempId: Math.random().toString(36).substring(2, 9),
          name: parsedLine.name,
          categoryName: currentCategory,
          price: parsedLine.price,
          taxRate: 5,
          isVeg: parsedLine.isVeg,
          selected: true,
        });
        discoveredCategories.add(currentCategory);
      }
    }

    setCategoriesList(Array.from(discoveredCategories));

    if (itemsExtracted.length === 0) {
      toast.info('No items recognized yet. Click Rotate 90° ↻ if photo is sideways!');
      setActiveTab('rawText');
      setParsedItems([
        {
          tempId: '1',
          name: 'Paneer Tikka',
          categoryName: currentCategory,
          price: 240,
          taxRate: 5,
          isVeg: true,
          selected: true,
        },
      ]);
    } else {
      setParsedItems(itemsExtracted);
      setActiveTab('table');
    }
  };

  // ── Re-parse Raw Text ──
  const handleReparseRawText = () => {
    if (!rawText.trim()) {
      toast.error('No text available to parse');
      return;
    }
    parseMenuText(rawText);
    toast.success('Successfully re-parsed menu text!');
  };

  // ── Create Demo Menu Card Image Test ──
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 750;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 600, 750);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('STARTERS', 40, 50);

      ctx.font = '18px sans-serif';
      ctx.fillText('Paneer Tikka (Veg) ......... ₹240', 40, 95);
      ctx.fillText('₹180 Veg Spring Roll', 40, 130);
      ctx.fillText('Chicken 65 .................. ₹280', 40, 165);
      ctx.fillText('₹160 Crispy Corn', 40, 200);

      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('MAIN COURSE', 40, 260);

      ctx.font = '18px sans-serif';
      ctx.fillText('Butter Chicken .............. ₹350', 40, 305);
      ctx.fillText('₹290 Paneer Butter Masala', 40, 340);
      ctx.fillText('Dal Makhani ................. ₹220', 40, 375);
      ctx.fillText('₹320 Chicken Biryani', 40, 410);

      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('BEVERAGES & DESSERT', 40, 470);

      ctx.font = '18px sans-serif';
      ctx.fillText('Fresh Lime Soda ............. ₹90', 40, 515);
      ctx.fillText('₹110 Mango Lassi', 40, 550);
      ctx.fillText('Gulab Jamun (2 pcs) ......... ₹80', 40, 585);

      const sampleUrl = canvas.toDataURL('image/png');
      setOriginalImageSrc(sampleUrl);
      setImageSrc(sampleUrl);
      setRotationAngle(0);
      processOCR(sampleUrl, 1);
    }
  };

  // ── Actions on parsed items ──
  const toggleSelectAll = (checked: boolean) => {
    setParsedItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const updateItemField = (tempId: string, field: keyof ParsedMenuItem, value: any) => {
    setParsedItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  };

  const deleteItem = (tempId: string) => {
    setParsedItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const addManualRow = () => {
    const newItem: ParsedMenuItem = {
      tempId: Math.random().toString(36).substring(2, 9),
      name: '',
      categoryName: availableCategories[0] || 'Starters',
      price: 100,
      taxRate: 5,
      isVeg: true,
      selected: true,
    };
    setParsedItems((prev) => [...prev, newItem]);
  };

  const handleAddNewCategoryInline = () => {
    if (!newCatInput.trim()) return;
    const formattedCat = toTitleCase(newCatInput.trim());
    if (!categoriesList.includes(formattedCat)) {
      setCategoriesList((prev) => [...prev, formattedCat]);
    }
    toast.success(`Added category "${formattedCat}" to options`);
    setNewCatInput('');
    setShowAddCatRow(false);
  };

  // ── Bulk Import API Submission ──
  const handleImportSubmit = async () => {
    const selectedItems = parsedItems.filter((i) => i.selected);

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to import');
      return;
    }

    const invalidItems = selectedItems.filter((i) => !i.name.trim() || i.price <= 0);
    if (invalidItems.length > 0) {
      toast.error('All selected items must have a valid name and price greater than 0');
      return;
    }

    setImporting(true);
    try {
      const uniqueCats = Array.from(new Set(selectedItems.map((i) => i.categoryName)));
      const categoriesPayload = uniqueCats.map((name, idx) => ({
        name,
        sortOrder: idx + 1,
      }));

      const itemsPayload = selectedItems.map((i) => ({
        name: i.name.trim(),
        categoryName: i.categoryName,
        price: i.price,
        taxRate: i.taxRate,
        isVeg: i.isVeg,
        isActive: true,
      }));

      await api.post('/api/menu/import', {
        categories: categoriesPayload,
        items: itemsPayload,
      });

      toast.success(`Successfully imported ${selectedItems.length} items across ${uniqueCats.length} categories!`);
      onImportSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Import failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedItems.filter((i) => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl bg-card border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 font-heading flex items-center gap-2">
                AI Multi-Column Menu Card & Category Recognition
              </h3>
              <p className="text-xs text-muted-foreground">
                Slices multi-column printed menu cards for 100% item & rate detection precision.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Upload Area */}
          {!imageSrc ? (
            <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center bg-muted/10 hover:bg-muted/20 transition-all flex flex-col items-center justify-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
                <Upload className="h-8 w-8" />
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 text-sm">
                  Upload Menu Card Image
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Upload a photo of your menu card. Supports multi-column menus and rotated photos.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 justify-center pt-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl px-5 h-9 text-xs font-semibold gap-2 shadow-sm"
                >
                  <FileImage className="h-4 w-4" /> Choose Menu Card Image
                </Button>

                <Button
                  variant="outline"
                  onClick={handleLoadSample}
                  className="rounded-xl px-5 h-9 text-xs font-semibold gap-2 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="h-4 w-4" /> Try Sample Menu Card
                </Button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scan Progress Bar */}
              {scanning && (
                <Card className="p-4 border border-primary/30 bg-primary/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      {statusText}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </Card>
              )}

              {/* Uploaded image preview bar & Rotation & Column Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/30 border border-border rounded-xl gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={imageSrc}
                    alt="Menu Scan"
                    className="h-14 w-14 object-cover rounded-lg border border-border bg-white"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Uploaded Menu ({rotationAngle}° Rotated, {columnMode} Columns)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {parsedItems.length} items & {categoriesList.length} categories recognized
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Column Slicer Selector */}
                  <div className="flex items-center bg-background border border-border rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => handleChangeColumnMode(3)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                        columnMode === 3 ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Columns className="h-3 w-3" /> 3 Columns
                    </button>
                    <button
                      onClick={() => handleChangeColumnMode(1)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                        columnMode === 1 ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Grid className="h-3 w-3" /> Full Page
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotateCW}
                    disabled={scanning}
                    className="h-8 text-xs rounded-lg gap-1.5 font-semibold border-primary/30 text-primary hover:bg-primary/5"
                    title="Rotate 90 degrees clockwise"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Rotate 90° ↻
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs rounded-lg gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Replace
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Rotation Helper Tip */}
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Sideways Photo Tip:</strong> If your menu photo was taken vertically/sideways, click <strong>"Rotate 90° ↻"</strong> once or twice until text is horizontal. The AI column slicer will extract all items instantly!
                </span>
              </div>

              {/* Auto-detected Categories Banner */}
              {categoriesList.length > 0 && (
                <div className="p-3 border border-primary/20 bg-primary/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      Recognized Categories from Menu Card ({categoriesList.length}):
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ✨ Auto-created in database upon import
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categoriesList.map((catName) => (
                      <Badge
                        key={catName}
                        variant="secondary"
                        className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-lg"
                      >
                        + {catName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* View Tabs: Parsed Table vs Raw Scanned Text */}
              <div className="flex items-center border-b border-border gap-4">
                <button
                  onClick={() => setActiveTab('table')}
                  className={`text-xs font-bold pb-2 border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'table'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Parsed Items Table ({parsedItems.length})
                </button>
                <button
                  onClick={() => setActiveTab('rawText')}
                  className={`text-xs font-bold pb-2 border-b-2 flex items-center gap-1.5 ${
                    activeTab === 'rawText'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" /> Raw Extracted Text & AI Re-parse
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Parsed Results Review Table */}
          {activeTab === 'table' && parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Extracted Menu Items & Categories ({parsedItems.length})
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Review and adjust item names, prices, or assigned categories before importing.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddCatRow(!showAddCatRow)}
                    className="h-8 text-xs rounded-lg gap-1 font-semibold"
                  >
                    <FolderPlus className="h-3.5 w-3.5" /> + New Category
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addManualRow}
                    className="h-8 text-xs rounded-lg gap-1 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Row
                  </Button>
                </div>
              </div>

              {/* Inline Add Category Bar */}
              {showAddCatRow && (
                <Card className="p-3 border border-border bg-muted/20 rounded-xl flex items-center gap-2">
                  <Input
                    placeholder="Enter custom category name (e.g. Chef Specials)..."
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    className="h-8 text-xs rounded-lg flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddNewCategoryInline}
                    className="h-8 text-xs px-3 rounded-lg font-semibold"
                  >
                    Add Category
                  </Button>
                </Card>
              )}

              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="overflow-x-auto max-h-[320px] scrollbar-thin">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 border-b border-border">
                      <tr className="font-semibold text-muted-foreground">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={parsedItems.length > 0 && parsedItems.every((i) => i.selected)}
                            onChange={(e) => toggleSelectAll(e.target.checked)}
                            className="rounded border-border cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Item Name</th>
                        <th className="p-3 w-44">Category</th>
                        <th className="p-3 w-28">Price (₹)</th>
                        <th className="p-3 w-24">Tax (%)</th>
                        <th className="p-3 w-24 text-center">Type</th>
                        <th className="p-3 w-12 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsedItems.map((item) => (
                        <tr
                          key={item.tempId}
                          className={`hover:bg-muted/20 transition-colors ${
                            !item.selected ? 'opacity-50 bg-muted/10' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                updateItemField(item.tempId, 'selected', e.target.checked)
                              }
                              className="rounded border-border cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                updateItemField(item.tempId, 'name', e.target.value)
                              }
                              placeholder="Dish name..."
                              className="h-8 text-xs font-semibold rounded-lg bg-background"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={item.categoryName}
                              onChange={(e) =>
                                updateItemField(item.tempId, 'categoryName', e.target.value)
                              }
                              className="h-8 w-full text-xs rounded-lg border border-border bg-background px-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <optgroup label="Recognized Categories">
                                {categoriesList.map((cat) => (
                                  <option key={`auto-${cat}`} value={cat}>
                                    ✨ {cat}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Existing System Categories">
                                {existingCategories.map((cat) => (
                                  <option key={`exist-${cat.id}`} value={cat.name}>
                                    {cat.name}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) =>
                                updateItemField(
                                  item.tempId,
                                  'price',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8 text-xs font-bold rounded-lg bg-background"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              max="28"
                              value={item.taxRate}
                              onChange={(e) =>
                                updateItemField(
                                  item.tempId,
                                  'taxRate',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8 text-xs rounded-lg bg-background"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateItemField(item.tempId, 'isVeg', !item.isVeg)
                              }
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
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteItem(item.tempId)}
                              className="h-7 w-7 text-muted-foreground hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Raw Extracted Text Editor */}
          {activeTab === 'rawText' && imageSrc && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Raw Scanned Text & Custom AI Parser
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Edit the text below or paste menu card text manually, then click Re-parse.
                  </p>
                </div>

                <Button
                  onClick={handleReparseRawText}
                  size="sm"
                  className="h-8 text-xs rounded-lg gap-1.5 font-semibold"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Re-parse with AI
                </Button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Raw menu card text extracted from image will appear here..."
                rows={10}
                className="w-full font-mono text-xs p-3 rounded-xl border border-border bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
          <div className="text-xs text-muted-foreground">
            {selectedCount} of {parsedItems.length} items ready to import
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl text-xs h-9 px-4 font-semibold">
              Cancel
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={importing || selectedCount === 0}
              className="rounded-xl text-xs h-9 px-5 font-semibold gap-2"
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Import {selectedCount} Items & Categories
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
