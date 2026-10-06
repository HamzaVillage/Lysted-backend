const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');
const authController = require('./controller/authController');
const marketplaceController = require('./controller/marketplaceController');
const ebayController = require('./controller/ebayController');
const etsyController = require('./controller/etsyController');
const aiController = require('./controller/aiController');
const { protect } = require('./utils/authMiddleware');

// Multer config — store in memory for direct processing
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'), false);
        }
    },
});

// @route   POST /api/auth/register
router.post(
    '/register',
    [
        body('fullName').trim().notEmpty().withMessage('Full name is required'),
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    authController.register
);

// @route   POST /api/auth/login
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    authController.login
);

// @route   POST /api/auth/google
router.post('/google', authController.googleAuth);

// @route   GET /api/auth/me (Protected)
router.get('/me', protect, authController.getMe);

// @route   PUT /api/auth/update-profile (Protected)
router.put('/update-profile', protect, marketplaceController.updateProfile);

// @route   GET /api/auth/marketplace/all-listings (Protected)
router.get('/marketplace/all-listings', protect, marketplaceController.getAllListings);

// @route   POST /api/auth/marketplace/connect (Protected)
router.post(
    '/marketplace/connect',
    protect,
    [
        body('marketplace').trim().notEmpty().withMessage('Marketplace is required'),
        body('email').trim().notEmpty().withMessage('Email / Username is required'),
        body('password').trim().notEmpty().withMessage('Password is required'),
    ],
    marketplaceController.connectMarketplace
);

// @route   GET /api/auth/marketplace/ebay/auth-url (Protected)
router.get('/marketplace/ebay/auth-url', protect, ebayController.getAuthUrl);

// @route   GET /api/auth/marketplace/ebay/callback (Public Web Redirect)
router.get('/marketplace/ebay/callback', ebayController.handleCallback);

// @route   POST /api/auth/marketplace/ebay/callback (Protected/Public JSON Code Exchange)
router.post('/marketplace/ebay/callback', ebayController.exchangeCodeForTokens);

// @route   GET /api/auth/marketplace/ebay/policies (Protected)
router.get('/marketplace/ebay/policies', protect, ebayController.getSellerPolicies);

// @route   POST /api/auth/marketplace/ebay/publish (Protected)
router.post('/marketplace/ebay/publish', protect, ebayController.publishToEbay);

// @route   GET /api/auth/marketplace/ebay/listings (Protected)
router.get('/marketplace/ebay/listings', protect, ebayController.getEbayListings);

// @route   GET /api/auth/marketplace/ebay/categories (Protected)
router.get('/marketplace/ebay/categories', protect, ebayController.getEbayCategories);

// ============================================================
// ETSY MARKETPLACE ROUTES
// ============================================================

// @route   GET /api/auth/marketplace/etsy/auth-url (Protected)
router.get('/marketplace/etsy/auth-url', protect, etsyController.getAuthUrl);

// @route   GET /api/auth/marketplace/etsy/callback (Public Web Redirect)
router.get('/marketplace/etsy/callback', etsyController.handleCallback);

// @route   POST /api/auth/marketplace/etsy/callback (Protected/Public JSON Code Exchange)
router.post('/marketplace/etsy/callback', etsyController.exchangeCodeForTokens);

// @route   GET /api/auth/marketplace/etsy/shop (Protected)
router.get('/marketplace/etsy/shop', protect, etsyController.getEtsyShopDetails);

// @route   GET /api/auth/marketplace/etsy/listings (Protected)
router.get('/marketplace/etsy/listings', protect, etsyController.getEtsyListings);

// @route   POST /api/auth/marketplace/etsy/publish (Protected)
router.post('/marketplace/etsy/publish', protect, etsyController.publishToEtsy);

// @route   PATCH /api/auth/marketplace/listings/:id/status (Protected)
router.patch('/marketplace/listings/:id/status', protect, marketplaceController.updateListingStatus);

// @route   DELETE /api/auth/marketplace/listings/:id (Protected)
router.delete('/marketplace/listings/:id', protect, marketplaceController.deleteListing);

// @route   GET /api/auth/marketplace/etsy/shipping-profiles (Protected)
router.get('/marketplace/etsy/shipping-profiles', protect, etsyController.getShippingProfiles);

// @route   POST /api/auth/marketplace/etsy/shipping-profiles (Protected)
router.post('/marketplace/etsy/shipping-profiles', protect, etsyController.createShippingProfile);

// @route   GET /api/auth/marketplace/etsy/readiness-states (Protected)
router.get('/marketplace/etsy/readiness-states', protect, etsyController.getReadinessStates);

// @route   POST /api/auth/marketplace/etsy/readiness-states (Protected)
router.post('/marketplace/etsy/readiness-states', protect, etsyController.createReadinessState);

// @route   GET /api/auth/marketplace/etsy/taxonomy (Protected)
router.get('/marketplace/etsy/taxonomy', protect, etsyController.getSellerTaxonomy);

// @route   GET /api/auth/marketplace/etsy/taxonomy/:taxonomyId/properties (Protected)
router.get('/marketplace/etsy/taxonomy/:taxonomyId/properties', protect, etsyController.getTaxonomyProperties);

// @route   GET /api/auth/marketplace/etsy/return-policies (Protected)
router.get('/marketplace/etsy/return-policies', protect, etsyController.getReturnPolicies);

// @route   POST /api/auth/marketplace/etsy/return-policies (Protected)
router.post('/marketplace/etsy/return-policies', protect, etsyController.createReturnPolicy);

// @route   POST /api/auth/marketplace/etsy/listings/:listingId/videos (Protected)
router.post('/marketplace/etsy/listings/:listingId/videos', protect, upload.single('video'), etsyController.uploadListingVideo);

// @route   POST /api/auth/marketplace/etsy/disconnect (Protected)
router.post('/marketplace/etsy/disconnect', protect, etsyController.disconnectEtsy);

// @route   PATCH /api/auth/marketplace/etsy/listings/:listingId/state (Protected)
router.patch('/marketplace/etsy/listings/:listingId/state', protect, etsyController.updateEtsyListingState);

// @route   DELETE /api/auth/marketplace/etsy/listings/:listingId (Protected)
router.delete('/marketplace/etsy/listings/:listingId', protect, etsyController.deleteEtsyListing);




// ============================================================
// AI PRODUCT PROCESSING ROUTES
// ============================================================

// @route   POST /api/auth/ai/process-product (Protected)
// @desc    Full AI pipeline: enhance image + analyze + generate images + suggest title/desc
router.post('/ai/process-product', protect, upload.single('image'), aiController.processProduct);

// @route   POST /api/auth/ai/enhance-image (Protected)
// @desc    Enhance uploaded product image only
router.post('/ai/enhance-image', protect, upload.single('image'), aiController.enhanceImage);

// @route   POST /api/auth/ai/analyze (Protected)
// @desc    Analyze product from image only
router.post('/ai/analyze', protect, upload.single('image'), aiController.analyzeProductImage);

// @route   POST /api/auth/ai/generate-images (Protected)
// @desc    Generate 2 professional product images
router.post('/ai/generate-images', protect, upload.single('image'), aiController.generateImages);

// @route   POST /api/auth/ai/suggest-listing (Protected)
// @desc    Generate title & description suggestions
router.post('/ai/suggest-listing', protect, upload.single('image'), aiController.suggestListing);

module.exports = router;
