import { CheckCircle2, MapPin, Package, Search, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatRupiah, type Order, type OrderStatus } from '../lib/marketplace';

interface OrderTrackerViewProps {
  orders: Order[];
  initialQuery?: string;
  onConfirmPayment: (orderId: string) => Promise<Order>;
}

const PROGRESS_STEPS: OrderStatus[] = [
  'Menunggu Pembayaran',
  'Menunggu Penjemputan Kurir',
  'Dalam Pengiriman Kurir Lokal',
  'Selesai',
];

export function OrderTrackerView({
  orders,
  initialQuery = '',
  onConfirmPayment,
}: OrderTrackerViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id ?? '');

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      const match = orders.find(
        (o) =>
          o.resi.toLowerCase() === initialQuery.toLowerCase() ||
          o.id.toLowerCase() === initialQuery.toLowerCase()
      );
      if (match) setSelectedOrderId(match.id);
    }
  }, [initialQuery, orders]);

  const trimmed = query.trim().toLowerCase();
  const activeOrder = trimmed
    ? orders.find(
        (o) => o.resi.toLowerCase().includes(trimmed) || o.id.toLowerCase().includes(trimmed)
      )
    : orders.find((o) => o.id === selectedOrderId) ?? orders[0];

  const activeStepIdx = activeOrder ? PROGRESS_STEPS.indexOf(activeOrder.status) : 0;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Lacak Pesanan & Pengiriman Kurir Lokal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau status pembayaran dan posisi kurir desa Kecamatan Cisarua secara real-time
          </p>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative w-full md:w-80"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <label htmlFor="track-resi-input" className="sr-only">
            Cari nomor resi atau ID pesanan
          </label>
          <input
            id="track-resi-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Masukkan No. Resi (mis. CSR-EXP-0001)"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
          />
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Orders List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Daftar Pesanan Terbaru ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Belum ada transaksi tercatat.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 max-h-[540px] overflow-y-auto">
              {orders.map((order) => {
                const isSelected = activeOrder?.id === order.id;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setSelectedOrderId(order.id);
                      }}
                      className={`w-full text-left p-4 transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {order.resi}
                        </span>
                        <span className="text-xs font-medium text-[#00AA5B] tabular-nums">
                          {formatRupiah(order.grandTotal)}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 mt-1">{order.buyerName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {order.destinationDesaName} · {order.status}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: Tracking Details */}
        <div className="lg:col-span-8">
          {!activeOrder ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Nomor resi tidak ditemukan
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Periksa kembali nomor resi atau pilih pesanan dari daftar di sebelah kiri.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">
                    ID Pesanan <span className="font-mono">{activeOrder.id}</span> · Resi{' '}
                    <strong className="font-mono text-slate-900">{activeOrder.resi}</strong>
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                    {activeOrder.status}
                  </h2>
                </div>

                {!activeOrder.isPaid &&
                  activeOrder.paymentMethodId !== 'cod' &&
                  !activeOrder.paymentCode.startsWith('COD-') && (
                  <button
                    type="button"
                    onClick={() => onConfirmPayment(activeOrder.id)}
                    className="px-4 py-2 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Konfirmasi Pembayaran ({activeOrder.paymentMethodName})
                  </button>
                )}
              </div>

              {/* 4-Step Progress Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PROGRESS_STEPS.map((step, index) => {
                  const done = index <= activeStepIdx;
                  return (
                    <div
                      key={step}
                      className={`p-3 rounded-lg border text-xs ${
                        done
                          ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            done ? 'text-[#00AA5B]' : 'text-slate-300'
                          }`}
                        />
                        <span>Tahap {index + 1}</span>
                      </div>
                      <p className="mt-1 font-medium leading-snug">{step}</p>
                    </div>
                  );
                })}
              </div>

              {/* Courier & Recipient Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-[#F7F8FA] border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Truck className="w-4 h-4 text-[#00AA5B]" />
                    <span>Informasi Kurir Lokal</span>
                  </div>
                  <p className="text-slate-700 font-medium">{activeOrder.courierName}</p>
                  <p className="text-slate-600">
                    Petugas Kurir:{' '}
                    <strong>{activeOrder.courierDriver ?? 'Menunggu penugasan kurir desa'}</strong>
                  </p>
                  {activeOrder.courierPhone && (
                    <p className="text-slate-600 font-mono">WA Kurir: {activeOrder.courierPhone}</p>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-[#F7F8FA] border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <MapPin className="w-4 h-4 text-[#00AA5B]" />
                    <span>Tujuan Pengiriman</span>
                  </div>
                  <p className="text-slate-700 font-medium">
                    {activeOrder.buyerName} ({activeOrder.buyerPhone})
                  </p>
                  <p className="text-slate-600">
                    {activeOrder.destinationDesaName} — {activeOrder.addressDetail}
                  </p>
                </div>
              </div>

              {/* Timeline History */}
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 mb-3">
                  Riwayat Perjalanan Paket
                </h3>
                <ol className="space-y-3 border-l border-slate-200 ml-2 pl-4">
                  {[...activeOrder.timeline].reverse().map((event, idx) => (
                    <li key={idx} className="relative">
                      <span
                        aria-hidden="true"
                        className={`w-2.5 h-2.5 rounded-full absolute -left-[21px] top-1.5 ${
                          idx === 0 ? 'bg-[#00AA5B]' : 'bg-slate-300'
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">{event.status}</span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-mono text-slate-500">
                          {new Date(event.timestamp).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{event.note}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Items Summary */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-display text-sm font-bold text-slate-900 mb-2">
                  Produk dalam Pesanan
                </h3>
                <ul className="divide-y divide-slate-100 text-xs">
                  {activeOrder.items.map((item) => (
                    <li key={item.productId} className="py-2 flex justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{item.productName}</p>
                        <p className="text-slate-500">
                          {item.sellerName} ({item.desa}) · {item.quantity} ×{' '}
                          {formatRupiah(item.unitPrice)}
                        </p>
                      </div>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal Produk</span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {formatRupiah(activeOrder.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ongkos Kirim ({activeOrder.courierName})</span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {formatRupiah(Math.max(0, activeOrder.shippingCost - activeOrder.shippingDiscount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Layanan Pembayaran</span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {activeOrder.serviceFee === 0 ? 'Gratis' : formatRupiah(activeOrder.serviceFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee Admin Forum (Kas Pengurus)</span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {formatRupiah(activeOrder.buyerAdminFee ?? 1000)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>Total Tagihan Pembeli</span>
                    <span className="tabular-nums text-[#00AA5B]">
                      {formatRupiah(activeOrder.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
