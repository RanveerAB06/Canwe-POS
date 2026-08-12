import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/db';
import { AppError } from '../middlewares/error.middleware';

// Send invoice receipt via WhatsApp / SMS (Mock Service)
export const sendInvoiceNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const restaurantId = req.user?.restaurantId;
    const { billId, phone } = req.body;

    if (!restaurantId) {
      throw new AppError('Tenant identifier missing', 400);
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        order: {
          include: {
            table: true,
            branch: true,
          },
        },
      },
    });

    if (!bill || bill.order.branch.restaurantId !== restaurantId) {
      throw new AppError('Invoice not found or access denied', 404);
    }

    // Mock Send
    console.log(`[SMS/WhatsApp Gateway] Dispatching invoice ${bill.invoiceNumber} to ${phone}...`);
    const messageBody = `Hello! Thank you for dining at our restaurant. Your total bill is $${Number(bill.grandTotal).toFixed(2)}. View details: https://canwe.pos/receipt/${bill.invoiceNumber}`;

    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        gateway: 'Twilio / WhatsApp API (Mocked)',
        recipient: phone,
        invoiceNumber: bill.invoiceNumber,
        message: messageBody,
        status: 'DELIVERED',
      },
    });
  } catch (error) {
    next(error);
  }
};
