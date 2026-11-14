import { Calculator, Edit3, MapPin, Phone, Plus, Trash2, Truck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CISARUA_DESA_LIST,
  COURIER_SERVICES,
  COURIER_ZONE_OPTIONS,
  PAYMENT_METHODS,
  calculateShippingCost,
  formatRupiah,
  validateCourierDriverInput,
  type CourierDriver,
  type CourierZoneType,
  type PaymentMethod,
} from '../lib/marketplace';

interface CourierDirectoryViewProps {
  drivers: CourierDriver[];
  paymentMethods?: PaymentMethod[];
  onCreateDriver: (payload: Omit<CourierDriver, 'id'>) => Promise<void>;
  onUpdateDriver: (id: string, patch: Partial<Omit<CourierDriver, 'id'>>) => Promise<void>;
  onDeleteDriver: (id: string) => Promise<void>;
}

type ZoneFilter = 'Semua' | CourierZoneType;

interface DriverFormState {
  name: string;
  phone: string;
  zone: CourierZoneType;
  area: string;
  isActive: boolean;
}

const EMPTY_DRIVER_FORM: DriverFormState = {
  name: '',
  phone: '',
  zone: 'Zona Inti',
  area: '',
  isActive: true,
};

const ZONE_DESA_MAP: Record<CourierZoneType, string[]> = {
  'Zona Inti': ['Kel. Cisarua', 'Desa Kopo', 'Desa Leuwimalang', 'Desa Jogjogan', 'Desa Cilember'],
  'Zona Puncak': ['Desa Batulayang', 'Desa Citeko', 'Desa Cibeureum', 'Desa Tugu Utara', 'Desa Tugu Selatan'],
  'Luar Kec. Cisarua': ['Megamendung', 'Ciawi', 'Bogor Kota', 'Jabodetabek'],
};

