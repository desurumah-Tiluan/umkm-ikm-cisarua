import { ArrowRight, MapPin, Plus, Search, ShieldCheck, Store, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HERO_BANNER_IMAGE } from '../lib/imageAssets';
import {
  PRODUCT_CATEGORIES,
  formatRupiah,
  type Product,
  type ProductCategory,
} from '../lib/marketplace';
import { ProductImage } from './ProductImage';

interface StorefrontViewProps {
  products: Product[];
  isLoading: boolean;
  onSelectProduct: (product: Product) => void;
  onQuickAddToCart: (product: Product) => void;
  onOpenSellerDashboard?: () => void;
  onOpenCourierDirectory?: () => void;
  onOpenTrackOrder?: () => void;
}

type SortOption = 'terlaris' | 'termurah' | 'termahal' | 'terbaru';

export function StorefrontView({
  products,
  isLoading,
  onSelectProduct,
  onQuickAddToCart,
  onOpenSellerDashboard,
  onOpenCourierDirectory,
  onOpenTrackOrder,
}: StorefrontViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | ProductCategory>('Semua');
  const [selectedDesa, setSelectedDesa] = useState<string>('Semua Desa');
  const [sortBy, setSortBy] = useState<SortOption>('terlaris');

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const desaOptions = useMemo(() => {
    const unique = Array.from(new Set(activeProducts.map((p) => p.desa))).sort();
    return ['Semua Desa', ...unique];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = activeProducts.filter((product) => {
      if (selectedCategory !== 'Semua' && product.category !== selectedCategory) return false;
      if (selectedDesa !== 'Semua Desa' && product.desa !== selectedDesa) return false;
      if (
        q &&
        !product.name.toLowerCase().includes(q) &&
        !product.sellerName.toLowerCase().includes(q) &&
        !product.desa.toLowerCase().includes(q) &&
        !product.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    switch (sortBy) {
      case 'termurah':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'termahal':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'terbaru':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'terlaris':
      default:
        sorted.sort((a, b) => b.soldCount - a.soldCount);
        break;
    }
    return sorted;
  }, [activeProducts, searchQuery, selectedCategory, selectedDesa, sortBy]);

  return (
    <div className="space-y-10 pb-16">
      {/* Section 1: Hero Showcase (2-Column Balanced Split + 4-Column Trust Strip) */}
      <section aria-labelledby="hero-heading" className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold text-[#00AA5B]">
                Pasar Digital Resmi Kecamatan Cisarua · Kabupaten Bogor
              </p>
              <h1
                id="hero-heading"
                className="mt-3 font-display text-3xl sm:text-4xl lg:text-[42px] font-bold text-slate-900 leading-[1.15] text-balance"
              >
                Produk Unggulan Asli Pelaku UMKM IKM Kecamatan Cisarua
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                Belanja langsung kopi dataran tinggi, madu hutan, susu segar, kerajinan bambu, dan
                hasil tani dari 10 desa di Kecamatan Cisarua dengan pengiriman kurir lokal hari yang
                sama.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href="#katalog-produk"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Belanja Produk Lokal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                {onOpenSellerDashboard ? (
                  <button
                    type="button"
                    onClick={onOpenSellerDashboard}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Store className="w-4 h-4 text-[#00AA5B]" />
                    <span>Kelola Toko & Inventaris</span>
                  </button>
                ) : onOpenTrackOrder ? (
                  <button
                    type="button"
                    onClick={onOpenTrackOrder}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Truck className="w-4 h-4 text-[#00AA5B]" />
                    <span>Lacak Pesanan Saya</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[240px] lg:min-h-[340px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={HERO_BANNER_IMAGE}
                  alt="Koleksi produk UMKM Kecamatan Cisarua berlatar kebun teh Puncak"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Trust Strip below Hero Split */}
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-display text-lg font-bold text-slate-900 tabular-nums">
                {activeProducts.length} Produk Aktif
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Langsung dari pengrajin & petani Cisarua
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-slate-900">10 Desa & Kelurahan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Terhubung armada Kurir Desa Cisarua Express
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-slate-900">QRIS, VA & COD</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Pembayaran instan atau bayar di tempat
              </p>
            </div>
            <div>
              <p className="font-display text-lg font-bold text-slate-900 tabular-nums">
                Gratis Ongkir Zona Inti
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Minimal belanja Rp 150.000 via Kurir Desa
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Search, Category Filters & Product Catalog Grid */}
      <section
        id="katalog-produk"
        aria-labelledby="catalog-heading"
        className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 id="catalog-heading" className="font-display text-2xl font-bold text-slate-900">
              Katalog Produk Forum UMKM IKM
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Temukan produk terverifikasi dari desa-desa di Kecamatan Cisarua
            </p>
          </div>

          {/* Search & Location Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="storefront-search" className="sr-only">
                Cari produk atau nama toko UMKM
              </label>
              <input
                id="storefront-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kopi, madu, bambu, nama toko..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B] focus:ring-1 focus:ring-[#00AA5B]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="desa-filter" className="sr-only">
                Filter berdasarkan desa asal
              </label>
              <select
                id="desa-filter"
                value={selectedDesa}
                onChange={(e) => setSelectedDesa(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
              >
                {desaOptions.map((desa) => (
                  <option key={desa} value={desa}>
                    {desa}
                  </option>
                ))}
              </select>

              <label htmlFor="sort-filter" className="sr-only">
                Urutkan produk
              </label>
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
              >
                <option value="terlaris">Terlaris</option>
                <option value="terbaru">Terbaru</option>
                <option value="termurah">Harga Terendah</option>
                <option value="termahal">Harga Tertinggi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs (Functional Segmented Buttons) */}
        <div
          role="tablist"
          aria-label="Filter kategori produk"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {(['Semua', ...PRODUCT_CATEGORIES] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#00AA5B] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {cat === 'Semua' ? 'Semua Produk' : cat}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 w-2/3 bg-slate-200 rounded" />
                  <div className="h-4 w-full bg-slate-200 rounded" />
                  <div className="h-5 w-1/2 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Produk tidak ditemukan
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Tidak ada produk yang cocok dengan kata kunci atau filter desa yang dipilih.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Semua');
                setSelectedDesa('Semua Desa');
              }}
              className="mt-4 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div
            data-testid="product-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  aria-label={`Lihat detail ${product.name}`}
                  className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#00AA5B]"
                >
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <ProductImage
                      imageKey={product.imageKey}
                      alt={product.name}
                      className="w-full h-full group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  </div>
                  <div className="p-4 pb-2">
                    <p className="text-[11px] font-medium text-slate-500 truncate">
                      {product.category}
                      <span aria-hidden="true"> · </span>
                      {product.desa}
                    </p>
                    <h3 className="mt-1 font-display text-sm font-semibold text-slate-900 line-clamp-2 min-h-[2.5rem] leading-snug">
                      {product.name}
                    </h3>
                    <div className="mt-2 font-display text-base font-bold text-slate-900 tabular-nums">
                      {formatRupiah(product.price)}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5 truncate">
                      <span className="truncate font-medium text-slate-700">{product.sellerName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums shrink-0">Terjual {product.soldCount}</span>
                    </p>
                  </div>
                </button>

                <div className="px-4 pb-4 pt-2 mt-auto flex items-center justify-between gap-2 border-t border-slate-100">
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      product.stock === 0
                        ? 'text-red-600'
                        : product.stock <= 5
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {product.stock === 0 ? 'Stok Habis' : `Stok ${product.stock}`}
                  </span>
                  <button
                    type="button"
                    disabled={product.stock === 0}
                    onClick={() => onQuickAddToCart(product)}
                    aria-label={`Tambah ${product.name} ke keranjang`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-[#00AA5B] text-[#00AA5B] hover:text-white text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Keranjang</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Local Courier & Payment Ecosystem Callout */}
      <section className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-semibold text-[#00AA5B]">
              Logistik & Pembayaran Terintegrasi
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Dikirim Kurir Desa Cisarua, Dibayar Mudah dari Mana Saja
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              Setiap pesanan langsung menjemput barang di rumah produksi UMKM (Desa Tugu Utara,
              Cibeureum, Batulayang, Citeko, hingga Kopo) menggunakan armada Kurir Desa Cisarua
              Express dan mitra Ojek Puncak, dengan pelacakan resi real-time.
            </p>
            {onOpenCourierDirectory && (
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onOpenCourierDirectory}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Cek Tarif Kurir Lokal Cisarua</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[#F7F8FA] border border-slate-200">
              <MapPin className="w-5 h-5 text-[#00AA5B] mb-2" />
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Tarif Zona Kecamatan
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Zona Inti mulai Rp 5.000 · Zona Puncak Rp 8.000 · Ambil di Koperasi Rp 0.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[#F7F8FA] border border-slate-200">
              <ShieldCheck className="w-5 h-5 text-[#00AA5B] mb-2" />
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Pembayaran Escrow UMKM
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Mendukung QRIS tanpa biaya admin, VA Bank BJB & BRI, serta COD tunai.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
