import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { CourierDirectoryView } from './components/CourierDirectoryView';
import { Navbar, type ActiveTab } from './components/Navbar';
import { OrderTrackerView } from './components/OrderTrackerView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SellerDashboard } from './components/SellerDashboard';
import { StorefrontView } from './components/StorefrontView';
import {
  formatRupiah,
  getAllowedTabsForRole,
  getDefaultTabForRole,
  type ApprovalStatus,
  type CartItem,
  type CourierDriver,
  type CourierId,
  type KasWalletSummary,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type PaymentMethodId,
  type Product,
  type SellerStore,
  type SheetsRecapConfig,
  type UserAccount,
} from './lib/marketplace';

const CART_STORAGE_KEY = 'cisarua_umkm_cart_v1';
const AUTH_TOKEN_STORAGE_KEY = 'cisarua_umkm_auth_token_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('katalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<SellerStore[]>([]);
  const [drivers, setDrivers] = useState<CourierDriver[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>([]);
  const [sheetsConfig, setSheetsConfig] = useState<SheetsRecapConfig | null>(null);
  const [kasWallet, setKasWallet] = useState<KasWalletSummary | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [trackingQuery, setTrackingQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3000);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError('');
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Gagal memuat data marketplace.');
      const data = await res.json();
      setProducts(data.products ?? []);
      setOrders(data.orders ?? []);
      setSellers(data.sellers ?? []);
      setDrivers(data.drivers ?? []);
      setPaymentMethods(data.paymentMethods ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAdminUsers = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAdminUsers(data.users ?? []);
      setSheetsConfig(data.sheetsConfig ?? null);
      setKasWallet(data.kasWallet ?? null);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          if (!cancelled) {
            localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            setAuthToken(null);
            setCurrentUser(null);
          }
          return;
        }
        const data = await res.json();
        const user = data.user as UserAccount;
        if (!cancelled && user) {
          setCurrentUser(user);
          setActiveTab((prev) => {
            const allowed = getAllowedTabsForRole(user.role);
            return allowed.includes(prev) ? prev : getDefaultTabForRole(user.role);
          });
          if (user.role === 'admin') {
            fetchAdminUsers(authToken);
          }
        }
      } catch {
        // ignore network hiccup on mount
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, fetchAdminUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  const allowedTabs = getAllowedTabsForRole(currentUser?.role ?? null);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(getDefaultTabForRole(currentUser?.role ?? null));
    }
  }, [allowedTabs, activeTab, currentUser?.role]);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleLoginSuccess = (user: UserAccount, token: string) => {
    try {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore
    }
    setAuthToken(token);
    setCurrentUser(user);
    setActiveTab(getDefaultTabForRole(user.role));
    if (user.role === 'admin') {
      fetchAdminUsers(token);
    }
    showToast(`Selamat datang, ${user.storeName || user.name}`);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
    setAdminUsers([]);
    setKasWallet(null);
    setActiveTab('katalog');
    showToast('Anda telah keluar dari akun');
  };

  const handleWithdrawKas = async (amount: number, note: string) => {
    if (!authToken) return;
    const res = await fetch('/api/admin/kas/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ amount, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Gagal mencatat penarikan kas.');
    }
    setKasWallet(data.kasWallet ?? null);
    showToast(`Penarikan kas ${formatRupiah(amount)} berhasil dicatat`);
  };

  const handleApproveUser = async (userId: string, approvalStatus: ApprovalStatus) => {
    if (!authToken) return;
    const res = await fetch(`/api/admin/users/${userId}/approval`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ approvalStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.message || 'Gagal memperbarui status pendaftar.');
      return;
    }
    setAdminUsers(data.users ?? []);
    if (Array.isArray(data.sellers)) {
      setSellers(data.sellers);
    }
    const updatedUser = data.user as UserAccount;
    showToast(
      approvalStatus === 'approved'
        ? `Akun "${updatedUser.name}" disetujui Admin`
        : `Pendaftaran "${updatedUser.name}" ditolak`
    );
  };

  const handleAddToCart = (
    product: Product,
    quantity = 1,
    openCheckoutImmediately = false
  ) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + quantity);
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prev, { productId: product.id, quantity: Math.min(product.stock, quantity) }];
    });

    if (openCheckoutImmediately) {
      setIsCheckoutOpen(true);
    } else {
      showToast(`"${product.name}" ditambahkan ke keranjang`);
    }
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleSubmitOrder = async (payload: {
    buyerName: string;
    buyerPhone: string;
    destinationDesaId: string;
    addressDetail: string;
    courierId: CourierId;
    paymentMethodId: PaymentMethodId;
    items: CartItem[];
  }): Promise<Order> => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Gagal memproses pesanan.');
    }
    setOrders((prev) => [data.order, ...prev]);
    if (Array.isArray(data.products)) {
      setProducts(data.products);
    }
    setCart([]);
    if (currentUser?.role === 'admin' && authToken) {
      fetchAdminUsers(authToken);
    }
    return data.order as Order;
  };

  const handleConfirmPayment = async (orderId: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${orderId}/pay`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal verifikasi pembayaran.');
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
    if (currentUser?.role === 'admin' && authToken) {
      fetchAdminUsers(authToken);
    }
    showToast(`Pembayaran pesanan ${orderId} terverifikasi`);
    return data.order as Order;
  };

  const handleCreateProduct = async (
    payload: Omit<Product, 'id' | 'rating' | 'soldCount' | 'createdAt' | 'sellerId'> & {
      sellerId?: string;
    }
  ) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menambah produk.');
    setProducts((prev) => [data.product, ...prev]);
    if (Array.isArray(data.sellers)) {
      setSellers(data.sellers);
    }
    showToast(`Produk "${data.product.name}" berhasil dipublikasikan`);
  };

  const handleUpdateProduct = async (id: string, patch: Partial<Product>) => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui produk.');
    setProducts((prev) => prev.map((p) => (p.id === id ? data.product : p)));
    showToast(`Inventaris "${data.product.name}" diperbarui`);
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus produk.');
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((item) => item.productId !== id));
    showToast('Produk dihapus dari inventaris');
  };

  const handleAdvanceOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    courierDriver?: string,
    courierPhone?: string
  ) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, courierDriver, courierPhone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui status pesanan.');
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
    if (currentUser?.role === 'admin' && authToken) {
      fetchAdminUsers(authToken);
    }
    showToast(`Status pesanan ${orderId} diperbarui: ${nextStatus}`);
  };

  const handleCreateDriver = async (payload: Omit<CourierDriver, 'id'>) => {
    const res = await fetch('/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal mendaftarkan petugas kurir.');
    setDrivers(data.drivers ?? []);
    showToast(`Petugas kurir "${data.driver.name}" berhasil didaftarkan`);
  };

  const handleUpdateDriver = async (
    id: string,
    patch: Partial<Omit<CourierDriver, 'id'>>
  ) => {
    const res = await fetch(`/api/drivers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui petugas kurir.');
    setDrivers(data.drivers ?? []);
    showToast(`Data petugas "${data.driver.name}" diperbarui`);
  };

  const handleDeleteDriver = async (id: string) => {
    const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus petugas kurir.');
    setDrivers(data.drivers ?? []);
    showToast('Petugas kurir dihapus dari daftar');
  };

  const handleCreatePaymentMethod = async (payload: Omit<PaymentMethod, 'id'>) => {
    if (!authToken) return;
    const res = await fetch('/api/payment-methods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menambah kanal pembayaran.');
    setPaymentMethods(data.paymentMethods ?? []);
    showToast(`Kanal pembayaran "${data.paymentMethod.name}" ditambahkan`);
  };

  const handleUpdatePaymentMethod = async (
    id: string,
    patch: Partial<Omit<PaymentMethod, 'id'>>
  ) => {
    if (!authToken) return;
    const res = await fetch(`/api/payment-methods/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui kanal pembayaran.');
    setPaymentMethods(data.paymentMethods ?? []);
    showToast(`Kanal "${data.paymentMethod.name}" diperbarui`);
  };

  const handleDeletePaymentMethod = async (id: string) => {
    if (!authToken) return;
    const res = await fetch(`/api/payment-methods/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menghapus kanal pembayaran.');
    setPaymentMethods(data.paymentMethods ?? []);
    showToast('Kanal pembayaran dihapus dari daftar resmi forum');
  };

  const handleSelectTab = useCallback(
    (tab: ActiveTab) => {
      if (!allowedTabs.includes(tab)) return;
      setActiveTab(tab);
      if (tab === 'admin' && currentUser?.role === 'admin' && authToken) {
        fetchAdminUsers(authToken);
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [allowedTabs, authToken, currentUser?.role, fetchAdminUsers]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-slate-900">
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        currentUser={currentUser}
        onOpenAuth={(mode = 'login') => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {loadError && (
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-4 text-sm text-red-700"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={fetchBootstrap}
              className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-xs font-semibold hover:bg-red-50 cursor-pointer"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'katalog' && (
          <StorefrontView
            products={products}
            isLoading={isLoading}
            onSelectProduct={setSelectedProduct}
            onQuickAddToCart={(prod) => handleAddToCart(prod, 1, false)}
            onOpenSellerDashboard={
              allowedTabs.includes('penjual') ? () => handleSelectTab('penjual') : undefined
            }
            onOpenCourierDirectory={
              allowedTabs.includes('kurir') ? () => handleSelectTab('kurir') : undefined
            }
            onOpenTrackOrder={() => handleSelectTab('lacak')}
          />
        )}

        {activeTab === 'lacak' && (
          <OrderTrackerView
            orders={orders}
            initialQuery={trackingQuery}
            onConfirmPayment={handleConfirmPayment}
          />
        )}

        {activeTab === 'kurir' && allowedTabs.includes('kurir') && (
          <CourierDirectoryView
            drivers={drivers}
            paymentMethods={paymentMethods}
            onCreateDriver={handleCreateDriver}
            onUpdateDriver={handleUpdateDriver}
            onDeleteDriver={handleDeleteDriver}
          />
        )}

        {activeTab === 'penjual' && allowedTabs.includes('penjual') && (
          <SellerDashboard
            products={products}
            orders={orders}
            sellers={sellers}
            drivers={drivers}
            currentUser={currentUser}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onAdvanceOrderStatus={handleAdvanceOrderStatus}
            onConfirmOrderPayment={handleConfirmPayment}
          />
        )}

        {activeTab === 'admin' && currentUser?.role === 'admin' && authToken && (
          <AdminDashboard
            authToken={authToken}
            users={adminUsers}
            sheetsConfig={sheetsConfig}
            kasWallet={kasWallet}
            paymentMethods={paymentMethods}
            onRefreshUsers={() => fetchAdminUsers(authToken)}
            onApproveUser={handleApproveUser}
            onWithdrawKas={handleWithdrawKas}
            onCreatePaymentMethod={handleCreatePaymentMethod}
            onUpdatePaymentMethod={handleUpdatePaymentMethod}
            onDeletePaymentMethod={handleDeletePaymentMethod}
            onSheetsSynced={(config, updatedUsers) => {
              setSheetsConfig(config);
              setAdminUsers(updatedUsers);
            }}
            onNotify={showToast}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p className="font-display font-bold text-slate-900 text-sm">
              FORUM UMKM IKM KECAMATAN CISARUA
            </p>
            <p className="mt-1">
              Sekretariat Koperasi & Gerai Bersama: Jl. Raya Puncak KM 81, Kec. Cisarua, Kab. Bogor 16750
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {allowedTabs.includes('admin') && (
              <button
                type="button"
                onClick={() => handleSelectTab('admin')}
                className="hover:text-slate-900 cursor-pointer"
              >
                Dasbor Admin
              </button>
            )}
            {allowedTabs.includes('katalog') && (
              <button
                type="button"
                onClick={() => handleSelectTab('katalog')}
                className="hover:text-slate-900 cursor-pointer"
              >
                Katalog Produk
              </button>
            )}
            {allowedTabs.includes('lacak') && (
              <button
                type="button"
                onClick={() => handleSelectTab('lacak')}
                className="hover:text-slate-900 cursor-pointer"
              >
                Lacak Resi
              </button>
            )}
            {allowedTabs.includes('kurir') && (
              <button
                type="button"
                onClick={() => handleSelectTab('kurir')}
                className="hover:text-slate-900 cursor-pointer"
              >
                Kurir Lokal
              </button>
            )}
            {allowedTabs.includes('penjual') && (
              <button
                type="button"
                onClick={() => handleSelectTab('penjual')}
                className="hover:text-slate-900 cursor-pointer"
              >
                Dasbor Penjual
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        products={products}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        products={products}
        paymentMethods={paymentMethods}
        currentUser={currentUser}
        onSubmitOrder={handleSubmitOrder}
        onConfirmPayment={handleConfirmPayment}
        onTrackOrder={(resi) => {
          setTrackingQuery(resi);
          handleSelectTab('lacak');
        }}
      />

      {/* Non-intrusive Action Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
