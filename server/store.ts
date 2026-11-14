import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BUYER_ADMIN_FEE,
  LOCAL_COURIER_DRIVERS,
  PAYMENT_METHODS,
  calculateSellerPayout,
  type CourierDriver,
  type KasWithdrawal,
  type Order,
  type PaymentMethod,
  type Product,
  type SellerStore,
  type SheetsRecapConfig,
  type UserAccount,
} from '../src/lib/marketplace.ts';
import { hashPassword } from './auth.ts';

export type StoredUserAccount = UserAccount & {
  passwordHash: string;
};

export interface MarketplaceDatabase {
  sellers: SellerStore[];
  products: Product[];
  orders: Order[];
  orderSequence: number;
  users: StoredUserAccount[];
  sheetsConfig: SheetsRecapConfig | null;
  kasWithdrawals: KasWithdrawal[];
  drivers: CourierDriver[];
  paymentMethods: PaymentMethod[];
}

export function resolveWritableDataDir(): string {
  const preferred = path.resolve(process.cwd(), '.data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'cisarua-umkm-data');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'marketplace.json');
let memoryFallbackDb: MarketplaceDatabase | null = null;

export function sanitizeUser(user: StoredUserAccount): UserAccount {
  const { passwordHash: _ignored, ...safeUser } = user;
  return safeUser;
}

function getSeedUsers(): StoredUserAccount[] {
  return [
    {
      id: 'usr-admin-01',
      role: 'admin',
      name: 'Pengurus Admin Forum UMKM IKM',
      email: 'admin@ikmcisarua.id',
      phone: '0811-1675-0001',
      desa: 'Kel. Cisarua (Pusat Kecamatan)',
      address: 'Sekretariat Forum UMKM IKM, Jl. Raya Puncak KM 81, Cisarua',
      approvalStatus: 'approved',
      createdAt: '2026-10-01T08:00:00.000Z',
      approvedAt: '2026-10-01T08:00:00.000Z',
      passwordHash: hashPassword('AdminCisarua2026!'),
    },
    {
      id: 'usr-pelanggan-01',
      role: 'pelanggan',
      name: 'Bapak Agus Kurniawan',
      email: 'pelanggan@ikmcisarua.id',
      phone: '0812-9901-4432',
      desa: 'Desa Cilember',
      address: 'Jl. Curug Cilember RT 02/04 No. 18 (Dekat Gerbang Villa)',
      approvalStatus: 'approved',
      createdAt: '2026-11-05T09:00:00.000Z',
      approvedAt: '2026-11-05T10:15:00.000Z',
      passwordHash: hashPassword('Pelanggan2026!'),
    },
    {
      id: 'usr-pelanggan-02',
      role: 'pelanggan',
      name: 'Ibu Rina Kartikasari',
      email: 'rina.warga@gmail.com',
      phone: '0856-7712-9045',
      desa: 'Desa Kopo',
      address: 'Komplek Griya Alam Kopo Blok C3 No. 11, Cisarua',
      approvalStatus: 'pending',
      createdAt: '2026-11-12T07:30:00.000Z',
      passwordHash: hashPassword('Warga2026!'),
    },
    {
      id: 'usr-penjual-01',
      role: 'penjual',
      name: 'H. Rahmat Hidayat',
      email: 'penjual@ikmcisarua.id',
      phone: '0812-8810-4401',
      desa: 'Desa Tugu Utara',
      address: 'Kp. Gunung Mas RT 01/05, Desa Tugu Utara, Cisarua',
      storeName: 'Kopi Puncak Lestari',
      sellerId: 'umkm-kopi-tugu',
      approvalStatus: 'approved',
      createdAt: '2026-10-05T08:00:00.000Z',
      approvedAt: '2026-10-05T09:00:00.000Z',
      passwordHash: hashPassword('Penjual2026!'),
    },
  ];
}

const SEED_SELLERS: SellerStore[] = [
  {
    id: 'umkm-kopi-tugu',
    name: 'Kopi Puncak Lestari',
    ownerName: 'H. Rahmat Hidayat',
    desa: 'Desa Tugu Utara',
    phone: '0812-8810-4401',
    joinedYear: 2021,
  },
  {
    id: 'umkm-madu-cibeureum',
    name: 'Peternakan & Madu Cibeureum',
    ownerName: 'Ibu Neneng Suryani',
    desa: 'Desa Cibeureum',
    phone: '0856-9120-7742',
    joinedYear: 2020,
  },
  {
    id: 'umkm-bambu-batulayang',
    name: 'Galeri Bambu Batulayang',
    ownerName: 'Kang Tatang Kosasih',
    desa: 'Desa Batulayang',
    phone: '0813-2240-6615',
    joinedYear: 2019,
  },
  {
    id: 'umkm-agro-citeko',
    name: 'Kebun Organik Citeko',
    ownerName: 'Pak Usep Saepuloh',
    desa: 'Desa Citeko',
    phone: '0878-7701-5519',
    joinedYear: 2022,
  },
  {
    id: 'umkm-dapur-kopo',
    name: 'Dapur Olahan & Batik Kopo',
    ownerName: 'Teh Dewi Ratnasari',
    desa: 'Desa Kopo',
    phone: '0815-1189-3302',
    joinedYear: 2021,
  },
];

const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod-kopi-tugu-250',
    name: 'Kopi Arabika Gunung Cisarua Roasting Medium 250gr',
    category: 'Kopi & Teh',
    price: 68000,
    stock: 28,
    weightGrams: 250,
    sellerId: 'umkm-kopi-tugu',
    sellerName: 'Kopi Puncak Lestari',
    desa: 'Desa Tugu Utara',
    description:
      'Biji kopi Arabika single origin dari ketinggian 1.350 mdpl Tugu Utara, Cisarua. Profil rasa karamel, cokelat hitam, dan aroma floral teh pegunungan. Tersedia biji utuh maupun giling halus/sedang.',
    imageKey: 'kopi',
    rating: 4.9,
    soldCount: 142,
    isActive: true,
    createdAt: '2026-10-12T08:00:00.000Z',
  },
  {
    id: 'prod-madu-hutan-350',
    name: 'Madu Hutan Liar Gunung Gede-Cisarua Murni 340gr',
    category: 'Susu & Madu',
    price: 95000,
    stock: 16,
    weightGrams: 420,
    sellerId: 'umkm-madu-cibeureum',
    sellerName: 'Peternakan & Madu Cibeureum',
    desa: 'Desa Cibeureum',
    description:
      'Madu nektar bunga liar lereng Gunung Gede Pangrango area Cisarua. Dipanen secara higienis oleh kelompok tani hutan tanpa pemanasan dan tanpa campuran pemanis tambahan.',
    imageKey: 'madu-susu',
    rating: 4.9,
    soldCount: 98,
    isActive: true,
    createdAt: '2026-10-15T09:30:00.000Z',
  },
  {
    id: 'prod-susu-segar-1l',
    name: 'Susu Sapi Segar Pasteurisasi Peternakan Cibeureum 1 Liter',
    category: 'Susu & Madu',
    price: 26000,
    stock: 34,
    weightGrams: 1100,
    sellerId: 'umkm-madu-cibeureum',
    sellerName: 'Peternakan & Madu Cibeureum',
    desa: 'Desa Cibeureum',
    description:
      'Susu sapi perah segar hasil perahan pagi hari dari peternak lokal Cibeureum. Dipasteurisasi suhu rendah sehingga nutrisi alami dan rasa creamy terjaga. Khusus pengantaran Kurir Lokal Cisarua.',
    imageKey: 'madu-susu',
    rating: 4.8,
    soldCount: 215,
    isActive: true,
    createdAt: '2026-10-20T06:15:00.000Z',
  },
  {
    id: 'prod-keranjang-bambu',
    name: 'Set Keranjang & Nampan Anyaman Bambu Motif Sunda',
    category: 'Kerajinan & Batik',
    price: 125000,
    stock: 9,
    weightGrams: 750,
    sellerId: 'umkm-bambu-batulayang',
    sellerName: 'Galeri Bambu Batulayang',
    desa: 'Desa Batulayang',
    description:
      'Kerajinan tangan anyaman bambu tali dan rotan pilihan karya pengrajin senior Batulayang. Sudah melalui proses pengawetan alami anti-jamur, cocok untuk hampers atau dekorasi meja makan.',
    imageKey: 'anyaman-bambu',
    rating: 5.0,
    soldCount: 54,
    isActive: true,
    createdAt: '2026-10-22T10:00:00.000Z',
  },
  {
    id: 'prod-paket-sayur-stroberi',
    name: 'Paket Panen Segar: Stroberi Puncak & Sayur Organik 1.5kg',
    category: 'Sayur & Buah Segar',
    price: 58000,
    stock: 22,
    weightGrams: 1500,
    sellerId: 'umkm-agro-citeko',
    sellerName: 'Kebun Organik Citeko',
    desa: 'Desa Citeko',
    description:
      'Dipetik langsung pada pagi hari pengiriman: 500gr stroberi manis Puncak, selada keriting hidroponik, dan wortel muda organik dari kebun petani Desa Citeko.',
    imageKey: 'sayur-stroberi',
    rating: 4.9,
    soldCount: 176,
    isActive: true,
    createdAt: '2026-11-01T07:20:00.000Z',
  },
  {
    id: 'prod-ecoprint-batik',
    name: 'Syal & Kain Batik Ecoprint Daun Teh Cisarua (Katun Primisima)',
    category: 'Kerajinan & Batik',
    price: 165000,
    stock: 4,
    weightGrams: 320,
    sellerId: 'umkm-dapur-kopo',
    sellerName: 'Dapur Olahan & Batik Kopo',
    desa: 'Desa Kopo',
    description:
      'Pewarnaan alami teknik ecoprint menggunakan dedaunan lokal kebun teh Cisarua dan kulit kayu mahoni di atas kain katun primisima lembut. Motif eksklusif tidak ada yang kembar.',
    imageKey: 'batik-kripik',
    rating: 4.9,
    soldCount: 41,
    isActive: true,
    createdAt: '2026-11-03T11:00:00.000Z',
  },
  {
    id: 'prod-keripik-talas',
    name: 'Keripik Talas Bogor Renyah Bumbu Gurih Balado 200gr',
    category: 'Kuliner & Camilan',
    price: 22000,
    stock: 45,
    weightGrams: 220,
    sellerId: 'umkm-dapur-kopo',
    sellerName: 'Dapur Olahan & Batik Kopo',
    desa: 'Desa Kopo',
    description:
      'Irisan tipis talas pilihan petani lokal tanpa pengawet, digoreng menggunakan minyak nabati jernih dan ditiriskan dengan spinner agar renyah tahan lama.',
    imageKey: 'batik-kripik',
    rating: 4.8,
    soldCount: 310,
    isActive: true,
    createdAt: '2026-11-05T13:45:00.000Z',
  },
  {
    id: 'prod-teh-hijau-puncak',
    name: 'Teh Hijau Oolong Puncak Kemasan Kaleng 150gr',
    category: 'Kopi & Teh',
    price: 54000,
    stock: 3,
    weightGrams: 200,
    sellerId: 'umkm-kopi-tugu',
    sellerName: 'Kopi Puncak Lestari',
    desa: 'Desa Tugu Utara',
    description:
      'Pucuk daun teh pilihan perkebunan dataran tinggi Tugu Utara yang diolah semi-fermentasi menghasilkan seduhan harum lembut dan kaya antioksidan.',
    imageKey: 'kopi',
    rating: 4.9,
    soldCount: 87,
    isActive: true,
    createdAt: '2026-11-08T15:10:00.000Z',
  },
];

