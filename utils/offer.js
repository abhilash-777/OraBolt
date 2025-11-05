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

    const regularPrice = product.regularPrice > product.salePrice ? product.salePrice : product.regularPrice;
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

  const currentDate = new Date();

  const proOffer = await Offer.findOne({
    offerAppliedTo: "product",
    product: { $in: [product._id] },
    isActive: true,
    startDate: { $lte: currentDate },
    endDate: { $gte: currentDate }
  }).lean();

  let catOffer = null;
  if (product.category && product.category._id) {
    catOffer = await Offer.findOne({
      offerAppliedTo: "category",
      category: { $in: [product.category._id] },
      isActive: true,
      startDate: { $lte: currentDate},
      endDate: { $gte: currentDate}
    }).lean();
  }
  
  const productOfferPercentage = proOffer?.percentage || 0;
  const categoryOfferPercentage = catOffer?.percentage || 0;
  if(productOfferPercentage > 0 || categoryOfferPercentage > 0){
    if(productOfferPercentage >= categoryOfferPercentage){
      percentage = productOfferPercentage;
      offerId = proOffer._id;
      offerType = "product";
    }else{
      percentage = categoryOfferPercentage;
      offerId = catOffer._id;
      offerType = "category";
    }
    price = Math.round(product.salePrice *(1 - percentage/100));
    console.log(`Applied ${offerType} offer: ${percentage}% off (Product: ${productOfferPercentage}%, Category: ${categoryOfferPercentage}%)`);
  }

  return { price, percentage, offerId };
}

module.exports = { applyOffersToProducts,getEffectivePrice };
