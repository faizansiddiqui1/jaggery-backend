import multer from "multer";

const storage = multer.memoryStorage();

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];

const fileFilter = (_req, file, cb) => {
  const mime = String(file?.mimetype || "").toLowerCase();
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
  if (!allowed) {
    const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file?.fieldname || "file");
    err.message = "Unsupported file type";
    return cb(err);
  }
  return cb(null, true);
};

// Single upload for simple file fields
export const upload = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

// Multiple fields upload for product with images and video
export const uploadProductFiles = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }
}).fields([
  { name: 'images', maxCount: 10 },      // Product images
  { name: 'image', maxCount: 10 },       // Alternative field name
  { name: 'video', maxCount: 1 },        // Product video
  { name: 'variantImages', maxCount: 20 }, // Variant specific images (if any)
  { name: 'files', maxCount: 20 }        // Generic file field
]);