const SEED_ORDERS: Order[] = [
  {
    id: 'ORD-2026-0001',
    resi: 'CSR-EXP-0001',
    buyerName: 'Bapak Agus Kurniawan',
    buyerPhone: '0812-9901-4432',
    destinationDesaId: 'cilember',
    destinationDesaName: 'Desa Cilember',
    addressDetail: 'Jl. Curug Cilember RT 02/04 No. 18 (Dekat Gerbang Villa)',
    courierId: 'kurir-desa',
    courierName: 'Kurir Desa Cisarua Express',
    courierDriver: 'Pak Hendra Wijaya',
    courierPhone: '0878-7312-9084',
    paymentMethodId: 'qris',
    paymentMethodName: 'QRIS Forum UMKM IKM',
    paymentCode: 'QRIS-CISARUA-100137',
    isPaid: true,
    status: 'Dalam Pengiriman Kurir Lokal',
    items: [
      {
        productId: 'prod-kopi-tugu-250',
        productName: 'Kopi Arabika Gunung Cisarua Roasting Medium 250gr',
        sellerName: 'Kopi Puncak Lestari',
        desa: 'Desa Tugu Utara',
        unitPrice: 68000,
        weightGrams: 250,
        quantity: 2,
        imageKey: 'kopi',
      },
      {
        productId: 'prod-keripik-talas',
        productName: 'Keripik Talas Bogor Renyah Bumbu Gurih Balado 200gr',
        sellerName: 'Dapur Olahan & Batik Kopo',
        desa: 'Desa Kopo',
        unitPrice: 22000,
        weightGrams: 220,
        quantity: 2,
        imageKey: 'batik-kripik',
      },
    ],
    subtotal: 180000,
    totalWeightGrams: 940,
    shippingCost: 5000,
    shippingDiscount: 5000,
    serviceFee: 0,
    buyerAdminFee: 1000,
    sellerAdminFee: 9000,
    sellerNetAmount: 171000,
    grandTotal: 181000,
    createdAt: '2026-11-12T08:15:00.000Z',
    timeline: [
      {
        timestamp: '2026-11-12T08:15:00.000Z',
        status: 'Pesanan Dibuat',
        note: 'Pesanan masuk untuk pengiriman ke Desa Cilember.',
      },
      {
        timestamp: '2026-11-12T08:18:00.000Z',
        status: 'Pembayaran Terverifikasi',
        note: 'Pembayaran via QRIS Forum UMKM IKM berhasil diterima.',
      },
      {
        timestamp: '2026-11-12T09:10:00.000Z',
        status: 'Dalam Pengiriman Kurir Lokal',
        note: 'Paket dijemput oleh Pak Hendra Wijaya menuju Desa Cilember.',
      },
    ],
  },
  {
    id: 'ORD-2026-0002',
    resi: 'OJK-PK-0002',
    buyerName: 'Ibu Ratna Puspita',
    buyerPhone: '0857-8823-1091',
    destinationDesaId: 'kopo',
    destinationDesaName: 'Desa Kopo',
    addressDetail: 'Komplek Griya Cisarua Blok B2 No. 7, Desa Kopo',
    courierId: 'ojek-umkm',
    courierName: 'Ojek Kilat Puncak UMKM',
    paymentMethodId: 'cod',
    paymentMethodName: 'COD (Bayar di Tempat via Kurir Lokal)',
    paymentCode: 'COD-CSR-100274',
    isPaid: false,
    status: 'Menunggu Penjemputan Kurir',
    items: [
      {
        productId: 'prod-paket-sayur-stroberi',
        productName: 'Paket Panen Segar: Stroberi Puncak & Sayur Organik 1.5kg',
        sellerName: 'Kebun Organik Citeko',
        desa: 'Desa Citeko',
        unitPrice: 58000,
        weightGrams: 1500,
        quantity: 1,
        imageKey: 'sayur-stroberi',
      },
    ],
    subtotal: 58000,
    totalWeightGrams: 1500,
    shippingCost: 13000,
    shippingDiscount: 0,
    serviceFee: 2000,
    buyerAdminFee: 1000,
    sellerAdminFee: 2900,
    sellerNetAmount: 55100,
    grandTotal: 74000,
    createdAt: '2026-11-12T10:30:00.000Z',
    timeline: [
      {
        timestamp: '2026-11-12T10:30:00.000Z',
        status: 'Pesanan Dibuat',
        note: 'Metode COD dipilih. Menunggu penjemputan kurir ojek UMKM di Desa Citeko.',
      },
    ],
  },
];

