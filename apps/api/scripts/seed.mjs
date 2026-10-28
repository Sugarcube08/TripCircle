import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TripCircle database...');

  // 1. Seed Expense Categories
  const categories = [
    { key: 'FOOD_DINING', name: 'Food & Dining', icon: 'utensils' },
    { key: 'TRANSPORT', name: 'Transport', icon: 'car' },
    { key: 'ACCOMMODATION', name: 'Accommodation', icon: 'hotel' },
    { key: 'SHOPPING', name: 'Shopping', icon: 'shopping-bag' },
    { key: 'ACTIVITIES_ENTERTAINMENT', name: 'Activities & Entertainment', icon: 'ticket' },
    { key: 'GROCERIES', name: 'Groceries', icon: 'shopping-cart' },
    { key: 'FUEL', name: 'Fuel', icon: 'gas-pump' },
    { key: 'TICKETS_RESERVATIONS', name: 'Tickets & Reservations', icon: 'calendar-check' },
    { key: 'MISCELLANEOUS', name: 'Miscellaneous', icon: 'tag' },
  ];

  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { key: cat.key },
      update: { name: cat.name, icon: cat.icon },
      create: { key: cat.key, name: cat.name, icon: cat.icon, isSystem: true },
    });
  }
  console.log('✅ Expense categories seeded');

  // 2. Seed Users
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const usersData = [
    { email: 'alice@tripcircle.app', name: 'Alice Sharma', phone: '+919876543210' },
    { email: 'bob@tripcircle.app', name: 'Bob Verma', phone: '+919876543211' },
    { email: 'charlie@tripcircle.app', name: 'Charlie Patel', phone: '+919876543212' },
    { email: 'dave@tripcircle.app', name: 'Dave Fernandes', phone: '+919876543213' },
  ];

  const userMap = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, isEmailVerified: true },
      create: {
        email: u.email,
        name: u.name,
        phone: u.phone,
        passwordHash,
        isEmailVerified: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
        paymentQrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${u.email}&pn=${encodeURIComponent(u.name)}`,
      },
    });
    userMap[u.name.split(' ')[0]] = user;
  }
  console.log('✅ Demo users seeded (Alice, Bob, Charlie, Dave - password: Password@123)');

  // 3. Seed Goa Trip
  const foodCat = await prisma.expenseCategory.findUnique({ where: { key: 'FOOD_DINING' } });
  const transportCat = await prisma.expenseCategory.findUnique({ where: { key: 'TRANSPORT' } });

  let trip = await prisma.trip.findFirst({ where: { name: 'Goa Trip' } });
  if (!trip) {
    trip = await prisma.trip.create({
      data: {
        name: 'Goa Trip',
        destination: 'Goa, India',
        startDate: new Date('2026-11-12'),
        endDate: new Date('2026-11-16'),
        currency: 'INR',
        status: 'ACTIVE',
        creatorId: userMap.Alice.id,
        coverImageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600',
      },
    });
  }

  // 4. Seed Memberships
  const memberMap = {};
  const memberRoles = [
    { user: userMap.Alice, role: 'CREATOR', status: 'ACTIVE' },
    { user: userMap.Bob, role: 'MEMBER', status: 'ACTIVE' },
    { user: userMap.Charlie, role: 'MEMBER', status: 'ACTIVE' },
    { user: userMap.Dave, role: 'MEMBER', status: 'ACTIVE' },
  ];

  for (const m of memberRoles) {
    const member = await prisma.tripMember.upsert({
      where: {
        tripId_userId: {
          tripId: trip.id,
          userId: m.user.id,
        },
      },
      update: { status: m.status, role: m.role },
      create: {
        tripId: trip.id,
        userId: m.user.id,
        role: m.role,
        status: m.status,
      },
    });
    memberMap[m.user.name.split(' ')[0]] = member;
  }
  console.log('✅ Trip members seeded for Goa Trip');

  // 5. Seed Acceptance Scenario:
  // Expense 1: Alice pays ₹1,200 (120000 paise) split equally among Alice, Bob, Charlie (excluding Dave)
  const existingExpenses = await prisma.expense.findMany({ where: { tripId: trip.id } });
  if (existingExpenses.length === 0) {
    const exp1 = await prisma.expense.create({
      data: {
        tripId: trip.id,
        submitterId: userMap.Alice.id,
        payerMemberId: memberMap.Alice.id,
        amountPaise: 120000,
        categoryId: foodCat.id,
        description: 'Seafood Dinner at Fisherman’s Wharf',
        location: 'Fisherman’s Wharf, Panaji',
        splitMethod: 'EQUAL',
        version: 1,
        allocations: {
          create: [
            { memberId: memberMap.Alice.id, sharePaise: 40000 },
            { memberId: memberMap.Bob.id, sharePaise: 40000 },
            { memberId: memberMap.Charlie.id, sharePaise: 40000 },
          ],
        },
      },
    });

    // Record initial revision for exp1
    await prisma.expenseRevision.create({
      data: {
        expenseId: exp1.id,
        version: 1,
        editorId: userMap.Alice.id,
        amountPaise: 120000,
        payerMemberId: memberMap.Alice.id,
        categoryId: foodCat.id,
        description: 'Seafood Dinner at Fisherman’s Wharf',
        location: 'Fisherman’s Wharf, Panaji',
        splitMethod: 'EQUAL',
        allocationsSnapshot: [
          { memberId: memberMap.Alice.id, sharePaise: 40000 },
          { memberId: memberMap.Bob.id, sharePaise: 40000 },
          { memberId: memberMap.Charlie.id, sharePaise: 40000 },
        ],
      },
    });

    // Expense 2: Bob pays ₹600 (60000 paise) for everyone
    const exp2 = await prisma.expense.create({
      data: {
        tripId: trip.id,
        submitterId: userMap.Bob.id,
        payerMemberId: memberMap.Bob.id,
        amountPaise: 60000,
        categoryId: transportCat.id,
        description: 'Airport Taxi & Tolls',
        location: 'Goa Airport to Resort',
        splitMethod: 'EQUAL',
        version: 1,
        allocations: {
          create: [
            { memberId: memberMap.Alice.id, sharePaise: 15000 },
            { memberId: memberMap.Bob.id, sharePaise: 15000 },
            { memberId: memberMap.Charlie.id, sharePaise: 15000 },
            { memberId: memberMap.Dave.id, sharePaise: 15000 },
          ],
        },
      },
    });

    await prisma.expenseRevision.create({
      data: {
        expenseId: exp2.id,
        version: 1,
        editorId: userMap.Bob.id,
        amountPaise: 60000,
        payerMemberId: memberMap.Bob.id,
        categoryId: transportCat.id,
        description: 'Airport Taxi & Tolls',
        location: 'Goa Airport to Resort',
        splitMethod: 'EQUAL',
        allocationsSnapshot: [
          { memberId: memberMap.Alice.id, sharePaise: 15000 },
          { memberId: memberMap.Bob.id, sharePaise: 15000 },
          { memberId: memberMap.Charlie.id, sharePaise: 15000 },
          { memberId: memberMap.Dave.id, sharePaise: 15000 },
        ],
      },
    });

    // Payment 1 (Disputed): C records payment to A, which A disputed
    await prisma.payment.create({
      data: {
        tripId: trip.id,
        payerMemberId: memberMap.Charlie.id,
        receiverMemberId: memberMap.Alice.id,
        amountPaise: 20000,
        paymentMethod: 'UPI',
        status: 'DISPUTED',
        note: 'UPI transfer for dinner',
        disputeReason: 'Payment not received in bank account; wrong UPI ID was used',
        disputedAt: new Date(),
      },
    });

    // Payment 2 (Confirmed): C corrects and transfers ₹300 (30000 paise) to A, A confirms
    const payment2 = await prisma.payment.create({
      data: {
        tripId: trip.id,
        payerMemberId: memberMap.Charlie.id,
        receiverMemberId: memberMap.Alice.id,
        amountPaise: 30000,
        paymentMethod: 'UPI',
        status: 'CONFIRMED',
        note: 'Correct UPI transfer with ref ID #987654',
        confirmedAt: new Date(),
      },
    });

    // Settlement Discount: A accepts waiving 65 paise fractional remainder from a prior settlement
    await prisma.settlementDiscount.create({
      data: {
        tripId: trip.id,
        fromMemberId: memberMap.Dave.id,
        toMemberId: memberMap.Bob.id,
        originalDebtPaise: 15065,
        paidAmountPaise: 15000,
        waivedPaise: 65,
        reason: 'Rounded off ₹150.65 to ₹150.00 cash payment',
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    });

    console.log('✅ Demo expenses, payments, dispute, and settlement discount seeded successfully');
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
