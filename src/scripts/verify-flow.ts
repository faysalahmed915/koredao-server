/**
 * End-to-end flow verification for the job → chat → escrow → active lifecycle.
 * Boots the real services against the live database and exercises the business
 * rules from the `feat/job-gig-chat-escrow-flow` branch. Run: npx tsx src/scripts/verify-flow.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { AssignmentsService } from '../modules/assignments/assignments.service.js';
import { ProfilesService } from '../modules/profiles/profiles.service.js';
import { OrdersService } from '../modules/orders/orders.service.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { MilestonesService } from '../modules/milestones/milestones.service.js';

const RUN_ID = Date.now().toString(36);
let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    failed++;
    console.log(`  FAIL  ${label} (expected error, none thrown)`);
  } catch {
    passed++;
    console.log(`  PASS  ${label}`);
  }
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();

  const assignments = new AssignmentsService(prisma as any);
  const profiles = new ProfilesService(prisma as any);
  const orders = new OrdersService(prisma as any);
  const chat = new ChatService(prisma as any);
  const milestones = new MilestonesService(prisma as any);

  const passwordHash = 'unused-in-service-test';
  const custEmail = `flow.customer.${RUN_ID}@koredao.test`;
  const vendEmail = `flow.vendor.${RUN_ID}@koredao.test`;
  const staffEmail = `flow.staff.${RUN_ID}@koredao.test`;

  console.log('\n=== KoreDao Flow Verification ===');
  console.log(`RUN_ID=${RUN_ID}\n`);

  const customer = await prisma.user.create({
    data: { name: 'Flow Customer', email: custEmail, emailVerified: true, role: 'CUSTOMER' },
  });
  await prisma.account.create({ data: { accountId: customer.id, providerId: 'credential', userId: customer.id, password: passwordHash } });
  const vendorUser = await prisma.user.create({
    data: { name: 'Flow Vendor', email: vendEmail, emailVerified: true, role: 'CUSTOMER' },
  });
  await prisma.account.create({ data: { accountId: vendorUser.id, providerId: 'credential', userId: vendorUser.id, password: passwordHash } });
  const staff = await prisma.user.create({
    data: { name: 'Flow Moderator', email: staffEmail, emailVerified: true, role: 'MODERATOR' },
  });

  console.log('1. Users created (customer, vendor->pending, moderator)');
  check('Customer default role is CUSTOMER', customer.role === 'CUSTOMER');
  check('Vendor starts as CUSTOMER before approval', vendorUser.role === 'CUSTOMER');

  try {
    // 2. Vendor applies -> admin approves -> role becomes VENDOR
    console.log('\n2. Vendor verification -> approval -> role change');
    const app = await profiles.applyAsVendor(vendorUser.id, {
      university: 'BUET', department: 'CSE', academicLevel: 'UNDERGRADUATE' as any,
      idCardUrl: 'https://cdn.koredao.test/id.jpg',
    } as any);
    check('Vendor application created as PENDING', (app as any).verificationStatus === 'PENDING');

    await profiles.reviewVendorApplication(staff.id, (app as any).id, { status: 'APPROVED' as any } as any);
    const promoted = await prisma.user.findUnique({ where: { id: vendorUser.id } });
    check('User role promoted CUSTOMER -> VENDOR on approval', promoted?.role === 'VENDOR');

    const vendorProfile = await prisma.vendorProfile.findUnique({ where: { userId: vendorUser.id } });
    if (!vendorProfile) throw new Error('Expected vendor profile to exist after approval');

    // 3. Customer posts a job
    console.log('\n3. Customer posts a job');
    const assignment = await assignments.create(customer.id, {
      title: 'Calculus Problem Set', description: 'Solve 20 integration problems with steps.',
      category: 'MATH_PROBLEM_SOLVING' as any, subject: 'Math', type: 'SOFTCOPY' as any,
      deadline: new Date(Date.now() + 7 * 864e5).toISOString(), budgetMin: 500, budgetMax: 1000,
    } as any);
    check('Job posted with OPEN status', (assignment as any).status === 'OPEN');

    // NOTE: "Vendor cannot post a job" is enforced by the RolesGuard at the HTTP
    // controller layer (@Roles(UserRole.CUSTOMER)), verified by unit tests. The
    // service method has no role context, so it is intentionally not called here.

    // Active limit (3): test FIRST while the weekly count is still low, because
    // enforcePostingLimits checks the weekly cap before the active cap.
    // Currently 1 active (main). Add 2 more active -> 3 active; the 4th must fail.
    for (let i = 0; i < 2; i++) {
      await assignments.create(customer.id, {
        title: `Active Job ${i}`, description: 'x', category: 'ASSIGNMENT' as any, subject: 'x', type: 'SOFTCOPY' as any,
        deadline: new Date(Date.now() + 864e5).toISOString(), budgetMin: 1, budgetMax: 2,
      } as any);
    }
    await expectThrow('Active job limit (3) enforced', () =>
      assignments.create(customer.id, {
        title: 'Active Overflow', description: 'x', category: 'ASSIGNMENT' as any, subject: 'x', type: 'SOFTCOPY' as any,
        deadline: new Date(Date.now() + 864e5).toISOString(), budgetMin: 1, budgetMax: 2,
      } as any),
    );
    // Close the extra active jobs so only the main assignment stays OPEN.
    await prisma.assignment.updateMany({
      where: { customerId: customer.id, id: { not: assignment.id } },
      data: { status: 'CANCELLED' },
    });

    // Weekly limit (5): 3 posts already exist this window (main + 2 closed).
    // Create 2 more to reach 5, then the 6th must fail the weekly cap.
    for (let i = 0; i < 2; i++) {
      await assignments.create(customer.id, {
        title: `Weekly Job ${i}`, description: 'x', category: 'ASSIGNMENT' as any, subject: 'x', type: 'SOFTCOPY' as any,
        deadline: new Date(Date.now() + 864e5).toISOString(), budgetMin: 1, budgetMax: 2,
      } as any);
    }
    await expectThrow('Weekly posting limit (5) enforced', () =>
      assignments.create(customer.id, {
        title: 'Weekly Overflow', description: 'x', category: 'ASSIGNMENT' as any, subject: 'x', type: 'SOFTCOPY' as any,
        deadline: new Date(Date.now() + 864e5).toISOString(), budgetMin: 1, budgetMax: 2,
      } as any),
    );
    // Close everything except the main assignment to keep downstream steps clean.
    await prisma.assignment.updateMany({
      where: { customerId: customer.id, id: { not: assignment.id } },
      data: { status: 'CANCELLED' },
    });

    // 4. Bid -> accept -> order
    console.log('\n4. Bid -> accept -> order created');
    const bid = await assignments.submitBid(vendorUser.id, assignment.id, {
      proposedPrice: 800, deliveryDays: 2, coverLetter: 'I can solve these with clear steps.',
    } as any);
    check('Vendor submitted a bid', !!(bid as any).id);
    const accepted = await assignments.acceptBid(customer.id, assignment.id, bid.id);
    check('Bid accepted; assignment ASSIGNED', (accepted as any).assignment.status === 'ASSIGNED');
    const order = await orders.create(customer.id, { assignmentId: assignment.id, bidId: bid.id } as any);
    check('Order created in PENDING_PAYMENT (not active)', (order as any).status === 'PENDING_PAYMENT');
    check('Order recorded customerAcceptedAt', !!(order as any).customerAcceptedAt);

    // 5. Chat conversation (pre-order + order-scoped)
    console.log('\n5. Chat conversation (customer <-> vendor)');
    const preConv = await chat.getOrCreateConversation(customer.id, { vendorProfileId: vendorProfile.id } as any);
    check('Pre-order conversation created', !!preConv.id);
    await chat.sendMessage(customer.id, { conversationId: preConv.id, content: 'Hi! Need help with calculus.' });
    await chat.sendMessage(vendorUser.id, { conversationId: preConv.id, content: 'Sure, I can help. 2 days ok?' });
    await chat.sendMessage(customer.id, { conversationId: preConv.id, content: 'Perfect.' });

    const orderConv = await chat.getOrCreateConversation(customer.id, { orderId: order.id } as any);
    await chat.sendMessage(customer.id, { conversationId: orderConv.id, content: 'Problem files: https://cdn.koredao.test/problems.pdf' });
    await chat.sendMessage(vendorUser.id, { conversationId: orderConv.id, content: 'Got them, starting after payment.' });
    const msgs = await chat.getMessages(vendorUser.id, orderConv.id);
    check('Order-scoped chat has messages', msgs.length === 2);

    // 6. Target sidebar (pre-payment) + customer approval
    console.log('\n6. Target sidebar (pre-payment) + customer approval');
    const cp = await milestones.createCheckpoint(vendorUser.id, {
      orderId: order.id, title: 'First 10 problems', targetDate: new Date(Date.now() + 2 * 864e5).toISOString(),
    } as any);
    check('Vendor created a target while PENDING_PAYMENT', (cp as any).status === 'PENDING');
    await milestones.approveTarget(customer.id, cp.id);
    const approvedCp = await prisma.projectCheckpoint.findUnique({ where: { id: cp.id } });
    check('Customer approved the target (approvedAt set)', !!approvedCp?.approvedAt);

    // 7. Payment activates the job
    console.log('\n7. Payment activates the job');
    const funded = await orders.fundEscrow(order.id, 'AAMARPAY', `TXN-${RUN_ID}`, customer.id);
    check('Order becomes ESCROW_HELD after payment', (funded as any).status === 'ESCROW_HELD');
    check('Escrow holding is HELD', (funded as any).escrowHolding?.status === 'HELD');

    // 7b. Security: a non-owner cannot fund escrow. Create a fresh pending order
    // (via a gig) and assert a stranger actor is rejected.
    const gig = await prisma.gig.create({
      data: {
        vendorProfileId: vendorProfile.id, title: `Flow Gig ${RUN_ID}`, slug: `flow-gig-${RUN_ID}`,
        description: 'x', category: 'ASSIGNMENT', priceFrom: 300, deliveryDays: 2,
        packages: [{ name: 'Basic', price: 300, deliveryDays: 2 }], isActive: true,
      },
    });
    const gigOrder = await orders.create(customer.id, { gigId: gig.id, packageIndex: 0 } as any);
    await expectThrow('Non-owner is blocked from funding escrow (security)', () =>
      orders.fundEscrow(gigOrder.id, 'MOCK_SANDBOX', 'TXN-HACK', vendorUser.id),
    );
    // 7c. Vendor accepts the gig-order (handshake) — order stays PENDING_PAYMENT
    const acceptedGigOrder = await orders.vendorAcceptOrder(vendorUser.id, gigOrder.id);
    check('Vendor accepted gig-order; still PENDING_PAYMENT', (acceptedGigOrder as any).status === 'PENDING_PAYMENT');
    check('Gig-order recorded vendorAcceptedAt', !!(acceptedGigOrder as any).vendorAcceptedAt);
    await prisma.gig.delete({ where: { id: gig.id } }).catch(() => {});

    // 8. Moderation access
    console.log('\n8. Moderation access');
    const staffMsgs = await chat.getMessages(staff.id, orderConv.id, 'MODERATOR');
    check('Moderator can read order chat history', staffMsgs.length === 2);
    const staffCps = await milestones.getOrderCheckpoints(staff.id, order.id, 'MODERATOR');
    check('Moderator can read target/checkpoint history', staffCps.length === 1);
    const staffList = await chat.getConversationsForStaff({ limit: 50 });
    check('Moderator can list all conversations', Array.isArray(staffList.items));

    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
  } finally {
    console.log('Cleaning up test data...');
    const ids = [customer.id, vendorUser.id, staff.id];
    await prisma.chatMessage.deleteMany({ where: { conversation: { customerId: { in: ids } } } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { customerId: { in: ids } } }).catch(() => {});
    await prisma.projectCheckpoint.deleteMany({ where: { order: { customerId: customer.id } } }).catch(() => {});
    await prisma.escrowHolding.deleteMany({ where: { order: { customerId: customer.id } } }).catch(() => {});
    await prisma.order.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
    await prisma.bid.deleteMany({ where: { assignment: { customerId: customer.id } } }).catch(() => {});
    await prisma.assignment.deleteMany({ where: { customerId: customer.id } }).catch(() => {});
    await prisma.handwritingSample.deleteMany({ where: { vendorProfile: { userId: vendorUser.id } } }).catch(() => {});
    await prisma.vendorProfile.deleteMany({ where: { userId: vendorUser.id } }).catch(() => {});
    await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.account.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await prisma.$disconnect();
    console.log('Cleanup complete.');
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Flow verification crashed:', err);
  process.exit(1);
});


