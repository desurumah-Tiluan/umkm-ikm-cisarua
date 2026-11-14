import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUYER_ADMIN_FEE,
  MAX_PRODUCT_IMAGE_BYTES,
  buildCustomerRecapRows,
  calculateKasWalletSummary,
  calculateOrderTotals,
  calculateSellerPayout,
  calculateShippingCost,
  extractSpreadsheetId,
  formatRupiah,
  generatePaymentCode,
  generateResiNumber,
  getAllowedTabsForRole,
  getDefaultTabForRole,
  getNextOrderStatus,
  validateCheckoutInput,
  validateCourierDriverInput,
  validateKasWithdrawalInput,
  validateLoginInput,
  validatePaymentMethodInput,
  validateProductImageFile,
  validateProductInput,
  validateRegistrationInput,
  type Order,
  type PaymentMethod,
  type UserAccount,
} from './marketplace';

test('formatRupiah formats Indonesian currency deterministically', () => {
  assert.equal(formatRupiah(45000), 'Rp 45.000');
  assert.equal(formatRupiah(0), 'Rp 0');
});

test('calculateShippingCost applies zone pricing, weight tiers, and free shipping threshold in Zona Inti', () => {
  // Zona inti below threshold (150k), 1kg
  const standardInti = calculateShippingCost('kurir-desa', 'kopo', 800, 65000);
  assert.equal(standardInti.finalShipping, 5000);
  assert.equal(standardInti.eligibleFreeShipping, false);

  // Zona inti above threshold (150k), 2.5kg -> free shipping!
  const freeInti = calculateShippingCost('kurir-desa', 'kopo', 2500, 160000);
  assert.equal(freeInti.shippingCost, 9000); // 5000 + 2 * 2000
  assert.equal(freeInti.shippingDiscount, 9000);
  assert.equal(freeInti.finalShipping, 0);
  assert.equal(freeInti.eligibleFreeShipping, true);

  // Zona puncak (Tugu Utara) with 1.5kg -> billed 2kg = 8000 + 2000 = 10000
  const puncak = calculateShippingCost('kurir-desa', 'tugu-utara', 1500, 200000);
  assert.equal(puncak.finalShipping, 10000);
  assert.equal(puncak.eligibleFreeShipping, false);

  // Pickup at Koperasi is always free
  const pickup = calculateShippingCost('pickup-koperasi', 'tugu-selatan', 5000, 30000);
  assert.equal(pickup.finalShipping, 0);
});

test('calculateOrderTotals computes subtotal, courier shipping, payment fee, buyer admin fee, seller 5% fee, and grandTotal', () => {
  const totals = calculateOrderTotals(
    [
      { unitPrice: 55000, weightGrams: 250, quantity: 2 },
      { unitPrice: 30000, weightGrams: 500, quantity: 1 },
    ],
    'ojek-umkm',
    'cibeureum',
    'va-bjb'
  );
  assert.equal(totals.subtotal, 140000);
  assert.equal(totals.totalWeightGrams, 1000);
  assert.equal(totals.finalShipping, 15000);
  assert.equal(totals.serviceFee, 1500);
  assert.equal(totals.buyerAdminFee, BUYER_ADMIN_FEE);
  assert.equal(totals.buyerAdminFee, 1000);
  assert.equal(totals.sellerAdminFee, 7000);
  assert.equal(totals.sellerNetAmount, 133000);
  assert.equal(totals.totalKasAdminFee, 8000);
  assert.equal(totals.grandTotal, 157500);
});

test('generateResiNumber uses courier prefix and zero-padded sequence', () => {
  assert.equal(generateResiNumber('kurir-desa', 12), 'CSR-EXP-0012');
  assert.equal(generateResiNumber('ojek-umkm', 5), 'OJK-PK-0005');
});

