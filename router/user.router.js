import { Router } from "express";
import {
  showProducts,
  getProductById,
  getProductByCategory,
  searchProducts,
  getCategories,
  getProductReviews,
  addProductReview,
  listWishlist,
  addToWishlistDb,
  removeFromWishlistDb,
  clearWishlistDb,
  getUserCart,
  saveUserCart,
  getUserAddresses,
  createNewAddress,
  addToCart,
  removeCartByProduct,
  updateCartItem,
  clearCart,
  updateUserAddress,
  getUserProfile,
  updateUserProfile,
  getUserOrders,
  createOrder,
  confirmPayment,
  cancelOrder,
  returnOrder,
  subscribeNewsletter,
  submitContactForm,
} from "../controller/user.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { requireUserSession } from "../middleware/auth.middleware.js";
import { paymentRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.get("/show-product", showProducts);
router.get("/get-product-byid/:id", getProductById);
router.get("/get-product-byCategory/:category", getProductByCategory);
router.post("/search", searchProducts);
router.get("/get-categories", getCategories);
router.get("/get-product-reviews/:id", getProductReviews);
router.post("/product-reviews", upload.single("reviewImage"), addProductReview);
router.post("/wishlist/list", requireUserSession, listWishlist);
router.post("/wishlist/add", requireUserSession, addToWishlistDb);
router.post("/wishlist/remove", requireUserSession, removeFromWishlistDb);
router.post("/wishlist/clear", requireUserSession, clearWishlistDb);
router.post("/get-user-cart", getUserCart);
router.post("/save-cart", saveUserCart);
router.post("/add-to-cart", addToCart);
router.get("/remove-cart-by-product/:productId", removeCartByProduct);
router.post("/update-cart-item", updateCartItem);
router.post("/clear-cart", clearCart);
router.post("/get-user-addresess", requireUserSession, getUserAddresses);
router.post("/create-newAddress", requireUserSession, createNewAddress);
router.patch("/update-user-address", requireUserSession, updateUserAddress);
router.post("/get-user-profile", requireUserSession, getUserProfile);
router.post("/update-user-profile", requireUserSession, updateUserProfile);
router.post("/get-orders", requireUserSession, getUserOrders);
router.post("/create-order", requireUserSession, paymentRateLimit, createOrder);
router.post("/payment-success", requireUserSession, paymentRateLimit, confirmPayment);
router.post("/cancel-order", requireUserSession, cancelOrder);
router.post("/return-order", requireUserSession, returnOrder);
router.post("/newsletter/subscribe", subscribeNewsletter);
router.post("/contact/submit", submitContactForm);

export { router };
export default router;
