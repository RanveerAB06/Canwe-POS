export interface PrintItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

export const generateThermalKOT = (
  restaurantName: string,
  tableName: string,
  kotNumber: string,
  captainName: string,
  items: PrintItem[],
  width: '58mm' | '80mm' = '80mm'
): string => {
  const lineChar = width === '80mm' ? 40 : 30;
  const divider = '-'.repeat(lineChar);
  const doubleDivider = '='.repeat(lineChar);

  let output = '';
  output += doubleDivider + '\n';
  output += `   KITCHEN ORDER TICKET (KOT)   \n`;
  output += doubleDivider + '\n';
  output += `Restaurant : ${restaurantName.slice(0, lineChar - 13)}\n`;
  output += `Table      : ${tableName}\n`;
  output += `KOT No     : ${kotNumber}\n`;
  output += `Captain    : ${captainName}\n`;
  output += `Date       : ${new Date().toLocaleString()}\n`;
  output += divider + '\n';
  
  // Header
  if (width === '80mm') {
    output += 'Item Name                      Qty      \n';
  } else {
    output += 'Item Name                 Qty  \n';
  }
  output += divider + '\n';

  // Items
  items.forEach((item) => {
    const qtyStr = String(item.quantity);
    const itemWidth = lineChar - qtyStr.length - 2;
    let nameStr = item.name.slice(0, itemWidth).padEnd(itemWidth);
    output += `${nameStr} x${qtyStr}\n`;
    if (item.notes) {
      output += `  * Notes: ${item.notes}\n`;
    }
  });

  output += divider + '\n';
  output += `           * FOR KITCHEN USE *          \n`;
  output += doubleDivider + '\n\n\n\n';

  return output;
};

export const generateThermalBill = (
  restaurantName: string,
  branchName: string,
  tableName: string,
  invoiceNumber: string,
  items: PrintItem[],
  subtotal: number,
  tax: number,
  serviceCharge: number,
  discount: number,
  grandTotal: number,
  width: '58mm' | '80mm' = '80mm'
): string => {
  const lineChar = width === '80mm' ? 40 : 30;
  const divider = '-'.repeat(lineChar);
  const doubleDivider = '='.repeat(lineChar);

  let output = '';
  output += doubleDivider + '\n';
  output += `        ${restaurantName.toUpperCase()}        \n`;
  output += `        ${branchName}        \n`;
  output += doubleDivider + '\n';
  output += `Invoice No : ${invoiceNumber}\n`;
  output += `Table      : ${tableName}\n`;
  output += `Date       : ${new Date().toLocaleString()}\n`;
  output += divider + '\n';

  // Items Header
  if (width === '80mm') {
    output += 'Item Name            Qty   Rate   Amt   \n';
  } else {
    output += 'Item Name       Qty  Rate  Amt\n';
  }
  output += divider + '\n';

  // Items rows
  items.forEach((item) => {
    const qty = item.quantity;
    const rate = item.price || 0;
    const amt = qty * rate;
    
    if (width === '80mm') {
      const line = `${item.name.slice(0, 18).padEnd(18)} ${String(qty).padStart(3)} ${rate.toFixed(1).padStart(6)} ${amt.toFixed(1).padStart(7)}`;
      output += line + '\n';
    } else {
      const line = `${item.name.slice(0, 12).padEnd(12)} ${String(qty).padStart(2)} ${rate.toFixed(0).padStart(4)} ${amt.toFixed(0).padStart(5)}`;
      output += line + '\n';
    }
  });

  output += divider + '\n';
  output += `Subtotal       : ${subtotal.toFixed(2).padStart(12)}\n`;
  output += `Tax (GST)      : ${tax.toFixed(2).padStart(12)}\n`;
  output += `Service Charge : ${serviceCharge.toFixed(2).padStart(12)}\n`;
  output += `Discount       : -${discount.toFixed(2).padStart(11)}\n`;
  output += divider + '\n';
  output += `GRAND TOTAL    : ${grandTotal.toFixed(2).padStart(12)}\n`;
  output += doubleDivider + '\n';
  output += `          THANK YOU FOR VISITING!       \n`;
  output += doubleDivider + '\n\n\n\n';

  return output;
};
