export type ProductCategory =
  | 'Kopi & Teh'
  | 'Susu & Madu'
  | 'Kuliner & Camilan'
  | 'Kerajinan & Batik'
  | 'Sayur & Buah Segar';

export type OrderStatus =
  | 'Menunggu Pembayaran'
  | 'Menunggu Penjemputan Kurir'
  | 'Dalam Pengiriman Kurir Lokal'
  | 'Selesai';

export type PaymentMethodId = string;

export type CourierId =
  | 'kurir-desa'
  | 'ojek-umkm'
  | 'pickup-koperasi'
  | 'reguler-lokal';

export interface DesaZone {
  id: string;
  name: string;
  zone: 'inti' | 'puncak' | 'luar';
  distanceKm: number;
  postalCode: string;
}

export interface CourierService {
  id: CourierId;
  name: string;
  tagline: string;
  eta: string;
  baseRates: Record<'inti' | 'puncak' | 'luar', number>;
  perExtraKg: number;
  maxWeightGrams: number;
  supportsCod: boolean;
  freeThresholdInti?: number;
}

export interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  subtitle: string;
  fee: number;
  type: 'qris' | 'va' | 'cod';
  bankCode?: string;
  accountNumber?: string;
  isActive: boolean;
}

export interface SellerStore {
  id: string;
  name: string;
  ownerName: string;
  desa: string;
  phone: string;
  joinedYear: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  weightGrams: number;
  sellerId: string;
  sellerName: string;
  desa: string;
  description: string;
  imageKey: string;
  rating: number;
  soldCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface OrderLineItem {
  productId: string;
  productName: string;
  sellerName: string;
  desa: string;
  unitPrice: number;
  weightGrams: number;
  quantity: number;
  imageKey: string;
}

export interface OrderTimelineEvent {
  timestamp: string;
  status: string;
  note: string;
}

export interface Order {
  id: string;
  resi: string;
  buyerName: string;
  buyerPhone: string;
  destinationDesaId: string;
  destinationDesaName: string;
  addressDetail: string;
  courierId: CourierId;
  courierName: string;
  courierDriver?: string;
  courierPhone?: string;
  paymentMethodId: PaymentMethodId;
  paymentMethodName: string;
  paymentCode: string;
  isPaid: boolean;
  status: OrderStatus;
  items: OrderLineItem[];
  subtotal: number;
  totalWeightGrams: number;
  shippingCost: number;
  shippingDiscount: number;
  serviceFee: number;
  buyerAdminFee: number;
  sellerAdminFee: number;
  sellerNetAmount: number;
  grandTotal: number;
  createdAt: string;
  timeline: OrderTimelineEvent[];
}

export const BUYER_ADMIN_FEE = 1000;
export const SELLER_ADMIN_FEE_RATE = 0.05;

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Kopi & Teh',
  'Susu & Madu',
  'Kuliner & Camilan',
  'Kerajinan & Batik',
  'Sayur & Buah Segar',
];

export const CISARUA_DESA_LIST: DesaZone[] = [
  { id: 'cisarua-kota', name: 'Kel. Cisarua (Pusat Kecamatan)', zone: 'inti', distanceKm: 1.5, postalCode: '16750' },
  { id: 'kopo', name: 'Desa Kopo', zone: 'inti', distanceKm: 2.2, postalCode: '16750' },
  { id: 'leuwimalang', name: 'Desa Leuwimalang', zone: 'inti', distanceKm: 2.8, postalCode: '16750' },
  { id: 'jogjogan', name: 'Desa Jogjogan', zone: 'inti', distanceKm: 3.4, postalCode: '16750' },
  { id: 'cilember', name: 'Desa Cilember', zone: 'inti', distanceKm: 4.1, postalCode: '16750' },
  { id: 'batulayang', name: 'Desa Batulayang', zone: 'puncak', distanceKm: 5.5, postalCode: '16750' },
  { id: 'citeko', name: 'Desa Citeko', zone: 'puncak', distanceKm: 6.2, postalCode: '16750' },
  { id: 'cibeureum', name: 'Desa Cibeureum', zone: 'puncak', distanceKm: 6.8, postalCode: '16750' },
  { id: 'tugu-utara', name: 'Desa Tugu Utara', zone: 'puncak', distanceKm: 8.4, postalCode: '16750' },
  { id: 'tugu-selatan', name: 'Desa Tugu Selatan', zone: 'puncak', distanceKm: 9.1, postalCode: '16750' },
  { id: 'luar-cisarua', name: 'Luar Kec. Cisarua (Bogor / Jabodetabek)', zone: 'luar', distanceKm: 25.0, postalCode: '16770' },
];

