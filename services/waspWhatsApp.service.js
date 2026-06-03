import Orders from "../model/orders.model.js";
import Profile from "../model/profile.model.js";

const cleanEnv = (key) => String(process.env[key] || "").trim();

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const REMINDER_DELAY = "28d";
const REMINDER_ENDPOINT_PATH = "/user/order-reminder/qstash";

const formatOrderDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const normalizePhoneForCampaign = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length > 10) digits = digits.slice(-10);
  if (digits.length !== 10) return "";
  return `91${digits}`;
};

const getFrontendBaseUrl = () => {
  const urls = String(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return urls.find((value) => value.startsWith("https://")) || urls[0] || cleanEnv("FRONTEND_URL");
};

const getOrderTrackingUrl = (order) => {
  if (!order?.order_id) return "";
  const orderPath = `/user/orders/${encodeURIComponent(order.order_id)}`;
  const siteUrl = getFrontendBaseUrl();
  return siteUrl ? `${siteUrl.replace(/\/+$/, "")}${orderPath}` : orderPath;
};

const formatProductNameForPath = (name) =>
  String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getProductBuyUrl = (item) => {
  const productId = Number(item?.product_id || 0);
  const productName = String(item?.product_name || "product").trim() || "product";
  if (!productId) return getFrontendBaseUrl() || "";
  const productPath = `/product/${encodeURIComponent(String(productId))}/${formatProductNameForPath(productName)}`;
  const siteUrl = getFrontendBaseUrl();
  return siteUrl ? `${siteUrl.replace(/\/+$/, "")}${productPath}` : productPath;
};

const formatAmount = (amountPaise, currency = "INR") => {
  const amount = Number(amountPaise || 0) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `${currency} ${amount.toFixed(2)}`;
};

const getItemsSummary = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return "Your items";
  return items
    .map((item) => {
      const name = String(item?.product_name || "Product").trim() || "Product";
      const quantity = Number(item?.quantity || 1);
      const size = String(item?.size || "").trim();
      const sizeText = size ? `, Size: ${size}` : "";
      return `- ${name} x${quantity}${sizeText}`;
    })
    .join("\n");
};

const buildOrderConfirmationVariables = (order, options = {}) => [
  String(order?.FullName || options.profileName || "Customer").trim() || "Customer",
  String(order?.order_id || "").trim(),
  formatOrderDate(order?.createdAt),
  formatAmount(order?.amount, order?.currency || "INR"),
  String(order?.payment_method || "").trim() || "Payment",
  getItemsSummary(order),
  getOrderTrackingUrl(order),
];

const getPrimaryOrderItem = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items[0] || null;
};

const buildOrderReminderVariables = (order, options = {}) => {
  const item = getPrimaryOrderItem(order);
  const productName = String(item?.product_name || "your product").trim() || "your product";
  const size = String(item?.size || "").trim();
  const quantity = Number(item?.quantity || 1);
  const productInfo = `${productName}${size ? `, Size: ${size}` : ""} x${quantity}`;
  return [
    String(order?.FullName || options.profileName || "Customer").trim() || "Customer",
    productInfo,
    getProductBuyUrl(item),
  ];
};

