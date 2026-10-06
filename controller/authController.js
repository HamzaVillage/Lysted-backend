const User = require('../modal/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'lysted_jwt_secret_key_2026_change_in_production', {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg,
                errors: errors.array(),
            });
        }

        const { fullName, email, phone, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists',
            });
        }

        // Create new user
        const user = await User.create({
            fullName,
            email,
            phone,
            password,
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user,
        });

    } catch (error) {
        console.error('Register Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg,
                errors: errors.array(),
            });
        }

        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Generate token
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user,
        });

    } catch (error) {
        console.error('Login Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.status(200).json({
            success: true,
            user,
        });

    } catch (error) {
        console.error('GetMe Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
};

// @desc    Google Sign-In / Sign-Up
// @route   POST /api/auth/google
exports.googleAuth = async (req, res) => {
    try {
        const { email, fullName, profileImage, googleId } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required for Google Sign-In',
            });
        }

        let user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            user = await User.create({
                fullName: fullName || 'Google User',
                email: email.toLowerCase(),
                profileImage: profileImage || '',
                googleId: googleId || '',
                authProvider: 'google',
            });
        } else {
            let updated = false;
            if (googleId && !user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (profileImage && !user.profileImage) {
                user.profileImage = profileImage;
                updated = true;
            }
            if (updated) {
                await user.save();
            }
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            success: true,
            message: 'Google authentication successful',
            token,
            user,
        });

    } catch (error) {
        console.error('Google Auth Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error during Google authentication',
            error: error.message,
        });
    }
};
