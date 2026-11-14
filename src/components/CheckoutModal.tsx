import { CheckCircle2, Copy, CreditCard, MapPin, QrCode, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CISARUA_DESA_LIST,
  COURIER_SERVICES,
  PAYMENT_METHODS,
  calculateOrderTotals,
  calculateShippingCost,
  formatRupiah,
  formatWeight,
  validateCheckoutInput,
  type CartItem,
  type CourierId,
  type Order,
  type PaymentMethod,
  type PaymentMethodId,
  type Product,
  type UserAccount,
} from '../lib/marketplace';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  products: Product[];
  paymentMethods?: PaymentMethod[];
  currentUser?: UserAccount | null;
  onSubmitOrder: (payload: {
    buyerName: string;
    buyerPhone: string;
    destinationDesaId: string;
    addressDetail: string;
    courierId: CourierId;
    paymentMethodId: PaymentMethodId;
    items: CartItem[];
  }) => Promise<Order>;
  onConfirmPayment: (orderId: string) => Promise<Order>;
  onTrackOrder: (resi: string) => void;
}

export function CheckoutModal({
  isOpen,
  onClose,
  cart,
  products,
  paymentMethods,
  currentUser,
  onSubmitOrder,
  onConfirmPayment,
  onTrackOrder,
}: CheckoutModalProps) {
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [destinationDesaId, setDestinationDesaId] = useState('cisarua-kota');
  const [addressDetail, setAddressDetail] = useState('');
  const [courierId, setCourierId] = useState<CourierId>('kurir-desa');
  const [paymentMethodId, setPaymentMethodId] = useState<PaymentMethodId>('qris');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser && !createdOrder) {
      setBuyerName((prev) => prev || currentUser.name);
      setBuyerPhone((prev) => prev || currentUser.phone);
      setAddressDetail((prev) => prev || currentUser.address);
      const matchedDesa = CISARUA_DESA_LIST.find((d) => d.name === currentUser.desa);
      if (matchedDesa) {
        setDestinationDesaId(matchedDesa.id);
      }
    }
  }, [isOpen, currentUser, createdOrder]);

  if (!isOpen) return null;

  const lineItems = cart
    .map((item) => {
      const p = products.find((prod) => prod.id === item.productId);
      if (!p) return null;
      return {
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        weightGrams: p.weightGrams,
        quantity: item.quantity,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const activePaymentMethods = (
    paymentMethods && paymentMethods.length > 0 ? paymentMethods : PAYMENT_METHODS
  ).filter((pm) => pm.isActive !== false);

  const selectedCourier = COURIER_SERVICES.find((c) => c.id === courierId) ?? COURIER_SERVICES[0];
  const resolvedPaymentMethod =
    activePaymentMethods.find(
      (pm) => pm.id === paymentMethodId && !(pm.type === 'cod' && !selectedCourier.supportsCod)
    ) ??
    activePaymentMethods.find((pm) => !(pm.type === 'cod' && !selectedCourier.supportsCod)) ??
    activePaymentMethods[0] ??
    PAYMENT_METHODS[0];

  const effectivePaymentMethodId = resolvedPaymentMethod.id;

  const totals = calculateOrderTotals(
    lineItems,
    courierId,
    destinationDesaId,
    effectivePaymentMethodId,
    activePaymentMethods
  );

  const handleCourierChange = (nextCourierId: CourierId) => {
    setCourierId(nextCourierId);
    const c = COURIER_SERVICES.find((item) => item.id === nextCourierId);
    const currentPm = activePaymentMethods.find((p) => p.id === effectivePaymentMethodId);
    if (c && !c.supportsCod && currentPm?.type === 'cod') {
      const nonCod = activePaymentMethods.find((p) => p.type !== 'cod');
      if (nonCod) setPaymentMethodId(nonCod.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const validation = validateCheckoutInput({
      buyerName,
      buyerPhone,
      destinationDesaId,
      addressDetail,
      courierId,
      paymentMethodId: effectivePaymentMethodId,
      paymentType: resolvedPaymentMethod.type,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const order = await onSubmitOrder({
        buyerName,
        buyerPhone,
        destinationDesaId,
        addressDetail,
        courierId,
        paymentMethodId: effectivePaymentMethodId,
        items: cart,
      });
      setCreatedOrder(order);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Gagal membuat pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!createdOrder) return;
    setIsSubmitting(true);
    try {
      const updated = await onConfirmPayment(createdOrder.id);
      setCreatedOrder(updated);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Gagal verifikasi pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setCreatedOrder(null);
    setErrors({});
    setServerError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 id="checkout-modal-title" className="font-display text-lg font-bold text-slate-900">
              {createdOrder ? 'Rincian Pembayaran & Resi Pengiriman' : 'Checkout & Pengiriman Lokal'}
            </h2>
            <p className="text-xs text-slate-500">
              Forum UMKM IKM Kecamatan Cisarua · Pembayaran & Kurir Terintegrasi
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Tutup jendela checkout"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {createdOrder ? (() => {
            const matchedMethod = (paymentMethods ?? PAYMENT_METHODS).find(
              (p) => p.id === createdOrder.paymentMethodId
            );
            const createdType: 'qris' | 'va' | 'cod' =
              matchedMethod?.type ??
              (createdOrder.paymentMethodId === 'cod' || createdOrder.paymentCode.startsWith('COD-')
                ? 'cod'
                : createdOrder.paymentMethodId === 'qris' ||
                  createdOrder.paymentCode.startsWith('QRIS-')
                ? 'qris'
                : 'va');
            return (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl border ${
                  createdOrder.isPaid || createdType === 'cod'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={`w-6 h-6 shrink-0 mt-0.5 ${
                        createdOrder.isPaid ? 'text-[#00AA5B]' : 'text-amber-600'
                      }`}
                    />
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {createdOrder.isPaid
                          ? 'Pembayaran Berhasil Terverifikasi'
                          : createdType === 'cod'
                          ? 'Pesanan COD Diterima — Siap Dijemput Kurir Lokal'
                          : 'Pesanan Dibuat — Selesaikan Pembayaran'}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        ID Pesanan: <strong className="font-mono">{createdOrder.id}</strong> · Resi
                        Kurir: <strong className="font-mono">{createdOrder.resi}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">Total Tagihan (termasuk Fee Admin Rp 1.000)</p>
                    <p className="font-display text-xl font-bold text-slate-900 tabular-nums">
                      {formatRupiah(createdOrder.grandTotal)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Box */}
                <div className="p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Metode Pembayaran
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {createdOrder.paymentMethodName}
                    </span>
                  </div>

                  {createdType === 'qris' && (
                    <div className="flex flex-col items-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <QrCode className="w-28 h-28 text-slate-900 stroke-[1.5]" />
                      <p className="mt-2 text-xs font-mono text-slate-600">
                        {createdOrder.paymentCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 text-center">
                        Pindai QRIS dengan GoPay, OVO, DANA, atau Mobile Banking
                      </p>
                    </div>
                  )}

                  {createdType === 'va' && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <p className="text-xs text-slate-500">Nomor Virtual Account / Rekening</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                          {createdOrder.paymentCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(createdOrder.paymentCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 1500);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedCode ? 'Disalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {createdType === 'cod' && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      Siapkan uang pas sejumlah{' '}
                      <strong className="tabular-nums">{formatRupiah(createdOrder.grandTotal)}</strong>{' '}
                      untuk dibayarkan kepada kurir lokal saat paket tiba di{' '}
                      <strong>{createdOrder.destinationDesaName}</strong>.
                    </div>
                  )}

                  {!createdOrder.isPaid && createdType !== 'cod' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSimulatePayment}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Memverifikasi...' : 'Konfirmasi Pembayaran Sekarang'}
                    </button>
                  )}
                </div>

                {/* Delivery Summary */}
                <div className="p-5 rounded-xl border border-slate-200 space-y-3 text-sm">
                  <h4 className="font-display font-semibold text-slate-900">
                    Detail Pengiriman Kurir Lokal
                  </h4>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p>
                      <span className="text-slate-400">Penerima:</span>{' '}
                      <strong className="text-slate-800">{createdOrder.buyerName}</strong> (
                      {createdOrder.buyerPhone})
                    </p>
                    <p>
                      <span className="text-slate-400">Tujuan:</span>{' '}
                      <strong className="text-slate-800">{createdOrder.destinationDesaName}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Alamat:</span> {createdOrder.addressDetail}
                    </p>
                    <p>
                      <span className="text-slate-400">Armada Kurir:</span>{' '}
                      <strong className="text-[#00AA5B]">{createdOrder.courierName}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Status Saat Ini:</span>{' '}
                      <strong className="text-slate-900">{createdOrder.status}</strong>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const resi = createdOrder.resi;
                        handleResetAndClose();
                        onTrackOrder(resi);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      Lacak Pengiriman ({createdOrder.resi})
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAndClose}
                      className="py-2.5 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })() : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">
                {serverError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
                  >
                    {serverError}
                  </div>
                )}

                {/* Step 1: Alamat Pengiriman */}
                <fieldset className="space-y-3">
                  <legend className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00AA5B]" />
                    <span>1. Data Penerima & Alamat di Kecamatan Cisarua</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="checkout-name" className="block text-xs font-medium text-slate-700 mb-1">
                        Nama Lengkap Penerima
                      </label>
                      <input
                        id="checkout-name"
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Contoh: Siti Rahmawati"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                      />
                      {errors.buyerName && (
                        <p className="text-xs text-red-600 mt-1">{errors.buyerName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="checkout-phone" className="block text-xs font-medium text-slate-700 mb-1">
                        Nomor WhatsApp
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="0812-xxxx-xxxx"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                      />
                      {errors.buyerPhone && (
                        <p className="text-xs text-red-600 mt-1">{errors.buyerPhone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="checkout-desa" className="block text-xs font-medium text-slate-700 mb-1">
                      Desa / Kelurahan Tujuan
                    </label>
                    <select
                      id="checkout-desa"
                      value={destinationDesaId}
                      onChange={(e) => setDestinationDesaId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                    >
                      {CISARUA_DESA_LIST.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.distanceKm} km · Kode Pos {d.postalCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {courierId !== 'pickup-koperasi' && (
                    <div>
                      <label htmlFor="checkout-address" className="block text-xs font-medium text-slate-700 mb-1">
                        Alamat Lengkap & Patokan
                      </label>
                      <textarea
                        id="checkout-address"
                        rows={2}
                        value={addressDetail}
                        onChange={(e) => setAddressDetail(e.target.value)}
                        placeholder="Jl. Raya Puncak / Kampung, RT/RW, nomor rumah atau patokan"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                      />
                      {errors.addressDetail && (
                        <p className="text-xs text-red-600 mt-1">{errors.addressDetail}</p>
                      )}
                    </div>
                  )}
                </fieldset>

                {/* Step 2: Kurir Lokal */}
                <fieldset className="space-y-3 pt-4 border-t border-slate-200">
                  <legend className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#00AA5B]" />
                    <span>2. Pilih Pengiriman Kurir Lokal</span>
                  </legend>

                  <div className="space-y-2">
                    {COURIER_SERVICES.map((c) => {
                      const calc = calculateShippingCost(
                        c.id,
                        destinationDesaId,
                        totals.totalWeightGrams,
                        totals.subtotal
                      );
                      const selected = courierId === c.id;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selected
                              ? 'border-[#00AA5B] bg-emerald-50/50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="courier"
                              value={c.id}
                              checked={selected}
                              onChange={() => handleCourierChange(c.id)}
                              className="mt-1 accent-[#00AA5B]"
                            />
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                              <div className="text-xs text-slate-500">
                                {c.eta} · {c.tagline}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {calc.eligibleFreeShipping ? (
                              <div>
                                <span className="text-xs line-through text-slate-400 tabular-nums block">
                                  {formatRupiah(calc.shippingCost)}
                                </span>
                                <span className="text-sm font-bold text-[#00AA5B]">Gratis</span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {calc.finalShipping === 0 ? 'Gratis' : formatRupiah(calc.finalShipping)}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Step 3: Sistem Pembayaran */}
                <fieldset className="space-y-3 pt-4 border-t border-slate-200">
                  <legend className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#00AA5B]" />
                    <span>3. Pilih Metode Pembayaran</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activePaymentMethods.map((pm) => {
                      const disabled = pm.type === 'cod' && !selectedCourier.supportsCod;
                      const selected = effectivePaymentMethodId === pm.id;
                      return (
                        <label
                          key={pm.id}
                          className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
                            disabled
                              ? 'opacity-45 bg-slate-50 border-slate-200 cursor-not-allowed'
                              : selected
                              ? 'border-[#00AA5B] bg-emerald-50/50 cursor-pointer'
                              : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={pm.id}
                            disabled={disabled}
                            checked={selected}
                            onChange={() => setPaymentMethodId(pm.id)}
                            className="mt-1 accent-[#00AA5B]"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900">{pm.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{pm.subtitle}</div>
                            <div className="text-[11px] font-medium text-slate-700 mt-1 tabular-nums">
                              Biaya layanan: {pm.fee === 0 ? 'Gratis' : formatRupiah(pm.fee)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {errors.paymentMethodId && (
                    <p className="text-xs text-red-600">{errors.paymentMethodId}</p>
                  )}
                </fieldset>
              </div>

              {/* Right Column: Order Summary */}
              <div className="lg:col-span-5">
                <div className="bg-[#F7F8FA] rounded-xl border border-slate-200 p-5 space-y-4 sticky top-0">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Ringkasan Belanja ({lineItems.length} Produk)
                  </h3>

                  <ul className="divide-y divide-slate-200 max-h-52 overflow-y-auto">
                    {lineItems.map((item) => (
                      <li key={item.productId} className="py-2.5 flex justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{item.name}</p>
                          <p className="text-slate-500 tabular-nums">
                            {item.quantity} × {formatRupiah(item.unitPrice)}
                          </p>
                        </div>
                        <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                          {formatRupiah(item.unitPrice * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 border-t border-slate-200 space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between gap-4">
                      <span>Subtotal Produk ({formatWeight(totals.totalWeightGrams)})</span>
                      <span className="font-medium text-slate-900 tabular-nums whitespace-nowrap shrink-0">
                        {formatRupiah(totals.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Ongkos Kirim ({selectedCourier.name})</span>
                      <span className="font-medium text-slate-900 tabular-nums whitespace-nowrap shrink-0">
                        {formatRupiah(totals.shippingCost)}
                      </span>
                    </div>
                    {totals.shippingDiscount > 0 && (
                      <div className="flex justify-between gap-4 text-[#00AA5B]">
                        <span>Subsidi Gratis Ongkir Forum IKM</span>
                        <span className="font-semibold tabular-nums whitespace-nowrap shrink-0">
                          -{formatRupiah(totals.shippingDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <span>Biaya Layanan Pembayaran</span>
                      <span className="font-medium text-slate-900 tabular-nums whitespace-nowrap shrink-0">
                        {totals.serviceFee === 0 ? 'Gratis' : formatRupiah(totals.serviceFee)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Fee Admin Forum (Kas Pengurus)</span>
                      <span className="font-medium text-slate-900 tabular-nums whitespace-nowrap shrink-0">
                        {formatRupiah(totals.buyerAdminFee)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-slate-900">
                      Total Tagihan
                    </span>
                    <span className="font-display text-xl font-bold text-[#00AA5B] tabular-nums">
                      {formatRupiah(totals.grandTotal)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || lineItems.length === 0}
                    className="w-full py-3 px-4 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Memproses Pesanan...' : 'Buat Pesanan & Bayar'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
