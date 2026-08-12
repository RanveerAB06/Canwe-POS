const http = require('http');

const PORT = 4000;

async function runTests() {
  console.log('--- STARTING CAPTAIN APP ORDERING MODULE TESTS ---');
  
  const testRestaurant = {
    restaurantName: 'Bella Ciao Order',
    restaurantSlug: `bella-ciao-order-${Date.now()}`,
    email: `owner-${Date.now()}@ciaoorder.com`,
    password: 'ciao_password_123',
    firstName: 'Bella',
    lastName: 'Ciao',
  };

  let accessToken = '';
  let branchId = '';
  let table1Id = '';
  let table2Id = '';
  let categoryId = '';
  let menuItemId = '';
  let orderId = '';
  let orderItemId = '';

  try {
    // 1. Register Owner & Restaurant
    console.log('[Setup] Registering user/restaurant...');
    const regRes = await post('/api/auth/register', testRestaurant);
    if (!regRes.success) throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
    accessToken = regRes.data.tokens.accessToken;
    
    // Fetch user details to get default branch ID
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

    // 2. Create Order
    console.log('\n[Test 1] Testing Order Placement (2x Bruschetta on Table T1)...');
    const orderRes = await post('/api/orders', {
      tableId: table1Id,
      orderType: 'DINE_IN',
      items: [
        {
          menuItemId,
          quantity: 2,
          price: 8.00,
        }
      ]
    }, accessToken);

    if (orderRes.success && Number(orderRes.data.order.total) === 16.80) {
      console.log('✅ Order placed successfully! Grand Total: $16.80 (calculated 5% tax).');
      orderId = orderRes.data.order.id;
      orderItemId = orderRes.data.order.items[0].id;
    } else {
      throw new Error(`Order placement failed: ${JSON.stringify(orderRes)}`);
    }

    // Verify table is OCCUPIED
    console.log('[Setup] Verifying table status changed to OCCUPIED...');
    const tablesList1 = await get(`/api/tables?branchId=${branchId}`, accessToken);
    const table1 = tablesList1.data.tables.find(t => t.id === table1Id);
    if (table1 && table1.status === 'OCCUPIED') {
      console.log('✅ Table T1 status is OCCUPIED.');
    } else {
      throw new Error(`Table status not synced. Table: ${JSON.stringify(table1)}`);
    }

    // 3. Update Order items
    console.log('\n[Test 2] Testing Order item quantity updating (Changing to 3x Bruschetta)...');
    const updateRes = await put(`/api/orders/${orderId}`, {
      items: [
        {
          menuItemId,
          quantity: 3,
          price: 8.00,
        }
      ]
    }, accessToken);

    if (updateRes.success && Number(updateRes.data.order.total) === 25.20) {
      console.log('✅ Order items quantity updated successfully. New Grand Total: $25.20');
      // Update orderItemId referencing the active list
      orderItemId = updateRes.data.order.items[0].id;
    } else {
      throw new Error(`Order update failed: ${JSON.stringify(updateRes)}`);
    }

    // 4. Toggle Hold Order status
    console.log('\n[Test 3] Testing hold/resume states...');
    const holdRes = await put(`/api/orders/${orderId}/hold`, null, accessToken);
    if (holdRes.success && holdRes.data.order.isHeld === true) {
      console.log('✅ Order hold toggled successfully (Hold is Active).');
    } else {
      throw new Error(`Hold toggle failed: ${JSON.stringify(holdRes)}`);
    }

    const resumeRes = await put(`/api/orders/${orderId}/hold`, null, accessToken);
    if (resumeRes.success && resumeRes.data.order.isHeld === false) {
      console.log('✅ Order resumed successfully (Hold is Deactivated).');
    } else {
      throw new Error(`Resume toggle failed: ${JSON.stringify(resumeRes)}`);
    }

    // 5. Cancel Item from Order (Cascades to order cancellation as it is the last item)
    console.log('\n[Test 4] Testing Order Item Cancellation...');
    const cancelRes = await put(`/api/orders/${orderId}/items/${orderItemId}/cancel`, null, accessToken);
    if (cancelRes.success && cancelRes.data.order.status === 'CANCELLED') {
      console.log('✅ Last item cancelled: entire Order was automatically transitioned to CANCELLED.');
      
      // Verify table status is reset to AVAILABLE
      const tablesList2 = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const tableCheck = tablesList2.data.tables.find(t => t.id === table1Id);
      if (tableCheck && tableCheck.status === 'AVAILABLE') {
        console.log('✅ Table T1 status was reset back to AVAILABLE.');
      } else {
        throw new Error('Table status not reset after cancellation!');
      }
    } else {
      throw new Error(`Item cancellation failed: ${JSON.stringify(cancelRes)}`);
    }

    // 6. Test Offline Sync Endpoint
    console.log('\n[Test 5] Testing Bulk Offline Queue Synchronization...');
    const syncPayload = {
      actions: [
        {
          type: 'CREATE_ORDER',
          tempId: 'offline-action-uuid-1',
          payload: {
            tableId: table2Id,
            orderType: 'DINE_IN',
            items: [
              {
                menuItemId,
                quantity: 2,
                price: 8.00,
              }
            ]
          }
        }
      ]
    };

    const syncRes = await post('/api/orders/sync', syncPayload, accessToken);
    if (
      syncRes.success && 
      syncRes.data.results.length === 1 && 
      syncRes.data.results[0].success === true
    ) {
      console.log('✅ Sync processed successfully! TempId "offline-action-uuid-1" mapped to active order ID:', syncRes.data.results[0].orderId);
      
      // Verify table T2 status is now OCCUPIED
      const tablesList3 = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const tableCheck2 = tablesList3.data.tables.find(t => t.id === table2Id);
      if (tableCheck2 && tableCheck2.status === 'OCCUPIED') {
        console.log('✅ Synced Table T2 status is OCCUPIED.');
      } else {
        throw new Error('Table T2 status not set to OCCUPIED after sync!');
      }
    } else {
      throw new Error(`Sync processed with error: ${JSON.stringify(syncRes)}`);
    }

    console.log('\n🎉 ALL CAPTAIN APP ORDERING MODULE TESTS PASSED SUCCESSFULLY! 🎉');
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
