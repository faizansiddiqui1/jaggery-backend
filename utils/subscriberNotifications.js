import NewsletterSubscriber from "../model/newsletterSubscriber.model.js";
import { sendBrevoEmail } from "./brevo.js";

const siteUrl = String(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://www.amilagold.com").replace(/\/+$/, "");
const brandName = process.env.BREVO_FROM_NAME || "Amila Gold";

const getBrevoConfig = () => ({
  apiKey: process.env.BREVO_API_KEY,
  fromEmail: process.env.BREVO_FROM_EMAIL,
  fromName: brandName,
});

const hasBrevoConfig = () => {
  const { apiKey, fromEmail } = getBrevoConfig();
  return Boolean(apiKey && fromEmail);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatRupees = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const normalizeAmountRupees = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount > 10000 ? amount / 100 : amount;
};

const getProductName = (product) =>
  String(product?.title || product?.name || product?.product_name || "Amila Gold product").trim();

const getProductImage = (product) => {
  const images = [];
  const add = (value) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const normalized = String(value || "").trim();
    if (normalized) images.push(normalized);
  };
  add(product?.product_image);
  if (Array.isArray(product?.variants)) {
    product.variants.forEach((variant) => {
      add(variant?.image);
      add(variant?.images);
    });
  }
  return images[0] || `${siteUrl}/logo.png`;
};

const getProductPrice = (product) => {
  const variant = Array.isArray(product?.variants) ? product.variants[0] : null;
  return Number(product?.selling_price || product?.price || variant?.selling_price || variant?.price || 0);
};

const getProductUrl = (product) => {
  const id = product?.product_id || product?._id || "";
  const name = getProductName(product)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id ? `${siteUrl}/product/${encodeURIComponent(String(id))}/${name || "product"}` : `${siteUrl}/shop`;
};

const renderShell = ({ preheader, title, body, ctaLabel, ctaUrl }) => {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f8f5ef;color:#2d2118;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f5ef;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdf8;border:1px solid #eadfce;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#5f3b20;color:#fff8ec;padding:26px 28px;text-align:center;">
                <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;">${escapeHtml(brandName)}</div>
                <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;font-weight:700;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${body}
                ${ctaLabel && ctaUrl ? `
                <div style="text-align:center;margin:28px 0 8px;">
                  <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#5f3b20;color:#fff8ec;text-decoration:none;border-radius:999px;padding:14px 24px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
                </div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eadfce;padding:18px 28px;text-align:center;color:#7b6b5e;font-size:12px;line-height:1.6;">
                You are receiving this because you interacted with ${escapeHtml(brandName)}.<br>
                ${escapeHtml(siteUrl)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendCustomerEmail = async ({ toEmail, subject, textContent, htmlContent }) => {
  if (!hasBrevoConfig()) {
    console.warn("Brevo email skipped: BREVO_API_KEY or BREVO_FROM_EMAIL missing");
    return { skipped: true, reason: "missing_brevo_config" };
  }

  const config = getBrevoConfig();
  return sendBrevoEmail({
    apiKey: config.apiKey,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    toEmail,
    subject,
    textContent,
    htmlContent,
  });
};

export async function sendNewsletterWelcomeEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { skipped: true, reason: "missing_email" };

  const htmlContent = renderShell({
    preheader: "Welcome to the Amila Gold harvest circle.",
    title: "Welcome to the Harvest Circle",
    body: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Namaste,</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Thank you for subscribing to ${escapeHtml(brandName)}. We will send you fresh harvest updates, new product launches, and stock alerts without flooding your inbox.</p>
      <p style="margin:0;font-size:16px;line-height:1.7;">Our promise is simple: traditional jaggery, clean ingredients, and honest updates whenever something worth sharing arrives.</p>
    `,
    ctaLabel: "Shop Amila Gold",
    ctaUrl: `${siteUrl}/shop`,
  });

  return sendCustomerEmail({
    toEmail: normalizedEmail,
    subject: `Welcome to ${brandName}`,
    textContent: `Welcome to ${brandName}. You are subscribed for harvest updates, product launches, and stock alerts. Shop: ${siteUrl}/shop`,
    htmlContent,
  });
}

