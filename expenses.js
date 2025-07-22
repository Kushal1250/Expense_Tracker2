// routes-->expenses.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/receipts/');
    fs.mkdirSync(uploadDir, { recursive: true }); // Ensure directory exists
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Validation middleware
const expenseValidation = [
  body('description').trim().isLength({ min: 1, max: 200 }).withMessage('Description is required and must be less than 200 characters'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('category').isIn(['Food', 'Transportation', 'Entertainment', 'Healthcare', 'Shopping', 'Bills', 'Others']).withMessage('Invalid category')
];

// Get All Expenses with filtering and pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { user: req.user._id };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) {
        filter.date.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.date.$lte = new Date(req.query.dateTo);
      }
    }

    if (req.query.search) {
      filter.$or = [
        { description: { $regex: req.query.search, $options: 'i' } },
        { note: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const expenses = await Expense.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const totalExpenses = await Expense.countDocuments(filter);
    const totalPages = Math.ceil(totalExpenses / limit);

    res.json({
      expenses,
      pagination: {
        currentPage: page,
        totalPages,
        totalExpenses,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});


router.get('/export', auth, async (req, res) => {
    try {
        // ... existing filter logic ...
        
        const expenses = await Expense.find(filter).sort({ date: -1 });
        
        let csv = 'Description,Amount,Category,Note,Date,Receipt URL\n';
        expenses.forEach(expense => {
            const receiptUrl = expense.receipt ? `${req.protocol}://${req.get('host')}${expense.receipt}` : '';
            csv += `"${expense.description}",${expense.amount},"${expense.category}","${expense.note || ''}","${expense.date}","${receiptUrl}"\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
        res.send(csv);
    } catch (error) {
        // ... error handling ...
    }
});

// Get Expense Statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get current month's expenses
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(currentMonth.getMonth() + 1);

    const monthlyExpenses = await Expense.find({
      user: userId,
      date: { $gte: currentMonth, $lt: nextMonth }
    });

    const totalMonthly = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Category breakdown
    const categoryStats = await Expense.aggregate([
      { $match: { user: userId, date: { $gte: currentMonth, $lt: nextMonth } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Overall statistics
    const allExpenses = await Expense.find({ user: userId });
    const total = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const average = allExpenses.length > 0 ? total / allExpenses.length : 0;
    const highest = allExpenses.length > 0 ? Math.max(...allExpenses.map(e => e.amount)) : 0;

    res.json({
      monthly: {
        total: totalMonthly,
        budgetUsed: (totalMonthly / req.user.budgetCap) * 100,
        categories: categoryStats
      },
      overall: {
        total: total.toFixed(2),
        average: average.toFixed(2),
        highest: highest.toFixed(2),
        count: allExpenses.length
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Add Expense
router.post('/', auth, upload.single('receipt'), expenseValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const expenseData = {
      description: req.body.description,
      amount: parseFloat(req.body.amount),
      category: req.body.category,
      note: req.body.note || '',
      user: req.user._id,
      receipt: req.file ? `/uploads/receipts/${req.file.filename}` : null
    };

    if (req.body.date) {
      expenseData.date = new Date(req.body.date);
    }

    const expense = new Expense(expenseData);
    await expense.save();
    
    res.status(201).json({
      message: 'Expense added successfully',
      expense
    });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: error.message || 'Failed to add expense' });
  }
});

// Update Expense
router.put('/:id', auth, expenseValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({
      message: 'Expense updated successfully',
      expense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete Expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // TODO: Delete associated receipt file if exists
    
    res.json({
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});
// Add this to your expenses.js route file

// Export expenses endpoint
router.get('/export', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const { period, category, dateFrom, dateTo } = req.query;
        
        // Build filter object
        const filter = { user: userId };
        
        if (category && category !== 'all') {
            filter.category = category;
        }
        
        // Apply date filters
        if (period === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            filter.date = { $gte: today, $lt: tomorrow };
        } else if (period === 'week') {
            const now = new Date();
            const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
            weekStart.setHours(0, 0, 0, 0);
            filter.date = { $gte: weekStart };
        } else if (period === 'month') {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            filter.date = { $gte: monthStart };
        } else if (dateFrom || dateTo) {
            filter.date = {};
            if (dateFrom) {
                filter.date.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                filter.date.$lte = toDate;
            }
        }
        
        const expenses = await Expense.find(filter)
            .sort({ date: -1 })
            .lean();
        
        // Generate CSV content
        let csv = 'Description,Amount,Category,Note,Date,Receipt URL\n';
        
        expenses.forEach(expense => {
            const receiptUrl = expense.receipt 
                ? `${req.protocol}://${req.get('host')}${expense.receipt}`
                : '';
            
            csv += `"${expense.description}",${expense.amount},"${expense.category}","${expense.note || ''}","${expense.date}","${receiptUrl}"\n`;
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
        
        // Send the CSV
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export expenses' });
    }
});
module.exports = router;
