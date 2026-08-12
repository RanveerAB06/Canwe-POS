import { Router } from 'express';
import {
  createSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  createInventoryItem,
  getInventoryItems,
  createRecipe,
  getLowStockAlerts,
  createPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
} from '../controllers/inventory.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Suppliers
router.post('/suppliers', createSupplier);
router.get('/suppliers', getSuppliers);
router.put('/suppliers/:supplierId', updateSupplier);
router.delete('/suppliers/:supplierId', deleteSupplier);

// Ingredients (Inventory Items)
router.post('/items', createInventoryItem);
router.get('/items', getInventoryItems);
router.get('/alerts', getLowStockAlerts);

// Recipes
router.post('/recipes', createRecipe);

// POs
router.post('/purchase-orders', createPurchaseOrder);
router.get('/purchase-orders', getPurchaseOrders);
router.put('/purchase-orders/:poId/status', updatePurchaseOrderStatus);

export default router;

