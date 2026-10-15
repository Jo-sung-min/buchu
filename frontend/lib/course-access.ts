import type { OrderCredentials } from "./courses";

export const COURSE_ORDERS_STORAGE_KEY = "buchu:course-orders:v1";
export const COURSE_ORDERS_CHANGED_EVENT = "buchu:course-orders-changed";
const MAX_ORDERS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function validCredentials(value: unknown): value is OrderCredentials {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OrderCredentials>;
  return typeof item.id === "string" && UUID.test(item.id)
    && typeof item.accessToken === "string" && TOKEN.test(item.accessToken);
}

function readOrders(storage: Storage): OrderCredentials[] {
  const raw = storage.getItem(COURSE_ORDERS_STORAGE_KEY);
  if (!raw || raw.length > 30_000) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  return parsed.slice(0, MAX_ORDERS).filter(validCredentials).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).map(({ id, accessToken }) => ({ id, accessToken }));
}

export function getSavedCourseOrders(): OrderCredentials[] {
  if (typeof window === "undefined") return [];
  try { return readOrders(window.localStorage); } catch { return []; }
}

export function saveCourseOrder(credentials: OrderCredentials): void {
  if (!validCredentials(credentials)) throw new Error("주문 번호와 복구 코드를 다시 확인해 주세요.");
  if (typeof window === "undefined") throw new Error("브라우저에서 주문을 저장해 주세요.");
  let orders: OrderCredentials[];
  try { orders = readOrders(window.localStorage); }
  catch { throw new Error("이 브라우저에 주문을 저장할 수 없어요. 브라우저 저장소를 허용한 뒤 다시 시도해 주세요."); }
  const existing = orders.findIndex((item) => item.id === credentials.id);
  const value = { id: credentials.id, accessToken: credentials.accessToken };
  if (existing >= 0) orders[existing] = value;
  else {
    if (orders.length >= MAX_ORDERS) throw new Error("이 브라우저에는 최대 100개 주문을 저장할 수 있어요. 다른 브라우저에서 복구 코드를 사용해 주세요.");
    orders = [value, ...orders];
  }
  try { window.localStorage.setItem(COURSE_ORDERS_STORAGE_KEY, JSON.stringify(orders)); }
  catch { throw new Error("주문을 브라우저에 저장하지 못했어요. 저장소 사용 설정과 남은 공간을 확인해 주세요."); }
  window.dispatchEvent(new Event(COURSE_ORDERS_CHANGED_EVENT));
}

export function getCourseOrderCredentials(id: string): OrderCredentials | null {
  if (!UUID.test(id)) return null;
  return getSavedCourseOrders().find((item) => item.id === id) ?? null;
}

export function orderHeaders(credentials: OrderCredentials): { "X-Order-Token": string } {
  return { "X-Order-Token": credentials.accessToken };
}