export const COURIER_SERVICES: CourierService[] = [
  {
    id: 'kurir-desa',
    name: 'Kurir Desa Cisarua Express',
    tagline: 'Armada resmi antar-desa Forum UMKM IKM Kec. Cisarua',
    eta: 'Hari ini (3 - 5 jam)',
    baseRates: { inti: 5000, puncak: 8000, luar: 18000 },
    perExtraKg: 2000,
    maxWeightGrams: 30000,
    supportsCod: true,
    freeThresholdInti: 150000,
  },
  {
    id: 'ojek-umkm',
    name: 'Ojek Kilat Puncak UMKM',
    tagline: 'Mitra ojek pangkalan lokal untuk pengiriman cepat & segar',
    eta: 'Instan (45 - 90 menit)',
    baseRates: { inti: 10000, puncak: 15000, luar: 28000 },
    perExtraKg: 3000,
    maxWeightGrams: 12000,
    supportsCod: true,
  },
  {
    id: 'pickup-koperasi',
    name: 'Ambil di Gerai Koperasi IKM',
    tagline: 'Jl. Raya Puncak KM 81, Cisarua (Buka 08.00 - 20.00)',
    eta: 'Siap diambil dalam 1 jam',
    baseRates: { inti: 0, puncak: 0, luar: 0 },
    perExtraKg: 0,
    maxWeightGrams: 100000,
    supportsCod: true,
  },
  {
    id: 'reguler-lokal',
    name: 'Kargo Reguler Nusantara',
    tagline: 'Pengiriman terintegrasi untuk luar kecamatan & luar kota',
    eta: '1 - 3 hari kerja',
    baseRates: { inti: 11000, puncak: 12000, luar: 15000 },
    perExtraKg: 5000,
    maxWeightGrams: 50000,
    supportsCod: false,
  },
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'qris',
    name: 'QRIS Forum UMKM IKM',
    subtitle: 'GoPay, OVO, DANA, ShopeePay, BCA & Mobile Banking',
    fee: 0,
    type: 'qris',
    accountNumber: 'QRIS-CISARUA',
    isActive: true,
  },
  {
    id: 'va-bjb',
    name: 'Virtual Account Bank BJB',
    subtitle: 'Verifikasi otomatis mitra resmi UMKM Jawa Barat',
    fee: 1500,
    type: 'va',
    bankCode: '110',
    accountNumber: '1100881675',
    isActive: true,
  },
  {
    id: 'va-bri',
    name: 'Virtual Account BRI BRIVA',
    subtitle: 'Transfer langsung ke rekening escrow Forum IKM Cisarua',
    fee: 1500,
    type: 'va',
    bankCode: '002',
    accountNumber: '88081675',
    isActive: true,
  },
  {
    id: 'cod',
    name: 'COD (Bayar di Tempat via Kurir Lokal)',
    subtitle: 'Bayar tunai langsung ke kurir desa saat paket tiba',
    fee: 2000,
    type: 'cod',
    isActive: true,
  },
];

export type CourierZoneType = 'Zona Inti' | 'Zona Puncak' | 'Luar Kec. Cisarua';

export interface CourierDriver {
  id: string;
  name: string;
  phone: string;
  zone: CourierZoneType;
  area: string;
  isActive: boolean;
}

