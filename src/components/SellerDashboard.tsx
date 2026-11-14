import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Edit3,
  ImagePlus,
  LayoutDashboard,
  Minus,
  Package,
  Plus,
  Search,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IMAGE_ASSET_OPTIONS } from '../lib/imageAssets';
import {
  CISARUA_DESA_LIST,
  LOCAL_COURIER_DRIVERS,
  PRODUCT_CATEGORIES,
  calculateSellerPayout,
  formatRupiah,
  formatWeight,
  getNextOrderStatus,
  validateProductImageFile,
  validateProductInput,
  type CourierDriver,
  type Order,
  type OrderStatus,
  type Product,
  type ProductCategory,
  type SellerStore,
  type UserAccount,
} from '../lib/marketplace';
import { ProductImage } from './ProductImage';

interface SellerDashboardProps {
  products: Product[];
  orders: Order[];
  sellers: SellerStore[];
  drivers?: CourierDriver[];
  currentUser?: UserAccount | null;
  onCreateProduct: (payload: Omit<Product, 'id' | 'rating' | 'soldCount' | 'createdAt' | 'sellerId'> & { sellerId?: string }) => Promise<void>;
  onUpdateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus, driverName?: string, driverPhone?: string) => Promise<void>;
  onConfirmOrderPayment: (orderId: string) => Promise<Order>;
}

type SellerSection = 'overview' | 'inventory' | 'orders';
type StockFilter = 'all' | 'low' | 'out' | 'inactive';

interface ProductFormState {
  name: string;
  category: ProductCategory;
  price: string;
  stock: string;
  weightGrams: string;
  sellerName: string;
  desa: string;
  description: string;
  imageKey: string;
  isActive: boolean;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  category: 'Kopi & Teh',
  price: '',
  stock: '10',
  weightGrams: '250',
  sellerName: 'Kopi Puncak Lestari',
  desa: 'Desa Tugu Utara',
  description: '',
  imageKey: 'kopi',
  isActive: true,
};

