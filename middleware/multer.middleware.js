import multer from "multer";

const storage = multer.memoryStorage();

// Single upload for simple file fields
export const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

// Multiple fields upload for product with images and video
export const uploadProductFiles = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }
}).fields([
  { name: 'images', maxCount: 10 },      // Product images
  { name: 'image', maxCount: 10 },       // Alternative field name
  { name: 'video', maxCount: 1 },        // Product video
  { name: 'variantImages', maxCount: 20 }, // Variant specific images (if any)
  { name: 'files', maxCount: 20 }        // Generic file field
]);