export const COURIER_ZONE_OPTIONS: Array<{
  zone: CourierZoneType;
  label: string;
  defaultArea: string;
}> = [
  {
    zone: 'Zona Inti',
    label: 'Zona Inti (Kel. Cisarua, Kopo, Leuwimalang, Jogjogan, Cilember)',
    defaultArea: 'Kel. Cisarua, Desa Kopo & Cilember',
  },
  {
    zone: 'Zona Puncak',
    label: 'Zona Puncak (Batulayang, Citeko, Cibeureum, Tugu Utara, Tugu Selatan)',
    defaultArea: 'Desa Tugu Utara, Tugu Selatan & Cibeureum',
  },
  {
    zone: 'Luar Kec. Cisarua',
    label: 'Luar Kec. Cisarua (Bogor / Jabodetabek)',
    defaultArea: 'Bogor Kota, Megamendung & Jabodetabek',
  },
];

export const LOCAL_COURIER_DRIVERS: CourierDriver[] = [
  {
    id: 'drv-dedi',
    name: 'Kang Dedi Mulyana',
    phone: '0812-8490-1120',
    zone: 'Zona Inti',
    area: 'Kel. Cisarua, Kopo & Leuwimalang',
    isActive: true,
  },
  {
    id: 'drv-asep',
    name: 'Mang Asep Saepudin',
    phone: '0857-7120-3348',
    zone: 'Zona Puncak',
    area: 'Desa Tugu Utara & Tugu Selatan',
    isActive: true,
  },
  {
    id: 'drv-rina',
    name: 'Teh Rina Kartika',
    phone: '0813-1904-5521',
    zone: 'Zona Puncak',
    area: 'Desa Cibeureum & Citeko',
    isActive: true,
  },
  {
    id: 'drv-hendra',
    name: 'Pak Hendra Wijaya',
    phone: '0878-7312-9084',
    zone: 'Zona Inti',
    area: 'Desa Cilember, Jogjogan & Batulayang',
    isActive: true,
  },
];

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `Rp ${safe.toLocaleString('id-ID')}`;
}

export function formatWeight(grams: number): string {
  if (grams < 1000) return `${grams} gr`;
  const kg = grams / 1000;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

export function calculateShippingCost(
  courierId: CourierId,
  destinationDesaId: string,
  totalWeightGrams: number,
  subtotal: number
): { shippingCost: number; shippingDiscount: number; finalShipping: number; eligibleFreeShipping: boolean } {
  const courier = COURIER_SERVICES.find((c) => c.id === courierId) ?? COURIER_SERVICES[0];
  const desa = CISARUA_DESA_LIST.find((d) => d.id === destinationDesaId) ?? CISARUA_DESA_LIST[0];

  if (courier.id === 'pickup-koperasi') {
    return { shippingCost: 0, shippingDiscount: 0, finalShipping: 0, eligibleFreeShipping: false };
  }

  const base = courier.baseRates[desa.zone];
  const billedKg = Math.max(1, Math.ceil(Math.max(1, totalWeightGrams) / 1000));
  const extraKg = Math.max(0, billedKg - 1);
  const rawCost = base + extraKg * courier.perExtraKg;

  const eligibleFreeShipping =
    Boolean(courier.freeThresholdInti) &&
    desa.zone === 'inti' &&
    subtotal >= (courier.freeThresholdInti ?? Infinity);

  const shippingDiscount = eligibleFreeShipping ? rawCost : 0;
  const finalShipping = Math.max(0, rawCost - shippingDiscount);

  return {
    shippingCost: rawCost,
    shippingDiscount,
    finalShipping,
    eligibleFreeShipping,
  };
}

export function calculateSellerPayout(grossAmount: number): {
  grossAmount: number;
  adminFee: number;
  netAmount: number;
} {
  const safeGross = Number.isFinite(grossAmount) ? Math.max(0, Math.round(grossAmount)) : 0;
  const adminFee = Math.round(safeGross * SELLER_ADMIN_FEE_RATE);
  const netAmount = Math.max(0, safeGross - adminFee);
  return { grossAmount: safeGross, adminFee, netAmount };
}

export function calculateOrderTotals(
  items: Array<{ unitPrice: number; weightGrams: number; quantity: number }>,
  courierId: CourierId,
  destinationDesaId: string,
  paymentMethodId: PaymentMethodId,
  paymentMethods: PaymentMethod[] = PAYMENT_METHODS
) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalWeightGrams = items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0);

  const shipping = calculateShippingCost(courierId, destinationDesaId, totalWeightGrams, subtotal);
  const pool = paymentMethods.length > 0 ? paymentMethods : PAYMENT_METHODS;
  const payment = pool.find((p) => p.id === paymentMethodId) ?? pool[0] ?? PAYMENT_METHODS[0];
  const serviceFee = items.length > 0 ? payment.fee : 0;
  const buyerAdminFee = items.length > 0 ? BUYER_ADMIN_FEE : 0;
  const sellerPayout = calculateSellerPayout(subtotal);
  const grandTotal = subtotal + shipping.finalShipping + serviceFee + buyerAdminFee;

  return {
    subtotal,
    totalWeightGrams,
    shippingCost: shipping.shippingCost,
    shippingDiscount: shipping.shippingDiscount,
    finalShipping: shipping.finalShipping,
    eligibleFreeShipping: shipping.eligibleFreeShipping,
    serviceFee,
    buyerAdminFee,
    sellerAdminFee: sellerPayout.adminFee,
    sellerNetAmount: sellerPayout.netAmount,
    totalKasAdminFee: buyerAdminFee + sellerPayout.adminFee,
    grandTotal,
  };
}

