const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        sku: {
            type: String,
            default: () => 'LYS-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        price: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        views: {
            type: Number,
            default: 0
        },
        num_favorers: {
            type: Number,
            default: 0
        },
        brand: {
            type: String,
            default: 'Unbranded'
        },
        condition: {
            type: String,
            default: 'USED_EXCELLENT'
        },
        images: {
            type: [String],
            default: []
        },
        platform: {
            type: String,
            default: 'etsy'
        },
        status: {
            type: String,
            default: 'Listed on ETSY (ACTIVE)'
        },
        listingId: {
            type: String,
            default: null
        },
        listingUrl: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Listing', listingSchema);
