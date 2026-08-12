export interface WhatsAppBillDetails {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  invoiceNumber: string;
  tableName?: string;
  orderType?: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  grandTotal: number;
  date?: string;
}

export function formatWhatsAppBillText(details: WhatsAppBillDetails): string {
  const {
    restaurantName,
    restaurantAddress,
    invoiceNumber,
    tableName,
    orderType = 'Dine In',
    customerName,
    items,
    subtotal,
    taxAmount,
    discountAmount = 0,
    grandTotal,
    date = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  } = details;

  let msg = `🧾 *INVOICE RECEIPT*\n`;
  msg += `🏢 *${restaurantName.toUpperCase()}*\n`;
  if (restaurantAddress) {
    msg += `📍 ${restaurantAddress}\n`;
  }
  msg += `------------------------------------\n`;
  msg += `📄 *Bill No:* ${invoiceNumber}\n`;
  if (customerName) {
    msg += `👤 *Customer:* ${customerName}\n`;
  }
  if (tableName) {
    msg += `🪑 *Table:* ${tableName}\n`;
  } else {
    msg += `📦 *Type:* ${orderType}\n`;
  }
  msg += `📅 *Date:* ${date}\n`;
  msg += `------------------------------------\n`;
  msg += `📋 *ORDER SUMMARY:*\n`;

  items.forEach((item) => {
    const itemTotal = Number(item.price) * item.quantity;
    msg += `• ${item.quantity}x ${item.name} - ₹${itemTotal.toLocaleString('en-IN')}\n`;
  });

  msg += `------------------------------------\n`;
  msg += `Subtotal: ₹${Number(subtotal).toLocaleString('en-IN')}\n`;
  msg += `Tax (GST): ₹${Number(taxAmount).toLocaleString('en-IN')}\n`;
  if (discountAmount > 0) {
    msg += `Discount: -₹${Number(discountAmount).toLocaleString('en-IN')}\n`;
  }
  msg += `💰 *TOTAL AMOUNT: ₹${Number(grandTotal).toLocaleString('en-IN')}*\n`;
  msg += `------------------------------------\n`;
  msg += `Thank you for dining with us at *${restaurantName}*! Have a wonderful day! 🙏✨`;

  return msg;
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

export function openWhatsAppBill(phone: string, details: WhatsAppBillDetails): boolean {
  const sanitizedPhone = cleanPhoneNumber(phone);
  const text = formatWhatsAppBillText(details);
  const encoded = encodeURIComponent(text);

  let url = '';
  if (sanitizedPhone) {
    url = `https://wa.me/${sanitizedPhone}?text=${encoded}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encoded}`;
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}