export function generateResiNumber(courierId: CourierId, sequence: number): string {
  const prefixMap: Record<CourierId, string> = {
    'kurir-desa': 'CSR-EXP',
    'ojek-umkm': 'OJK-PK',
    'pickup-koperasi': 'KOP-PU',
    'reguler-lokal': 'REG-NS',
  };
  const padded = String(sequence).padStart(4, '0');
  return `${prefixMap[courierId]}-${padded}`;
}

export function generatePaymentCode(
  paymentMethod: PaymentMethod | PaymentMethodId,
  orderSeq: number
): string {
  const suffix = String(100000 + orderSeq * 137).slice(0, 6);
  const method =
    typeof paymentMethod === 'string'
      ? PAYMENT_METHODS.find((p) => p.id === paymentMethod)
      : paymentMethod;

  const type = method?.type ?? (paymentMethod === 'cod' ? 'cod' : paymentMethod === 'qris' ? 'qris' : 'va');
  const acct = method?.accountNumber?.trim();

  if (type === 'qris') {
    const prefix = acct || 'QRIS-CISARUA';
    return `${prefix}-${suffix}`;
  }
  if (type === 'va') {
    if (acct) {
      if (acct.includes('-') || acct.includes(' ') || acct.length >= 11) {
        return acct;
      }
      return `${acct}${suffix}`;
    }
    if (method?.id === 'va-bjb' || paymentMethod === 'va-bjb') {
      return `1100881675${suffix}`;
    }
    return `88081675${suffix}`;
  }
  return `COD-CSR-${suffix}`;
}

