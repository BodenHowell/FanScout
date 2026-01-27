const User = require('../models/user');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, username, email, password } = req.body;

        // Create user
        const user = await User.create({
            name,
            username,
            email,
            password
        });

        sendTokenResponse(user, 201, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: {
                ...user.toObject(),
                followersCount: user.followers.length,
                followingCount: user.following.length
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
    try {
        console.log('Update details request body:', req.body);
        const fieldsToUpdate = {
            name: req.body.name,
            username: req.body.username,
            email: req.body.email,
            avatar: req.body.avatar
        };

        // Remove undefined and empty fields
        Object.keys(fieldsToUpdate).forEach(key => {
            if (fieldsToUpdate[key] === undefined || fieldsToUpdate[key] === '') {
                delete fieldsToUpdate[key];
            }
        });

        console.log('Fields to update:', fieldsToUpdate);

        const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });

        console.log('Updated user:', user);

        res.status(200).json({
            success: true,
            data: {
                ...user.toObject(),
                followersCount: user.followers.length,
                followingCount: user.following.length
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        if (!(await user.matchPassword(req.body.currentPassword))) {
            return res.status(401).json({
                success: false,
                error: 'Password is incorrect'
            });
        }

        user.password = req.body.newPassword;
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();

    const options = {
        expires: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        ),
        httpOnly: true
    };

    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
};