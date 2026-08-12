import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';
import { OrderStatus, PaymentStatus, TableStatus, KotStatus } from '@prisma/client';
import { deductStockForOrder } from '../services/inventory.service';

// Generate a sequential invoice number based on restaurant settings
const generateInvoiceNumber = async (restaurantId: string): Promise<string> => {
  let prefix = 'INV-';
  let startingNum = 1;

  try {
    const invSetting = await prisma.setting.findUnique({
      where: {
        restaurantId_key: {
          restaurantId,
          key: 'invoice',
        },
      },
    });

    if (invSetting && invSetting.value) {
      let parsed = invSetting.value as any;
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.invoicePrefix !== undefined && parsed.invoicePrefix !== null) {
          prefix = String(parsed.invoicePrefix);
        }
        if (parsed.startingNumber !== undefined && parsed.startingNumber !== null) {
          startingNum = parseInt(String(parsed.startingNumber)) || 1;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read invoice setting, using defaults:', e);
  }

  // Count existing bills in this restaurant to compute next sequential invoice number
  const totalBills = await prisma.bill.count({
    where: {
      order: {
        branch: {
          restaurantId,
        },
      },
    },
  });

  const nextSeq = startingNum + totalBills;
  return `${prefix}${nextSeq}`;
};


// 1. Generate Bill for an Order
export const generateBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { orderId, discountAmount = 0.0, serviceChargeRate = 0.0 } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { bills: true },
    });

    if (!order) {
      throw new AppError('Running order not found', 404);
    }

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new AppError('Cannot generate bill for a paid or cancelled order', 400);
    }

    // Calculations
    const subtotal = Number(order.subtotal);
    const taxAmount = Number(order.tax);
    const serviceCharge = subtotal * (serviceChargeRate / 100);

    let packingChargeAmount = 0;
    try {
      const taxSetting = await prisma.setting.findUnique({
        where: { restaurantId_key: { restaurantId, key: 'taxes' } },
      });
      if (taxSetting && taxSetting.value) {
        let parsed = taxSetting.value as any;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (_) {}
        }
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (_) {}
        }
        if (parsed && (order.orderType === 'TAKEAWAY' || (order as any).orderType === 'TAKEAWAY')) {
          if (parsed.applyPackingTakeaway ?? true) {
            packingChargeAmount = Number(parsed.packingCharge) || 0;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read tax setting for packing charge:', e);
    }

    const grandTotal = Math.max(0, subtotal + taxAmount + serviceCharge + packingChargeAmount - discountAmount);


    const invoiceNumber = await generateInvoiceNumber(restaurantId);

    const bill = await prisma.$transaction(async (tx) => {
      // Delete any previous unpaid bills for this order to allow recalculation
      await tx.bill.deleteMany({
        where: {
          orderId,
          paymentStatus: { not: PaymentStatus.PAID },
        },
      });

      const newBill = await tx.bill.create({
        data: {
          orderId,
          invoiceNumber,
          paymentStatus: PaymentStatus.UNPAID,
          discountAmount,
          taxAmount,
          serviceCharge,
          grandTotal,
        },
      });


      // Update Order Status to BILLED and shift KOTs to SERVED (History)
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.BILLED },
      });

      await tx.kOT.updateMany({
        where: { orderId },
        data: { status: KotStatus.SERVED },
      });

      // Log event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          restaurantId,
          action: 'GENERATE_BILL',
          entity: 'Bill',
          entityId: newBill.id,
          newValue: JSON.stringify(newBill),
        },
      });

      return newBill;
    });

    req.io?.to(branchId).emit('bill_update', { action: 'GENERATE', bill });
    req.io?.to(branchId).emit('order_update', { action: 'BILL', orderId });

    res.status(201).json({
      success: true,
      data: { bill },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Record Payments for a Bill
export const recordPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { billId } = req.params;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { payments } = req.body; // Array of { method, amount, referenceNumber }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { order: true },
    });

    if (!bill) {
      throw new AppError('Invoice not found', 404);
    }

    if (bill.paymentStatus === PaymentStatus.PAID) {
      throw new AppError('This bill is already fully paid', 400);
    }

    // Verify ownership of the order linked to the bill
    const order = await prisma.order.findFirst({
      where: { id: bill.orderId, branchId },
    });
    if (!order) {
      throw new AppError('Access denied', 403);
    }

    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const grandTotal = Number(bill.grandTotal);

    let paymentStatus: PaymentStatus = PaymentStatus.PARTIAL;
    if (totalPaid >= grandTotal) {
      paymentStatus = PaymentStatus.PAID;
    }

    const updatedBill = await prisma.$transaction(async (tx) => {
      // 1. Record Payments
      const paymentRecords = payments.map((p: any) => ({
        billId,
        amount: p.amount,
        method: p.method,
        referenceNumber: p.referenceNumber,
      }));

      await tx.payment.createMany({
        data: paymentRecords,
      });

      // 2. Update Bill Status
      const updated = await tx.bill.update({
        where: { id: billId },
        data: { paymentStatus },
        include: { payments: true },
      });

      // 3. If Fully Paid, update Order and Table
      if (paymentStatus === PaymentStatus.PAID) {
        await tx.order.update({
          where: { id: bill.orderId },
          data: { status: OrderStatus.PAID },
        });

        await tx.kOT.updateMany({
          where: { orderId: bill.orderId },
          data: { status: KotStatus.SERVED },
        });

        // Deduct inventory ingredients based on recipes
        await deductStockForOrder(bill.orderId, tx);

        if (bill.order.tableId) {
          await tx.table.update({
            where: { id: bill.order.tableId },
            data: { status: TableStatus.AVAILABLE },
          });
        }
      }

      // Log event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          restaurantId,
          action: 'RECORD_PAYMENT',
          entity: 'Bill',
          entityId: billId,
          newValue: JSON.stringify({ billStatus: paymentStatus, totalPaid }),
        },
      });

      return updated;
    });

    req.io?.to(branchId).emit('bill_update', { action: 'PAY', bill: updatedBill });
    if (paymentStatus === PaymentStatus.PAID) {
      req.io?.to(branchId).emit('order_update', { action: 'PAID', orderId: bill.orderId });
      if (bill.order.tableId) {
        req.io?.to(branchId).emit('table_update', { action: 'STATUS', tableId: bill.order.tableId, status: TableStatus.AVAILABLE });
      }
    }

    res.status(200).json({
      success: true,
      data: { bill: updatedBill },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Split Bill Equally
export const splitBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { orderId, splitCount } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, branchId },
    });

    if (!order) {
      throw new AppError('Running order not found', 404);
    }

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new AppError('Cannot split a paid or cancelled order', 400);
    }

    // Split amount calculation
    const orderTotal = Number(order.total);
    const splitTotal = Number((orderTotal / splitCount).toFixed(2));
    const subtotal = Number((Number(order.subtotal) / splitCount).toFixed(2));
    const taxAmount = Number((Number(order.tax) / splitCount).toFixed(2));

    const generatedBills = await prisma.$transaction(async (tx) => {
      // Delete previous unpaid bills
      await tx.bill.deleteMany({
        where: {
          orderId,
          paymentStatus: { not: PaymentStatus.PAID },
        },
      });

      const billsData = [];
      for (let i = 0; i < splitCount; i++) {
        const invoiceNumber = `${generateInvoiceNumber()}-S${i + 1}`;
        billsData.push({
          orderId,
          invoiceNumber,
          paymentStatus: PaymentStatus.UNPAID,
          discountAmount: 0.0,
          taxAmount,
          serviceCharge: 0.0,
          grandTotal: splitTotal,
        });
      }

      await tx.bill.createMany({
        data: billsData,
      });

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.BILLED },
      });

      const bills = await tx.bill.findMany({
        where: { orderId },
      });

      return bills;
    });

    req.io?.to(branchId).emit('bill_update', { action: 'SPLIT_BILL', orderId, bills: generatedBills });

    res.status(200).json({
      success: true,
      message: `Bill split into ${splitCount} parts successfully`,
      data: { bills: generatedBills },
    });
  } catch (error) {
    next(error);
  }
};

