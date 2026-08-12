const http = require('http');

const PORT = 4000;

async function runTests() {
  console.log('--- STARTING SYSTEM INTEGRATION TESTS (PHASES 7 - 14) ---');
  
  const testRestaurant = {
    restaurantName: 'Bella Italia Complete',
    restaurantSlug: `bella-italia-comp-${Date.now()}`,
    email: `owner-${Date.now()}@bellacomplete.com`,
    password: 'bella_password_123',
    firstName: 'Bella',
    lastName: 'Italia',
  };

  let accessToken = '';
  let branchId = '';
  let restaurantId = '';
  let table1Id = '';
  let categoryId = '';
  let menuItemId = '';
  let orderId = '';
  let billId = '';
  let ingredientId = '';
  let supplierId = '';
  let customerId = '';
  let userId = '';

  try {
    // 1. Register Owner & Restaurant
    console.log('[Setup] Registering user/restaurant...');
    const regRes = await post('/api/auth/register', testRestaurant);
    if (!regRes.success) throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    accessToken = regRes.data.tokens.accessToken;
    userId = regRes.data.user.id;
    restaurantId = regRes.data.restaurant.id;
    
    // Fetch branch ID
    const meRes = await get('/api/auth/me', accessToken);
    branchId = meRes.data.user.branch.id;
    console.log(`[Setup] Retrieved active branch: ${branchId} | Restaurant: ${restaurantId}`);

    // Create Table T1
    console.log('[Setup] Setting up Table T1...');
    const t1Res = await post('/api/tables', { branchId, number: 'T1', capacity: 4 }, accessToken);
    table1Id = t1Res.data.table.id;

    // Create Category & Item
    console.log('[Setup] Setting up menu item (Margarita Pizza @ $10.00, GST 5%)...');
    const catRes = await post('/api/menu/categories', { name: 'Pizzas' }, accessToken);
    categoryId = catRes.data.category.id;
    const itemRes = await post('/api/menu/items', {
      categoryId,
      name: 'Margarita Pizza',
      price: 10.00,
      taxRate: 5.0,
      isVeg: true,
    }, accessToken);
    menuItemId = itemRes.data.item.id;

    // 2. Setup Supplier and purchase order
    console.log('\n[Test 1] Testing Supplier Registry...');
    const supRes = await post('/api/inventory/suppliers', {
      name: 'Roma Produce',
      contactPerson: 'Mario',
      phone: '11223344',
      email: 'mario@roma.com',
    }, accessToken);
    if (supRes.success) {
      console.log('✅ Registered Supplier:', supRes.data.supplier.name);
      supplierId = supRes.data.supplier.id;
    } else {
      throw new Error(`Supplier creation failed: ${JSON.stringify(supRes)}`);
    }

    console.log('[Setup] Creating Purchase Order expense of $20.00...');
    await post('/api/inventory/purchase-orders', {
      supplierId,
      totalAmount: 20.00,
    }, accessToken);

    // 3. Setup Ingredient & Recipe Linkage
    console.log('\n[Test 2] Testing Inventory Ingredients & Recipes Mapping...');
    const ingRes = await post('/api/inventory/items', {
      name: 'Pizza Dough',
      unit: 'pcs',
      stockLevel: 100,
      minStockLevel: 5,
    }, accessToken);
    ingredientId = ingRes.data.item.id;

    const recRes = await post('/api/inventory/recipes', {
      menuItemId,
      inventoryItemId: ingredientId,
      quantityNeeded: 1.0,
    }, accessToken);

    if (ingRes.success && recRes.success) {
      console.log('✅ Inventory item mapped to menu recipe successfully.');
    } else {
      throw new Error(`Inventory mapping failed. Ing: ${JSON.stringify(ingRes)} | Recipe: ${JSON.stringify(recRes)}`);
    }

    // 4. Place order
    console.log('[Setup] Placing a Dine-in Order for Table T1 (2x Margarita Pizza)...');
    const orderRes = await post('/api/orders', {
      tableId: table1Id,
      orderType: 'DINE_IN',
      items: [{ menuItemId, quantity: 2, price: 10.00 }]
    }, accessToken);
    orderId = orderRes.data.order.id;

    // 5. KOT generation
    console.log('\n[Test 3] Testing Kitchen Order Ticket (KOT) automatic print layout generation...');
    const kotRes = await post('/api/kots', { orderId, notes: 'Crispy crust please' }, accessToken);
    if (kotRes.success && kotRes.data.kot.kotNumber) {
      console.log('✅ KOT generated successfully! Layout preview:\n', kotRes.data.printLayout);
    } else {
      throw new Error(`KOT generation failed: ${JSON.stringify(kotRes)}`);
    }
    const kotId = kotRes.data.kot.id;

    console.log('[Setup] Updating KOT preparation status to READY...');
    const kotStatusRes = await put(`/api/kots/${kotId}/status`, { status: 'READY' }, accessToken);
    if (kotStatusRes.success && kotStatusRes.data.kot.status === 'READY') {
      console.log('✅ KOT status successfully set to READY.');
    }

    // 6. Generate Bill
    console.log('[Setup] Generating Bill...');
    const billRes = await post('/api/bills', {
      orderId,
      discountAmount: 1.00,
      serviceChargeRate: 0.0,
    }, accessToken);
    billId = billRes.data.bill.id;

    // 7. CRM customer register
    console.log('\n[Test 4] Testing CRM Customer Profiling...');
    const custRes = await post('/api/crm', {
      name: 'Luigi',
      phone: '9988776655',
      email: 'luigi@bros.com',
    }, accessToken);
    if (custRes.success) {
      console.log('✅ Customer registered in CRM database:', custRes.data.customer.name);
      customerId = custRes.data.customer.id;
    } else {
      throw new Error(`CRM registration failed: ${JSON.stringify(custRes)}`);
    }

    // 8. Record payments and check stock decrements
    console.log('\n[Test 5] Processing Payment & Triggering Automatic Ingredient Stock Decrement...');
    const payRes = await post(`/api/bills/${billId}/payments`, {
      payments: [{ method: 'CASH', amount: 20.00 }]
    }, accessToken);

    if (payRes.success && payRes.data.bill.paymentStatus === 'PAID') {
      console.log('✅ Payment processed successfully. Bill PAID.');
      
      // Fetch ingredient stock level
      const stockCheckRes = await get('/api/inventory/items', accessToken);
      const doughItem = stockCheckRes.data.items.find(i => i.id === ingredientId);
      
      if (doughItem && Number(doughItem.stockLevel) === 98) {
        console.log('✅ Verification Succeeded: Pizza Dough stock decremented from 100 to 98 (2 pizzas ordered).');
      } else {
        throw new Error(`Stock decrement failed! Current Stock level: ${doughItem?.stockLevel}`);
      }
    } else {
      throw new Error(`Payment failed: ${JSON.stringify(payRes)}`);
    }

    // 9. Fetch Analytics Reports
    console.log('\n[Test 6] Testing Aggregated Sales and P&L Reports...');
    const repSales = await get('/api/reports/sales', accessToken);
    const repItems = await get('/api/reports/items', accessToken);
    const repPL = await get('/api/reports/profit-loss', accessToken);

    if (repSales.success && repItems.success && repPL.success) {
      console.log('✅ Reports compiled. Item rankings count:', repItems.data.items.length);
      console.log(`✅ Profit & Loss - Revenue: $${repPL.data.totalRevenue} | Expenses: $${repPL.data.totalExpenses} | Net Profit: $${repPL.data.netProfit}`);
    } else {
      throw new Error('Reports compilation failed!');
    }

    // 10. WhatsApp/SMS invoice alerts
    console.log('\n[Test 7] Testing Mock WhatsApp/SMS Receipt Notification...');
    const notifRes = await post('/api/notifications/send-invoice', {
      billId,
      phone: '+919988776655',
    }, accessToken);
    if (notifRes.success) {
      console.log('✅ Receipt alert successfully processed:', notifRes.data.recipient, '| Status:', notifRes.data.status);
    } else {
      throw new Error(`Notification failed: ${JSON.stringify(notifRes)}`);
    }

    // 11. Third party online delivery integrations
    console.log('\n[Test 8] Testing Swiggy/Zomato integrations webhook ingest...');
    const webhookRes = await post('/api/integrations/webhook/order', {
      branchId,
      channel: 'Swiggy',
      externalOrderId: 'SW-987654',
      items: [{ menuItemName: 'Margarita Pizza', quantity: 1 }]
    }, accessToken);

    if (webhookRes.success && webhookRes.data.grandTotal === 10.50) {
      console.log('✅ Swiggy order webhook correctly ingested! Grand Total calculated as $10.50 (10.00 base + 5% tax).');
    } else {
      throw new Error(`Webhook ingestion failed: ${JSON.stringify(webhookRes)}`);
    }

    // 12. SaaS limits and subscriptions
    console.log('\n[Test 9] Testing SaaS Limits & Upgrade Billing...');
    const subStatus1 = await get('/api/subscriptions/status', accessToken);
    console.log(' - Current plan details:', subStatus1.data.subscription.plan, '| Item limits:', subStatus1.data.limits.maxItems);
    
    // Upgrade
    const upgradeRes = await post('/api/subscriptions/subscribe', {
      plan: 'MONTHLY',
      durationMonths: 12,
    }, accessToken);
    
    const subStatus2 = await get('/api/subscriptions/status', accessToken);
    if (subStatus2.success && subStatus2.data.subscription.plan === 'MONTHLY' && subStatus2.data.limits.maxItems === 1000) {
      console.log('✅ Subscription upgrade successful! Updated plan limits:', subStatus2.data.limits.maxItems);
    } else {
      throw new Error(`Subscription update failed: ${JSON.stringify(upgradeRes)}`);
    }

    // 13. Super Admin operations (Elevate user to SUPER_ADMIN to bypass middleware check)
    console.log('\n[Test 10] Testing Super Admin Control Panel...');
    console.log('[Setup] Promoting user to SUPER_ADMIN to verify global analytics...');
    
    // In local tests, we update user role in DB directly
    // Let's run a quick command or write role promotion in DB. Wait! We can do it directly in the script using prisma client.
    // Wait, the script has no import of prisma client directly, but we can do a HTTP request or SQL update, or since this script runs under node,
    // we can update it in PostgreSQL using a shell command or by letting the script connect to prisma.
    // But wait! We can easily use psql to promote the user role:
    // /opt/homebrew/bin/psql canwe_pos -c "UPDATE \"User\" SET role = 'SUPER_ADMIN' WHERE id = '$userId';"
    // Let's execute the psql promotion from the script by spawning a process or doing it before starting node!
    // That is very simple! Or let's promote the user in the database directly before running the test! Yes!
    // But to keep the test automated and self-contained, the script can check super admin operations if it receives a SUPER_ADMIN token.
    // Let's promote the user in the database using a child_process inside the script! That is extremely clean.
    const { execSync } = require('child_process');
    try {
      execSync(`/opt/homebrew/bin/psql canwe_pos -c "UPDATE \\"User\\" SET role = 'SUPER_ADMIN' WHERE id = '${userId}';"`);
      console.log(` - Database role updated: user ${userId} promoted to SUPER_ADMIN.`);
    } catch (e) {
      throw new Error(`Failed to promote user via psql: ${e.message}`);
    }

    // Now query super admin endpoints using the promoted user's access token!
    const tenantsRes = await get('/api/superadmin/tenants', accessToken);
    const systemRev = await get('/api/superadmin/revenue', accessToken);
    const globalLogs = await get('/api/superadmin/logs', accessToken);

    if (tenantsRes.success && systemRev.success && globalLogs.success) {
      console.log('✅ Super Admin queries completed. Total Restaurants Count:', tenantsRes.data.restaurants.length);
      console.log('✅ Aggregated Subscription Revenue calculated as: $', systemRev.data.aggregatedRevenue);
      console.log('✅ Global logs retrieved. Count:', globalLogs.data.logs.length);
    } else {
      throw new Error('Super admin operations failed!');
    }

    console.log('\n🎉 ALL MODULES AND PHASES IN THE POS PLATFORM PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST RUN ENCOUNTERED AN ERROR:');
    console.error(error.message);
    process.exit(1);
  }
}

// HTTP Helper utilities
function post(path, data, token) {
  return request('POST', path, data, token);
}

function put(path, data, token) {
  return request('PUT', path, data, token);
}

function get(path, token) {
  return request('GET', path, null, token);
}

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {};
    
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: path,
        method: method,
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse response body from ${path}: ${body}`));
          }
        });
      }
    );

    req.on('error', (e) => reject(e));
    if (data) {
      req.write(postData);
    }
    req.end();
  });
}

// Start tests
runTests();
