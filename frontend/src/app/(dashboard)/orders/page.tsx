'use client';

import React, { useState } from 'react';
import { Table, ShoppingBag, Truck } from 'lucide-react';
import DineInView from './DineInView';
import TakeawayView from './TakeawayView';
import DeliveryView from './DeliveryView';

type POSTab = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export default function ConsolidatedOrdersPage() {
  const [activeTab, setActiveTab] = useState<POSTab>('DINE_IN');

  return (
    <div className="h-[calc(100vh-9.5rem)] flex flex-col space-y-4 overflow-hidden">
      
      {/* Tab bar header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-border bg-card p-1.5 rounded-xl shadow-sm max-w-md">
        <button
          onClick={() => setActiveTab('DINE_IN')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'DINE_IN'
              ? 'bg-primary text-white shadow-md shadow-primary/10'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Table className="h-4 w-4" />
          Table View
        </button>

        <button
          onClick={() => setActiveTab('TAKEAWAY')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'TAKEAWAY'
              ? 'bg-primary text-white shadow-md shadow-primary/10'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Takeaway
        </button>

        <button
          onClick={() => setActiveTab('DELIVERY')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'DELIVERY'
              ? 'bg-primary text-white shadow-md shadow-primary/10'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4" />
          Delivery
        </button>
      </div>

      {/* Main Active Tab view container */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'DINE_IN' && <DineInView />}
        {activeTab === 'TAKEAWAY' && <TakeawayView />}
        {activeTab === 'DELIVERY' && <DeliveryView />}
      </div>

    </div>
  );
}