export function validateProductInput(input: {
  name?: string;
  category?: string;
  price?: number | string;
  stock?: number | string;
  weightGrams?: number | string;
  sellerName?: string;
  desa?: string;
  description?: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 3) {
    errors.name = 'Nama produk minimal 3 karakter.';
  }
  if (!input.category || !PRODUCT_CATEGORIES.includes(input.category as ProductCategory)) {
    errors.category = 'Pilih kategori produk yang valid.';
  }
  const priceNum = Number(input.price);
  if (!Number.isFinite(priceNum) || priceNum < 1000) {
    errors.price = 'Harga produk minimal Rp 1.000.';
  }
  const stockNum = Number(input.stock);
  if (!Number.isFinite(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
    errors.stock = 'Stok harus berupa angka bulat minimal 0.';
  }
  const weightNum = Number(input.weightGrams);
  if (!Number.isFinite(weightNum) || weightNum < 10) {
    errors.weightGrams = 'Berat minimal 10 gram untuk kalkulasi kurir.';
  }
  if (!input.sellerName || input.sellerName.trim().length < 2) {
    errors.sellerName = 'Nama toko / UMKM wajib diisi.';
  }
  if (!input.desa || input.desa.trim().length < 2) {
    errors.desa = 'Desa asal di Kec. Cisarua wajib dipilih.';
  }
  if (!input.description || input.description.trim().length < 10) {
    errors.description = 'Deskripsi produk minimal 10 karakter.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCheckoutInput(input: {
  buyerName?: string;
  buyerPhone?: string;
  destinationDesaId?: string;
  addressDetail?: string;
  courierId?: CourierId;
  paymentMethodId?: PaymentMethodId;
  paymentType?: 'qris' | 'va' | 'cod';
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.buyerName || input.buyerName.trim().length < 3) {
    errors.buyerName = 'Nama lengkap penerima minimal 3 karakter.';
  }
  const cleanedPhone = (input.buyerPhone ?? '').replace(/[^0-9]/g, '');
  if (cleanedPhone.length < 9 || cleanedPhone.length > 15) {
    errors.buyerPhone = 'Masukkan nomor WhatsApp yang valid (9-15 digit).';
  }
  if (!input.destinationDesaId || !CISARUA_DESA_LIST.some((d) => d.id === input.destinationDesaId)) {
    errors.destinationDesaId = 'Pilih desa/wilayah tujuan pengiriman.';
  }
  if (
    input.courierId !== 'pickup-koperasi' &&
    (!input.addressDetail || input.addressDetail.trim().length < 10)
  ) {
    errors.addressDetail = 'Alamat lengkap (RT/RW, nama jalan, patokan) minimal 10 karakter.';
  }
  const courier = COURIER_SERVICES.find((c) => c.id === input.courierId);
  const isCod = input.paymentType ? input.paymentType === 'cod' : input.paymentMethodId === 'cod';
  if (courier && isCod && !courier.supportsCod) {
    errors.paymentMethodId = 'Kurir yang dipilih tidak mendukung pembayaran COD.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function getNextOrderStatus(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case 'Menunggu Pembayaran':
      return 'Menunggu Penjemputan Kurir';
    case 'Menunggu Penjemputan Kurir':
      return 'Dalam Pengiriman Kurir Lokal';
    case 'Dalam Pengiriman Kurir Lokal':
      return 'Selesai';
    case 'Selesai':
      return null;
  }
}

export type UserRole = 'admin' | 'pelanggan' | 'penjual';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AppTab = 'katalog' | 'lacak' | 'kurir' | 'penjual' | 'admin';

export interface UserAccount {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  phone: string;
  desa: string;
  address: string;
  storeName?: string;
  sellerId?: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  approvedAt?: string;
  syncedToSheetAt?: string;
}

export interface SheetsRecapConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  lastSyncedAt?: string;
  lastSyncedCount?: number;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

export function getAllowedTabsForRole(role: UserRole | null): AppTab[] {
  if (role === 'pelanggan') {
    return ['katalog', 'lacak'];
  }
  if (role === 'penjual') {
    return ['penjual', 'kurir'];
  }
  if (role === 'admin') {
    return ['admin', 'katalog', 'lacak', 'kurir', 'penjual'];
  }
  return ['katalog', 'lacak'];
}

export function getDefaultTabForRole(role: UserRole | null): AppTab {
  if (role === 'penjual') return 'penjual';
  if (role === 'admin') return 'admin';
  return 'katalog';
}

export function validateRegistrationInput(input: {
  role?: string;
  name?: string;
  email?: string;
  phone?: string;
  desa?: string;
  address?: string;
  password?: string;
  storeName?: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (input.role !== 'pelanggan' && input.role !== 'penjual') {
    errors.role = 'Pilih jenis akun Pelanggan atau Penjual.';
  }
  if (!input.name || input.name.trim().length < 3) {
    errors.name = 'Nama lengkap minimal 3 karakter.';
  }
  const email = (input.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Masukkan alamat email yang valid.';
  }
  const digits = (input.phone ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 9 || digits.length > 15) {
    errors.phone = 'Nomor WhatsApp harus 9-15 digit.';
  }
  if (!input.desa || input.desa.trim().length < 2) {
    errors.desa = 'Pilih desa/kelurahan domisili.';
  }
  if (!input.address || input.address.trim().length < 8) {
    errors.address = 'Alamat lengkap minimal 8 karakter.';
  }
  if (!input.password || input.password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter.';
  }
  if (input.role === 'penjual' && (!input.storeName || input.storeName.trim().length < 3)) {
    errors.storeName = 'Nama toko / usaha UMKM IKM minimal 3 karakter.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateLoginInput(input: {
  email?: string;
  password?: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const email = (input.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Masukkan alamat email yang valid.';
  }
  if (!input.password || input.password.length < 4) {
    errors.password = 'Kata sandi wajib diisi.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function buildCustomerRecapRows(users: UserAccount[]): string[][] {
  const approvedCustomers = users
    .filter((u) => u.role === 'pelanggan' && u.approvalStatus === 'approved')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const header = [
    'No',
    'ID Pelanggan',
    'Nama Lengkap',
    'Email',
    'Nomor WhatsApp',
    'Desa / Kelurahan',
    'Alamat Lengkap',
    'Status Persetujuan',
    'Tanggal Daftar',
    'Tanggal Disetujui Admin',
  ];

  const rows = approvedCustomers.map((user, idx) => [
    String(idx + 1),
    user.id,
    user.name,
    user.email,
    user.phone,
    user.desa,
    user.address,
    'Diterima Admin',
    new Date(user.createdAt).toLocaleString('id-ID'),
    user.approvedAt ? new Date(user.approvedAt).toLocaleString('id-ID') : '-',
  ]);

  return [header, ...rows];
}

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateProductImageFile(
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string; extension?: 'jpg' | 'png' } {
  const normalized = mimeType.trim().toLowerCase();
  let extension: 'jpg' | 'png' | undefined;
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    extension = 'jpg';
  } else if (normalized === 'image/png') {
    extension = 'png';
  } else {
    return {
      valid: false,
      error: 'Format foto produk harus JPG (.jpg/.jpeg) atau PNG (.png).',
    };
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { valid: false, error: 'File foto produk tidak valid atau kosong.' };
  }
  if (sizeBytes > MAX_PRODUCT_IMAGE_BYTES) {
    return {
      valid: false,
      error: 'Ukuran foto produk maksimal 5 MB.',
    };
  }

  return { valid: true, extension };
}

export interface KasWithdrawal {
  id: string;
  amount: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface KasLedgerEntry {
  id: string;
  timestamp: string;
  orderId?: string;
  resi?: string;
  type: 'buyer_admin_fee' | 'seller_admin_fee' | 'withdrawal';
  label: string;
  detail: string;
  amount: number;
  status: 'Masuk Kas' | 'Menunggu Bayar' | 'Penarikan';
}

export interface KasWalletSummary {
  availableBalance: number;
  pendingBalance: number;
  totalInflowPaid: number;
  totalBuyerAdminFees: number;
  totalSellerAdminFees: number;
  totalWithdrawn: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  entries: KasLedgerEntry[];
}

export function calculateKasWalletSummary(
  orders: Order[],
  withdrawals: KasWithdrawal[] = []
): KasWalletSummary {
  let totalBuyerAdminFees = 0;
  let totalSellerAdminFees = 0;
  let totalInflowPaid = 0;
  let pendingBalance = 0;
  let paidOrdersCount = 0;
  let pendingOrdersCount = 0;
  const entries: KasLedgerEntry[] = [];

  for (const order of orders) {
    const buyerFee =
      typeof order.buyerAdminFee === 'number' ? order.buyerAdminFee : BUYER_ADMIN_FEE;
    const sellerFee =
      typeof order.sellerAdminFee === 'number'
        ? order.sellerAdminFee
        : calculateSellerPayout(order.subtotal).adminFee;
    const orderKasTotal = buyerFee + sellerFee;
    const entryStatus: 'Masuk Kas' | 'Menunggu Bayar' = order.isPaid
      ? 'Masuk Kas'
      : 'Menunggu Bayar';

    if (order.isPaid) {
      totalBuyerAdminFees += buyerFee;
      totalSellerAdminFees += sellerFee;
      totalInflowPaid += orderKasTotal;
      paidOrdersCount += 1;
    } else {
      pendingBalance += orderKasTotal;
      pendingOrdersCount += 1;
    }

    const sellerNames = Array.from(new Set(order.items.map((i) => i.sellerName))).join(', ');

    if (buyerFee > 0) {
      entries.push({
        id: `kas-buyer-${order.id}`,
        timestamp: order.createdAt,
        orderId: order.id,
        resi: order.resi,
        type: 'buyer_admin_fee',
        label: 'Fee Admin Pembeli (Checkout)',
        detail: `${order.buyerName} · ${order.id}`,
        amount: buyerFee,
        status: entryStatus,
      });
    }

    if (sellerFee > 0) {
      entries.push({
        id: `kas-seller-${order.id}`,
        timestamp: order.createdAt,
        orderId: order.id,
        resi: order.resi,
        type: 'seller_admin_fee',
        label: 'Potongan Fee Admin Penjual (5%)',
        detail: `${sellerNames || 'Penjual UMKM'} · ${order.id}`,
        amount: sellerFee,
        status: entryStatus,
      });
    }
  }

  let totalWithdrawn = 0;
  for (const w of withdrawals) {
    const safeAmount = Math.max(0, Math.round(w.amount));
    totalWithdrawn += safeAmount;
    entries.push({
      id: w.id,
      timestamp: w.createdAt,
      type: 'withdrawal',
      label: 'Penarikan / Operasional Kas',
      detail: `${w.note} · Oleh ${w.createdBy}`,
      amount: -safeAmount,
      status: 'Penarikan',
    });
  }

  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    availableBalance: totalInflowPaid - totalWithdrawn,
    pendingBalance,
    totalInflowPaid,
    totalBuyerAdminFees,
    totalSellerAdminFees,
    totalWithdrawn,
    paidOrdersCount,
    pendingOrdersCount,
    entries,
  };
}

export function validateKasWithdrawalInput(
  input: { amount?: number | string; note?: string },
  availableBalance: number
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const amountNum = Number(input.amount);

  if (!Number.isFinite(amountNum) || !Number.isInteger(amountNum) || amountNum < 1000) {
    errors.amount = 'Nominal penarikan kas minimal Rp 1.000 (angka bulat).';
  } else if (amountNum > availableBalance) {
    errors.amount = `Nominal melebihi saldo kas tersedia (${formatRupiah(availableBalance)}).`;
  }

  if (!input.note || input.note.trim().length < 5) {
    errors.note = 'Keterangan penggunaan kas minimal 5 karakter.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateCourierDriverInput(input: {
  name?: string;
  phone?: string;
  zone?: string;
  area?: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 3) {
    errors.name = 'Nama petugas kurir minimal 3 karakter.';
  }
  const digits = (input.phone ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 9 || digits.length > 15) {
    errors.phone = 'Nomor WhatsApp petugas harus 9-15 digit.';
  }
  const validZones: CourierZoneType[] = ['Zona Inti', 'Zona Puncak', 'Luar Kec. Cisarua'];
  if (!input.zone || !validZones.includes(input.zone as CourierZoneType)) {
    errors.zone = 'Pilih zona tugas kurir yang valid.';
  }
  if (!input.area || input.area.trim().length < 3) {
    errors.area = 'Cakupan desa / rute tugas minimal 3 karakter.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validatePaymentMethodInput(input: {
  name?: string;
  subtitle?: string;
  fee?: number | string;
  type?: string;
  accountNumber?: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length < 3) {
    errors.name = 'Nama kanal pembayaran minimal 3 karakter.';
  }
  if (!input.subtitle || input.subtitle.trim().length < 5) {
    errors.subtitle = 'Keterangan kanal pembayaran minimal 5 karakter.';
  }
  if (input.type !== 'qris' && input.type !== 'va' && input.type !== 'cod') {
    errors.type = 'Pilih jenis kanal yang valid (QRIS, VA/Transfer, atau COD).';
  }
  const feeNum = Number(input.fee ?? 0);
  if (!Number.isFinite(feeNum) || feeNum < 0 || !Number.isInteger(feeNum)) {
    errors.fee = 'Biaya layanan harus berupa angka bulat minimal Rp 0.';
  }
  if (input.type === 'va' && (!input.accountNumber || input.accountNumber.trim().length < 4)) {
    errors.accountNumber =
      'Nomor rekening atau kode prefix Virtual Account minimal 4 karakter.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