export async function sendOrderConfirmationEmail(order) {
  const toEmail = String(order?.user_email || "").trim().toLowerCase();
  if (!toEmail) return { skipped: true, reason: "missing_email" };

  const orderId = order?.order_id || order?.order_code || String(order?._id || "");
  const items = Array.isArray(order?.items) ? order.items : [];
  const rows = items.map((item) => {
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const lineTotal = formatRupees(price * qty);
    const variant = [item?.size, item?.color].filter(Boolean).join(" / ");
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee4d6;">
          <div style="font-weight:700;color:#2d2118;">${escapeHtml(item?.product_name || `Product #${item?.product_id || ""}`)}</div>
          ${variant ? `<div style="font-size:13px;color:#7b6b5e;margin-top:4px;">${escapeHtml(variant)}</div>` : ""}
        </td>
        <td align="center" style="padding:12px 8px;border-bottom:1px solid #eee4d6;color:#5b4a3a;">${qty}</td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #eee4d6;color:#2d2118;">${escapeHtml(lineTotal)}</td>
      </tr>`;
  }).join("");

  const amount = formatRupees(normalizeAmountRupees(order?.amount));
  const address = [
    order?.FullName,
    order?.address_line1,
    order?.address_line2,
    order?.city,
    order?.district,
    order?.state,
    order?.pinCode,
    order?.country,
  ].filter(Boolean).join(", ");

  const htmlContent = renderShell({
    preheader: `Your ${brandName} order ${orderId} is confirmed.`,
    title: "Order Confirmed",
    body: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Thank you for your order. We have received it and will keep you updated as it moves ahead.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:#fbf6ec;border:1px solid #eadfce;border-radius:12px;">
        <tr><td style="padding:16px;font-size:14px;line-height:1.8;">
          <strong>Order ID:</strong> ${escapeHtml(orderId)}<br>
          <strong>Payment:</strong> ${escapeHtml(order?.payment_method || "")} (${escapeHtml(order?.payment_status || "pending")})<br>
          <strong>Total:</strong> ${escapeHtml(amount)}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;">
        <thead>
          <tr>
            <th align="left" style="padding-bottom:8px;color:#7b6b5e;">Item</th>
            <th align="center" style="padding-bottom:8px;color:#7b6b5e;">Qty</th>
            <th align="right" style="padding-bottom:8px;color:#7b6b5e;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3" style="padding:12px 0;">Order details are being prepared.</td></tr>`}</tbody>
      </table>
      ${address ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#5b4a3a;"><strong>Delivery address:</strong><br>${escapeHtml(address)}</p>` : ""}
    `,
    ctaLabel: "View Orders",
    ctaUrl: `${siteUrl}/user/orders`,
  });

  return sendCustomerEmail({
    toEmail,
    subject: `${brandName} order confirmed - ${orderId}`,
    textContent: `Your ${brandName} order ${orderId} is confirmed. Total: ${amount}. View orders: ${siteUrl}/user/orders`,
    htmlContent,
  });
}

const listActiveSubscribers = async () =>
  NewsletterSubscriber.find({ isActive: true })
    .select("email")
    .lean();

const sendProductCampaign = async ({ product, campaignType, subject, title, intro }) => {
  if (!hasBrevoConfig()) {
    console.warn(`${campaignType} email skipped: BREVO_API_KEY or BREVO_FROM_EMAIL missing`);
    return { skipped: true, reason: "missing_brevo_config" };
  }

  const subscribers = await listActiveSubscribers();
  if (!subscribers.length) return { total: 0, sent: 0, failed: 0 };

  const productName = getProductName(product);
  const productUrl = getProductUrl(product);
  const imageUrl = getProductImage(product);
  const price = formatRupees(getProductPrice(product));
  let sent = 0;
  let failed = 0;

  const htmlContent = renderShell({
    preheader: intro,
    title,
    body: `
      <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${escapeHtml(intro)}</p>
      <div style="border:1px solid #eadfce;border-radius:16px;overflow:hidden;background:#fbf6ec;">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(productName)}" style="width:100%;max-height:320px;object-fit:cover;display:block;">
        <div style="padding:18px;">
          <h2 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:#2d2118;">${escapeHtml(productName)}</h2>
          ${price ? `<div style="font-size:18px;font-weight:700;color:#5f3b20;">${escapeHtml(price)}</div>` : ""}
        </div>
      </div>
    `,
    ctaLabel: "View Product",
    ctaUrl: productUrl,
  });

  for (const subscriber of subscribers) {
    const email = String(subscriber?.email || "").trim().toLowerCase();
    if (!email) continue;
    try {
      await sendCustomerEmail({
        toEmail: email,
        subject,
        textContent: `${intro}\n\n${productName}${price ? ` - ${price}` : ""}\n${productUrl}`,
        htmlContent,
      });
      sent += 1;
      await NewsletterSubscriber.updateOne(
        { email },
        { $set: { lastNotifiedAt: new Date(), lastNotifiedType: campaignType } }
      );
    } catch (error) {
      failed += 1;
      console.error(`${campaignType} email failed for ${email}:`, error?.message || error);
    }
  }

  return { total: subscribers.length, sent, failed, campaignType };
};

export function notifySubscriber(email, message) {
  return sendCustomerEmail({
    toEmail: email,
    subject: `${brandName} update`,
    textContent: String(message || ""),
    htmlContent: renderShell({
      title: `${brandName} update`,
      body: `<p style="margin:0;font-size:16px;line-height:1.7;">${escapeHtml(message || "")}</p>`,
      ctaLabel: "Visit Store",
      ctaUrl: siteUrl,
    }),
  });
}

export function notifySubscribersInstagramPost(postUrl, message) {
  return sendProductCampaign({
    product: { title: "A fresh update from Amila Gold", product_image: `${siteUrl}/logo.png` },
    campaignType: "instagram_post",
    subject: `${brandName} has a new update`,
    title: "Fresh From Amila Gold",
    intro: `${message || "We have shared a new update."} ${postUrl || ""}`.trim(),
  });
}

export function notifySubscribersProductInStock(product) {
  const productName = getProductName(product);
  return sendProductCampaign({
    product,
    campaignType: "product_in_stock",
    subject: `${productName} is back in stock`,
    title: "Back In Stock",
    intro: `${productName} is available again. Fresh stock is ready for you.`,
  });
}

export function notifySubscribersProductUploaded(product) {
  const productName = getProductName(product);
  return sendProductCampaign({
    product,
    campaignType: "product_uploaded",
    subject: `New arrival: ${productName}`,
    title: "New Product Launched",
    intro: `A new ${brandName} product has just arrived: ${productName}.`,
  });
}
