const http = require('http');

const PORT = 4000;

async function runTests() {
  console.log('--- STARTING TABLE MANAGEMENT MODULE TESTS ---');
  
  const testRestaurant = {
    restaurantName: 'The Pizza Box',
    restaurantSlug: `pizza-box-${Date.now()}`,
    email: `owner-${Date.now()}@pizzabox.com`,
    password: 'pizzabox_password_123',
    firstName: 'Luigi',
    lastName: 'Bros',
  };

  let accessToken = '';
  let branchId = '';
  let table1Id = '';
  let table2Id = '';
  let table3Id = '';

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

    // 2. Create Table 1
    console.log('\n[Test 1] Testing Table Creation (Table 1 - Ground Floor)...');
    const t1Res = await post('/api/tables', {
      branchId,
      number: 'T1',
      capacity: 4,
      floor: 'Ground Floor',
    }, accessToken);
    if (t1Res.success && t1Res.data.table.number === 'T1') {
      console.log('✅ Created table 1:', t1Res.data.table.number);
      table1Id = t1Res.data.table.id;
    } else {
      throw new Error(`Table 1 creation failed: ${JSON.stringify(t1Res)}`);
    }

    // Create Table 2
    console.log('[Setup] Creating Table 2 (Ground Floor)...');
    const t2Res = await post('/api/tables', {
      branchId,
      number: 'T2',
      capacity: 2,
      floor: 'Ground Floor',
    }, accessToken);
    table2Id = t2Res.data.table.id;

    // Create Table 3
    console.log('[Setup] Creating Table 3 (Rooftop)...');
    const t3Res = await post('/api/tables', {
      branchId,
      number: 'T3',
      capacity: 6,
      floor: 'Rooftop',
    }, accessToken);
    table3Id = t3Res.data.table.id;

    // 3. Fetch all active tables
    console.log('\n[Test 2] Testing Fetching Tables...');
    const listRes = await get(`/api/tables?branchId=${branchId}`, accessToken);
    if (listRes.success && listRes.data.tables.length === 3) {
      console.log('✅ All 3 tables fetched successfully.');
    } else {
      throw new Error(`Tables query failed: ${JSON.stringify(listRes)}`);
    }

    // 4. Floor filtering
    console.log('\n[Test 3] Testing Floor filtering (Ground Floor)...');
    const groundRes = await get(`/api/tables?branchId=${branchId}&floor=Ground%20Floor`, accessToken);
    if (groundRes.success && groundRes.data.tables.length === 2) {
      console.log('✅ Ground floor filter returned exactly 2 tables.');
    } else {
      throw new Error(`Floor filter failed: ${JSON.stringify(groundRes)}`);
    }

    // 5. Update table details
    console.log('\n[Test 4] Testing Modifying Table configurations...');
    const updateRes = await put(`/api/tables/${table3Id}`, {
      number: 'T3-VIP',
      capacity: 8,
    }, accessToken);
    if (updateRes.success && updateRes.data.table.number === 'T3-VIP' && updateRes.data.table.capacity === 8) {
      console.log('✅ Table modified successfully to T3-VIP (Capacity: 8).');
    } else {
      throw new Error(`Table update failed: ${JSON.stringify(updateRes)}`);
    }

    // 6. Delete Table (Soft Delete)
    console.log('\n[Test 5] Testing Soft Deleting Table...');
    const delRes = await del(`/api/tables/${table3Id}`, accessToken);
    if (delRes.success) {
      console.log('✅ Table deleted successfully.');
      const checkRes = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const deletedFound = checkRes.data.tables.some(t => t.id === table3Id);
      if (!deletedFound && checkRes.data.tables.length === 2) {
        console.log('✅ Soft-deleted table is successfully excluded from listings.');
      } else {
        throw new Error('Soft deleted table is still in the active list!');
      }
    } else {
      throw new Error(`Table delete failed: ${JSON.stringify(delRes)}`);
    }

    // 7. Table Merging
    console.log('\n[Test 6] Testing Table Merging (Merging T2 into T1)...');
    const mergeRes = await post('/api/tables/merge', {
      sourceTableId: table2Id,
      targetTableId: table1Id,
    }, accessToken);
    if (mergeRes.success && mergeRes.data.sourceTable.mergedToId === table1Id) {
      console.log('✅ Merge request succeeded: Table T2 is merged into Table T1!');
    } else {
      throw new Error(`Table merge failed: ${JSON.stringify(mergeRes)}`);
    }

    // 8. Update Target status and check cascade update
    console.log('\n[Test 7] Testing Table Status Updates & Cascade Merges...');
    const statusRes = await put(`/api/tables/${table1Id}/status`, {
      status: 'OCCUPIED',
    }, accessToken);
    
    if (statusRes.success && statusRes.data.table.status === 'OCCUPIED') {
      console.log('✅ Target Table T1 updated status to OCCUPIED.');
      
      // Fetch T2 details to check status sync
      const listAfterStatus = await get(`/api/tables?branchId=${branchId}`, accessToken);
      const sourceTable = listAfterStatus.data.tables.find(t => t.id === table2Id);
      
      if (sourceTable && sourceTable.status === 'OCCUPIED') {
        console.log('✅ Checked cascade: Merged source Table T2 automatically synced status to OCCUPIED!');
      } else {
        throw new Error(`Cascade status sync failed. Source Table status: ${sourceTable?.status}`);
      }
    } else {
      throw new Error(`Status update failed: ${JSON.stringify(statusRes)}`);
    }

    // 9. Split Merged Table
    console.log('\n[Test 8] Testing Table Splitting (Unmerging T2)...');
    const splitRes = await post('/api/tables/split', {
      tableId: table2Id,
    }, accessToken);
    if (splitRes.success && splitRes.data.table.mergedToId === null && splitRes.data.table.status === 'AVAILABLE') {
      console.log('✅ Split succeeded. Table T2 is unmerged and status is reset to AVAILABLE.');
    } else {
      throw new Error(`Table split failed: ${JSON.stringify(splitRes)}`);
    }

    console.log('\n🎉 ALL TABLE MANAGEMENT MODULE TESTS PASSED SUCCESSFULLY! 🎉');
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

function del(path, token) {
  return request('DELETE', path, null, token);
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
