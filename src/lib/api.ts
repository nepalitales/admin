const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787/api/admin";

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  [key: string]: unknown;
}

class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;

  constructor(message: string, status: number, errors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

// ─── Token Management for Cross-Origin SPAs ──────────────────────

const TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

// ─── In-Memory Cache & In-Flight Deduplication ───────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Default TTL: 2 minutes (sufficient to prevent redundant requests across tab navigation)
const DEFAULT_TTL_MS = 2 * 60 * 1000;

const cache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Invalidates cache entries matching a prefix, or clears all if no prefix is given.
 */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clears the entire in-memory cache.
 */
export function clearCache() {
  cache.clear();
}

/**
 * Automatically invalidates relevant caches based on the mutated endpoint.
 */
function handleMutationInvalidation(endpoint: string) {
  const clean = endpoint.split("?")[0];
  const root = clean.split("/").filter(Boolean)[0];

  if (!root) return;

  if (root === "auth") {
    clearCache();
  } else if (root === "categories") {
    // Category changes can affect product displays
    invalidateCache("/categories");
    invalidateCache("/products");
  } else {
    invalidateCache(`/${root}`);
  }
}

export interface RequestOptions extends RequestInit {
  forceRefresh?: boolean;
  ttlMs?: number;
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const cacheKey = endpoint;

  // 1. Check cache for GET requests unless forceRefresh is true
  if (isGet && !options.forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    // 2. Deduplicate simultaneous in-flight GET requests
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const url = `${API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const fetchPromise = (async (): Promise<T> => {
    try {
      const token = getAdminToken();
      const res = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (
          res.status === 401 &&
          (data.code === "SESSION_EXPIRED" ||
            data.message?.toLowerCase().includes("session expired") ||
            data.message?.toLowerCase().includes("authentication required"))
        ) {
          removeAdminToken();
        }
        throw new ApiError(
          data.message || "Something went wrong",
          res.status,
          data.errors,
        );
      }

      // 3. Cache successful GET responses
      if (isGet) {
        const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
        cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttl,
        });
      } else {
        // 4. On mutations, purge relevant caches
        handleMutationInvalidation(endpoint);
      }

      return data as T;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    } finally {
      if (isGet) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  if (isGet && !options.forceRefresh) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

// ─── Auth ────────────────────────────────────────────────────────

export interface Admin {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export async function login(identifier: string, password: string) {
  clearCache();
  const res = await request<{
    success: true;
    message: string;
    token?: string;
    admin: Admin;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  if (res.token) {
    setAdminToken(res.token);
  }
  return res;
}

export async function logout() {
  clearCache();
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    removeAdminToken();
  }
}

export async function getMe(options?: RequestOptions) {
  // Shorter TTL for session validation (1 minute)
  return request<{ success: true; admin: Admin }>("/auth/me", {
    ttlMs: 60 * 1000,
    ...options,
  });
}

// ─── Categories ──────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function getCategories(options?: RequestOptions) {
  return request<{ success: true; categories: Category[] }>("/categories", options);
}

export async function getCategory(id: string, options?: RequestOptions) {
  return request<{ success: true; category: Category }>(`/categories/${id}`, options);
}

export async function createCategory(data: { name: string; displayOrder?: number }) {
  return request<{ success: true; message: string; category: Category }>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: string, data: { name?: string; displayOrder?: number }) {
  return request<{ success: true; message: string; category: Category }>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string) {
  return request(`/categories/${id}`, { method: "DELETE" });
}

// ─── Products ────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  categorySlug: string;
  type?: "veg" | "non-veg";
  quantity?: string; // e.g. "6 pcs", "2 pcs"
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function getProducts(
  params?: { categoryId?: string; page?: number; limit?: number },
  options?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (params?.categoryId) query.set("categoryId", params.categoryId);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<{ success: true; products: Product[]; pagination: ProductsPagination }>(
    `/products${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function getProduct(id: string, options?: RequestOptions) {
  return request<{ success: true; product: Product }>(`/products/${id}`, options);
}

export async function createProduct(data: {
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  type?: "veg" | "non-veg";
  quantity?: string;
  isAvailable?: boolean;
}) {
  return request<{ success: true; message: string; product: Product }>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: string, data: Partial<{
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId: string;
  type: "veg" | "non-veg";
  quantity: string;
  isAvailable: boolean;
}>) {
  return request<{ success: true; message: string; product: Product }>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string) {
  return request(`/products/${id}`, { method: "DELETE" });
}

export async function uploadImage(
  file: File,
  folder: "products" | "addons" = "products",
): Promise<{
  success: true;
  message: string;
  url: string;
  publicId: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const url = `${API_BASE}/upload`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const token = getAdminToken();
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new ApiError(
        data.message || "Failed to upload image to Cloudinary",
        res.status,
        data.errors,
      );
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ─── Order Windows ───────────────────────────────────────────────

export interface TimeWindow {
  start: string;
  end: string;
  maxOrders?: number;
}

export interface OrderWindow {
  day: string;
  enabled: boolean;
  windows: TimeWindow[];
  updatedAt?: string;
}

export async function getOrderWindows(options?: RequestOptions) {
  return request<{ success: true; orderWindows: OrderWindow[] }>("/order-windows", options);
}

export async function updateOrderWindow(day: string, data: { enabled: boolean; windows: TimeWindow[] }) {
  return request<{ success: true; message: string }>(`/order-windows/${day}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateOrderWindowsBulk(data: {
  days: string[];
  enabled: boolean;
  windows: TimeWindow[];
}) {
  return request<{ success: true; message: string }>("/order-windows/bulk", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Dispatch Windows & Slots ────────────────────────────────────

export interface DispatchSlot {
  id: string;
  start: string;
  end: string;
  label: string;
  maxCapacity: number;
  isActive: boolean;
}

export interface DispatchWindow {
  day: string;
  enabled: boolean;
  slots: DispatchSlot[];
  updatedAt?: string;
}

export interface SlotCapacityOverview {
  slotId: string;
  start: string;
  end: string;
  label: string;
  maxCapacity: number;
  isActive: boolean;
  confirmedCount: number;
  heldCount: number;
  totalBooked: number;
  availableCapacity: number;
  percentageBooked: number;
  confirmedOrders: string[];
}

export interface DispatchCapacityResponse {
  date: string;
  dayName: string;
  enabled: boolean;
  slots: SlotCapacityOverview[];
}

export async function getDispatchWindows(options?: RequestOptions) {
  return request<{ success: true; dispatchWindows: DispatchWindow[] }>("/dispatch-windows", options);
}

export async function getDispatchCapacity(date?: string, options?: RequestOptions) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<{ success: true; capacity: DispatchCapacityResponse }>(`/dispatch-windows/capacity${qs}`, options);
}

export async function updateDispatchWindow(
  day: string,
  data: { enabled: boolean; slots: DispatchSlot[] },
) {
  return request<{ success: true; message: string }>(`/dispatch-windows/${day}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateDispatchWindowsBulk(data: {
  days: string[];
  enabled: boolean;
  slots: DispatchSlot[];
}) {
  return request<{ success: true; message: string }>("/dispatch-windows/bulk", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Weekly Off ──────────────────────────────────────────────────

export async function getWeeklyOff(options?: RequestOptions) {
  return request<{ success: true; weeklyOff: string[] }>("/weekly-off", options);
}

export async function updateWeeklyOff(days: string[]) {
  return request("/weekly-off", {
    method: "PUT",
    body: JSON.stringify({ days }),
  });
}

// ─── Holidays ────────────────────────────────────────────────────

export interface Holiday {
  id: string;
  date: string;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getHolidays(options?: RequestOptions) {
  return request<{ success: true; holidays: Holiday[] }>("/holidays", options);
}

export async function createHoliday(data: { date: string; reason: string }) {
  return request<{ success: true; message: string; holiday: Holiday }>("/holidays", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateHoliday(id: string, data: { date?: string; reason?: string }) {
  return request<{ success: true; message: string; holiday: Holiday }>(`/holidays/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteHoliday(id: string) {
  return request(`/holidays/${id}`, { method: "DELETE" });
}

// ─── FAQs ────────────────────────────────────────────────────────

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getFaqs(category?: string, options?: RequestOptions) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return request<{ success: true; faqs: Faq[] }>(`/faqs${qs}`, options);
}

export async function getFaq(id: string, options?: RequestOptions) {
  return request<{ success: true; faq: Faq }>(`/faqs/${id}`, options);
}

export async function createFaq(data: {
  question: string;
  answer: string;
  category?: string;
  displayOrder?: number;
  isActive?: boolean;
}) {
  return request<{ success: true; message: string; faq: Faq }>("/faqs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFaq(
  id: string,
  data: {
    question?: string;
    answer?: string;
    category?: string;
    displayOrder?: number;
    isActive?: boolean;
  },
) {
  return request<{ success: true; message: string; faq: Faq }>(`/faqs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteFaq(id: string) {
  return request(`/faqs/${id}`, { method: "DELETE" });
}

export async function reorderFaqs(faqIds: string[]) {
  return request<{ success: true; message: string }>("/faqs/reorder", {
    method: "PUT",
    body: JSON.stringify({ faqIds }),
  });
}

// ─── Order type settings (pickup / delivery) ─────────────────────

export interface OrderSettings {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  pickupInstructions: string;
}

export async function getOrderSettings(options?: RequestOptions) {
  return request<{ success: true; settings: OrderSettings }>("/order-settings", options);
}

export async function updateOrderSettings(data: OrderSettings) {
  return request<{ success: true; message: string; settings: OrderSettings }>("/order-settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── Orders & Real-Time Management ──────────────────────────────

export type OrderStatus =
  | "pending_payment"
  | "placed"
  | "preparing"
  | "ready"
  | "porter_booked"
  | "porter_failed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled_by_customer"
  | "cancelled_by_admin";

export interface OrderItemAddon {
  addonId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
  kind?: "product" | "addon";
  addonId?: string;
  addons?: OrderItemAddon[];
}

export type OrderType = "pickup" | "delivery";

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
}

export interface OrderDeliveryAddress {
  id?: string;
  label: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  city: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  borzoFormat: {
    address: string;
    note: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

export interface OrderPayment {
  provider: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: "pending" | "paid" | "failed";
  paidAt?: string;
}

export interface OrderRefund {
  status: "none" | "refunded" | "declined";
  amount: number;
  type: "full" | "partial" | "decline";
  reason?: string;
  razorpayRefundId?: string;
  refundedAt?: string;
  notes?: string;
}

export interface OrderBorzo {
  borzoOrderId?: number;
  borzoOrderName?: string;
  trackingUrl?: string;
  status?: string;
  deliveryFee?: string;
  error?: string;
  updatedAt?: string;
}

export interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  _id?: string;
  id: string;
  orderNumber: string;
  userId: string;
  orderType?: OrderType;
  customer: OrderCustomer;
  deliveryAddress: OrderDeliveryAddress;
  items: OrderItem[];
  itemTotal: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  notes?: string;
  status: OrderStatus;
  canCustomerCancelUntil: string;
  dispatchDate?: string;
  dispatchSlot?: {
    id: string;
    start: string;
    end: string;
    label: string;
  };
  payment: OrderPayment;
  refund?: OrderRefund;
  borzo?: OrderBorzo;
  timeline: OrderTimeline[];
  createdAt: string;
  updatedAt: string;
}

export interface OrdersListResponse {
  success: true;
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts: {
    placed: number;
    preparing: number;
    ready: number;
  };
}

export interface CancelledOrdersResponse {
  success: true;
  cancelledOrders: Order[];
  count: number;
  totalRefundedAmount: number;
}

export type ReportPeriod = "this_week" | "this_month" | "last_month" | "this_year";

export interface ReportTimelinePoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  cancelledOrders: number;
}

export interface MonthlyReportsResponse {
  success: true;
  period?: "this_week" | "this_month" | "last_month" | "this_year" | "custom_month";
  periodLabel?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  month: string;
  summary: {
    totalRevenue: number;
    avgOrderValue: number;
    paidOrdersCount: number;
    totalOrdersCount: number;
    cancelledOrdersCount: number;
  };
  timeline?: ReportTimelinePoint[];
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenueGenerated: number;
  }>;
}

export interface KitchenBill {
  restaurant: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
  };
  order: {
    orderNumber: string;
    invoiceNumber?: string;
    orderId: string;
    date: string;
    status: string;
    orderType?: OrderType;
    dispatchDate?: string;
    dispatchSlot?: string;
  };
  customer: {
    name: string;
    phone: string;
    email?: string;
    deliveryAddress: string;
    note: string;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    total: number;
    addons?: Array<{
      name: string;
      price: number;
      quantity: number;
      total: number;
    }>;
  }>;
  totals: {
    subtotal: number;
    deliveryFee: number;
    discount: number;
    grandTotal: number;
  };
  payment: {
    mode: string;
    status: string;
    transactionId: string;
  };
}

export async function getOrders(
  params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
  options?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<OrdersListResponse>(`/orders${qs ? `?${qs}` : ""}`, {
    forceRefresh: true,
    ...options,
  });
}

export async function getOrder(orderId: string, options?: RequestOptions) {
  return request<{ success: true; order: Order }>(`/orders/${orderId}`, {
    forceRefresh: true,
    ...options,
  });
}

export async function getCancelledOrders(options?: RequestOptions) {
  return request<CancelledOrdersResponse>("/orders/cancelled", {
    forceRefresh: true,
    ...options,
  });
}

export async function getMonthlyReports(
  params?: string | { month?: string; period?: ReportPeriod },
  options?: RequestOptions,
) {
  let qs = "";
  if (typeof params === "string") {
    qs = `?month=${params}`;
  } else if (params) {
    const sp = new URLSearchParams();
    if (params.period) sp.set("period", params.period);
    if (params.month) sp.set("month", params.month);
    const s = sp.toString();
    if (s) qs = `?${s}`;
  }
  return request<MonthlyReportsResponse>(`/orders/reports${qs}`, options);
}

export async function getKitchenBill(orderId: string, options?: RequestOptions) {
  return request<{ success: true; bill: KitchenBill }>(`/orders/${orderId}/bill`, options);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
  trackingUrl?: string,
) {
  return request<{
    success: true;
    message: string;
    order: Order;
  }>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note, trackingUrl }),
  });
}

export async function cancelOrder(
  orderId: string,
  data: {
    reason: string;
    refundType: "full" | "partial" | "decline";
    refundAmount?: number;
    notes?: string;
  },
) {
  return request<{
    success: true;
    message: string;
    order: Order;
    refund?: unknown;
  }>(`/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function autoPrepareOrders() {
  return request<{
    success: true;
    message: string;
    count: number;
  }>("/orders/auto-prepare", {
    method: "POST",
  });
}

export function getOrderEventsUrl(): string {
  const token = getAdminToken();
  const base = `${API_BASE}/orders/events`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export interface OrderLiveSummaryResponse {
  success: boolean;
  counts: {
    placed: number;
    preparing: number;
    ready: number;
    porterBooked: number;
    delivered: number;
    cancelled: number;
  };
  events: Array<{
    type: "order_created" | "order_status_updated" | "order_cancelled" | "porter_status_updated";
    orderId: string;
    orderNumber: string;
    status: string;
    timestamp: string;
    summary?: Record<string, unknown>;
  }>;
  serverTime: number;
}

export async function getOrderLiveSummary(since?: number): Promise<OrderLiveSummaryResponse> {
  const query = since ? `?since=${since}` : "";
  return request<OrderLiveSummaryResponse>(`/orders/live-summary${query}`, {
    forceRefresh: true,
  });
}

// ─── Add-ons ─────────────────────────────────────────────────────

export interface Addon {
  id: string;
  name: string;
  price: number;
  image: string;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function getAddons(options?: RequestOptions) {
  return request<{ success: true; addons: Addon[] }>("/addons", {
    ttlMs: 60 * 1000,
    ...options,
  });
}

export async function getAddon(id: string, options?: RequestOptions) {
  return request<{ success: true; addon: Addon }>(`/addons/${id}`, options);
}

export async function createAddon(data: {
  name: string;
  price: number;
  image: string;
  isAvailable?: boolean;
  displayOrder?: number;
}) {
  return request<{ success: true; message: string; addon: Addon }>("/addons", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAddon(
  id: string,
  data: Partial<{
    name: string;
    price: number;
    image: string;
    isAvailable: boolean;
    displayOrder: number;
  }>,
) {
  return request<{ success: true; message: string; addon: Addon }>(`/addons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAddon(id: string) {
  return request(`/addons/${id}`, { method: "DELETE" });
}

export { ApiError };

