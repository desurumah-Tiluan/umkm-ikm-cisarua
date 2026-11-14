import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  HardDriveUpload,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  getGoogleAccessToken,
  googleSignIn,
  initGoogleAuth,
  logoutGoogle,
} from '../lib/googleSheetsAuth';
import {
  buildCustomerRecapRows,
  formatRupiah,
  validateKasWithdrawalInput,
  validatePaymentMethodInput,
  type ApprovalStatus,
  type DriveFileItem,
  type KasWalletSummary,
  type PaymentMethod,
  type SheetsRecapConfig,
  type UserAccount,
} from '../lib/marketplace';

interface AdminDashboardProps {
  authToken: string;
  users: UserAccount[];
  sheetsConfig: SheetsRecapConfig | null;
  kasWallet: KasWalletSummary | null;
  paymentMethods: PaymentMethod[];
  onRefreshUsers: () => Promise<void>;
  onApproveUser: (userId: string, approvalStatus: ApprovalStatus) => Promise<void>;
  onWithdrawKas: (amount: number, note: string) => Promise<void>;
  onCreatePaymentMethod: (payload: Omit<PaymentMethod, 'id'>) => Promise<void>;
  onUpdatePaymentMethod: (id: string, patch: Partial<Omit<PaymentMethod, 'id'>>) => Promise<void>;
  onDeletePaymentMethod: (id: string) => Promise<void>;
  onSheetsSynced: (config: SheetsRecapConfig, updatedUsers: UserAccount[]) => void;
  onNotify: (msg: string) => void;
}

type RoleFilter = 'all' | 'pelanggan' | 'penjual' | 'pending';

interface ConfirmWorkspaceAction {
  mode: 'sheets-create' | 'sheets-sync' | 'drive-backup' | 'drive-trash';
  title: string;
  description: string;
  targetLabel: string;
  spreadsheetIdInput?: string;
  driveFileId?: string;
}

function getDriveTypeLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheet';
  if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
  if (mimeType === 'application/vnd.google-apps.folder') return 'Folder';
  if (mimeType === 'application/json') return 'Arsip JSON';
  return 'File Drive';
}

type KasEntryFilter = 'all' | 'Masuk Kas' | 'Menunggu Bayar' | 'Penarikan';

interface PaymentMethodFormState {
  name: string;
  subtitle: string;
  fee: string;
  type: 'qris' | 'va' | 'cod';
  accountNumber: string;
  isActive: boolean;
}

const EMPTY_PM_FORM: PaymentMethodFormState = {
  name: '',
  subtitle: '',
  fee: '0',
  type: 'va',
  accountNumber: '',
  isActive: true,
};

const PAYMENT_TYPE_LABEL: Record<'qris' | 'va' | 'cod', string> = {
  qris: 'QRIS / Dompet Digital',
  va: 'Virtual Account / Transfer Bank',
  cod: 'COD (Tunai via Kurir Lokal)',
};

