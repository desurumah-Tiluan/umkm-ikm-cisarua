import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { formatRupiah, formatWeight, type CartItem, type Product } from '../lib/marketplace';
import { ProductImage } from './ProductImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  products: Product[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  products,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const detailedItems = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return product ? { ...item, product } : null;
    })
    .filter((entry): entry is { productId: string; quantity: number; product: Product } => entry !== null);

  const subtotal = detailedItems.reduce(
    (sum, entry) => sum + entry.product.price * entry.quantity,
    0
  );
  const totalWeight = detailedItems.reduce(
    (sum, entry) => sum + entry.product.weightGrams * entry.quantity,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/45"
      role="dialog"
      aria-modal="true"
      aria-label="Keranjang Belanja"
    >
      <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Keranjang Belanja</h2>
            <p className="text-xs text-slate-500">
              {detailedItems.length} produk · Total berat {formatWeight(totalWeight)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup keranjang belanja"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {detailedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Keranjang masih kosong
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">
                Pilih kopi, madu hutan, anyaman bambu, atau sayur segar dari UMKM Kecamatan Cisarua.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 px-4 py-2 rounded-lg bg-[#00AA5B] text-white text-sm font-semibold hover:bg-[#00944F] cursor-pointer"
              >
                Jelajahi Katalog Produk
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {detailedItems.map(({ product, quantity }) => (
                <li key={product.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <ProductImage
                      imageKey={product.imageKey}
                      alt={product.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 truncate">
                      {product.sellerName} · {product.desa}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 mt-0.5">
                      {product.name}
                    </h3>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatRupiah(product.price * quantity)}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center border border-slate-200 rounded-md">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(product.id, quantity - 1)}
                            aria-label={`Kurangi jumlah ${product.name}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(product.id, Math.min(product.stock, quantity + 1))
                            }
                            disabled={quantity >= product.stock}
                            aria-label={`Tambah jumlah ${product.name}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(product.id)}
                          aria-label={`Hapus ${product.name} dari keranjang`}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {detailedItems.length > 0 && (
          <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Belanja (Belum termasuk ongkir)</span>
              <span className="font-display text-lg font-bold text-slate-900 tabular-nums">
                {formatRupiah(subtotal)}
              </span>
            </div>
            <button
              type="button"
              onClick={onProceedToCheckout}
              className="w-full py-3 px-4 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              Lanjut ke Pembayaran & Pengiriman
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