export function CourierDirectoryView({
  drivers,
  paymentMethods,
  onCreateDriver,
  onUpdateDriver,
  onDeleteDriver,
}: CourierDirectoryViewProps) {
  const [selectedDesaId, setSelectedDesaId] = useState('tugu-utara');
  const [weightGrams, setWeightGrams] = useState(1000);
  const [orderSubtotal, setOrderSubtotal] = useState(100000);

  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<CourierDriver | null>(null);
  const [formState, setFormState] = useState<DriverFormState>(EMPTY_DRIVER_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredDrivers = useMemo(() => {
    if (zoneFilter === 'Semua') return drivers;
    return drivers.filter((d) => d.zone === zoneFilter);
  }, [drivers, zoneFilter]);

  const openCreateModal = () => {
    setEditingDriver(null);
    setFormState(EMPTY_DRIVER_FORM);
    setFormErrors({});
    setServerError('');
    setIsModalOpen(true);
  };

  const openEditModal = (driver: CourierDriver) => {
    setEditingDriver(driver);
    setFormState({
      name: driver.name,
      phone: driver.phone,
      zone: driver.zone,
      area: driver.area,
      isActive: driver.isActive,
    });
    setFormErrors({});
    setServerError('');
    setIsModalOpen(true);
  };

  const handleAppendDesa = (desaLabel: string) => {
    setFormState((prev) => {
      const current = prev.area.trim();
      if (!current) return { ...prev, area: desaLabel };
      if (current.toLowerCase().includes(desaLabel.toLowerCase())) return prev;
      return { ...prev, area: `${current}, ${desaLabel}` };
    });
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const validation = validateCourierDriverInput(formState);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});
    setIsSaving(true);
    try {
      const payload = {
        name: formState.name.trim(),
        phone: formState.phone.trim(),
        zone: formState.zone,
        area: formState.area.trim(),
        isActive: formState.isActive,
      };
      if (editingDriver) {
        await onUpdateDriver(editingDriver.id, payload);
      } else {
        await onCreateDriver(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Gagal menyimpan petugas kurir.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Integrasi Kurir Lokal & Sistem Pembayaran Kecamatan Cisarua
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Jaringan pengiriman antar-desa dan metode pembayaran resmi Forum UMKM IKM Kecamatan Cisarua
        </p>
      </div>

      {/* Interactive Shipping Tariff Simulator */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#00AA5B]" />
          <h2 className="font-display text-lg font-bold text-slate-900">
            Simulasi Tarif Pengiriman Kurir Lokal
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="sim-desa" className="block text-xs font-medium text-slate-700 mb-1">
              Desa / Kelurahan Tujuan
            </label>
            <select
              id="sim-desa"
              value={selectedDesaId}
              onChange={(e) => setSelectedDesaId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
            >
              {CISARUA_DESA_LIST.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.distanceKm} km)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sim-weight" className="block text-xs font-medium text-slate-700 mb-1">
              Berat Total Paket (gram)
            </label>
            <input
              id="sim-weight"
              type="number"
              min={100}
              step={100}
              value={weightGrams}
              onChange={(e) => setWeightGrams(Math.max(100, Number(e.target.value) || 100))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
            />
          </div>

          <div>
            <label htmlFor="sim-subtotal" className="block text-xs font-medium text-slate-700 mb-1">
              Nilai Belanja (Rp)
            </label>
            <input
              id="sim-subtotal"
              type="number"
              min={10000}
              step={10000}
              value={orderSubtotal}
              onChange={(e) => setOrderSubtotal(Math.max(0, Number(e.target.value) || 0))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COURIER_SERVICES.map((c) => {
            const calc = calculateShippingCost(c.id, selectedDesaId, weightGrams, orderSubtotal);
            return (
              <div key={c.id} className="p-4 rounded-lg border border-slate-200 bg-[#F7F8FA] space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-display font-semibold text-sm">
                  <Truck className="w-4 h-4 text-[#00AA5B] shrink-0" />
                  <span>{c.name}</span>
                </div>
                <p className="text-xs text-slate-600">{c.tagline}</p>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{c.eta}</span>
                  <span className="font-bold text-slate-900 tabular-nums text-sm">
                    {calc.finalShipping === 0 ? 'Gratis' : formatRupiah(calc.finalShipping)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Local Drivers & Payment Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          aria-labelledby="drivers-directory-heading"
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="drivers-directory-heading" className="font-display text-lg font-bold text-slate-900">
                Petugas Kurir Desa Terdaftar
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {drivers.length} petugas terdaftar · {drivers.filter((d) => d.isActive).length} aktif
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Daftarkan Petugas Kurir</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['Semua', 'Zona Inti', 'Zona Puncak', 'Luar Kec. Cisarua'] as const).map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setZoneFilter(zone)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  zoneFilter === zone
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {zone === 'Semua' ? 'Semua Zona' : zone}
              </button>
            ))}
          </div>

          {filteredDrivers.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Belum ada petugas kurir pada zona ini. Klik &ldquo;Daftarkan Petugas Kurir&rdquo; untuk menambahkan.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {filteredDrivers.map((driver) => (
                <li
                  key={driver.id}
                  className="py-3.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{driver.name}</p>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span
                        className={`text-xs font-semibold ${
                          driver.isActive ? 'text-[#00AA5B]' : 'text-slate-400'
                        }`}
                      >
                        {driver.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#00AA5B] shrink-0" />
                      <span>
                        <strong className="text-slate-800">{driver.zone}</strong>
                        <span aria-hidden="true"> · </span>
                        <span>{driver.area}</span>
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-700 tabular-nums">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{driver.phone}</span>
                    </span>

                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(driver)}
                        aria-label={`Edit petugas ${driver.name}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDriver(driver.id)}
                        aria-label={`Hapus petugas ${driver.name}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Kanal Pembayaran Resmi Forum
          </h2>
          <ul className="divide-y divide-slate-200">
            {(paymentMethods && paymentMethods.length > 0 ? paymentMethods : PAYMENT_METHODS)
              .filter((pm) => pm.isActive !== false)
              .map((pm) => (
                <li key={pm.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{pm.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{pm.subtitle}</p>
                    {pm.accountNumber && pm.type !== 'cod' && (
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Rekening / Kode: {pm.accountNumber}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 tabular-nums shrink-0">
                    {pm.fee === 0 ? 'Biaya Rp 0' : `Admin ${formatRupiah(pm.fee)}`}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </div>

      {/* Add / Edit Courier Driver & Zone Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-form-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#00AA5B]" />
                <h2 id="driver-form-title" className="font-display text-lg font-bold text-slate-900">
                  {editingDriver ? 'Edit Petugas Kurir Desa & Zona' : 'Daftarkan Petugas Kurir Desa'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup form petugas kurir"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="p-6 space-y-4">
              {serverError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
                >
                  {serverError}
                </div>
              )}

              <div>
                <label htmlFor="driver-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap Petugas Kurir
                </label>
                <input
                  id="driver-name"
                  type="text"
                  value={formState.name}
                  onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Contoh: Kang Ujang Permana"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="driver-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor WhatsApp Petugas
                </label>
                <input
                  id="driver-phone"
                  type="tel"
                  value={formState.phone}
                  onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {formErrors.phone && <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <label htmlFor="driver-zone" className="block text-xs font-medium text-slate-700 mb-1">
                  Zona Pengiriman Utama
                </label>
                <select
                  id="driver-zone"
                  value={formState.zone}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      zone: e.target.value as CourierZoneType,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                >
                  {COURIER_ZONE_OPTIONS.map((opt) => (
                    <option key={opt.zone} value={opt.zone}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formErrors.zone && <p className="text-xs text-red-600 mt-1">{formErrors.zone}</p>}
              </div>

              <div>
                <label htmlFor="driver-area" className="block text-xs font-medium text-slate-700 mb-1">
                  Desa / Wilayah Rute Tugas
                </label>
                <input
                  id="driver-area"
                  type="text"
                  value={formState.area}
                  onChange={(e) => setFormState((s) => ({ ...s, area: e.target.value }))}
                  placeholder="Contoh: Desa Tugu Utara & Tugu Selatan"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {formErrors.area && <p className="text-xs text-red-600 mt-1">{formErrors.area}</p>}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ZONE_DESA_MAP[formState.zone].map((desaName) => (
                    <button
                      key={desaName}
                      type="button"
                      onClick={() => handleAppendDesa(desaName)}
                      className="px-2 py-1 rounded border border-slate-200 bg-[#F7F8FA] hover:border-[#00AA5B] hover:text-[#00AA5B] text-[11px] font-medium text-slate-600 cursor-pointer"
                    >
                      + {desaName}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  id="driver-active"
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) => setFormState((s) => ({ ...s, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-[#00AA5B] rounded"
                />
                <span className="text-xs font-medium text-slate-700">
                  Petugas aktif dan siap ditugaskan menjemput paket
                </span>
              </label>

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
                    : editingDriver
                    ? 'Simpan Perubahan'
                    : 'Simpan Petugas Kurir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