export function AdminDashboard({
  authToken,
  users,
  sheetsConfig,
  kasWallet,
  paymentMethods,
  onRefreshUsers,
  onApproveUser,
  onWithdrawKas,
  onCreatePaymentMethod,
  onUpdatePaymentMethod,
  onDeletePaymentMethod,
  onSheetsSynced,
  onNotify,
}: AdminDashboardProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [kasFilter, setKasFilter] = useState<KasEntryFilter>('all');
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawErrors, setWithdrawErrors] = useState<Record<string, string>>({});
  const [withdrawServerError, setWithdrawServerError] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [isPmModalOpen, setIsPmModalOpen] = useState(false);
  const [editingPm, setEditingPm] = useState<PaymentMethod | null>(null);
  const [pmForm, setPmForm] = useState<PaymentMethodFormState>(EMPTY_PM_FORM);
  const [pmErrors, setPmErrors] = useState<Record<string, string>>({});
  const [pmServerError, setPmServerError] = useState('');
  const [isSavingPm, setIsSavingPm] = useState(false);
  const [pmActionError, setPmActionError] = useState('');

  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(() => getGoogleAccessToken());
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [spreadsheetInput, setSpreadsheetInput] = useState(sheetsConfig?.spreadsheetId ?? '');
  const [newSheetTitle, setNewSheetTitle] = useState(
    'Rekap Pelanggan Forum UMKM IKM Kecamatan Cisarua'
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmWorkspaceAction | null>(null);
  const [isExecutingWorkspace, setIsExecutingWorkspace] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  const loadDriveFiles = useCallback(
    async (tokenOverride?: string, queryText?: string) => {
      const token = tokenOverride ?? getGoogleAccessToken() ?? googleToken;
      if (!token) return;
      setIsLoadingDrive(true);
      setWorkspaceError('');
      try {
        const q = (queryText ?? driveSearch).trim();
        const url = q ? `/api/drive/files?q=${encodeURIComponent(q)}` : '/api/drive/files';
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Google-Access-Token': token,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          setWorkspaceError(data.message || 'Gagal memuat file dari Google Drive.');
          return;
        }
        setDriveFiles((data.files as DriveFileItem[]) ?? []);
      } catch {
        setWorkspaceError('Gagal terhubung ke Google Drive.');
      } finally {
        setIsLoadingDrive(false);
      }
    },
    [authToken, driveSearch, googleToken]
  );

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setDriveFiles([]);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (sheetsConfig?.spreadsheetId && !spreadsheetInput) {
      setSpreadsheetInput(sheetsConfig.spreadsheetId);
    }
  }, [sheetsConfig, spreadsheetInput]);

  const nonAdminUsers = useMemo(
    () => users.filter((u) => u.role !== 'admin'),
    [users]
  );

  const pendingUsers = useMemo(
    () => nonAdminUsers.filter((u) => u.approvalStatus === 'pending'),
    [nonAdminUsers]
  );

  const approvedCustomers = useMemo(
    () => nonAdminUsers.filter((u) => u.role === 'pelanggan' && u.approvalStatus === 'approved'),
    [nonAdminUsers]
  );

  const approvedSellers = useMemo(
    () => nonAdminUsers.filter((u) => u.role === 'penjual' && u.approvalStatus === 'approved'),
    [nonAdminUsers]
  );

  const filteredUsers = useMemo(() => {
    return nonAdminUsers.filter((u) => {
      if (roleFilter === 'pending') return u.approvalStatus === 'pending';
      if (roleFilter === 'pelanggan') return u.role === 'pelanggan';
      if (roleFilter === 'penjual') return u.role === 'penjual';
      return true;
    });
  }, [nonAdminUsers, roleFilter]);

  const recapRows = useMemo(() => buildCustomerRecapRows(users), [users]);

  const filteredKasEntries = useMemo(() => {
    if (!kasWallet) return [];
    if (kasFilter === 'all') return kasWallet.entries;
    return kasWallet.entries.filter((entry) => entry.status === kasFilter);
  }, [kasWallet, kasFilter]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawServerError('');
    const available = kasWallet?.availableBalance ?? 0;
    const validation = validateKasWithdrawalInput(
      { amount: withdrawAmount, note: withdrawNote },
      available
    );
    if (!validation.valid) {
      setWithdrawErrors(validation.errors);
      return;
    }
    setWithdrawErrors({});
    setIsWithdrawing(true);
    try {
      await onWithdrawKas(Math.round(Number(withdrawAmount)), withdrawNote.trim());
      setWithdrawAmount('');
      setWithdrawNote('');
      setIsWithdrawOpen(false);
    } catch (err) {
      setWithdrawServerError(err instanceof Error ? err.message : 'Gagal mencatat penarikan kas.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const openCreatePmModal = () => {
    setEditingPm(null);
    setPmForm(EMPTY_PM_FORM);
    setPmErrors({});
    setPmServerError('');
    setPmActionError('');
    setIsPmModalOpen(true);
  };

  const openEditPmModal = (pm: PaymentMethod) => {
    setEditingPm(pm);
    setPmForm({
      name: pm.name,
      subtitle: pm.subtitle,
      fee: String(pm.fee),
      type: pm.type,
      accountNumber: pm.accountNumber ?? '',
      isActive: pm.isActive !== false,
    });
    setPmErrors({});
    setPmServerError('');
    setPmActionError('');
    setIsPmModalOpen(true);
  };

  const handleSavePm = async (e: React.FormEvent) => {
    e.preventDefault();
    setPmServerError('');
    const validation = validatePaymentMethodInput({
      name: pmForm.name,
      subtitle: pmForm.subtitle,
      fee: pmForm.fee,
      type: pmForm.type,
      accountNumber: pmForm.accountNumber,
    });
    if (!validation.valid) {
      setPmErrors(validation.errors);
      return;
    }

    setPmErrors({});
    setIsSavingPm(true);
    try {
      const payload: Omit<PaymentMethod, 'id'> = {
        name: pmForm.name.trim(),
        subtitle: pmForm.subtitle.trim(),
        fee: Math.round(Number(pmForm.fee || 0)),
        type: pmForm.type,
        accountNumber: pmForm.accountNumber.trim() || undefined,
        isActive: pmForm.isActive,
      };
      if (editingPm) {
        await onUpdatePaymentMethod(editingPm.id, payload);
      } else {
        await onCreatePaymentMethod(payload);
      }
      setIsPmModalOpen(false);
    } catch (err) {
      setPmServerError(
        err instanceof Error ? err.message : 'Gagal menyimpan kanal pembayaran.'
      );
    } finally {
      setIsSavingPm(false);
    }
  };

  const handleTogglePmActive = async (pm: PaymentMethod) => {
    setPmActionError('');
    try {
      await onUpdatePaymentMethod(pm.id, { isActive: !(pm.isActive !== false) });
    } catch (err) {
      setPmActionError(
        err instanceof Error ? err.message : 'Gagal mengubah status kanal pembayaran.'
      );
    }
  };

  const handleDeletePm = async (pm: PaymentMethod) => {
    setPmActionError('');
    try {
      await onDeletePaymentMethod(pm.id);
    } catch (err) {
      setPmActionError(
        err instanceof Error ? err.message : 'Gagal menghapus kanal pembayaran.'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setWorkspaceError('');
    setIsGoogleLoading(true);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setGoogleToken(result.accessToken);
      onNotify(`Terhubung ke Google Sheets & Drive sebagai ${result.user.email ?? 'Google User'}`);
      await loadDriveFiles(result.accessToken, '');
    } catch (err) {
      setWorkspaceError(
        err instanceof Error ? err.message : 'Gagal login dengan akun Google.'
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
    setDriveFiles([]);
    onNotify('Koneksi Google Sheets & Drive diputuskan');
  };

  const handleUserDecision = async (userId: string, status: ApprovalStatus) => {
    setProcessingUserId(userId);
    try {
      await onApproveUser(userId, status);
    } finally {
      setProcessingUserId(null);
    }
  };

  const executeConfirmedWorkspaceOperation = async () => {
    if (!confirmAction) return;
    const token = getGoogleAccessToken() ?? googleToken;
    if (!token) {
      setWorkspaceError('Sesi Google berakhir. Silakan Sign in with Google kembali.');
      setConfirmAction(null);
      return;
    }

    setWorkspaceError('');
    setIsExecutingWorkspace(true);
    try {
      if (confirmAction.mode === 'sheets-create' || confirmAction.mode === 'sheets-sync') {
        const endpoint =
          confirmAction.mode === 'sheets-create' ? '/api/sheets/create' : '/api/sheets/sync';
        const body =
          confirmAction.mode === 'sheets-create'
            ? { title: newSheetTitle.trim() || 'Rekap Pelanggan Forum UMKM IKM Kecamatan Cisarua' }
            : { spreadsheetId: confirmAction.spreadsheetIdInput ?? spreadsheetInput };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Google-Access-Token': token,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setWorkspaceError(data.message || 'Gagal menyinkronkan data ke Google Sheets.');
          setConfirmAction(null);
          return;
        }

        onSheetsSynced(data.sheetsConfig as SheetsRecapConfig, data.users as UserAccount[]);
        setSpreadsheetInput((data.sheetsConfig as SheetsRecapConfig).spreadsheetId);
        setConfirmAction(null);
        onNotify(
          `Berhasil merekap ${data.syncedCount} pelanggan disetujui ke Google Sheet`
        );
        await loadDriveFiles(token);
        return;
      }

      if (confirmAction.mode === 'drive-backup') {
        const res = await fetch('/api/drive/backup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Google-Access-Token': token,
          },
          body: JSON.stringify({ fileName: confirmAction.targetLabel }),
        });
        const data = await res.json();
        if (!res.ok) {
          setWorkspaceError(data.message || 'Gagal mencadangkan data ke Google Drive.');
          setConfirmAction(null);
          return;
        }
        setConfirmAction(null);
        onNotify(`Arsip "${data.file?.name ?? 'backup.json'}" tersimpan di Google Drive`);
        await loadDriveFiles(token);
        return;
      }

      if (confirmAction.mode === 'drive-trash' && confirmAction.driveFileId) {
        const res = await fetch(`/api/drive/files/${encodeURIComponent(confirmAction.driveFileId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Google-Access-Token': token,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          setWorkspaceError(data.message || 'Gagal memindahkan file Google Drive ke sampah.');
          setConfirmAction(null);
          return;
        }
        setDriveFiles((prev) => prev.filter((f) => f.id !== confirmAction.driveFileId));
        setConfirmAction(null);
        onNotify(`File "${confirmAction.targetLabel}" dipindahkan ke sampah Google Drive`);
      }
    } catch {
      setWorkspaceError('Terjadi kesalahan jaringan saat menghubungi Google Workspace API.');
      setConfirmAction(null);
    } finally {
      setIsExecutingWorkspace(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E256B] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Panel Administrasi · FORUM UMKM IKM KECAMATAN CISARUA</span>
          </p>
          <h1 className="font-display text-xl font-bold text-slate-900 mt-1">
            Verifikasi Pendaftaran Akun, Google Sheets & Google Drive
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Terima pendaftar Pelanggan & Penjual UMKM via email, rekap pelanggan ke Google Sheets, serta kelola arsip di Google Drive.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshUsers}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang Pendaftar</span>
        </button>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Menunggu Persetujuan</p>
          <p className="font-display text-2xl font-bold text-amber-600 mt-1 tabular-nums">
            {pendingUsers.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Pendaftar baru via email</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Pelanggan Diterima</p>
          <p className="font-display text-2xl font-bold text-[#00AA5B] mt-1 tabular-nums">
            {approvedCustomers.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Siap direkap ke Google Sheet</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Penjual UMKM IKM Aktif</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {approvedSellers.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Akun toko terverifikasi</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Rekap Google Sheet</p>
          <p className="font-display text-2xl font-bold text-[#1E256B] mt-1 tabular-nums">
            {sheetsConfig?.lastSyncedCount ?? 0} baris
          </p>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {sheetsConfig?.lastSyncedAt
              ? `Terakhir: ${new Date(sheetsConfig.lastSyncedAt).toLocaleString('id-ID')}`
              : 'Belum disinkronkan'}
          </p>
        </div>
      </div>

      {/* Dompet Saldo Kas Admin & Pengurus */}
      <section
        aria-labelledby="kas-wallet-heading"
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-[#00AA5B]" />
            </div>
            <div>
              <h2 id="kas-wallet-heading" className="font-display text-base font-bold text-slate-900">
                Dompet Saldo Kas Admin & Pengurus
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemasukan otomatis dari fee admin pembeli (Rp 1.000/checkout) dan potongan 5% transaksi penjual.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setWithdrawErrors({});
              setWithdrawServerError('');
              setIsWithdrawOpen((prev) => !prev);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E256B] hover:bg-[#171d56] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{isWithdrawOpen ? 'Tutup Form Penarikan' : 'Catat Penarikan Kas'}</span>
          </button>
        </div>

        {/* 4-Column Flat Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-[#F7F8FA]">
          <div className="p-4">
            <p className="text-xs text-slate-500">Saldo Kas Tersedia (Lunas)</p>
            <p
              data-testid="admin-kas-balance"
              className="font-display text-2xl font-bold text-[#00AA5B] mt-1 tabular-nums"
            >
              {formatRupiah(kasWallet?.availableBalance ?? 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Dari {kasWallet?.paidOrdersCount ?? 0} pesanan lunas
            </p>
          </div>

          <div className="p-4">
            <p className="text-xs text-slate-500">Fee Pembeli (Rp 1.000/checkout)</p>
            <p className="font-display text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatRupiah(kasWallet?.totalBuyerAdminFees ?? 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Akumulasi fee checkout masuk kas
            </p>
          </div>

          <div className="p-4">
            <p className="text-xs text-slate-500">Potongan Penjual (5%)</p>
            <p className="font-display text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatRupiah(kasWallet?.totalSellerAdminFees ?? 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kontribusi 5% dari omzet produk
            </p>
          </div>

          <div className="p-4">
            <p className="text-xs text-slate-500">Menunggu Pelunasan / Penarikan</p>
            <p className="font-display text-xl font-bold text-amber-700 mt-1 tabular-nums">
              {formatRupiah(kasWallet?.pendingBalance ?? 0)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {kasWallet?.pendingOrdersCount ?? 0} pesanan belum lunas · Ditarik {formatRupiah(kasWallet?.totalWithdrawn ?? 0)}
            </p>
          </div>
        </div>

        {/* Inline Withdrawal Form */}
        {isWithdrawOpen && (
          <form
            onSubmit={handleWithdrawSubmit}
            className="p-5 border-b border-slate-200 bg-white space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900">
                Catat Pengeluaran / Penarikan Saldo Kas Pengurus
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                Maksimal: {formatRupiah(kasWallet?.availableBalance ?? 0)}
              </span>
            </div>

            {withdrawServerError && (
              <p role="alert" className="text-xs text-red-600">
                {withdrawServerError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              <div className="sm:col-span-4">
                <label htmlFor="kas-withdraw-amount" className="block text-xs font-medium text-slate-700 mb-1">
                  Nominal Penarikan (Rp)
                </label>
                <input
                  id="kas-withdraw-amount"
                  type="number"
                  min={1000}
                  step={500}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Contoh: 5000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
                />
                {withdrawErrors.amount && (
                  <p className="text-xs text-red-600 mt-1">{withdrawErrors.amount}</p>
                )}
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="kas-withdraw-note" className="block text-xs font-medium text-slate-700 mb-1">
                  Keterangan Penggunaan Kas
                </label>
                <input
                  id="kas-withdraw-note"
                  type="text"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="Contoh: Operasional bazar UMKM & cetak resi koperasi"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {withdrawErrors.note && (
                  <p className="text-xs text-red-600 mt-1">{withdrawErrors.note}</p>
                )}
              </div>

              <div className="sm:col-span-2 sm:pt-5">
                <button
                  type="submit"
                  disabled={isWithdrawing}
                  className="w-full py-2 px-3 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isWithdrawing ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Ledger Table */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold text-slate-900">
            Riwayat Mutasi Dompet Kas ({filteredKasEntries.length})
          </h3>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Semua Mutasi' },
                { id: 'Masuk Kas', label: 'Masuk Kas' },
                { id: 'Menunggu Bayar', label: 'Menunggu Bayar' },
                { id: 'Penarikan', label: 'Penarikan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKasFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  kasFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredKasEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada mutasi kas pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Sumber Fee / Keterangan</th>
                  <th className="py-2.5 px-4">Detail Transaksi</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredKasEntries.map((entry) => {
                  const isNegative = entry.amount < 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          {isNegative ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-[#00AA5B] shrink-0" />
                          )}
                          <span>{entry.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{entry.detail}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            entry.status === 'Masuk Kas'
                              ? 'text-[#00AA5B]'
                              : entry.status === 'Menunggu Bayar'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                          isNegative
                            ? 'text-red-600'
                            : entry.status === 'Masuk Kas'
                            ? 'text-[#00AA5B]'
                            : 'text-slate-700'
                        }`}
                      >
                        {isNegative
                          ? `-${formatRupiah(Math.abs(entry.amount))}`
                          : `+${formatRupiah(entry.amount)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Kanal Pembayaran Resmi Forum */}
      <section
        aria-labelledby="payment-channels-heading"
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-[#00AA5B]" />
            </div>
            <div>
              <h2 id="payment-channels-heading" className="font-display text-base font-bold text-slate-900">
                Kanal Pembayaran Resmi Forum
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {paymentMethods.length} kanal terdaftar ·{' '}
                {paymentMethods.filter((pm) => pm.isActive !== false).length} aktif saat checkout pembeli
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreatePmModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kanal Pembayaran</span>
          </button>
        </div>

        {pmActionError && (
          <div
            role="alert"
            className="mx-5 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
          >
            {pmActionError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-5">Nama Kanal & Keterangan</th>
                <th className="py-2.5 px-4">Jenis</th>
                <th className="py-2.5 px-4">No. Rekening / Kode</th>
                <th className="py-2.5 px-4">Biaya Layanan</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-5 text-right">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paymentMethods.map((pm) => {
                const active = pm.isActive !== false;
                return (
                  <tr key={pm.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-900 text-sm">{pm.name}</p>
                      <p className="text-slate-500 mt-0.5">{pm.subtitle}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {PAYMENT_TYPE_LABEL[pm.type]}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {pm.accountNumber ? pm.accountNumber : '-'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {pm.fee === 0 ? 'Gratis (Rp 0)' : formatRupiah(pm.fee)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          active ? 'text-[#00AA5B]' : 'text-slate-400'
                        }`}
                      >
                        {active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePmActive(pm)}
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          {active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditPmModal(pm)}
                          aria-label={`Edit kanal ${pm.name}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePm(pm)}
                          aria-label={`Hapus kanal ${pm.name}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Applicant Approval Queue */}
        <section
          aria-labelledby="approval-queue-heading"
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 id="approval-queue-heading" className="font-display text-base font-bold text-slate-900">
              Daftar Pendaftaran Pelanggan & Penjual
            </h2>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'all', label: `Semua (${nonAdminUsers.length})` },
                  { id: 'pending', label: `Menunggu (${pendingUsers.length})` },
                  { id: 'pelanggan', label: 'Pelanggan' },
                  { id: 'penjual', label: 'Penjual' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                    roleFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Tidak ada pendaftar pada filter ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredUsers.map((u) => {
                const isPending = u.approvalStatus === 'pending';
                const isApproved = u.approvalStatus === 'approved';
                const isBusy = processingUserId === u.id;

                return (
                  <div key={u.id} className="p-4 space-y-3 hover:bg-slate-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            {u.role === 'penjual' ? (
                              <Store className="w-3.5 h-3.5 text-[#1E256B]" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-[#00AA5B]" />
                            )}
                            <span>{u.role === 'penjual' ? 'Penjual UMKM' : 'Pelanggan'}</span>
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span
                            className={`font-semibold ${
                              isApproved
                                ? 'text-[#00AA5B]'
                                : isPending
                                ? 'text-amber-700'
                                : 'text-red-600'
                            }`}
                          >
                            {isApproved
                              ? 'Diterima Admin'
                              : isPending
                              ? 'Menunggu Persetujuan'
                              : 'Ditolak'}
                          </span>
                          {u.syncedToSheetAt && u.role === 'pelanggan' && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="text-[#1E256B] font-medium">
                                Tercatat di Sheet
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="font-display text-sm font-bold text-slate-900">
                          {u.name}
                          {u.storeName ? ` — ${u.storeName}` : ''}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {u.email} · {u.phone}
                        </p>
                        <p className="text-xs text-slate-500">
                          {u.desa} · {u.address}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {u.approvalStatus !== 'approved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUserDecision(u.id, 'approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Terima</span>
                          </button>
                        )}
                        {u.approvalStatus !== 'rejected' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUserDecision(u.id, 'rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right 5 Cols: Google Sheets + Google Drive Workspace Panel */}
        <div className="lg:col-span-5 space-y-6">
          <section
            aria-labelledby="sheets-recap-heading"
            className="bg-white rounded-xl border border-slate-200 p-5 space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-[#00AA5B]" />
              </div>
              <div>
                <h2 id="sheets-recap-heading" className="font-display text-base font-bold text-slate-900">
                  Integrasi Google Sheets & Google Drive
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekap pelanggan ke Google Sheet dan kelola arsip file Forum UMKM IKM di Google Drive.
                </p>
              </div>
            </div>

            {workspaceError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
              >
                {workspaceError}
              </div>
            )}

            {!googleToken ? (
              <div className="p-4 rounded-xl bg-[#F7F8FA] border border-slate-200 space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Hubungkan akun Google Anda untuk mengakses Google Sheets (rekap pelanggan) dan Google Drive (jelajah file & arsip data forum).
                </p>

                {/* Official Sign in with Google button style */}
                <button
                  type="button"
                  disabled={isGoogleLoading}
                  onClick={handleGoogleSignIn}
                  className="gsi-material-button inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-md border border-[#747775] bg-white hover:bg-slate-50 text-[#1F1F1F] text-sm font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="gsi-material-button-icon w-5 h-5 shrink-0">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </span>
                  <span className="gsi-material-button-contents">
                    {isGoogleLoading ? 'Menghubungkan Google...' : 'Sign in with Google'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">Google Sheets & Drive Terhubung</p>
                    <p className="text-slate-600 truncate">
                      {googleUser?.email ?? 'Akun Google Terautentikasi'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogout}
                    className="px-2.5 py-1 rounded border border-emerald-300 bg-white text-slate-700 hover:bg-slate-50 font-medium cursor-pointer shrink-0"
                  >
                    Putuskan
                  </button>
                </div>

                {/* Sheets Create */}
                <div className="space-y-2">
                  <label htmlFor="new-sheet-title" className="block text-xs font-medium text-slate-700">
                    Buat Google Sheet Rekap Baru
                  </label>
                  <input
                    id="new-sheet-title"
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        mode: 'sheets-create',
                        title: 'Buat & Isi Google Sheet Rekap Baru?',
                        description: `Tindakan ini akan membuat Google Sheet baru dan menulis ${approvedCustomers.length} data pelanggan disetujui (total ${recapRows.length} baris termasuk header).`,
                        targetLabel: newSheetTitle.trim() || 'Rekap Pelanggan Forum UMKM IKM Kecamatan Cisarua',
                      })
                    }
                    className="w-full py-2 px-3 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-xs font-semibold cursor-pointer"
                  >
                    Buat Google Sheet & Kirim Rekap ({approvedCustomers.length} Pelanggan)
                  </button>
                </div>

                {/* Sheets Sync */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <label htmlFor="existing-sheet-id" className="block text-xs font-medium text-slate-700">
                    Sinkronkan ke Spreadsheet yang Sudah Ada (URL / ID / Pilih dari Drive)
                  </label>
                  <input
                    id="existing-sheet-id"
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => setSpreadsheetInput(e.target.value)}
                    placeholder="Tempel link https://docs.google.com/spreadsheets/d/... atau pilih dari Drive"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                  />
                  <button
                    type="button"
                    disabled={!spreadsheetInput.trim()}
                    onClick={() =>
                      setConfirmAction({
                        mode: 'sheets-sync',
                        title: 'Perbarui Data di Google Sheet?',
                        description: `Tindakan ini akan memperbarui tab pertama pada Google Sheet target dengan ${approvedCustomers.length} data pelanggan disetujui.`,
                        targetLabel: spreadsheetInput.trim(),
                        spreadsheetIdInput: spreadsheetInput.trim(),
                      })
                    }
                    className="w-full py-2 px-3 rounded-lg bg-[#1E256B] hover:bg-[#171d56] text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                  >
                    Sinkronkan Rekap Pelanggan ke Sheet
                  </button>
                </div>

                {/* Google Drive Archive & File Explorer */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-[#1E256B]" />
                      <span>Berkas & Arsip Google Drive</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          mode: 'drive-backup',
                          title: 'Unggah Arsip Forum UMKM IKM ke Google Drive?',
                          description:
                            'File cadangan JSON berisi katalog produk, daftar pesanan kurir lokal, dan data anggota akan diunggah ke Google Drive Anda.',
                          targetLabel: `Arsip-Forum-UMKM-IKM-Cisarua-${new Date().toISOString().slice(0, 10)}.json`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <HardDriveUpload className="w-3.5 h-3.5" />
                      <span>Cadangkan ke Drive</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={driveSearch}
                        onChange={(e) => setDriveSearch(e.target.value)}
                        placeholder="Cari file di Google Drive..."
                        aria-label="Cari file di Google Drive"
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isLoadingDrive}
                      onClick={() => loadDriveFiles()}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingDrive ? 'Memuat...' : 'Muat Drive'}
                    </button>
                  </div>

                  {driveFiles.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      {isLoadingDrive
                        ? 'Sedang mengambil daftar berkas dari Google Drive...'
                        : 'Klik "Muat Drive" untuk menelusuri Google Sheet atau arsip Anda.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                      {driveFiles.map((file) => {
                        const isSheet =
                          file.mimeType === 'application/vnd.google-apps.spreadsheet';
                        return (
                          <li
                            key={file.id}
                            className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{file.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {getDriveTypeLabel(file.mimeType)}
                                {file.modifiedTime
                                  ? ` · ${new Date(file.modifiedTime).toLocaleDateString('id-ID')}`
                                  : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSheet && (
                                <button
                                  type="button"
                                  onClick={() => setSpreadsheetInput(file.id)}
                                  className="px-2 py-1 rounded border border-[#00AA5B] text-[#00AA5B] hover:bg-emerald-50 text-[11px] font-semibold cursor-pointer"
                                >
                                  Pilih Sheet
                                </button>
                              )}
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Buka ${file.name} di Google Drive`}
                                  className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    mode: 'drive-trash',
                                    title: 'Pindahkan File ke Sampah Google Drive?',
                                    description:
                                      'File yang dipilih akan dipindahkan ke folder Sampah (Trash) di Google Drive Anda.',
                                    targetLabel: file.name,
                                    driveFileId: file.id,
                                  })
                                }
                                aria-label={`Pindahkan ${file.name} ke sampah`}
                                className="p-1.5 rounded border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {sheetsConfig && (
              <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 truncate">
                    {sheetsConfig.spreadsheetTitle}
                  </span>
                  <a
                    href={sheetsConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#00AA5B] hover:underline font-semibold shrink-0"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-500 font-mono truncate">
                  ID: {sheetsConfig.spreadsheetId}
                </p>
              </div>
            )}

            {/* Recap Preview Table */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-800">
                Pratinjau Baris Rekap ({approvedCustomers.length} Pelanggan Diterima)
              </h3>
              {approvedCustomers.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada pelanggan berstatus Diterima Admin.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#F7F8FA] border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2 px-2.5">No</th>
                        <th className="py-2 px-2.5">Nama</th>
                        <th className="py-2 px-2.5">Email</th>
                        <th className="py-2 px-2.5">Desa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {recapRows.slice(1).map((row) => (
                        <tr key={row[1]}>
                          <td className="py-1.5 px-2.5 tabular-nums text-slate-500">{row[0]}</td>
                          <td className="py-1.5 px-2.5 font-medium text-slate-900">{row[2]}</td>
                          <td className="py-1.5 px-2.5 text-slate-600">{row[3]}</td>
                          <td className="py-1.5 px-2.5 text-slate-600">{row[5]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Explicit Confirmation Dialog before modifying Google Sheets or Google Drive */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 id="workspace-confirm-title" className="font-display text-base font-bold text-slate-900">
                  {confirmAction.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmAction.description}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F7F8FA] border border-slate-200 text-xs space-y-1">
              <p className="text-slate-500">Target:</p>
              <p className="font-semibold text-slate-900 break-all">{confirmAction.targetLabel}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isExecutingWorkspace}
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isExecutingWorkspace}
                onClick={executeConfirmedWorkspaceOperation}
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                  confirmAction.mode === 'drive-trash'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#00AA5B] hover:bg-[#00944F]'
                }`}
              >
                {isExecutingWorkspace ? 'Memproses...' : 'Konfirmasi & Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Tambah / Edit Kanal Pembayaran Resmi Forum */}
      {isPmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-modal-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#00AA5B]" />
                <h2 id="pm-modal-title" className="font-display text-lg font-bold text-slate-900">
                  {editingPm ? 'Edit Kanal Pembayaran Resmi Forum' : 'Tambah Kanal Pembayaran Resmi'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPmModalOpen(false)}
                aria-label="Tutup form kanal pembayaran"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePm} className="p-6 space-y-4">
              {pmServerError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
                >
                  {pmServerError}
                </div>
              )}

              <div>
                <label htmlFor="pm-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Kanal Pembayaran
                </label>
                <input
                  id="pm-name"
                  type="text"
                  value={pmForm.name}
                  onChange={(e) => setPmForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Contoh: Transfer Bank Mandiri Koperasi"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {pmErrors.name && <p className="text-xs text-red-600 mt-1">{pmErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label htmlFor="pm-type" className="block text-xs font-medium text-slate-700 mb-1">
                    Jenis Kanal
                  </label>
                  <select
                    id="pm-type"
                    value={pmForm.type}
                    onChange={(e) =>
                      setPmForm((s) => ({
                        ...s,
                        type: e.target.value as 'qris' | 'va' | 'cod',
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#00AA5B]"
                  >
                    <option value="qris">QRIS / Dompet Digital</option>
                    <option value="va">Virtual Account / Transfer Bank</option>
                    <option value="cod">COD (Bayar di Tempat Kurir)</option>
                  </select>
                  {pmErrors.type && <p className="text-xs text-red-600 mt-1">{pmErrors.type}</p>}
                </div>

                <div className="sm:col-span-5">
                  <label htmlFor="pm-fee" className="block text-xs font-medium text-slate-700 mb-1">
                    Biaya Layanan (Rp)
                  </label>
                  <input
                    id="pm-fee"
                    type="number"
                    min={0}
                    step={500}
                    value={pmForm.fee}
                    onChange={(e) => setPmForm((s) => ({ ...s, fee: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-[#00AA5B]"
                  />
                  {pmErrors.fee && <p className="text-xs text-red-600 mt-1">{pmErrors.fee}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="pm-subtitle" className="block text-xs font-medium text-slate-700 mb-1">
                  Keterangan / Petunjuk Pembeli
                </label>
                <input
                  id="pm-subtitle"
                  type="text"
                  value={pmForm.subtitle}
                  onChange={(e) => setPmForm((s) => ({ ...s, subtitle: e.target.value }))}
                  placeholder="Contoh: a.n. Koperasi Forum UMKM IKM Kec. Cisarua"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#00AA5B]"
                />
                {pmErrors.subtitle && <p className="text-xs text-red-600 mt-1">{pmErrors.subtitle}</p>}
              </div>

              <div>
                <label htmlFor="pm-account" className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor Rekening / Kode Prefix VA / ID Merchant
                </label>
                <input
                  id="pm-account"
                  type="text"
                  value={pmForm.accountNumber}
                  onChange={(e) => setPmForm((s) => ({ ...s, accountNumber: e.target.value }))}
                  placeholder={
                    pmForm.type === 'cod'
                      ? 'Opsional untuk COD'
                      : pmForm.type === 'qris'
                      ? 'Contoh: QRIS-CISARUA'
                      : 'Contoh: 133-00-881675-9 atau 1100881675'
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-[#00AA5B]"
                />
                {pmErrors.accountNumber && (
                  <p className="text-xs text-red-600 mt-1">{pmErrors.accountNumber}</p>
                )}
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  id="pm-active"
                  type="checkbox"
                  checked={pmForm.isActive}
                  onChange={(e) => setPmForm((s) => ({ ...s, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-[#00AA5B] rounded"
                />
                <span className="text-xs font-medium text-slate-700">
                  Kanal aktif dan tersedia untuk pembeli saat checkout
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPmModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPm}
                  className="px-5 py-2 rounded-lg bg-[#00AA5B] hover:bg-[#00944F] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSavingPm
                    ? 'Menyimpan...'
                    : editingPm
                    ? 'Simpan Perubahan'
                    : 'Simpan Kanal Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
