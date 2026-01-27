const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array()); // Debug log
        console.log('Request body:', req.body); // Debug log
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// Auth validations
const authValidation = {
    register: [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
        body('username')
            .trim()
            .notEmpty().withMessage('Username is required')
            .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3-20 characters')
            .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Please provide a valid email')
            .normalizeEmail(),
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        validate
    ],
    login: [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Please provide a valid email')
            .normalizeEmail(),
        body('password')
            .notEmpty().withMessage('Password is required'),
        validate
    ],
    updateDetails: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
        body('username')
            .optional()
            .trim()
            .custom((value) => {
                if (value && value.length > 0) {
                    if (value.length < 3 || value.length > 20) {
                        throw new Error('Username must be between 3-20 characters');
                    }
                    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                        throw new Error('Username can only contain letters, numbers, and underscores');
                    }
                }
                return true;
            }),
        body('email')
            .optional()
            .trim()
            .isEmail().withMessage('Please provide a valid email')
            .normalizeEmail(),
        validate
    ]
};

// Transaction validations
const transactionValidation = {
    create: [
        body('athleteName')
            .trim()
            .notEmpty().withMessage('Athlete name is required'),
        body('type')
            .notEmpty().withMessage('Transaction type is required')
            .isIn(['buy', 'sell']).withMessage('Type must be buy or sell'),
        body('quantity')
            .notEmpty().withMessage('Quantity is required')
            .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
        body('pricePerShare')
            .notEmpty().withMessage('Price per share is required')
            .isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
        validate
    ]
};

// Message validations
const messageValidation = {
    send: [
        param('id')
            .isMongoId().withMessage('Invalid conversation ID'),
        body('text')
            .trim()
            .notEmpty().withMessage('Message text is required')
            .isLength({ max: 1000 }).withMessage('Message too long'),
        body('offer')
            .optional()
            .isObject().withMessage('Offer must be an object'),
        validate
    ]
};

// Ownership validations
const ownershipValidation = {
    update: [
        body('athleteName')
            .trim()
            .notEmpty().withMessage('Athlete name is required'),
        body('quantity')
            .notEmpty().withMessage('Quantity is required')
            .isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
        body('type')
            .notEmpty().withMessage('Type is required')
            .isIn(['buy', 'sell']).withMessage('Type must be buy or sell'),
        validate
    ]
};

// Query validations
const queryValidation = {
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
        validate
    ],
    filter: [
        query('sport')
            .optional()
            .isIn(['all', 'nfl', 'nba', 'ncaaf', 'ncaab', 'soccer', 'f1', 'tennis', 'ufc', 'golf', 'track', 'mlb', 'nhl'])
            .withMessage('Invalid sport filter'),
        query('minPrice')
            .optional()
            .isFloat({ min: 0 }).withMessage('Min price must be non-negative'),
        query('maxPrice')
            .optional()
            .isFloat({ min: 0 }).withMessage('Max price must be non-negative'),
        query('sortBy')
            .optional()
            .isIn(['name', 'price', 'change', 'marketCap']).withMessage('Invalid sort field'),
        query('order')
            .optional()
            .isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
        validate
    ]
};

module.exports = {
    authValidation,
    transactionValidation,
    messageValidation,
    ownershipValidation,
    queryValidation
};