export function SellerDashboard({
  products,
  orders,
  sellers,
  drivers,
  currentUser,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdvanceOrderStatus,
  onConfirmOrderPayment,
}: SellerDashboardProps) {
  const driverList = useMemo(() => {
    const base = drivers && drivers.length > 0 ? drivers : LOCAL_COURIER_DRIVERS;
    const active = base.filter((d) => d.isActive);
    return active.length > 0 ? active : base;
  }, [drivers]);
  const lockedSellerName =
    currentUser?.role === 'penjual' && currentUser.storeName
      ? currentUser.storeName
      : null;

  const [section, setSection] = useState<SellerSection>('inventory');
  const [selectedSellerName, setSelectedSellerName] = useState<string>(
    lockedSellerName ?? 'Semua UMKM Forum'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lockedSellerName) {
      setSelectedSellerName(lockedSellerName);
    }
  }, [lockedSellerName]);

  const sellerProducts = useMemo(() => {
    if (selectedSellerName === 'Semua UMKM Forum') return products;
    return products.filter((p) => p.sellerName === selectedSellerName);
  }, [products, selectedSellerName]);

  const sellerOrders = useMemo(() => {
    if (selectedSellerName === 'Semua UMKM Forum') return orders;
    return orders.filter((o) => o.items.some((i) => i.sellerName === selectedSellerName));
  }, [orders, selectedSellerName]);

  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sellerProducts.filter((p) => {
      if (stockFilter === 'low' && (p.stock > 5 || p.stock === 0)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (stockFilter === 'inactive' && p.isActive) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !p.sellerName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [sellerProducts, searchQuery, stockFilter]);

  const kpis = useMemo(() => {
    const activeCount = sellerProducts.filter((p) => p.isActive).length;
    const lowStockCount = sellerProducts.filter((p) => p.stock <= 5).length;
    const pendingShipCount = sellerOrders.filter(
      (o) => o.status === 'Menunggu Penjemputan Kurir' || o.status === 'Menunggu Pembayaran'
    ).length;
    const grossRevenue = sellerOrders.reduce((sum, o) => {
      const storeItemsTotal =
        selectedSellerName === 'Semua UMKM Forum'
          ? o.subtotal
          : o.items
              .filter((i) => i.sellerName === selectedSellerName)
              .reduce((itemSum, i) => itemSum + i.unitPrice * i.quantity, 0);
      return sum + storeItemsTotal;
    }, 0);
    const payout = calculateSellerPayout(grossRevenue);
    return {
      activeCount,
      lowStockCount,
      pendingShipCount,
      grossRevenue: payout.grossAmount,
      sellerFeeTotal: payout.adminFee,
      netRevenue: payout.netAmount,
    };
  }, [sellerProducts, sellerOrders, selectedSellerName]);

  const openCreateModal = () => {
    const defaultSeller =
      lockedSellerName
        ? {
            name: lockedSellerName,
            desa: currentUser?.desa ?? 'Desa Tugu Utara',
          }
        : selectedSellerName !== 'Semua UMKM Forum'
        ? sellers.find((s) => s.name === selectedSellerName)
        : sellers[0];

    setEditingProduct(null);
    setFormState({
      ...EMPTY_FORM,
      sellerName: defaultSeller?.name ?? 'UMKM Mandiri Cisarua',
      desa: defaultSeller?.desa ?? 'Desa Tugu Utara',
    });
    setFormErrors({});
    setImageUploadError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormState({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      weightGrams: String(product.weightGrams),
      sellerName: product.sellerName,
      desa: product.desa,
      description: product.description,
      imageKey: product.imageKey,
      isActive: product.isActive,
    });
    setFormErrors({});
    setImageUploadError('');
    setIsModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageUploadError('');
    const validation = validateProductImageFile(file.type, file.size);
    if (!validation.valid) {
      setImageUploadError(validation.error || 'Format foto harus JPG atau PNG.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/uploads/product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageUploadError(data.message || 'Gagal mengunggah foto produk.');
        return;
      }

      setFormState((s) => ({ ...s, imageKey: data.imageUrl as string }));
    } catch (err) {
      setImageUploadError(
        err instanceof Error ? err.message : 'Gagal mengunggah foto produk.'
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProductInput(formState);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});
    setIsSaving(true);
    try {
      const payload = {
        name: formState.name.trim(),
        category: formState.category,
        price: Math.round(Number(formState.price)),
        stock: Math.round(Number(formState.stock)),
        weightGrams: Math.round(Number(formState.weightGrams)),
        sellerName: formState.sellerName.trim(),
        desa: formState.desa.trim(),
        description: formState.description.trim(),
        imageKey: formState.imageKey,
        isActive: formState.isActive,
      };
      if (editingProduct) {
        await onUpdateProduct(editingProduct.id, payload);
      } else {
        await onCreateProduct(payload);
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Navigation (240px–260px) */}
        <aside
          aria-label="Menu Dasbor Penjual"
          className="w-full lg:w-64 shrink-0 bg-white rounded-xl border border-slate-200 p-4 space-y-5"
        >
          <div>
            <label htmlFor="seller-switcher" className="block text-xs font-semibold text-slate-500 mb-1.5">
              Akun Toko UMKM IKM
            </label>
            {lockedSellerName ? (
              <div className="px-3 py-2 text-sm font-semibold bg-[#F7F8FA] border border-slate-200 rounded-lg text-slate-900">
                <p className="truncate">{lockedSellerName}</p>
                <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                  {currentUser?.desa}
                </p>
              </div>
            ) : (
              <select
                id="seller-switcher"
                value={selectedSellerName}
                onChange={(e) => setSelectedSellerName(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-none focus:border-[#00AA5B]"
              >
                <option value="Semua UMKM Forum">Semua UMKM Forum</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSection('overview')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${
                section === 'overview'
                  ? 'bg-emerald-50 text-[#00AA5B] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Ringkasan Toko</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('inventory')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${
                section === 'inventory'
                  ? 'bg-emerald-50 text-[#00AA5B] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Inventaris Produk</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('orders')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer ${
                section === 'orders'
                  ? 'bg-emerald-50 text-[#00AA5B] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Pesanan & Kurir ({sellerOrders.length})</span>
            </button>
          </nav>
        </aside>

        {/* Main Workspace Viewport */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* Top Header Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">
                Dasbor Penjual · {selectedSellerName}
              </p>
              <h1 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                {section === 'overview'
                  ? 'Ringkasan Performa Toko UMKM'
                  : section === 'inventory'
                  ? 'Manajemen Inventaris Produk Mandiri'
                  : 'Pengelolaan Pesanan & Kurir Lokal'}
              </h1>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Baru</span>
            </button>
          </div>

          {/* 4-Column KPI Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Produk Aktif</p>
              <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {kpis.activeCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                Dari {sellerProducts.length} total SKU
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Stok Menipis (≤ 5)</p>
              <p className="font-display text-2xl font-bold text-amber-600 mt-1 tabular-nums">
                {kpis.lowStockCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Perlu restock segera</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Perlu Dikirim</p>
              <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {kpis.pendingShipCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Menunggu kurir lokal</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Pendapatan Bersih (95%)</p>
              <p className="font-display text-2xl font-bold text-[#00AA5B] mt-1 tabular-nums">
                {formatRupiah(kpis.netRevenue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                Bruto {formatRupiah(kpis.grossRevenue)} · Potongan fee admin 5% (-{formatRupiah(kpis.sellerFeeTotal)})
              </p>
            </div>
          </div>

          {/* Overview Quick Alerts */}
          {section === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Produk Stok Menipis
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setStockFilter('low');
                      setSection('inventory');
                    }}
                    className="text-xs font-semibold text-[#00AA5B] hover:underline cursor-pointer"
                  >
                    Kelola Semua
                  </button>
                </div>
                {sellerProducts.filter((p) => p.stock <= 5).length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">
                    Seluruh stok produk berada pada level aman.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sellerProducts
                      .filter((p) => p.stock <= 5)
                      .map((p) => (
                        <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.sellerName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-amber-700 tabular-nums">
                              Sisa {p.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateProduct(p.id, { stock: p.stock + 10 })}
                              className="px-2.5 py-1 rounded border border-slate-300 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                            >
                              +10 Stok
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Antrean Pengiriman Kurir Lokal
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSection('orders')}
                    className="text-xs font-semibold text-[#00AA5B] hover:underline cursor-pointer"
                  >
                    Proses Pesanan
                  </button>
                </div>
                {sellerOrders.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">Belum ada pesanan masuk.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sellerOrders.slice(0, 4).map((o) => (
                      <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {o.buyerName} · <span className="font-mono text-xs">{o.resi}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {o.destinationDesaName} · {o.courierName}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-800 shrink-0">
                          {o.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Inventory Management Section */}
          {section === 'inventory' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <label htmlFor="inventory-search" className="sr-only">
                    Cari produk di inventaris
                  </label>
                  <input
                    id="inventory-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama produk atau kategori..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'low', label: 'Stok Menipis' },
                      { id: 'out', label: 'Habis' },
                      { id: 'inactive', label: 'Nonaktif' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStockFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        stockFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredInventory.length === 0 ? (
                <div className="p-12 text-center">
                  <Box className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Tidak ada produk pada filter ini
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Tambahkan produk baru atau ubah filter pencarian inventaris Anda.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 px-4 py-2 rounded-lg bg-[#00AA5B] text-white text-xs font-semibold hover:bg-[#00944F] cursor-pointer"
                  >
                    + Tambah Produk Pertama
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#F7F8FA] text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Produk</th>
                        <th className="py-3 px-4">Toko & Desa</th>
                        <th className="py-3 px-4 text-right">Harga</th>
                        <th className="py-3 px-4 text-center">Stok</th>
                        <th className="py-3 px-4 text-center">Status Etalase</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredInventory.map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <div className="w-12 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                <ProductImage
                                  imageKey={product.imageKey}
                                  alt={product.name}
                                  className="w-full h-full"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 line-clamp-1">
                                  {product.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {product.category} · {formatWeight(product.weightGrams)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            <div className="font-medium text-slate-800">{product.sellerName}</div>
                            <div>{product.desa}</div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-semibold text-slate-900 tabular-nums">
                              {formatRupiah(product.price)}
                            </div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              Bersih {formatRupiah(calculateSellerPayout(product.price).netAmount)} (-5%)
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={product.stock <= 0}
                                onClick={() =>
                                  onUpdateProduct(product.id, {
                                    stock: Math.max(0, product.stock - 1),
                                  })
                                }
                                aria-label={`Kurangi stok ${product.name}`}
                                className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                className={`w-10 text-center font-mono text-xs font-semibold tabular-nums ${
                                  product.stock === 0
                                    ? 'text-red-600'
                                    : product.stock <= 5
                                    ? 'text-amber-700'
                                    : 'text-slate-900'
                                }`}
                              >
                                {product.stock}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateProduct(product.id, { stock: product.stock + 1 })
                                }
                                aria-label={`Tambah stok ${product.name}`}
                                className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProduct(product.id, { isActive: !product.isActive })
                              }
                              aria-label={`Ubah status aktif ${product.name}`}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer ${
                                product.isActive
                                  ? 'border-emerald-200 bg-emerald-50 text-[#00AA5B]'
                                  : 'border-slate-200 bg-slate-100 text-slate-500'
                              }`}
                            >
                              {product.isActive ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(product)}
                                aria-label={`Edit ${product.name}`}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProduct(product.id)}
                                aria-label={`Hapus ${product.name}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Orders & Local Courier Fulfillment Section */}
          {section === 'orders' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {sellerOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Belum ada pesanan untuk toko ini
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Pesanan pembeli akan muncul di sini untuk diproses ke kurir lokal.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {sellerOrders.map((order) => {
                    const nextStatus = getNextOrderStatus(order.status);
                    const chosenDriverName =
                      selectedDrivers[order.id] ??
                      order.courierDriver ??
                      driverList[0]?.name ??
                      LOCAL_COURIER_DRIVERS[0].name;
                    const driverObj = driverList.find(
                      (d) => d.name === chosenDriverName
                    );
                    const sellerRelevantItems =
                      selectedSellerName === 'Semua UMKM Forum'
                        ? order.items
                        : order.items.filter((i) => i.sellerName === selectedSellerName);
                    const sellerOrderGross = sellerRelevantItems.reduce(
                      (sum, i) => sum + i.unitPrice * i.quantity,
                      0
                    );
                    const sellerOrderPayout = calculateSellerPayout(sellerOrderGross);

                    return (
                      <div key={order.id} className="p-5 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-900">
                                {order.id}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{order.resi}</span>
                              <span aria-hidden="true">·</span>
                              <span>{order.paymentMethodName}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-semibold ${
                                  order.isPaid ? 'text-[#00AA5B]' : 'text-amber-700'
                                }`}
                              >
                                {order.isPaid
                                  ? 'Lunas'
                                  : order.paymentMethodId === 'cod'
                                  ? 'Bayar COD saat tiba'
                                  : 'Belum Dibayar'}
                              </span>
                            </div>
                            <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                              {order.buyerName} ({order.buyerPhone}) — {order.destinationDesaName}
                            </h3>
                            <p className="text-xs text-slate-600 mt-0.5">{order.addressDetail}</p>
                          </div>

                          <div className="text-left md:text-right shrink-0">
                            <p className="text-xs text-slate-500">{order.courierName}</p>
                            <p className="font-display text-lg font-bold text-[#00AA5B] tabular-nums">
                              {formatRupiah(sellerOrderPayout.netAmount)}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              Bersih penjual · Tagihan pembeli {formatRupiah(order.grandTotal)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-[#F7F8FA] rounded-lg border border-slate-200 p-3 text-xs space-y-1.5">
                          {order.items.map((item) => (
                            <div key={item.productId} className="flex justify-between gap-2">
                              <span className="text-slate-800">
                                {item.quantity}× {item.productName} ({item.sellerName})
                              </span>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {formatRupiah(item.unitPrice * item.quantity)}
                              </span>
                            </div>
                          ))}
                          <div className="pt-2 mt-2 border-t border-slate-200 space-y-1">
                            <div className="flex justify-between gap-2 text-slate-600">
                              <span>Subtotal Penjualan Produk</span>
                              <span className="font-medium text-slate-900 tabular-nums">
                                {formatRupiah(sellerOrderPayout.grossAmount)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2 text-amber-700">
                              <span>Potongan Fee Admin Forum (5%)</span>
                              <span className="font-semibold tabular-nums">
                                -{formatRupiah(sellerOrderPayout.adminFee)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2 font-semibold text-[#00AA5B]">
                              <span>Pendapatan Bersih Penjual (95%)</span>
                              <span className="tabular-nums">
                                {formatRupiah(sellerOrderPayout.netAmount)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2 text-xs">
                            {order.status === 'Selesai' ? (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-[#00AA5B]">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Status: Selesai</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>Status: {order.status}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {!order.isPaid && order.paymentMethodId !== 'cod' && (
                              <button
                                type="button"
                                onClick={() => onConfirmOrderPayment(order.id)}
                                className="px-3 py-1.5 rounded-lg border border-[#00AA5B] text-[#00AA5B] hover:bg-emerald-50 text-xs font-semibold cursor-pointer"
                              >
                                Verifikasi Pembayaran
                              </button>
                            )}

                            {order.status === 'Menunggu Penjemputan Kurir' && (
                              <div className="flex items-center gap-2">
                                <label htmlFor={`driver-${order.id}`} className="sr-only">
                                  Pilih petugas kurir lokal
                                </label>
                                <select
                                  id={`driver-${order.id}`}
                                  value={chosenDriverName}
                                  onChange={(e) =>
                                    setSelectedDrivers((prev) => ({
                                      ...prev,
                                      [order.id]: e.target.value,
                                    }))
                                  }
                                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                >
                                  {driverList.map((d) => (
                                    <option key={d.id} value={d.name}>
                                      {d.name} ({d.zone} · {d.area})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {nextStatus && order.status !== 'Menunggu Pembayaran' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAdvanceOrderStatus(
                                    order.id,
                                    nextStatus,
                                    driverObj?.name,
                                    driverObj?.phone
                                  )
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold cursor-pointer"
                              >
                                {nextStatus === 'Dalam Pengiriman Kurir Lokal'
                                  ? 'Kirim via Kurir Lokal'
                                  : 'Tandai Pesanan Selesai'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-form-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#00AA5B]" />
                <h2 id="product-form-title" className="font-display text-lg font-bold text-slate-900">
                  {editingProduct ? 'Edit Produk Inventaris' : 'Tambah Produk Baru ke Etalase'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup form produk"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label htmlFor="prod-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Produk
                </label>
                <input
                  id="prod-name"
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Contoh: Kopi Wine Arabika Tugu Selatan 250gr"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label htmlFor="prod-category" className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    id="prod-category"
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, category: e.target.value as ProductCategory }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="prod-image" className="block text-xs font-medium text-slate-700 mb-1">
                    Galeri Foto Bawaan Cisarua
                  </label>
                  <select
                    id="prod-image"
                    value={
                      IMAGE_ASSET_OPTIONS.some((opt) => opt.key === formState.imageKey)
                        ? formState.imageKey
                        : '__custom__'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '__custom__') {
                        setImageUploadError('');
                        setFormState((s) => ({ ...s, imageKey: val }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                  >
                    {!IMAGE_ASSET_OPTIONS.some((opt) => opt.key === formState.imageKey) && (
                      <option value="__custom__">Foto Kustom Unggahan (JPG/PNG)</option>
                    )}
                    {IMAGE_ASSET_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload / Preview Foto Produk (JPG / PNG) */}
              <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-28 h-20 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                  <ProductImage
                    imageKey={formState.imageKey}
                    alt={formState.name || 'Pratinjau foto produk'}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      Foto Produk Sendiri (Format JPG / PNG)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Unggah foto asli produk Anda (.jpg, .jpeg, atau .png, maks. 5 MB) atau pilih dari Galeri Cisarua di atas.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      id="prod-image-upload"
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      onChange={handleImageFileChange}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-[#00AA5B] hover:text-[#00AA5B] text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>
                        {isUploadingImage
                          ? 'Mengunggah Foto...'
                          : formState.imageKey.startsWith('/uploads/')
                          ? 'Ganti Foto (JPG / PNG)'
                          : 'Unggah Foto (JPG / PNG)'}
                      </span>
                    </button>

                    {!IMAGE_ASSET_OPTIONS.some((opt) => opt.key === formState.imageKey) && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageUploadError('');
                          setFormState((s) => ({ ...s, imageKey: 'kopi' }));
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 cursor-pointer"
                      >
                        Pakai Galeri Bawaan
                      </button>
                    )}
                  </div>
                  {imageUploadError && (
                    <p role="alert" className="text-xs text-red-600">
                      {imageUploadError}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="prod-price" className="block text-xs font-medium text-slate-700 mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    id="prod-price"
                    type="number"
                    min={1000}
                    step={500}
                    value={formState.price}
                    onChange={(e) => setFormState((s) => ({ ...s, price: e.target.value }))}
                    placeholder="45000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
                  />
                  {formErrors.price && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.price}</p>
                  )}
                  {Number(formState.price) >= 1000 && (
                    <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                      Fee admin 5%: -{formatRupiah(calculateSellerPayout(Number(formState.price)).adminFee)} · Bersih: {formatRupiah(calculateSellerPayout(Number(formState.price)).netAmount)}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="prod-stock" className="block text-xs font-medium text-slate-700 mb-1">
                    Stok Awal (Unit)
                  </label>
                  <input
                    id="prod-stock"
                    type="number"
                    min={0}
                    value={formState.stock}
                    onChange={(e) => setFormState((s) => ({ ...s, stock: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
                  />
                  {formErrors.stock && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.stock}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="prod-weight" className="block text-xs font-medium text-slate-700 mb-1">
                    Berat Paket (gram)
                  </label>
                  <input
                    id="prod-weight"
                    type="number"
                    min={10}
                    value={formState.weightGrams}
                    onChange={(e) => setFormState((s) => ({ ...s, weightGrams: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
                  />
                  {formErrors.weightGrams && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.weightGrams}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-seller" className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Toko / Pelaku UMKM
                  </label>
                  <input
                    id="prod-seller"
                    type="text"
                    value={formState.sellerName}
                    onChange={(e) => setFormState((s) => ({ ...s, sellerName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  {formErrors.sellerName && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.sellerName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="prod-desa" className="block text-xs font-medium text-slate-700 mb-1">
                    Desa / Kelurahan Asal
                  </label>
                  <select
                    id="prod-desa"
                    value={formState.desa}
                    onChange={(e) => setFormState((s) => ({ ...s, desa: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                  >
                    {CISARUA_DESA_LIST.filter((d) => d.zone !== 'luar').map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="prod-desc" className="block text-xs font-medium text-slate-700 mb-1">
                  Deskripsi & Spesifikasi Produk
                </label>
                <textarea
                  id="prod-desc"
                  rows={3}
                  value={formState.description}
                  onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Jelaskan komposisi, asal bahan baku Cisarua, dan keunggulan produk..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {formErrors.description && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSaving
                    ? 'Menyimpan...'
                    : editingProduct
                    ? 'Simpan Perubahan'
                    : 'Publikasikan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
