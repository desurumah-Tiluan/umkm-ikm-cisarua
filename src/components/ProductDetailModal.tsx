import { useState } from 'react';
import { MapPin, Minus, Plus, ShieldCheck, Store, Truck, X } from 'lucide-react';
import { formatRupiah, formatWeight, type Product } from '../lib/marketplace';
import { ProductImage } from './ProductImage';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, openCheckoutImmediately?: boolean) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const maxStock = Math.max(0, product.stock);
  const clampedQty = Math.min(Math.max(1, quantity), Math.max(1, maxStock));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full overflow-hidden shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>{product.category}</span>
            <span aria-hidden="true">·</span>
            <span>{product.desa}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail produk"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
          {/* Left: Product Image */}
          <div className="md:col-span-6">
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
              <ProductImage
                imageKey={product.imageKey}
                alt={product.name}
                className="w-full h-full"
              />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#00AA5B]" />
                <span className="font-semibold text-slate-800">{product.sellerName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <MapPin className="w-3.5 h-3.5" />
                <span>{product.desa}, Kec. Cisarua</span>
              </div>
            </div>
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="md:col-span-6 flex flex-col justify-between gap-5">
            <div>
              <h2
                id="pdp-title"
                className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug"
              >
                {product.name}
              </h2>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-amber-600">★ {product.rating.toFixed(1)}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Terjual {product.soldCount}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Berat {formatWeight(product.weightGrams)}</span>
              </div>

              <div className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums font-display">
                {formatRupiah(product.price)}
              </div>

              <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                {product.description}
              </p>

              <div className="mt-5 pt-4 border-t border-slate-200 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#00AA5B] shrink-0" />
                  <span>
                    Pengiriman langsung via <strong>Kurir Desa Cisarua Express</strong> mulai Rp 5.000
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#00AA5B] shrink-0" />
                  <span>Pembayaran aman via QRIS, Virtual Account Bank, atau COD Kurir Lokal</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Atur Jumlah</span>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={clampedQty <= 1}
                      aria-label="Kurangi jumlah"
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">
                      {clampedQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                      disabled={clampedQty >= maxStock}
                      aria-label="Tambah jumlah"
                      className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Stok: <strong className="text-slate-800">{maxStock}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-bold text-slate-900 tabular-nums text-base">
                  {formatRupiah(product.price * clampedQty)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={maxStock === 0}
                  onClick={() => {
                    onAddToCart(product, clampedQty, false);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-lg border border-[#00AA5B] text-[#00AA5B] hover:bg-emerald-50 font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  + Keranjang
                </button>
                <button
                  type="button"
                  disabled={maxStock === 0}
                  onClick={() => {
                    onAddToCart(product, clampedQty, true);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {maxStock === 0 ? 'Stok Habis' : 'Beli Langsung'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