const sendWaspCampaign = async ({ campaignName, recipient, variables }) => {
  const apiKey = cleanEnv("WASPAKAMIFY_API_KEY");
  const baseUrl = normalizeBaseUrl(cleanEnv("BASE_URL"));
  if (!apiKey || !campaignName || !baseUrl) {
    return { skipped: true, reason: "Waspakamify campaign env missing" };
  }

  if (!recipient) {
    return { skipped: true, reason: "Order recipient phone missing" };
  }

  const response = await fetch(`${baseUrl}/integrations/campaigns/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      campaignName,
      recipients: [
        {
          to: recipient,
          variables,
        },
      ],
    }),
  });

  const responseText = await response.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = { raw: responseText };
  }

  if (!response.ok) {
    throw new Error(`Waspakamify API campaign failed: ${response.status} ${responseText}`);
  }

  return { skipped: false, data };
};

const getOrderRecipient = (order, options = {}) =>
  normalizePhoneForCampaign(order?.phone1 || options.profilePhone || order?.phone2);

const getOrderNotificationProfile = async (order) => {
  const hasName = Boolean(String(order?.FullName || "").trim());
  const hasPhone = Boolean(String(order?.phone1 || order?.phone2 || "").trim());
  if (hasName && hasPhone) return {};

  const email = String(order?.user_email || "").trim().toLowerCase();
  if (!email) return {};
  const profile = await Profile.findOne({ email }).select("name phone").lean();
  return {
    profileName: String(profile?.name || "").trim(),
    profilePhone: String(profile?.phone || "").trim(),
  };
};

const isReminderAllowedForOrder = (order) => {
  const status = String(order?.status || "").toLowerCase();
  return !["cancelled", "rejected", "refund", "refunded", "return"].includes(status);
};

export const sendWaspOrderConfirmation = async (order, options = {}) =>
  sendWaspCampaign({
    campaignName: cleanEnv("ORDER_CONFIRMATION_CAMPAIGN") || cleanEnv("API_CAMPAIGN_NAME"),
    recipient: getOrderRecipient(order, options),
    variables: buildOrderConfirmationVariables(order, options),
  });

export const sendWaspOrderReminder = async (order, options = {}) =>
  sendWaspCampaign({
    campaignName: cleanEnv("ORDER_REMINDER_CAMPAIGN"),
    recipient: getOrderRecipient(order, options),
    variables: buildOrderReminderVariables(order, options),
  });

export const sendOrderReminderForOrderId = async (orderId) => {
  const id = String(orderId || "").trim();
  if (!id) return { skipped: true, reason: "Order id missing" };

  const order = await Orders.findOne({ $or: [{ order_id: id }, { order_code: id }] });
  if (!order) return { skipped: true, reason: "Order not found" };
  if (!isReminderAllowedForOrder(order)) {
    return { skipped: true, reason: `Order status ${order.status} is not eligible` };
  }

  const profile = await getOrderNotificationProfile(order);
  return sendWaspOrderReminder(order, profile);
};

const getQstashDestinationUrl = () => {
  const baseUrl = cleanEnv("QSTASH_DESTINATION_BASE_URL") || cleanEnv("BACKEND_PUBLIC_URL");
  if (!baseUrl) return "";
  return `${baseUrl.replace(/\/+$/, "")}${REMINDER_ENDPOINT_PATH}`;
};

export const scheduleOrderReminder = async (order) => {
  const qstashToken = cleanEnv("QSTASH_TOKEN");
  const qstashUrl = normalizeBaseUrl(cleanEnv("QSTASH_URL") || "https://qstash.upstash.io");
  const webhookSecret = cleanEnv("ORDER_REMINDER_WEBHOOK_SECRET") || cleanEnv("QSTASH_CURRENT_SIGNING_KEY");
  const destinationUrl = getQstashDestinationUrl();
  if (!qstashToken || !webhookSecret || !destinationUrl || !cleanEnv("ORDER_REMINDER_CAMPAIGN")) {
    return { skipped: true, reason: "Order reminder scheduler env missing" };
  }
  if (!order?.order_id) {
    return { skipped: true, reason: "Order id missing" };
  }

  const response = await fetch(`${qstashUrl}/v2/publish/${destinationUrl}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      "Upstash-Delay": REMINDER_DELAY,
      "Upstash-Forward-X-Order-Reminder-Secret": webhookSecret,
      "Upstash-Label": `order-reminder,${order.order_id}`,
    },
    body: JSON.stringify({ order_id: order.order_id }),
  });

  const responseText = await response.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = { raw: responseText };
  }

  if (!response.ok) {
    throw new Error(`QStash order reminder schedule failed: ${response.status} ${responseText}`);
  }

  return { skipped: false, data };
};

export const notifyOrderConfirmed = (order, options = {}) => {
  sendWaspOrderConfirmation(order, options)
    .then((result) => {
      if (!result?.skipped) {
        return scheduleOrderReminder(order);
      }
      return null;
    })
    .catch((error) => {
      console.error("Waspakamify order confirmation/reminder scheduling failed:", error.message);
    });
};
