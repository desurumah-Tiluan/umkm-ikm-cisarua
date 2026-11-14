import { CheckCircle2, Lock, Mail, Store, UserCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CISARUA_DESA_LIST,
  validateLoginInput,
  validateRegistrationInput,
  type UserAccount,
} from '../lib/marketplace';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onLoginSuccess: (user: UserAccount, token: string) => void;
}

type AuthMode = 'login' | 'register';

export function AuthModal({
  isOpen,
  initialMode = 'login',
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [regRole, setRegRole] = useState<'pelanggan' | 'penjual'>('pelanggan');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDesa, setRegDesa] = useState(CISARUA_DESA_LIST[0].name);
  const [regAddress, setRegAddress] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regServerError, setRegServerError] = useState('');
  const [registeredResult, setRegisteredResult] = useState<{
    user: UserAccount;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setLoginError('');
      setRegServerError('');
      setRegisteredResult(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const validation = validateLoginInput({ email: loginEmail, password: loginPassword });
    if (!validation.valid) {
      setLoginError(validation.errors.email || validation.errors.password || 'Lengkapi data login.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.message || 'Gagal masuk ke akun.');
        return;
      }
      onLoginSuccess(data.user as UserAccount, data.token as string);
      onClose();
    } catch {
      setLoginError('Terjadi gangguan koneksi ke server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegServerError('');

    const payload = {
      role: regRole,
      name: regName,
      email: regEmail,
      phone: regPhone,
      desa: regDesa,
      address: regAddress,
      password: regPassword,
      ...(regRole === 'penjual' ? { storeName: regStoreName } : {}),
    };

    const validation = validateRegistrationInput(payload);
    if (!validation.valid) {
      setRegErrors(validation.errors);
      return;
    }
    setRegErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setRegErrors(data.errors);
        setRegServerError(data.message || 'Gagal mengirim pendaftaran.');
        return;
      }
      setRegisteredResult({
        user: data.user as UserAccount,
        message: data.message as string,
      });
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegAddress('');
      setRegStoreName('');
      setRegPassword('');
    } catch {
      setRegServerError('Terjadi gangguan koneksi ke server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-bold text-slate-900">
              {mode === 'login' ? 'Masuk Akun Forum UMKM IKM' : 'Pendaftaran Akun via Email'}
            </h2>
            <p className="text-xs text-slate-500">
              Portal Resmi Admin, Pelanggan & Penjual Kecamatan Cisarua
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela akun"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setRegisteredResult(null);
              }}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setRegisteredResult(null);
              }}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {mode === 'login' ? (
            <div className="space-y-5">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed"
                  >
                    {loginError}
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1">
                    Alamat Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Memeriksa Akun...' : 'Masuk Sekarang'}
                </button>
              </form>
            </div>
          ) : registeredResult ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00AA5B] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Pendaftaran Akun Berhasil Dikirim
                    </h3>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {registeredResult.message}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <p>
                  <span className="text-slate-400">Nama:</span>{' '}
                  <strong className="text-slate-900">{registeredResult.user.name}</strong>
                </p>
                <p>
                  <span className="text-slate-400">Email:</span>{' '}
                  <strong className="text-slate-900">{registeredResult.user.email}</strong>
                </p>
                <p>
                  <span className="text-slate-400">Jenis Akun:</span>{' '}
                  <strong className="text-slate-900 uppercase">{registeredResult.user.role}</strong>
                </p>
                <p>
                  <span className="text-slate-400">Status Saat Ini:</span>{' '}
                  <strong className="text-amber-700">Menunggu Persetujuan Admin</strong>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(registeredResult.user.email);
                    setMode('login');
                    setRegisteredResult(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold cursor-pointer"
                >
                  Ke Halaman Masuk
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {regServerError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
                >
                  {regServerError}
                </div>
              )}

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-slate-700">
                  Pilih Peran Pendaftaran
                </legend>
                <div className="grid grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      regRole === 'pelanggan'
                        ? 'border-[#00AA5B] bg-emerald-50/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="regRole"
                      value="pelanggan"
                      checked={regRole === 'pelanggan'}
                      onChange={() => setRegRole('pelanggan')}
                      className="mt-0.5 accent-[#00AA5B]"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-[#00AA5B]" />
                        <span>Pelanggan</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Akses Katalog & Lacak Pesanan
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      regRole === 'penjual'
                        ? 'border-[#00AA5B] bg-emerald-50/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="regRole"
                      value="penjual"
                      checked={regRole === 'penjual'}
                      onChange={() => setRegRole('penjual')}
                      className="mt-0.5 accent-[#00AA5B]"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-[#00AA5B]" />
                        <span>Penjual UMKM</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dasbor Penjual & Kurir Lokal
                      </p>
                    </div>
                  </label>
                </div>
              </fieldset>

              {regRole === 'penjual' && (
                <div>
                  <label htmlFor="reg-store" className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Toko / Usaha UMKM IKM
                  </label>
                  <input
                    id="reg-store"
                    type="text"
                    value={regStoreName}
                    onChange={(e) => setRegStoreName(e.target.value)}
                    placeholder="Contoh: Madu Asli Tugu Selatan"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  {regErrors.storeName && (
                    <p className="text-xs text-red-600 mt-1">{regErrors.storeName}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Nama sesuai KTP"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  {regErrors.name && <p className="text-xs text-red-600 mt-1">{regErrors.name}</p>}
                </div>

                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    Nomor WhatsApp
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  {regErrors.phone && (
                    <p className="text-xs text-red-600 mt-1">{regErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 mb-1">
                    Email Aktif
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  {regErrors.email && (
                    <p className="text-xs text-red-600 mt-1">{regErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700 mb-1">
                    Buat Kata Sandi
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 6 karakter"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  {regErrors.password && (
                    <p className="text-xs text-red-600 mt-1">{regErrors.password}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="reg-desa" className="block text-xs font-medium text-slate-700 mb-1">
                  Desa / Kelurahan Domisili
                </label>
                <select
                  id="reg-desa"
                  value={regDesa}
                  onChange={(e) => setRegDesa(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                >
                  {CISARUA_DESA_LIST.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {regErrors.desa && <p className="text-xs text-red-600 mt-1">{regErrors.desa}</p>}
              </div>

              <div>
                <label htmlFor="reg-address" className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  id="reg-address"
                  rows={2}
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="Nama jalan / kampung, RT/RW, nomor rumah"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {regErrors.address && (
                  <p className="text-xs text-red-600 mt-1">{regErrors.address}</p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-[#F7F8FA] border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                {regRole === 'pelanggan'
                  ? 'Pendaftaran Pelanggan melalui email akan diverifikasi oleh Admin Forum UMKM IKM dan direkap ke dalam Google Sheet resmi.'
                  : 'Pendaftaran Penjual UMKM IKM akan ditinjau oleh Admin sebelum toko Anda aktif di etalase.'}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Mengirim Pendaftaran...' : 'Daftar Akun via Email'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
