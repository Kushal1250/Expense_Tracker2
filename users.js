// routes-->User.ja
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Update Budget
router.patch('/budget', auth, [
  body('budgetCap').isFloat({ min: 0 }).withMessage('Budget must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    req.user.budgetCap = req.body.budgetCap;
    await req.user.save();

    res.json({
      message: 'Budget updated successfully',
      user: req.user
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Update Profile
router.patch('/profile', auth, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const updates = ['name', 'currency'];
    updates.forEach(update => {
      if (req.body[update] !== undefined) {
        req.user[update] = req.body[update];
      }
    });

    await req.user.save();

    res.json({
      message: 'Profile updated successfully',
      user: req.user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