// 4. Merge Bills (Consolidating Orders)
export const mergeBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { orderIds } = req.body; // Array of Order UUIDs to merge

    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        branchId,
        status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] },
      },
      include: { items: true },
    });

    if (orders.length !== orderIds.length) {
      throw new AppError('One or more orders not found, or they are already paid/cancelled', 404);
    }

    const primaryOrder = orders[0];
    const secondaryOrders = orders.slice(1);

    const mergedBill = await prisma.$transaction(async (tx) => {
      // 1. Move items from secondary orders to primary order
      for (const secOrder of secondaryOrders) {
        for (const item of secOrder.items) {
          // Check if item already exists in primary order
          const existingItem = await tx.orderItem.findFirst({
            where: { orderId: primaryOrder.id, menuItemId: item.menuItemId },
          });

          if (existingItem) {
            // Update quantity
            await tx.orderItem.update({
              where: { id: existingItem.id },
              data: { quantity: existingItem.quantity + item.quantity },
            });
          } else {
            // Relink to primary order
            await tx.orderItem.update({
              where: { id: item.id },
              data: { orderId: primaryOrder.id },
            });
          }
        }

        // Cancel the secondary order
        await tx.order.update({
          where: { id: secOrder.id },
          data: { status: OrderStatus.CANCELLED },
        });

        // Set secondary order table back to available
        if (secOrder.tableId) {
          await tx.table.update({
            where: { id: secOrder.tableId },
            data: { status: TableStatus.AVAILABLE },
          });
        }
      }

      // 2. Recalculate totals for primary order
      const primaryItems = await tx.orderItem.findMany({
        where: { orderId: primaryOrder.id },
      });

      let subtotal = 0;
      let tax = 0;

      for (const item of primaryItems) {
        const menuItem = await tx.menuItem.findUnique({
          where: { id: item.menuItemId },
        });
        if (menuItem) {
          const itemSub = Number(item.price || menuItem.price) * item.quantity;
          subtotal += itemSub;
          tax += itemSub * (Number(menuItem.taxRate) / 100);
        }
      }

      const total = subtotal + tax;

      const updatedPrimaryOrder = await tx.order.update({
        where: { id: primaryOrder.id },
        data: { subtotal, tax, total },
      });

      // 3. Generate combined Bill
      const invoiceNumber = generateInvoiceNumber();
      const bill = await tx.bill.create({
        data: {
          orderId: primaryOrder.id,
          invoiceNumber,
          paymentStatus: PaymentStatus.UNPAID,
          discountAmount: 0.0,
          taxAmount: tax,
          serviceCharge: 0.0,
          grandTotal: total,
        },
      });

      // Set primary order status to billed
      await tx.order.update({
        where: { id: primaryOrder.id },
        data: { status: OrderStatus.BILLED },
      });

      // Log event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          restaurantId,
          action: 'MERGE_BILLS',
          entity: 'Bill',
          entityId: bill.id,
          newValue: JSON.stringify({ primaryOrderId: primaryOrder.id, mergedOrderIds: orderIds }),
        },
      });

      return bill;
    });

    req.io?.to(branchId).emit('bill_update', { action: 'MERGE', bill: mergedBill });
    secondaryOrders.forEach((o) => {
      req.io?.to(branchId).emit('order_update', { action: 'CANCEL', orderId: o.id });
      if (o.tableId) {
        req.io?.to(branchId).emit('table_update', { action: 'STATUS', tableId: o.tableId, status: TableStatus.AVAILABLE });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Orders merged and single bill generated successfully',
      data: { bill: mergedBill },
    });
  } catch (error) {
    next(error);
  }
};

