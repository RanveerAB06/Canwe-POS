import { Prisma } from '@prisma/client';

export const deductStockForOrder = async (
  orderId: string,
  tx: Prisma.TransactionClient
): Promise<void> => {
  // 1. Fetch Order Items
  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
  });

  // 2. Fetch the order details to identify branchId
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { branchId: true },
  });

  if (!order) return;

  for (const item of orderItems) {
    // 3. Find Recipes for this MenuItem
    const recipes = await tx.recipe.findMany({
      where: { menuItemId: item.menuItemId },
    });

    for (const recipe of recipes) {
      // Calculate total ingredient quantity to deduct
      const qtyToDeduct = Number(recipe.quantityNeeded) * item.quantity;

      // 4. Update Stock Level for the matching InventoryItem in this branch
      const inventoryItem = await tx.inventoryItem.findFirst({
        where: {
          id: recipe.inventoryItemId,
          branchId: order.branchId,
        },
      });

      if (inventoryItem) {
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            stockLevel: {
              decrement: qtyToDeduct,
            },
          },
        });
      }
    }
  }
};
