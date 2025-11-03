const Offer = require("../models/offerSchems");
const Product = require("../models/productSchema");

async function applyOffersToProducts(products) {
  const currentDate = new Date();

  // Fetch active offers
  const activeOffers = await Offer.find({
    isActive: true,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate },
  }).lean();

  const categoryOffers = {};
  const productOffers = {};

  activeOffers.forEach((offer) => {
    if (offer.offerAppliedTo === "category") {
      offer.category.forEach((catId) => {
        categoryOffers[catId.toString()] = offer.percentage;
      });
    } else if (offer.offerAppliedTo === "product") {
      offer.product.forEach((proId) => {
        productOffers[proId.toString()] = offer.percentage;
      });
    }
  });

  // Normalize products array
  const normalizedProducts = Array.isArray(products) ? products : [products];

  const processed = normalizedProducts.map((product) => {
    const productId = product._id ? product._id.toString() : null;
    const categoryId =
      product.category && product.category._id
        ? product.category._id.toString()
        : product.category?.toString() || null;

    const regularPrice = product.salePrice || product.regularPrice;
    const productOffer = productId ? productOffers[productId] || 0 : 0;
    const categoryOffer = categoryId ? categoryOffers[categoryId] || 0 : 0;

    const appliedOffer = Math.max(productOffer, categoryOffer);

    if (appliedOffer > 0) {
      const discount = (regularPrice * appliedOffer) / 100;
      const offerPrice = Math.round(regularPrice - discount);

      return {
        ...product,
        _id: productId,
        hasOffer: true,
        appliedOffer,
        offerPrice,
        savings: Math.round(discount),
        regularPrice,
      };
    }

    return {
      ...product,
      _id: productId,
      hasOffer: false,
      appliedOffer: 0,
      offerPrice: regularPrice,
      savings: 0,
      regularPrice,
    };
  });

  // Return single object if input was single product
  return Array.isArray(products) ? processed : processed[0];
};

async function getEffectivePrice(product) {

  let price = product.regularPrice;
  let percentage = 0;
  let offerId = null;

  // 1. PRODUCT OFFER
  const proOffer = await Offer.findOne({
    offerAppliedTo: "product",
    product: { $in: [product._id] },
    isActive: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  }).lean();

  if (proOffer) {
    percentage = proOffer.percentage;
    price = Math.round(product.regularPrice * (1 - percentage / 100));
    offerId = proOffer._id;
  }
  // 2. CATEGORY OFFER
  else if (product.category?.categoryOffer > 0) {
    const catOffer = await Offer.findOne({
      offerAppliedTo: "category",
      category: { $in: [product.category._id] },
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).lean();

    if (catOffer) {
      percentage = catOffer.percentage;
      price = Math.round(product.regularPrice * (1 - percentage / 100));
      offerId = catOffer._id;
    }
  }

  return { price, percentage, offerId };
}

module.exports = { applyOffersToProducts,getEffectivePrice };
