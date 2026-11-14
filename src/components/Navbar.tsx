import { LogIn, LogOut, Menu, ShoppingBag, X } from 'lucide-react';
import { useState } from 'react';
import {
  getAllowedTabsForRole,
  getDefaultTabForRole,
  type AppTab,
  type UserAccount,
} from '../lib/marketplace';

export type ActiveTab = AppTab;

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  cartCount: number;
  onOpenCart: () => void;
  currentUser: UserAccount | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
}

const TAB_LABELS: Record<AppTab, string> = {
  katalog: 'Katalog',
  lacak: 'Lacak Pesanan',
  kurir: 'Kurir Lokal',
  penjual: 'Dasbor Penjual',
  admin: 'Dasbor Admin',
};

const ROLE_LABELS: Record<UserAccount['role'], string> = {
  admin: 'Admin',
  pelanggan: 'Pelanggan',
  penjual: 'Penjual',
};

export function Navbar({
  activeTab,
  onSelectTab,
  cartCount,
  onOpenCart,
  currentUser,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const allowedTabs = getAllowedTabsForRole(currentUser?.role ?? null);
  const showCart = currentUser?.role !== 'penjual';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-3 md:gap-6">
        {/* Zone 1: Brand Logo & Two-Line Wordmark */}
        <button
          type="button"
          onClick={() => {
            onSelectTab(getDefaultTabForRole(currentUser?.role ?? null));
            setMobileMenuOpen(false);
          }}
          aria-label="FORUM UMKM IKM KECAMATAN CISARUA"
          className="flex items-center gap-2.5 sm:gap-3 text-left group min-w-0 shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E256B] rounded-lg py-1"
        >
          <img
            src="/assets/aistudio/Screenshot_20261113_122529_WhatsApp_88f122c9.jpg"
            alt="Logo Forum UMKM IKM Kecamatan Cisarua"
            className="w-11 h-11 sm:w-12 sm:h-12 object-contain rounded-md bg-white border border-slate-200/80 shrink-0"
          />
          <span className="flex flex-col leading-[1.15] font-display font-bold tracking-tight text-[#1E256B] group-hover:text-[#00AA5B] transition-colors">
            <span className="text-xs sm:text-[15px] whitespace-nowrap">FORUM UMKM IKM</span>
            <span className="text-[11px] sm:text-sm whitespace-nowrap">KECAMATAN CISARUA</span>
          </span>
        </button>

        {/* Zone 2: Clean Role-Scoped Single-Line Nav Links */}
        <nav aria-label="Navigasi Utama" className="hidden md:flex items-center gap-5 lg:gap-6">
          {allowedTabs.map((tabId) => {
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => onSelectTab(tabId)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-[#00AA5B] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {TAB_LABELS[tabId]}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00AA5B] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Auth & Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser ? (
            <div className="hidden sm:flex items-center gap-2 pr-1">
              <div className="text-right leading-tight">
                <p className="text-xs font-semibold text-slate-900 max-w-[140px] truncate">
                  {currentUser.storeName || currentUser.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {ROLE_LABELS[currentUser.role]}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Keluar dari akun"
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#1E256B]" />
              <span>Masuk / Daftar</span>
            </button>
          )}

          {showCart && (
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`Buka keranjang belanja, ${cartCount} item`}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00AA5B]"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Keranjang</span>
              <span className="tabular-nums font-mono text-xs bg-white/20 px-1.5 py-0.5 rounded">
                {cartCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Navigasi Mobile"
          className="md:hidden bg-white border-t border-slate-200 px-4 py-3 flex flex-col gap-1"
        >
          {allowedTabs.map((tabId) => {
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => {
                  onSelectTab(tabId);
                  setMobileMenuOpen(false);
                }}
                className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-[#00AA5B] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {TAB_LABELS[tabId]}
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between gap-2">
            {currentUser ? (
              <>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {currentUser.storeName || currentUser.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {ROLE_LABELS[currentUser.role]} · {currentUser.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenAuth('login');
                  setMobileMenuOpen(false);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#1E256B] text-white text-xs font-semibold cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk / Daftar Akun</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
