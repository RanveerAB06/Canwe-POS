import { PrismaClient, RoleName, SubscriptionPlan, TableStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create or update the demo restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'canwe-cafe' },
    update: {
      name: 'Canwe Technologies Cafe',
    },
    create: {
      name: 'Canwe Technologies Cafe',
      slug: 'canwe-cafe',
      address: 'Pune Central, Maharashtra',
      phone: '+91 9099912383',
      email: 'contact@canwepos.com',
    },
  });
  console.log(`✅ Restaurant: ${restaurant.name} (Slug: ${restaurant.slug})`);

  // 2. Create or find default branch
  let branch = await prisma.branch.findFirst({
    where: { restaurantId: restaurant.id, name: 'Pune Central Branch' },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Pune Central Branch',
        address: 'MG Road, Pune Central',
        phone: '+91 9099912383',
      },
    });
  }
  console.log(`✅ Branch: ${branch.name} (ID: ${branch.id})`);

  // 3. Create or update demo owner user
  const hashedPassword = await bcrypt.hash('demo_pos_cashier_pass', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo.cashier@canwepos.com' },
    update: {
      password: hashedPassword,
      firstName: 'Ranveer',
      lastName: 'Bhosale',
      role: RoleName.RESTAURANT_OWNER,
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
    create: {
      email: 'demo.cashier@canwepos.com',
      password: hashedPassword,
      firstName: 'Ranveer',
      lastName: 'Bhosale',
      role: RoleName.RESTAURANT_OWNER,
      restaurantId: restaurant.id,
      branchId: branch.id,
    },
  });
  console.log(`✅ User: ${user.email} (Password: demo_pos_cashier_pass)`);

  // 4. Create trial subscription if none exists
  const activeSub = await prisma.subscription.findFirst({
    where: { restaurantId: restaurant.id },
  });
  if (!activeSub) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    await prisma.subscription.create({
      data: {
        restaurantId: restaurant.id,
        plan: SubscriptionPlan.TRIAL,
        endDate: trialEndDate,
      },
    });
    console.log('✅ Subscription: 30-day Trial provisioned.');
  }

  // 5. Clean up old orders, tables & categories to start fresh
  await prisma.order.deleteMany({ where: { branchId: branch.id } });
  await prisma.table.deleteMany({ where: { branchId: branch.id } });
  await prisma.menuCategory.deleteMany({ where: { restaurantId: restaurant.id } });

  // 6. Seed Categories and Menu Items
  const menuData = [
    {
      category: 'Starters',
      items: [
        { name: 'Paneer Tikka', price: 280, isVeg: true },
        { name: 'Veg Spring Roll', price: 160, isVeg: true },
        { name: 'Chicken 65', price: 320, isVeg: false },
        { name: 'Mushroom Soup', price: 140, isVeg: true },
      ],
    },
    {
      category: 'Main Course',
      items: [
        { name: 'Butter Chicken', price: 380, isVeg: false },
        { name: 'Dal Makhani', price: 260, isVeg: true },
        { name: 'Palak Paneer', price: 280, isVeg: true },
        { name: 'Chicken Biryani', price: 360, isVeg: false },
        { name: 'Veg Fried Rice', price: 220, isVeg: true },
      ],
    },
    {
      category: 'Breads',
      items: [
        { name: 'Butter Naan', price: 60, isVeg: true },
        { name: 'Garlic Roti', price: 50, isVeg: true },
        { name: 'Paratha', price: 70, isVeg: true },
      ],
    },
    {
      category: 'Beverages',
      items: [
        { name: 'Masala Chai', price: 60, isVeg: true },
        { name: 'Fresh Lime Soda', price: 80, isVeg: true },
        { name: 'Mango Lassi', price: 120, isVeg: true },
        { name: 'Cold Coffee', price: 140, isVeg: true },
      ],
    },
    {
      category: 'Desserts',
      items: [
        { name: 'Gulab Jamun', price: 100, isVeg: true },
        { name: 'Ice Cream', price: 120, isVeg: true },
        { name: 'Brownie', price: 160, isVeg: true },
      ],
    },
  ];

  for (const group of menuData) {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: group.category,
      },
    });

    console.log(`📁 Category: ${category.name}`);

    for (const item of group.items) {
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: item.name,
          price: item.price,
          isVeg: item.isVeg,
          taxRate: 5.0, // default 5%
        },
      });
      console.log(`  🍔 Menu Item: ${item.name} (₹${item.price})`);
    }
  }

  // 7. Seed Tables
  const tablesData = [
    // A/C Dining Area
    { number: 'T1', floor: 'A/C DINING AREA', capacity: 4 },
    { number: 'T2', floor: 'A/C DINING AREA', capacity: 4 },
    { number: 'T3', floor: 'A/C DINING AREA', capacity: 4 },
    { number: 'T4', floor: 'A/C DINING AREA', capacity: 6 },
    { number: 'T5', floor: 'A/C DINING AREA', capacity: 6 },
    { number: 'T6', floor: 'A/C DINING AREA', capacity: 2 },
    // Non A/C Area
    { number: 'T7', floor: 'NON A/C AREA', capacity: 4 },
    { number: 'T8', floor: 'NON A/C AREA', capacity: 4 },
    { number: 'T9', floor: 'NON A/C AREA', capacity: 6 },
    { number: 'T10', floor: 'NON A/C AREA', capacity: 2 },
    // Rooftop
    { number: 'T11', floor: 'ROOFTOP', capacity: 4 },
    { number: 'T12', floor: 'ROOFTOP', capacity: 4 },
    { number: 'T13', floor: 'ROOFTOP', capacity: 6 },
  ];

  for (const t of tablesData) {
    await prisma.table.create({
      data: {
        branchId: branch.id,
        number: t.number,
        floor: t.floor,
        capacity: t.capacity,
        status: TableStatus.AVAILABLE,
      },
    });
    console.log(`🪑 Table: ${t.number} in ${t.floor} (Capacity: ${t.capacity})`);
  }

  console.log('🌱 Seeding database successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
