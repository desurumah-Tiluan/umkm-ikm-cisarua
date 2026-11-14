import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  CISARUA_DESA_LIST,
  COURIER_SERVICES,
  LOCAL_COURIER_DRIVERS,
  PAYMENT_METHODS,
  buildCustomerRecapRows,
  calculateKasWalletSummary,
  calculateOrderTotals,
  extractSpreadsheetId,
  generatePaymentCode,
  generateResiNumber,
  getNextOrderStatus,
  validateCheckoutInput,
  validateCourierDriverInput,
  validateKasWithdrawalInput,
  validateLoginInput,
  validatePaymentMethodInput,
  validateProductImageFile,
  validateProductInput,
  validateRegistrationInput,
  type ApprovalStatus,
  type CourierDriver,
  type CourierId,
  type CourierZoneType,
  type KasWithdrawal,
  type Order,
  type OrderLineItem,
  type OrderStatus,
  type PaymentMethod,
  type PaymentMethodId,
  type Product,
  type SheetsRecapConfig,
} from './src/lib/marketplace.ts';
import { hashPassword, signSessionToken, verifyPassword, verifySessionToken } from './server/auth.ts';
import {
  loadDatabase,
  resolveWritableDataDir,
  sanitizeUser,
  saveDatabase,
  type MarketplaceDatabase,
  type StoredUserAccount,
} from './server/store.ts';

function getAuthenticatedUser(req: express.Request, db: MarketplaceDatabase): StoredUserAccount | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = db.users.find((u) => u.id === payload.userId);
  if (!user || user.approvalStatus !== 'approved') return null;
  return user;
}

