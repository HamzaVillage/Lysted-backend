const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
    },
    profileImage: {
        type: String,
        default: '',
    },
    marketplaces: {
        poshmark: {
            connected: { type: Boolean, default: false },
            email: { type: String, default: '' },
            cookies: { type: Object, default: {} },
            connectedAt: { type: Date }
        },
        ebay: {
            connected: { type: Boolean, default: false },
            email: { type: String, default: '' },
            tokens: { type: Object, default: {} },
            connectedAt: { type: Date }
        },
        facebook: {
            connected: { type: Boolean, default: false },
            email: { type: String, default: '' },
            connectedAt: { type: Date }
        },
        depop: {
            connected: { type: Boolean, default: false },
            email: { type: String, default: '' },
            connectedAt: { type: Date }
        },
        mercari: {
            connected: { type: Boolean, default: false },
            email: { type: String, default: '' },
            connectedAt: { type: Date }
        },
        offerup: {
            connected: { type: Boolean, default: false },
            email: { type: String, default: '' },
            connectedAt: { type: Date }
        }
    },
}, {
    timestamps: true,
});

// Password hash before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