// 5. Void Bill
export const voidBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { billId } = req.params;
    const { reason } = req.body;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { order: true },
    });

    if (!bill) {
      throw new AppError('Invoice not found', 404);
    }

    // Void operations: cancel order and make table available
    await prisma.$transaction(async (tx) => {
      // Mark order as cancelled
      await tx.order.update({
        where: { id: bill.orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // Mark bill as unpaid or delete it
      await tx.bill.delete({
        where: { id: billId },
      });

      if (bill.order.tableId) {
        await tx.table.update({
          where: { id: bill.order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      // Log event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          restaurantId,
          action: 'VOID_BILL',
          entity: 'Bill',
          entityId: billId,
          oldValue: JSON.stringify(bill),
          newValue: JSON.stringify({ reason }),
        },
      });
    });

    req.io?.to(branchId).emit('bill_update', { action: 'VOID', billId });
    req.io?.to(branchId).emit('order_update', { action: 'CANCEL', orderId: bill.orderId });
    if (bill.order.tableId) {
      req.io?.to(branchId).emit('table_update', { action: 'STATUS', tableId: bill.order.tableId, status: TableStatus.AVAILABLE });
    }

    res.status(200).json({
      success: true,
      message: 'Bill successfully voided and associated order has been cancelled',
    });
  } catch (error) {
    next(error);
  }
};

// 6. Refund Bill
export const refundBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;
    const { billId } = req.params;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { payments: true },
    });

    if (!bill) {
      throw new AppError('Invoice not found', 404);
    }

    if (bill.paymentStatus !== PaymentStatus.PAID) {
      throw new AppError('Only fully paid bills can be refunded', 400);
    }

    await prisma.$transaction(async (tx) => {
      // Mark bill as unpaid/refunded
      await tx.bill.update({
        where: { id: billId },
        data: { paymentStatus: PaymentStatus.UNPAID },
      });

      // Clear payments
      await tx.payment.deleteMany({
        where: { billId },
      });

      // Log event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id,
          restaurantId,
          action: 'REFUND_BILL',
          entity: 'Bill',
          entityId: billId,
          oldValue: JSON.stringify(bill),
        },
      });
    });

    req.io?.to(branchId).emit('bill_update', { action: 'REFUND', billId });

    res.status(200).json({
      success: true,
      message: 'Bill successfully refunded',
    });
  } catch (error) {
    next(error);
  }
};

// 7. Get Bills (query list)
export const getBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const branchId = req.user?.branchId;

    if (!restaurantId || !branchId) {
      throw new AppError('Context details missing', 400);
    }

    const { status, startDate, endDate } = req.query;

    const whereClause: any = {
      order: {
        branchId,
      },
    };

    if (status) {
      whereClause.paymentStatus = status as PaymentStatus;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(String(startDate));
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    const bills = await prisma.bill.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            items: {
              include: {
                menuItem: true,
              },
            },
            table: true,
          },
        },
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      data: { bills },
    });
  } catch (error) {
    next(error);
  }
};