function getInitialData(): MarketplaceDatabase {
  return {
    sellers: SEED_SELLERS,
    products: SEED_PRODUCTS,
    orders: SEED_ORDERS,
    orderSequence: 2,
    users: getSeedUsers(),
    sheetsConfig: null,
    kasWithdrawals: [],
    drivers: LOCAL_COURIER_DRIVERS,
    paymentMethods: PAYMENT_METHODS,
  };
}

export function loadDatabase(): MarketplaceDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MarketplaceDatabase>;
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.orders)) {
      const initial = getInitialData();
      saveDatabase(initial);
      return initial;
    }
    let needsSave = false;
    const migratedOrders = parsed.orders.map((order) => {
      if (
        typeof order.buyerAdminFee === 'number' &&
        typeof order.sellerAdminFee === 'number' &&
        typeof order.sellerNetAmount === 'number'
      ) {
        return order;
      }
      needsSave = true;
      const buyerAdminFee =
        typeof order.buyerAdminFee === 'number' ? order.buyerAdminFee : BUYER_ADMIN_FEE;
      const payout = calculateSellerPayout(order.subtotal);
      const hasAddedBuyerFee = typeof order.buyerAdminFee === 'number';
      return {
        ...order,
        buyerAdminFee,
        sellerAdminFee: payout.adminFee,
        sellerNetAmount: payout.netAmount,
        grandTotal: hasAddedBuyerFee ? order.grandTotal : order.grandTotal + buyerAdminFee,
      };
    });

    const db: MarketplaceDatabase = {
      sellers: Array.isArray(parsed.sellers) ? parsed.sellers : SEED_SELLERS,
      products: parsed.products,
      orders: migratedOrders,
      orderSequence: typeof parsed.orderSequence === 'number' ? parsed.orderSequence : migratedOrders.length,
      users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : getSeedUsers(),
      sheetsConfig: parsed.sheetsConfig ?? null,
      kasWithdrawals: Array.isArray(parsed.kasWithdrawals) ? parsed.kasWithdrawals : [],
      drivers:
        Array.isArray(parsed.drivers) && parsed.drivers.length > 0
          ? parsed.drivers
          : LOCAL_COURIER_DRIVERS,
      paymentMethods:
        Array.isArray(parsed.paymentMethods) && parsed.paymentMethods.length > 0
          ? parsed.paymentMethods.map((pm) => ({
              ...pm,
              isActive: typeof pm.isActive === 'boolean' ? pm.isActive : true,
            }))
          : PAYMENT_METHODS,
    };
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      needsSave = true;
    }
    if (
      parsed.sheetsConfig === undefined ||
      !Array.isArray(parsed.kasWithdrawals) ||
      !Array.isArray(parsed.drivers) ||
      parsed.drivers.length === 0 ||
      !Array.isArray(parsed.paymentMethods) ||
      parsed.paymentMethods.length === 0
    ) {
      needsSave = true;
    }
    if (needsSave) {
      saveDatabase(db);
    }
    memoryFallbackDb = db;
    return db;
  } catch {
    if (memoryFallbackDb) return memoryFallbackDb;
    const initial = getInitialData();
    memoryFallbackDb = initial;
    return initial;
  }
}

export function saveDatabase(db: MarketplaceDatabase): void {
  memoryFallbackDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // Keep memoryFallbackDb if disk write is restricted in read-only environment
  }
}