function getGoogleAccessTokenFromRequest(req: express.Request): string | null {
  const raw = req.headers['x-google-access-token'];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const cleaned = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw.trim();
  return cleaned || null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const UPLOADS_DIR = path.join(resolveWritableDataDir(), 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Upload custom product image (JPG or PNG)
  app.post('/api/uploads/product-image', (req, res) => {
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      res.status(400).json({
        message: 'Format foto tidak valid. Gunakan gambar JPG (.jpg/.jpeg) atau PNG (.png).',
      });
      return;
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const validation = validateProductImageFile(mimeType, buffer.length);
    if (!validation.valid || !validation.extension) {
      res.status(400).json({ message: validation.error || 'Foto produk tidak valid.' });
      return;
    }

    // Verify magic bytes for JPEG (FF D8 FF) or PNG (89 50 4E 47)
    const isJpegMagic =
      buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPngMagic =
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;

    if (
      (validation.extension === 'jpg' && !isJpegMagic) ||
      (validation.extension === 'png' && !isPngMagic)
    ) {
      res.status(400).json({
        message: 'Isi file gambar tidak sesuai dengan format JPG atau PNG yang valid.',
      });
      return;
    }

    const filename = `prod-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${validation.extension}`;
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

    res.status(201).json({ imageUrl: `/uploads/${filename}` });
  });

  // Bootstrap all marketplace data
  app.get('/api/bootstrap', (_req, res) => {
    const db = loadDatabase();
    res.json({
      sellers: db.sellers,
      products: db.products,
      orders: db.orders,
      desaList: CISARUA_DESA_LIST,
      couriers: COURIER_SERVICES,
      paymentMethods: db.paymentMethods,
      drivers: db.drivers,
    });
  });

  // Payment Channels CRUD (Admin / Pengurus manages Official Forum Payment Channels)
  app.get('/api/payment-methods', (_req, res) => {
    const db = loadDatabase();
    res.json({ paymentMethods: db.paymentMethods });
  });

  app.post('/api/payment-methods', (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin / Pengurus Forum UMKM IKM.' });
      return;
    }

    const validation = validatePaymentMethodInput(req.body ?? {});
    if (!validation.valid) {
      res.status(400).json({
        message: 'Data kanal pembayaran belum valid.',
        errors: validation.errors,
      });
      return;
    }

    const cleanName = String(req.body.name).trim();
    const type = req.body.type as 'qris' | 'va' | 'cod';
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 24);
    const id = `pm-${slug || type}-${Date.now().toString(36).slice(-4)}`;
    const accountNumber =
      typeof req.body.accountNumber === 'string' && req.body.accountNumber.trim()
        ? req.body.accountNumber.trim()
        : undefined;

    const newMethod: PaymentMethod = {
      id,
      name: cleanName,
      subtitle: String(req.body.subtitle).trim(),
      fee: Math.round(Number(req.body.fee ?? 0)),
      type,
      ...(accountNumber ? { accountNumber } : {}),
      ...(typeof req.body.bankCode === 'string' && req.body.bankCode.trim()
        ? { bankCode: req.body.bankCode.trim() }
        : {}),
      isActive: req.body.isActive !== false,
    };

    db.paymentMethods.push(newMethod);
    saveDatabase(db);
    res.status(201).json({ paymentMethod: newMethod, paymentMethods: db.paymentMethods });
  });

  app.patch('/api/payment-methods/:id', (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin / Pengurus Forum UMKM IKM.' });
      return;
    }

    const idx = db.paymentMethods.findIndex((pm) => pm.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ message: 'Kanal pembayaran tidak ditemukan.' });
      return;
    }

    const current = db.paymentMethods[idx];
    const nextIsActive =
      req.body?.isActive !== undefined ? Boolean(req.body.isActive) : current.isActive;

    if (!nextIsActive) {
      const otherActiveCount = db.paymentMethods.filter(
        (pm) => pm.id !== current.id && pm.isActive !== false
      ).length;
      if (otherActiveCount === 0) {
        res.status(400).json({
          message: 'Minimal 1 kanal pembayaran harus tetap aktif untuk transaksi checkout.',
        });
        return;
      }
    }

    const nextAccountNumber =
      req.body?.accountNumber !== undefined
        ? String(req.body.accountNumber).trim() || undefined
        : current.accountNumber;

    const candidate: PaymentMethod = {
      ...current,
      name: req.body?.name !== undefined ? String(req.body.name).trim() : current.name,
      subtitle:
        req.body?.subtitle !== undefined ? String(req.body.subtitle).trim() : current.subtitle,
      fee:
        req.body?.fee !== undefined ? Math.round(Number(req.body.fee)) : current.fee,
      type:
        req.body?.type === 'qris' || req.body?.type === 'va' || req.body?.type === 'cod'
          ? req.body.type
          : current.type,
      accountNumber: nextAccountNumber,
      isActive: nextIsActive,
    };

    const validation = validatePaymentMethodInput(candidate);
    if (!validation.valid) {
      res.status(400).json({
        message: 'Perubahan data kanal pembayaran belum valid.',
        errors: validation.errors,
      });
      return;
    }

    db.paymentMethods[idx] = candidate;
    saveDatabase(db);
    res.json({ paymentMethod: candidate, paymentMethods: db.paymentMethods });
  });

  app.delete('/api/payment-methods/:id', (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin / Pengurus Forum UMKM IKM.' });
      return;
    }

    const exists = db.paymentMethods.some((pm) => pm.id === req.params.id);
    if (!exists) {
      res.status(404).json({ message: 'Kanal pembayaran tidak ditemukan.' });
      return;
    }

    const remainingActive = db.paymentMethods.filter(
      (pm) => pm.id !== req.params.id && pm.isActive !== false
    );
    if (remainingActive.length === 0) {
      res.status(400).json({
        message: 'Tidak dapat menghapus kanal pembayaran aktif terakhir.',
      });
      return;
    }

    db.paymentMethods = db.paymentMethods.filter((pm) => pm.id !== req.params.id);
    saveDatabase(db);
    res.json({ deletedId: req.params.id, paymentMethods: db.paymentMethods });
  });

  // Courier drivers CRUD (list, register, edit, delete)
  app.get('/api/drivers', (_req, res) => {
    const db = loadDatabase();
    res.json({ drivers: db.drivers });
  });

  app.post('/api/drivers', (req, res) => {
    const validation = validateCourierDriverInput(req.body ?? {});
    if (!validation.valid) {
      res.status(400).json({
        message: 'Data petugas kurir desa belum valid.',
        errors: validation.errors,
      });
      return;
    }

    const db = loadDatabase();
    const newDriver: CourierDriver = {
      id: `drv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: String(req.body.name).trim(),
      phone: String(req.body.phone).trim(),
      zone: req.body.zone as CourierZoneType,
      area: String(req.body.area).trim(),
      isActive: req.body.isActive !== false,
    };

    db.drivers.unshift(newDriver);
    saveDatabase(db);
    res.status(201).json({ driver: newDriver, drivers: db.drivers });
  });

  app.patch('/api/drivers/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.drivers.findIndex((d) => d.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ message: 'Petugas kurir desa tidak ditemukan.' });
      return;
    }

    const current = db.drivers[idx];
    const candidate: CourierDriver = {
      ...current,
      name: req.body?.name !== undefined ? String(req.body.name).trim() : current.name,
      phone: req.body?.phone !== undefined ? String(req.body.phone).trim() : current.phone,
      zone: (req.body?.zone as CourierZoneType | undefined) ?? current.zone,
      area: req.body?.area !== undefined ? String(req.body.area).trim() : current.area,
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : current.isActive,
    };

    const validation = validateCourierDriverInput(candidate);
    if (!validation.valid) {
      res.status(400).json({
        message: 'Perubahan data petugas kurir belum valid.',
        errors: validation.errors,
      });
      return;
    }

    db.drivers[idx] = candidate;
    saveDatabase(db);
    res.json({ driver: candidate, drivers: db.drivers });
  });

  app.delete('/api/drivers/:id', (req, res) => {
    const db = loadDatabase();
    const exists = db.drivers.some((d) => d.id === req.params.id);
    if (!exists) {
      res.status(404).json({ message: 'Petugas kurir desa tidak ditemukan.' });
      return;
    }
    db.drivers = db.drivers.filter((d) => d.id !== req.params.id);
    saveDatabase(db);
    res.json({ deletedId: req.params.id, drivers: db.drivers });
  });

  // List products
  app.get('/api/products', (_req, res) => {
    const db = loadDatabase();
    res.json({ products: db.products });
  });

  // Create product (Seller self-service inventory)
  app.post('/api/products', (req, res) => {
    const validation = validateProductInput(req.body ?? {});
    if (!validation.valid) {
      res.status(400).json({ message: 'Data produk belum valid.', errors: validation.errors });
      return;
    }

    const db = loadDatabase();
    const {
      name,
      category,
      price,
      stock,
      weightGrams,
      sellerId,
      sellerName,
      desa,
      description,
      imageKey,
      isActive,
    } = req.body;

    const cleanSellerName = String(sellerName).trim();
    const matchedSeller = db.sellers.find(
      (s) => s.id === sellerId || s.name.toLowerCase() === cleanSellerName.toLowerCase()
    );

    let resolvedSellerId = matchedSeller?.id ?? `umkm-${Date.now()}`;
    if (!matchedSeller) {
      db.sellers.push({
        id: resolvedSellerId,
        name: cleanSellerName,
        ownerName: cleanSellerName,
        desa: String(desa).trim(),
        phone: '0812-0000-0000',
        joinedYear: new Date().getFullYear(),
      });
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(name).trim(),
      category,
      price: Math.round(Number(price)),
      stock: Math.round(Number(stock)),
      weightGrams: Math.round(Number(weightGrams)),
      sellerId: resolvedSellerId,
      sellerName: cleanSellerName,
      desa: String(desa).trim(),
      description: String(description).trim(),
      imageKey: typeof imageKey === 'string' && imageKey.trim() ? imageKey.trim() : 'kopi',
      rating: 5.0,
      soldCount: 0,
      isActive: isActive !== false,
      createdAt: new Date().toISOString(),
    };

    db.products.unshift(newProduct);
    saveDatabase(db);
    res.status(201).json({ product: newProduct, sellers: db.sellers });
  });

  // Update product (Seller self-service inventory)
  app.patch('/api/products/:id', (req, res) => {
    const db = loadDatabase();
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ message: 'Produk tidak ditemukan.' });
      return;
    }

    const current = db.products[idx];
    const candidate = {
      ...current,
      ...req.body,
      price: req.body.price !== undefined ? Math.round(Number(req.body.price)) : current.price,
      stock: req.body.stock !== undefined ? Math.round(Number(req.body.stock)) : current.stock,
      weightGrams:
        req.body.weightGrams !== undefined
          ? Math.round(Number(req.body.weightGrams))
          : current.weightGrams,
    };

    const validation = validateProductInput(candidate);
    if (!validation.valid) {
      res.status(400).json({ message: 'Perubahan data produk tidak valid.', errors: validation.errors });
      return;
    }

    db.products[idx] = candidate;
    saveDatabase(db);
    res.json({ product: candidate });
  });

  // Delete product
  app.delete('/api/products/:id', (req, res) => {
    const db = loadDatabase();
    const exists = db.products.some((p) => p.id === req.params.id);
    if (!exists) {
      res.status(404).json({ message: 'Produk tidak ditemukan.' });
      return;
    }
    db.products = db.products.filter((p) => p.id !== req.params.id);
    saveDatabase(db);
    res.json({ deletedId: req.params.id });
  });

  // Create order & payment checkout
  app.post('/api/orders', (req, res) => {
    const {
      buyerName,
      buyerPhone,
      destinationDesaId,
      addressDetail,
      courierId,
      paymentMethodId,
      items,
    } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Keranjang belanja masih kosong.' });
      return;
    }

    const db = loadDatabase();
    const selectedPayment = db.paymentMethods.find((p) => p.id === paymentMethodId);
    if (!selectedPayment || selectedPayment.isActive === false) {
      res.status(400).json({ message: 'Kanal pembayaran tidak tersedia atau sedang dinonaktifkan.' });
      return;
    }

    const checkoutValidation = validateCheckoutInput({
      buyerName,
      buyerPhone,
      destinationDesaId,
      addressDetail,
      courierId,
      paymentMethodId,
      paymentType: selectedPayment.type,
    });
    if (!checkoutValidation.valid) {
      res.status(400).json({
        message: 'Mohon lengkapi data penerima dan pengiriman.',
        errors: checkoutValidation.errors,
      });
      return;
    }

    const orderLines: OrderLineItem[] = [];

    for (const reqItem of items) {
      const product = db.products.find((p) => p.id === reqItem.productId);
      const qty = Number(reqItem.quantity);
      if (!product || !product.isActive) {
        res.status(400).json({ message: 'Salah satu produk tidak tersedia.' });
        return;
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > product.stock) {
        res.status(400).json({
          message: `Stok "${product.name}" tidak mencukupi (tersisa ${product.stock}).`,
        });
        return;
      }
      orderLines.push({
        productId: product.id,
        productName: product.name,
        sellerName: product.sellerName,
        desa: product.desa,
        unitPrice: product.price,
        weightGrams: product.weightGrams,
        quantity: qty,
        imageKey: product.imageKey,
      });
    }

    const totals = calculateOrderTotals(
      orderLines,
      courierId as CourierId,
      destinationDesaId,
      paymentMethodId as PaymentMethodId,
      db.paymentMethods
    );

    const courier = COURIER_SERVICES.find((c) => c.id === courierId) ?? COURIER_SERVICES[0];
    const desa = CISARUA_DESA_LIST.find((d) => d.id === destinationDesaId) ?? CISARUA_DESA_LIST[0];
    const payment = selectedPayment;

    // Decrement stock & increment sold count
    for (const line of orderLines) {
      const prod = db.products.find((p) => p.id === line.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - line.quantity);
        prod.soldCount += line.quantity;
      }
    }

    db.orderSequence += 1;
    const seq = db.orderSequence;
    const now = new Date().toISOString();
    const isCod = payment.type === 'cod';
    const initialStatus: OrderStatus = isCod
      ? 'Menunggu Penjemputan Kurir'
      : 'Menunggu Pembayaran';

    const newOrder: Order = {
      id: `ORD-2026-${String(seq).padStart(4, '0')}`,
      resi: generateResiNumber(courier.id, seq),
      buyerName: String(buyerName).trim(),
      buyerPhone: String(buyerPhone).trim(),
      destinationDesaId: desa.id,
      destinationDesaName: desa.name,
      addressDetail:
        courier.id === 'pickup-koperasi'
          ? 'Ambil di Gerai Koperasi UMKM IKM Kec. Cisarua, Jl. Raya Puncak KM 81'
          : String(addressDetail).trim(),
      courierId: courier.id,
      courierName: courier.name,
      paymentMethodId: payment.id,
      paymentMethodName: payment.name,
      paymentCode: generatePaymentCode(payment, seq),
      isPaid: false,
      status: initialStatus,
      items: orderLines,
      subtotal: totals.subtotal,
      totalWeightGrams: totals.totalWeightGrams,
      shippingCost: totals.shippingCost,
      shippingDiscount: totals.shippingDiscount,
      serviceFee: totals.serviceFee,
      buyerAdminFee: totals.buyerAdminFee,
      sellerAdminFee: totals.sellerAdminFee,
      sellerNetAmount: totals.sellerNetAmount,
      grandTotal: totals.grandTotal,
      createdAt: now,
      timeline: [
        {
          timestamp: now,
          status: 'Pesanan Dibuat',
          note: isCod
            ? `Pesanan COD dibuat untuk ${desa.name}. Menunggu kurir ${courier.name}.`
            : `Tagihan ${payment.name} dibuat. Silakan selesaikan pembayaran.`,
        },
      ],
    };

    db.orders.unshift(newOrder);
    saveDatabase(db);
    res.status(201).json({ order: newOrder, products: db.products });
  });

  // Confirm payment (QRIS / Virtual Account verification)
  app.post('/api/orders/:id/pay', (req, res) => {
    const db = loadDatabase();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
      return;
    }

    if (!order.isPaid) {
      order.isPaid = true;
      if (order.status === 'Menunggu Pembayaran') {
        order.status = 'Menunggu Penjemputan Kurir';
      }
      order.timeline.push({
        timestamp: new Date().toISOString(),
        status: 'Pembayaran Terverifikasi',
        note: `Pembayaran via ${order.paymentMethodName} (${order.paymentCode}) berhasil dikonfirmasi.`,
      });
      saveDatabase(db);
    }

    res.json({ order });
  });

  // Update order status & assign local courier driver
  app.patch('/api/orders/:id/status', (req, res) => {
    const db = loadDatabase();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
      return;
    }

    const requestedStatus = req.body?.status as OrderStatus | undefined;
    const nextStatus = requestedStatus ?? getNextOrderStatus(order.status);
    if (!nextStatus) {
      res.status(400).json({ message: 'Pesanan sudah berstatus Selesai.' });
      return;
    }

    if (req.body?.courierDriver) {
      order.courierDriver = String(req.body.courierDriver).trim();
    } else if (nextStatus === 'Dalam Pengiriman Kurir Lokal' && !order.courierDriver) {
      const driverPool = db.drivers.filter((d) => d.isActive);
      const pool = driverPool.length > 0 ? driverPool : db.drivers.length > 0 ? db.drivers : LOCAL_COURIER_DRIVERS;
      const driver = pool[db.orders.indexOf(order) % pool.length];
      order.courierDriver = driver.name;
      order.courierPhone = driver.phone;
    }

    if (req.body?.courierPhone) {
      order.courierPhone = String(req.body.courierPhone).trim();
    }

    if (nextStatus === 'Selesai') {
      order.isPaid = true;
    }

    order.status = nextStatus;
    const noteMap: Record<OrderStatus, string> = {
      'Menunggu Pembayaran': 'Menunggu konfirmasi pembayaran pembeli.',
      'Menunggu Penjemputan Kurir': 'Penjual mengemas produk. Kurir lokal dijadwalkan menjemput paket.',
      'Dalam Pengiriman Kurir Lokal': `Paket sedang diantar oleh ${order.courierDriver ?? 'Kurir Lokal Cisarua'} menuju ${order.destinationDesaName}.`,
      Selesai: 'Paket telah diterima oleh pembeli dan transaksi selesai.',
    };

    order.timeline.push({
      timestamp: new Date().toISOString(),
      status: nextStatus,
      note: noteMap[nextStatus],
    });

    saveDatabase(db);
    res.json({ order });
  });

  // Lookup order by ID or Resi
  app.get('/api/orders/:query', (req, res) => {
    const db = loadDatabase();
    const q = req.params.query.trim().toLowerCase();
    const order = db.orders.find(
      (o) => o.id.toLowerCase() === q || o.resi.toLowerCase() === q
    );
    if (!order) {
      res.status(404).json({ message: 'Nomor pesanan atau resi tidak ditemukan.' });
      return;
    }
    res.json({ order });
  });

  // Register new Pelanggan or Penjual via Email (Pending Admin Approval)
  app.post('/api/auth/register', (req, res) => {
    const validation = validateRegistrationInput(req.body ?? {});
    if (!validation.valid) {
      res.status(400).json({ message: 'Data pendaftaran belum lengkap atau tidak valid.', errors: validation.errors });
      return;
    }

    const db = loadDatabase();
    const email = String(req.body.email).trim().toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      res.status(409).json({
        message: 'Email ini sudah terdaftar. Silakan masuk atau tunggu persetujuan Admin.',
        errors: { email: 'Email sudah terdaftar.' },
      });
      return;
    }

    const role = req.body.role as 'pelanggan' | 'penjual';
    const newUser: StoredUserAccount = {
      id: `usr-${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      role,
      name: String(req.body.name).trim(),
      email,
      phone: String(req.body.phone).trim(),
      desa: String(req.body.desa).trim(),
      address: String(req.body.address).trim(),
      ...(role === 'penjual' ? { storeName: String(req.body.storeName).trim() } : {}),
      approvalStatus: 'pending',
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(String(req.body.password)),
    };

    db.users.unshift(newUser);
    saveDatabase(db);

    res.status(201).json({
      user: sanitizeUser(newUser),
      message:
        role === 'pelanggan'
          ? 'Pendaftaran Pelanggan berhasil dikirim. Menunggu persetujuan Admin dan rekap Google Sheet.'
          : 'Pendaftaran Penjual UMKM IKM berhasil dikirim. Menunggu persetujuan Admin.',
    });
  });

  // Login for Admin, Pelanggan, or Penjual
  app.post('/api/auth/login', (req, res) => {
    const validation = validateLoginInput(req.body ?? {});
    if (!validation.valid) {
      res.status(400).json({ message: 'Email dan kata sandi wajib diisi.', errors: validation.errors });
      return;
    }

    const db = loadDatabase();
    const email = String(req.body.email).trim().toLowerCase();
    const password = String(req.body.password);
    const user = db.users.find((u) => u.email.toLowerCase() === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ message: 'Email atau kata sandi salah.' });
      return;
    }

    if (user.approvalStatus === 'pending') {
      res.status(403).json({
        message:
          'Akun Anda masih menunggu persetujuan Admin Forum UMKM IKM. Silakan hubungi pengurus atau coba lagi setelah disetujui.',
        approvalStatus: 'pending',
      });
      return;
    }

    if (user.approvalStatus === 'rejected') {
      res.status(403).json({
        message: 'Pendaftaran akun Anda ditolak oleh Admin Forum UMKM IKM.',
        approvalStatus: 'rejected',
      });
      return;
    }

    const token = signSessionToken({ userId: user.id, role: user.role });
    res.json({ user: sanitizeUser(user), token });
  });

  // Restore authenticated user session
  app.get('/api/auth/me', (req, res) => {
    const db = loadDatabase();
    const user = getAuthenticatedUser(req, db);
    if (!user) {
      res.status(401).json({ message: 'Sesi tidak valid atau telah berakhir.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  // Admin: list registered Pelanggan & Penjual accounts + Sheets status + Kas Wallet
  app.get('/api/admin/users', (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }
    res.json({
      users: db.users.map(sanitizeUser),
      sheetsConfig: db.sheetsConfig,
      kasWallet: calculateKasWalletSummary(db.orders, db.kasWithdrawals),
    });
  });

  // Admin: record kas operational withdrawal
  app.post('/api/admin/kas/withdraw', (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const currentWallet = calculateKasWalletSummary(db.orders, db.kasWithdrawals);
    const validation = validateKasWithdrawalInput(
      {
        amount: req.body?.amount,
        note: req.body?.note,
      },
      currentWallet.availableBalance
    );
    if (!validation.valid) {
      res.status(400).json({
        message: 'Data penarikan kas belum valid.',
        errors: validation.errors,
      });
      return;
    }

    const withdrawal: KasWithdrawal = {
      id: `kas-wd-${Date.now().toString(36)}`,
      amount: Math.round(Number(req.body.amount)),
      note: String(req.body.note).trim(),
      createdBy: admin.name,
      createdAt: new Date().toISOString(),
    };
    db.kasWithdrawals.unshift(withdrawal);
    saveDatabase(db);

    res.status(201).json({
      withdrawal,
      kasWallet: calculateKasWalletSummary(db.orders, db.kasWithdrawals),
    });
  });

  // Admin: approve or reject Pelanggan / Penjual registration
  app.patch('/api/admin/users/:id/approval', (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ message: 'Akun pendaftar tidak ditemukan.' });
      return;
    }
    if (user.role === 'admin') {
      res.status(400).json({ message: 'Status akun Admin utama tidak dapat diubah.' });
      return;
    }

    const nextStatus = req.body?.approvalStatus as ApprovalStatus | undefined;
    if (nextStatus !== 'approved' && nextStatus !== 'rejected') {
      res.status(400).json({ message: 'Status persetujuan harus approved atau rejected.' });
      return;
    }

    user.approvalStatus = nextStatus;
    if (nextStatus === 'approved') {
      user.approvedAt = new Date().toISOString();
      if (user.role === 'penjual' && user.storeName) {
        const cleanStore = user.storeName.trim();
        let matchedSeller = db.sellers.find(
          (s) => s.id === user.sellerId || s.name.toLowerCase() === cleanStore.toLowerCase()
        );
        if (!matchedSeller) {
          matchedSeller = {
            id: `umkm-${Date.now().toString(36)}`,
            name: cleanStore,
            ownerName: user.name,
            desa: user.desa,
            phone: user.phone,
            joinedYear: new Date().getFullYear(),
          };
          db.sellers.push(matchedSeller);
        }
        user.sellerId = matchedSeller.id;
      }
    }

    saveDatabase(db);
    res.json({
      user: sanitizeUser(user),
      users: db.users.map(sanitizeUser),
      sellers: db.sellers,
    });
  });

  // Admin: Create new Google Sheet and write approved Pelanggan recap rows
  app.post('/api/sheets/create', async (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const googleToken = getGoogleAccessTokenFromRequest(req);
    if (!googleToken) {
      res.status(401).json({ message: 'Silakan masuk dengan Google terlebih dahulu untuk mengakses Google Sheets.' });
      return;
    }

    try {
      const requestedTitle =
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim()
          : 'Rekap Pelanggan Forum UMKM IKM Kecamatan Cisarua';
      const tabTitle = 'Rekap Pelanggan';

      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: requestedTitle },
          sheets: [{ properties: { title: tabTitle } }],
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        res.status(createRes.status).json({
          message: createData?.error?.message || 'Gagal membuat Google Sheet baru.',
        });
        return;
      }

      const spreadsheetId = createData.spreadsheetId as string;
      const spreadsheetUrl = createData.spreadsheetUrl as string;
      const rows = buildCustomerRecapRows(db.users.map(sanitizeUser));
      const range = `${tabTitle}!A1`;

      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows }),
        }
      );

      if (!writeRes.ok) {
        const writeErr = await writeRes.json();
        res.status(writeRes.status).json({
          message: writeErr?.error?.message || 'Spreadsheet dibuat, tetapi gagal menulis baris rekap.',
        });
        return;
      }

      const now = new Date().toISOString();
      const syncedCount = Math.max(0, rows.length - 1);
      for (const u of db.users) {
        if (u.role === 'pelanggan' && u.approvalStatus === 'approved') {
          u.syncedToSheetAt = now;
        }
      }

      const config: SheetsRecapConfig = {
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle: requestedTitle,
        lastSyncedAt: now,
        lastSyncedCount: syncedCount,
      };
      db.sheetsConfig = config;
      saveDatabase(db);

      res.json({
        sheetsConfig: config,
        users: db.users.map(sanitizeUser),
        syncedCount,
      });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Gagal terhubung ke Google Sheets API.',
      });
    }
  });

  // Admin: Sync approved Pelanggan recap rows to an existing Google Sheet
  app.post('/api/sheets/sync', async (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const googleToken = getGoogleAccessTokenFromRequest(req);
    if (!googleToken) {
      res.status(401).json({ message: 'Silakan masuk dengan Google terlebih dahulu untuk menyinkronkan Google Sheets.' });
      return;
    }

    const rawId =
      typeof req.body?.spreadsheetId === 'string' && req.body.spreadsheetId.trim()
        ? req.body.spreadsheetId
        : db.sheetsConfig?.spreadsheetId ?? '';
    const spreadsheetId = extractSpreadsheetId(rawId);

    if (!spreadsheetId) {
      res.status(400).json({ message: 'Masukkan ID atau URL Google Sheet, atau buat spreadsheet baru.' });
      return;
    }

    try {
      // Discover actual sheet tab name instead of hardcoding 'Sheet1'
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,spreadsheetUrl,sheets.properties.title`,
        {
          headers: { Authorization: `Bearer ${googleToken}` },
        }
      );
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        res.status(metaRes.status).json({
          message: metaData?.error?.message || 'Google Sheet tidak ditemukan atau akses ditolak.',
        });
        return;
      }

      const firstSheetTitle =
        (metaData?.sheets?.[0]?.properties?.title as string | undefined) || 'Sheet1';
      const spreadsheetTitle =
        (metaData?.properties?.title as string | undefined) || 'Rekap Pelanggan Forum UMKM IKM';
      const spreadsheetUrl =
        (metaData?.spreadsheetUrl as string | undefined) ||
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      const clearRange = `${firstSheetTitle}!A:J`;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleToken}` },
        }
      );

      const rows = buildCustomerRecapRows(db.users.map(sanitizeUser));
      const writeRange = `${firstSheetTitle}!A1`;
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ range: writeRange, majorDimension: 'ROWS', values: rows }),
        }
      );

      if (!writeRes.ok) {
        const writeErr = await writeRes.json();
        res.status(writeRes.status).json({
          message: writeErr?.error?.message || 'Gagal menulis data rekap pelanggan ke Google Sheet.',
        });
        return;
      }

      const now = new Date().toISOString();
      const syncedCount = Math.max(0, rows.length - 1);
      for (const u of db.users) {
        if (u.role === 'pelanggan' && u.approvalStatus === 'approved') {
          u.syncedToSheetAt = now;
        }
      }

      const config: SheetsRecapConfig = {
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle,
        lastSyncedAt: now,
        lastSyncedCount: syncedCount,
      };
      db.sheetsConfig = config;
      saveDatabase(db);

      res.json({
        sheetsConfig: config,
        users: db.users.map(sanitizeUser),
        syncedCount,
      });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Gagal menyinkronkan ke Google Sheets API.',
      });
    }
  });

  // Admin: List files in Google Drive (spreadsheets & archives)
  app.get('/api/drive/files', async (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const googleToken = getGoogleAccessTokenFromRequest(req);
    if (!googleToken) {
      res.status(401).json({ message: 'Silakan masuk dengan Google terlebih dahulu untuk mengakses Google Drive.' });
      return;
    }

    try {
      const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const escapedSearch = search.replace(/'/g, "\\'");
      const queryParts = ['trashed = false'];
      if (escapedSearch) {
        queryParts.push(`name contains '${escapedSearch}'`);
      }

      const params = new URLSearchParams({
        pageSize: '20',
        orderBy: 'modifiedTime desc',
        fields: 'files(id,name,mimeType,modifiedTime,webViewLink,size)',
        q: queryParts.join(' and '),
      });

      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      const driveData = await driveRes.json();
      if (!driveRes.ok) {
        res.status(driveRes.status).json({
          message: driveData?.error?.message || 'Gagal membaca daftar file Google Drive.',
        });
        return;
      }

      res.json({ files: driveData.files ?? [] });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Gagal terhubung ke Google Drive API.',
      });
    }
  });

  // Admin: Upload JSON backup snapshot of Forum UMKM IKM data to Google Drive
  app.post('/api/drive/backup', async (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const googleToken = getGoogleAccessTokenFromRequest(req);
    if (!googleToken) {
      res.status(401).json({ message: 'Silakan masuk dengan Google terlebih dahulu untuk mengunggah arsip ke Google Drive.' });
      return;
    }

    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const customName =
        typeof req.body?.fileName === 'string' && req.body.fileName.trim()
          ? req.body.fileName.trim()
          : `Arsip-Forum-UMKM-IKM-Cisarua-${dateStamp}.json`;
      const fileName = customName.endsWith('.json') ? customName : `${customName}.json`;

      const snapshotPayload = {
        exportedAt: new Date().toISOString(),
        organization: 'FORUM UMKM IKM KECAMATAN CISARUA',
        summary: {
          sellersCount: db.sellers.length,
          productsCount: db.products.length,
          ordersCount: db.orders.length,
          approvedCustomersCount: db.users.filter(
            (u) => u.role === 'pelanggan' && u.approvalStatus === 'approved'
          ).length,
        },
        sellers: db.sellers,
        products: db.products,
        orders: db.orders,
        members: db.users.map(sanitizeUser),
      };

      const boundary = `cisarua_drive_boundary_${Date.now()}`;
      const metadataPart = JSON.stringify({
        name: fileName,
        mimeType: 'application/json',
        description: 'Cadangan data katalog, pesanan kurir lokal, dan anggota Forum UMKM IKM Kecamatan Cisarua',
      });
      const contentPart = JSON.stringify(snapshotPayload, null, 2);

      const multipartBody = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadataPart,
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        contentPart,
        `--${boundary}--`,
      ].join('\r\n');

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,size',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        res.status(uploadRes.status).json({
          message: uploadData?.error?.message || 'Gagal mengunggah arsip ke Google Drive.',
        });
        return;
      }

      res.status(201).json({ file: uploadData });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Gagal mengunggah cadangan ke Google Drive.',
      });
    }
  });

  // Admin: Move a selected Google Drive file to Trash
  app.delete('/api/drive/files/:fileId', async (req, res) => {
    const db = loadDatabase();
    const admin = getAuthenticatedUser(req, db);
    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ message: 'Akses khusus Admin Forum UMKM IKM.' });
      return;
    }

    const googleToken = getGoogleAccessTokenFromRequest(req);
    if (!googleToken) {
      res.status(401).json({ message: 'Silakan masuk dengan Google terlebih dahulu.' });
      return;
    }

    try {
      const fileId = encodeURIComponent(req.params.fileId);
      const trashRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      });

      const trashData = await trashRes.json();
      if (!trashRes.ok) {
        res.status(trashRes.status).json({
          message: trashData?.error?.message || 'Gagal memindahkan file Google Drive ke sampah.',
        });
        return;
      }

      res.json({ trashedId: req.params.fileId });
    } catch (err) {
      res.status(500).json({
        message: err instanceof Error ? err.message : 'Gagal terhubung ke Google Drive API.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use('/api', (_req, res) => {
      res.status(404).json({ message: 'Endpoint API tidak ditemukan.' });
    });
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FORUM UMKM IKM KECAMATAN CISARUA server listening on http://localhost:${PORT}`);
  });
}

startServer();
