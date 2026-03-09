const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('./controller/authController');
const { protect } = require('./utils/authMiddleware');

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

module.exports = router;