test('validateProductInput rejects missing or invalid fields', () => {
  const invalid = validateProductInput({
    name: 'ab',
    category: 'Lainnya',
    price: 500,
    stock: -1,
    weightGrams: 5,
    sellerName: '',
    desa: '',
    description: 'pendek',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.category);
  assert.ok(invalid.errors.price);
  assert.ok(invalid.errors.stock);

  const valid = validateProductInput({
    name: 'Kopi Arabika Tugu Utara 250gr',
    category: 'Kopi & Teh',
    price: 68000,
    stock: 20,
    weightGrams: 250,
    sellerName: 'Kopi Puncak Lestari',
    desa: 'Desa Tugu Utara',
    description: 'Biji kopi arabika pilihan dipetik langsung dari kebun dataran tinggi Cisarua.',
  });
  assert.equal(valid.valid, true);
});

test('validateCheckoutInput rejects COD with non-COD courier and short addresses', () => {
  const invalid = validateCheckoutInput({
    buyerName: 'Siti Aminah',
    buyerPhone: '081234567890',
    destinationDesaId: 'luar-cisarua',
    addressDetail: 'Jl. Raya',
    courierId: 'reguler-lokal',
    paymentMethodId: 'cod',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.paymentMethodId);
  assert.ok(invalid.errors.addressDetail);
});

test('getNextOrderStatus transitions cleanly through fulfillment lifecycle', () => {
  assert.equal(getNextOrderStatus('Menunggu Pembayaran'), 'Menunggu Penjemputan Kurir');
  assert.equal(getNextOrderStatus('Menunggu Penjemputan Kurir'), 'Dalam Pengiriman Kurir Lokal');
  assert.equal(getNextOrderStatus('Dalam Pengiriman Kurir Lokal'), 'Selesai');
  assert.equal(getNextOrderStatus('Selesai'), null);
});

test('getAllowedTabsForRole and getDefaultTabForRole strictly enforce role dashboards', () => {
  assert.deepEqual(getAllowedTabsForRole('pelanggan'), ['katalog', 'lacak']);
  assert.equal(getDefaultTabForRole('pelanggan'), 'katalog');

  assert.deepEqual(getAllowedTabsForRole('penjual'), ['penjual', 'kurir']);
  assert.equal(getDefaultTabForRole('penjual'), 'penjual');

  assert.deepEqual(getAllowedTabsForRole('admin'), ['admin', 'katalog', 'lacak', 'kurir', 'penjual']);
  assert.equal(getDefaultTabForRole('admin'), 'admin');

  assert.deepEqual(getAllowedTabsForRole(null), ['katalog', 'lacak']);
  assert.equal(getDefaultTabForRole(null), 'katalog');
});

test('validateRegistrationInput validates customer and seller email registrations', () => {
  const invalidSeller = validateRegistrationInput({
    role: 'penjual',
    name: 'Bo',
    email: 'bukan-email',
    phone: '123',
    desa: '',
    address: 'pendek',
    password: '123',
    storeName: '',
  });
  assert.equal(invalidSeller.valid, false);
  assert.ok(invalidSeller.errors.name);
  assert.ok(invalidSeller.errors.email);
  assert.ok(invalidSeller.errors.phone);
  assert.ok(invalidSeller.errors.desa);
  assert.ok(invalidSeller.errors.address);
  assert.ok(invalidSeller.errors.password);
  assert.ok(invalidSeller.errors.storeName);

  const validCustomer = validateRegistrationInput({
    role: 'pelanggan',
    name: 'Rina Marlina',
    email: 'rina@cisarua.id',
    phone: '081298765432',
    desa: 'Desa Kopo',
    address: 'Jl. Raya Puncak No. 45 RT 03/02',
    password: 'Password123',
  });
  assert.equal(validCustomer.valid, true);
});

test('validateLoginInput validates email and password presence', () => {
  assert.equal(validateLoginInput({ email: 'bad', password: '' }).valid, false);
  assert.equal(validateLoginInput({ email: 'admin@ikmcisarua.id', password: 'secret' }).valid, true);
});

test('extractSpreadsheetId parses full Google Sheets URLs and raw IDs', () => {
  assert.equal(
    extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(extractSpreadsheetId('  abc123_XYZ-99  '), 'abc123_XYZ-99');
});

test('buildCustomerRecapRows outputs header and only approved pelanggan sorted by createdAt', () => {
  const sampleUsers: UserAccount[] = [
    {
      id: 'usr-admin',
      role: 'admin',
      name: 'Admin Forum',
      email: 'admin@ikmcisarua.id',
      phone: '08111111111',
      desa: 'Kel. Cisarua',
      address: 'Jl. Raya Puncak KM 81',
      approvalStatus: 'approved',
      createdAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'usr-cust-2',
      role: 'pelanggan',
      name: 'Budi Santoso',
      email: 'budi@gmail.com',
      phone: '081234567890',
      desa: 'Desa Cilember',
      address: 'Jl. Curug Cilember No. 12',
      approvalStatus: 'approved',
      createdAt: '2026-11-05T10:00:00.000Z',
      approvedAt: '2026-11-05T11:00:00.000Z',
    },
    {
      id: 'usr-cust-pending',
      role: 'pelanggan',
      name: 'Warga Pending',
      email: 'pending@gmail.com',
      phone: '081200000001',
      desa: 'Desa Kopo',
      address: 'Jl. Kopo No. 1',
      approvalStatus: 'pending',
      createdAt: '2026-11-02T09:00:00.000Z',
    },
    {
      id: 'usr-cust-1',
      role: 'pelanggan',
      name: 'Siti Aminah',
      email: 'siti@gmail.com',
      phone: '081355556666',
      desa: 'Desa Kopo',
      address: 'Perum Griya Kopo Blok A4',
      approvalStatus: 'approved',
      createdAt: '2026-11-03T08:00:00.000Z',
      approvedAt: '2026-11-03T09:00:00.000Z',
    },
  ];

  const rows = buildCustomerRecapRows(sampleUsers);
  assert.equal(rows.length, 3); // header + 2 approved customers
  assert.equal(rows[0][0], 'No');
  assert.equal(rows[0][3], 'Email');
  assert.equal(rows[1][1], 'usr-cust-1');
  assert.equal(rows[1][2], 'Siti Aminah');
  assert.equal(rows[2][1], 'usr-cust-2');
  assert.equal(rows[2][7], 'Diterima Admin');
});

test('validateProductImageFile allows JPG/PNG within 5MB and rejects unsupported or oversized files', () => {
  assert.deepEqual(validateProductImageFile('image/jpeg', 250000), { valid: true, extension: 'jpg' });
  assert.deepEqual(validateProductImageFile('image/png', 1024000), { valid: true, extension: 'png' });

  const invalidType = validateProductImageFile('image/svg+xml', 1024);
  assert.equal(invalidType.valid, false);
  assert.ok(invalidType.error);

  const oversized = validateProductImageFile('image/png', MAX_PRODUCT_IMAGE_BYTES + 1);
  assert.equal(oversized.valid, false);
  assert.ok(oversized.error);
});

test('calculateSellerPayout deducts 5% admin fee from gross sales', () => {
  const payout = calculateSellerPayout(100000);
  assert.equal(payout.grossAmount, 100000);
  assert.equal(payout.adminFee, 5000);
  assert.equal(payout.netAmount, 95000);

  const oddPayout = calculateSellerPayout(55000);
  assert.equal(oddPayout.adminFee, 2750);
  assert.equal(oddPayout.netAmount, 52250);
});

test('calculateKasWalletSummary aggregates paid fees, pending fees, and withdrawals accurately', () => {
  const sampleOrders: Order[] = [
    {
      id: 'ORD-1',
      resi: 'CSR-EXP-0001',
      buyerName: 'Agus',
      buyerPhone: '081200000001',
      destinationDesaId: 'kopo',
      destinationDesaName: 'Desa Kopo',
      addressDetail: 'Jl. Kopo 1',
      courierId: 'kurir-desa',
      courierName: 'Kurir Desa',
      paymentMethodId: 'qris',
      paymentMethodName: 'QRIS',
      paymentCode: 'QRIS-1',
      isPaid: true,
      status: 'Selesai',
      items: [
        {
          productId: 'p1',
          productName: 'Kopi',
          sellerName: 'Kopi Puncak Lestari',
          desa: 'Desa Tugu Utara',
          unitPrice: 100000,
          weightGrams: 250,
          quantity: 1,
          imageKey: 'kopi',
        },
      ],
      subtotal: 100000,
      totalWeightGrams: 250,
      shippingCost: 5000,
      shippingDiscount: 0,
      serviceFee: 0,
      buyerAdminFee: 1000,
      sellerAdminFee: 5000,
      sellerNetAmount: 95000,
      grandTotal: 106000,
      createdAt: '2026-11-12T08:00:00.000Z',
      timeline: [],
    },
    {
      id: 'ORD-2',
      resi: 'OJK-PK-0002',
      buyerName: 'Ratna',
      buyerPhone: '081200000002',
      destinationDesaId: 'kopo',
      destinationDesaName: 'Desa Kopo',
      addressDetail: 'Jl. Kopo 2',
      courierId: 'ojek-umkm',
      courierName: 'Ojek Kilat',
      paymentMethodId: 'cod',
      paymentMethodName: 'COD',
      paymentCode: 'COD-2',
      isPaid: false,
      status: 'Menunggu Penjemputan Kurir',
      items: [
        {
          productId: 'p2',
          productName: 'Madu',
          sellerName: 'Madu Cibeureum',
          desa: 'Desa Cibeureum',
          unitPrice: 80000,
          weightGrams: 400,
          quantity: 1,
          imageKey: 'madu-susu',
        },
      ],
      subtotal: 80000,
      totalWeightGrams: 400,
      shippingCost: 10000,
      shippingDiscount: 0,
      serviceFee: 2000,
      buyerAdminFee: 1000,
      sellerAdminFee: 4000,
      sellerNetAmount: 76000,
      grandTotal: 93000,
      createdAt: '2026-11-12T10:00:00.000Z',
      timeline: [],
    },
  ];

  const summary = calculateKasWalletSummary(sampleOrders, [
    {
      id: 'kas-wd-1',
      amount: 2000,
      note: 'Biaya operasional cetak resi koperasi',
      createdBy: 'Admin Forum',
      createdAt: '2026-11-12T12:00:00.000Z',
    },
  ]);

  assert.equal(summary.totalBuyerAdminFees, 1000);
  assert.equal(summary.totalSellerAdminFees, 5000);
  assert.equal(summary.totalInflowPaid, 6000);
  assert.equal(summary.totalWithdrawn, 2000);
  assert.equal(summary.availableBalance, 4000);
  assert.equal(summary.pendingBalance, 5000);
  assert.equal(summary.paidOrdersCount, 1);
  assert.equal(summary.pendingOrdersCount, 1);
  assert.equal(summary.entries.length, 5); // 2 from ORD-1, 2 from ORD-2, 1 withdrawal
  assert.equal(summary.entries[0].id, 'kas-wd-1');
});

test('validateKasWithdrawalInput enforces balance ceiling and minimum note length', () => {
  assert.equal(validateKasWithdrawalInput({ amount: 500, note: 'Operasional' }, 10000).valid, false);
  assert.equal(validateKasWithdrawalInput({ amount: 15000, note: 'Operasional' }, 10000).valid, false);
  assert.equal(validateKasWithdrawalInput({ amount: 5000, note: 'Kas' }, 10000).valid, false);
  assert.equal(validateKasWithdrawalInput({ amount: 5000, note: 'Cetak label kurir desa' }, 10000).valid, true);
});

test('validateCourierDriverInput validates driver name, phone, zone, and area', () => {
  const invalid = validateCourierDriverInput({
    name: 'Ab',
    phone: '123',
    zone: 'Zona Lain',
    area: 'ab',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.zone);
  assert.ok(invalid.errors.area);

  const valid = validateCourierDriverInput({
    name: 'Kang Ujang Permana',
    phone: '0812-3456-7890',
    zone: 'Zona Puncak',
    area: 'Desa Tugu Selatan & Citeko',
  });
  assert.equal(valid.valid, true);
});

test('validatePaymentMethodInput and dynamic payment fee/code calculation work for custom forum channels', () => {
  const invalid = validatePaymentMethodInput({
    name: 'AB',
    subtitle: 'Pendek',
    fee: -100,
    type: 'va',
    accountNumber: '12',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.fee);
  assert.ok(invalid.errors.accountNumber);

  const customChannel: PaymentMethod = {
    id: 'va-mandiri-koperasi',
    name: 'Transfer Bank Mandiri Koperasi',
    subtitle: 'a.n. Koperasi Forum UMKM IKM Kec. Cisarua',
    fee: 1000,
    type: 'va',
    accountNumber: '133-00-881675-9',
    isActive: true,
  };
  assert.equal(validatePaymentMethodInput(customChannel).valid, true);

  const totals = calculateOrderTotals(
    [{ unitPrice: 50000, weightGrams: 500, quantity: 1 }],
    'pickup-koperasi',
    'kopo',
    customChannel.id,
    [customChannel]
  );
  assert.equal(totals.serviceFee, 1000);
  assert.equal(totals.grandTotal, 52000); // 50000 + 0 shipping + 1000 serviceFee + 1000 buyerAdminFee
  assert.equal(generatePaymentCode(customChannel, 5), '133-00-881675-9');
});
