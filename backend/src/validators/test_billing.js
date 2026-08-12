const http = require('http');

const PORT = 4000;

async function runTests() {
  console.log('--- STARTING BILLING MODULE TESTS ---');
  
  const testRestaurant = {
    restaurantName: 'La Bella Vita Billing',
    restaurantSlug: `bella-vita-bill-${Date.now()}`,
    email: `owner-${Date.now()}@bellavitabill.com`,
    password: 'bella_password_123',
    firstName: 'Bella',
    lastName: 'Vita',
  };

  let accessToken = '';
  let branchId = '';
  let table1Id = '';
  let table2Id = '';
  let categoryId = '';
  let menuItemId = '';
  
  try {
    // 1. Register Owner & Restaurant
    console.log('[Setup] Registering user/restaurant...');
    const regRes = await post('/api/auth/register', testRestaurant);
    if (!regRes.success) throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    accessToken = regRes.data.tokens.accessToken;
    
    // Fetch branch ID
    const meRes = await get('/api/auth/me', accessToken);
    branchId = meRes.data.user.branch.id;
    console.log(`[Setup] Retrieved active branch ID: ${branchId}`);

    // Create Category & Item
    console.log('[Setup] Setting up menu item (Bruschetta @ $8.00)...');
    const catRes = await post('/api/menu/categories', { name: 'Appetizers' }, accessToken);
    categoryId = catRes.data.category.id;
    const itemRes = await post('/api/menu/items', {
      categoryId,
      name: 'Bruschetta',
      price: 8.00,
      taxRate: 5.0,
      isVeg: true,
    }, accessToken);
    menuItemId = itemRes.data.item.id;

    // Create Tables
    console.log('[Setup] Setting up dining tables T1 and T2...');
    const t1Res = await post('/api/tables', { branchId, number: 'T1', capacity: 4 }, accessToken);
    table1Id = t1Res.data.table.id;
    const t2Res = await post('/api/tables', { branchId, number: 'T2', capacity: 2 }, accessToken);
    table2Id = t2Res.data.table.id;

    // Place a Dine-in Order
    console.log('[Setup] Placing a Dine-in Order for Table T1...');
    const orderRes = await post('/api/orders', {
      tableId: table1Id,
      orderType: 'DINE_IN',
      items: [{ menuItemId, quantity: 2, price: 8.00 }]
    }, accessToken);
    const order1Id = orderRes.data.order.id;

    // 2. Generate Bill
    console.log('\n[Test 1] Testing Bill Generation (Applying $2.00 discount and 10% service charge)...');
    const genRes = await post('/api/bills', {
      orderId: order1Id,
      discountAmount: 2.00,
      serviceChargeRate: 10.0,
    }, accessToken);

    // subtotal = 16.00, tax = 0.80, service charge = 1.60, discount = 2.00 -> grandTotal = 16.40
    if (genRes.success && Number(genRes.data.bill.grandTotal) === 16.40) {
      console.log('✅ Bill generated successfully! Grand Total: $16.40');
    } else {
      throw new Error(`Bill generation failed: ${JSON.stringify(genRes)}`);
    }
    const bill1Id = genRes.data.bill.id;

    // 3. Record Split Payments
    console.log('\n[Test 2] Testing Multi-method Split Payment processing...');
    const payRes = await post(`/api/bills/${bill1Id}/payments`, {
      payments: [
        { method: 'CASH', amount: 10.00 },
        { method: 'UPI', amount: 6.40, referenceNumber: 'UPI-TXN-9988' }
      ]
    }, accessToken);

    if (payRes.success && payRes.data.bill.paymentStatus === 'PAID') {
      console.log('✅ Payments processed. Bill is marked as PAID.');
      
      // Verify table T1 is reset to AVAILABLE
      const tablesList = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const table1 = tablesList.data.tables.find(t => t.id === table1Id);
      if (table1 && table1.status === 'AVAILABLE') {
        console.log('✅ Table T1 status reset to AVAILABLE.');
      } else {
        throw new Error('Table T1 was not reset to AVAILABLE after payment!');
      }
    } else {
      throw new Error(`Payment processing failed: ${JSON.stringify(payRes)}`);
    }

    // 4. Split Bill
    console.log('\n[Test 3] Testing Split Billing (2 equal parts)...');
    console.log('[Setup] Placing a new order for Table T1...');
    const orderRes2 = await post('/api/orders', {
      tableId: table1Id,
      orderType: 'DINE_IN',
      items: [{ menuItemId, quantity: 2, price: 8.00 }]
    }, accessToken);
    const order2Id = orderRes2.data.order.id;

    const splitRes = await post('/api/bills/split', {
      orderId: order2Id,
      splitCount: 2,
    }, accessToken);

    if (splitRes.success && splitRes.data.bills.length === 2 && Number(splitRes.data.bills[0].grandTotal) === 8.40) {
      console.log('✅ Split billing succeeded. Generated 2 sub-bills of $8.40 each.');
    } else {
      throw new Error(`Split billing failed: ${JSON.stringify(splitRes)}`);
    }

    // 5. Merge Bills
    console.log('\n[Test 4] Testing Bill/Order Merging...');
    
    // Setup Order A on Table 1
    console.log('[Setup] Placing Order A on Table T1 (1x Bruschetta)...');
    const orderARes = await post('/api/orders', {
      tableId: table1Id,
      orderType: 'DINE_IN',
      items: [{ menuItemId, quantity: 1, price: 8.00 }]
    }, accessToken);
    const orderAId = orderARes.data.order.id;

    // Setup Order B on Table 2
    console.log('[Setup] Placing Order B on Table T2 (2x Bruschetta)...');
    const orderBRes = await post('/api/orders', {
      tableId: table2Id,
      orderType: 'DINE_IN',
      items: [{ menuItemId, quantity: 2, price: 8.00 }]
    }, accessToken);
    const orderBId = orderBRes.data.order.id;

    const mergeRes = await post('/api/bills/merge', {
      orderIds: [orderAId, orderBId]
    }, accessToken);

    // Expected grandTotal = 3x Bruschetta (24.00) + 5% tax (1.20) = 25.20
    if (mergeRes.success && Number(mergeRes.data.bill.grandTotal) === 25.20) {
      console.log('✅ Merge succeeded: Combined invoice total is $25.20.');
      
      // Verify Table T2 status is reset to AVAILABLE and Table T1 is OCCUPIED
      const tablesList2 = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const checkT1 = tablesList2.data.tables.find(t => t.id === table1Id);
      const checkT2 = tablesList2.data.tables.find(t => t.id === table2Id);
      
      if (checkT1.status === 'OCCUPIED' && checkT2.status === 'AVAILABLE') {
        console.log('✅ Combined layout checked: T1 remains OCCUPIED, T2 released to AVAILABLE.');
      } else {
        throw new Error(`Table statuses incorrect after merge. T1: ${checkT1.status} | T2: ${checkT2.status}`);
      }
    } else {
      throw new Error(`Merge failed: ${JSON.stringify(mergeRes)}`);
    }
    const mergedBillId = mergeRes.data.bill.id;

    // 6. Void Bill
    console.log('\n[Test 5] Testing Voiding Generated Bills...');
    const voidRes = await post(`/api/bills/${mergedBillId}/void`, {
      reason: 'Customer changed mind, re-entered orders'
    }, accessToken);

    if (voidRes.success) {
      console.log('✅ Bill voided successfully. Associated order was cancelled.');
      
      // Verify table T1 is reset to AVAILABLE
      const tablesList3 = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const checkT1AfterVoid = tablesList3.data.tables.find(t => t.id === table1Id);
      if (checkT1AfterVoid.status === 'AVAILABLE') {
        console.log('✅ Table T1 status reset back to AVAILABLE.');
      } else {
        throw new Error(`T1 status not reset after void. Status: ${checkT1AfterVoid.status}`);
      }
    } else {
      throw new Error(`Void bill failed: ${JSON.stringify(voidRes)}`);
    }

    console.log('\n🎉 ALL BILLING MODULE TESTS PASSED SUCCESSFULLY! 🎉');
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
