import mongoose from 'mongoose';

const WhatsAppPricingSchema = new mongoose.Schema({
  pricePerRequest: { type: Number, required: true, default: 0.18 },
  effectiveFrom: { type: Date, required: true, default: new Date("2025-04-01") },
  createdAt: { type: Date, default: new Date("2025-04-01") },
});

WhatsAppPricingSchema.statics.getCurrentPrice = async function() {
  const pricing = await this.findOne({ effectiveFrom: { $lte: new Date() } })
    .sort({ effectiveFrom: -1 });
  return pricing ? pricing.pricePerRequest : 0.18; // Default to 0.18 as used across the codebase
};

export interface IWhatsAppPricing extends mongoose.Document {
  pricePerRequest: number;
  effectiveFrom: Date;
  createdAt: Date;
}

export interface IWhatsAppPricingModel extends mongoose.Model<IWhatsAppPricing> {
  getCurrentPrice(): Promise<number>;
}

// Check if the model is already compiled
let WhatsAppPricing = (mongoose.models.WhatsAppPricing as IWhatsAppPricingModel);

// If the model exists but doesn't have the static method (due to hot reload caching),
// we need to attach it manually to the existing model.
if (WhatsAppPricing && !WhatsAppPricing.getCurrentPrice) {
  WhatsAppPricing.getCurrentPrice = async function() {
    const pricing = await this.findOne({ effectiveFrom: { $lte: new Date() } })
      .sort({ effectiveFrom: -1 });
    return pricing ? pricing.pricePerRequest : 0.18;
  };
}

// If the model doesn't exist, create it
if (!WhatsAppPricing) {
  WhatsAppPricing = mongoose.model<IWhatsAppPricing, IWhatsAppPricingModel>('WhatsAppPricing', WhatsAppPricingSchema);
}

export default WhatsAppPricing;
