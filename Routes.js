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

// @route   POST /api/auth/marketplace/etsy/disconnect (Protected)
router.post('/marketplace/etsy/disconnect', protect, etsyController.disconnectEtsy);


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
