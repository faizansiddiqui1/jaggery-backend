import mongoose from "mongoose";

const TestimonialSchema = new mongoose.Schema(
  {
    quote: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

TestimonialSchema.index({ isActive: 1, order: 1, createdAt: -1 });

const Testimonial = mongoose.model("Testimonial", TestimonialSchema);
export default Testimonial;
