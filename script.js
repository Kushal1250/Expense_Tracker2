// script.js
// Constants and Configuration
const API = 'http://localhost:5000/api/expenses';
const USER_API = 'http://localhost:5000/api/auth';
const USERS_API = 'http://localhost:5000/api/users';

// Global State
let currentUser = null;
let expenses = [];
let currentPage = 1;
let totalPages = 1;
let charts = {
  budget: null,
  trend: null
};

// DOM Elements
const elements = {
  // Forms
  expenseForm: document.getElementById('expenseForm'),
  budgetForm: document.getElementById('budgetForm'),
  
  // Lists and containers
  expensesList: document.getElementById('expensesList'),
  toastContainer: document.getElementById('toastContainer'),
  
  // Buttons
  logoutBtn: document.getElementById('logoutBtn'),
  setBudgetBtn: document.getElementById('setBudgetBtn'),
  exportCSV: document.getElementById('exportCSV'),
  toggleDark: document.getElementById('toggleDark'),
  refreshExpenses: document.getElementById('refreshExpenses'),
  clearFilters: document.getElementById('clearFilters'),
  
  // Filters
  searchExpenses: document.getElementById('searchExpenses'),
  filterCategory: document.getElementById('filterCategory'),
  filterPeriod: document.getElementById('filterPeriod'),
  
  // Stats
  totalAmount: document.getElementById('totalAmount'),
  avgAmount: document.getElementById('avgAmount'),
  highestAmount: document.getElementById('highestAmount'),
  expenseCount: document.getElementById('expenseCount'),
  budgetPercentage: document.getElementById('budgetPercentage'),
  budgetUsed: document.getElementById('budgetUsed'),
  budgetTotal: document.getElementById('budgetTotal'),
  
  // Pagination
  pagination: document.getElementById('pagination'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageInfo: document.getElementById('pageInfo'),
  
  // Modals and overlays
  budgetModal: document.getElementById('budgetModal'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  expensesLoader: document.getElementById('expensesLoader'),
  noExpenses: document.getElementById('noExpenses')
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkAuth();
    await loadExpenses();
    await loadStats();
    setupEventListeners();
    initializeDateField();
    loadTheme();
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize app', 'error');
  }
});

// Authentication Functions
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const response = await fetch(`${USER_API}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    currentUser = data.user;
    updateBudgetDisplay();
  } catch (error) {
    console.error('Auth check failed:', error);
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

// Expense Management
async function loadExpenses(page = 1, filters = {}) {
  try {
    showLoader('expenses');
    
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '10',
      ...filters
    });

    const response = await fetch(`${API}?${params}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load expenses');
    }

    const data = await response.json();
    expenses = data.expenses || [];
    currentPage = data.pagination.currentPage;
    totalPages = data.pagination.totalPages;

    displayExpenses();
    updatePagination();
    hideLoader('expenses');

  } catch (error) {
    console.error('Load expenses error:', error);
    hideLoader('expenses');
    showToast('Failed to load expenses', 'error');
  }
}

function displayExpenses() {
  const tbody = elements.expensesList;
  tbody.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    elements.noExpenses.classList.remove('hidden');
    elements.pagination.classList.add('hidden');
    return;
  }

  elements.noExpenses.classList.add('hidden');

  expenses.forEach((expense, index) => {
    const row = createExpenseRow(expense, index + ((currentPage - 1) * 10) + 1);
    tbody.appendChild(row);
  });

  updatePagination();
}

function createExpenseRow(expense, serialNumber) {
  const row = document.createElement('tr');
  const date = new Date(expense.date).toLocaleDateString('en-IN');
  const categoryIcon = getCategoryIcon(expense.category);
  
  row.innerHTML = `
    <td>${serialNumber}</td>
    <td>${date}</td>
    <td class="expense-description" title="${expense.description}">
      ${expense.description.length > 30 ? expense.description.substring(0, 30) + '...' : expense.description}
    </td>
    <td class="expense-amount">₹${expense.amount.toFixed(2)}</td>
    <td class="expense-category">
      <span class="category-tag">${categoryIcon} ${expense.category}</span>
    </td>
    <td class="expense-note" title="${expense.note || 'No notes'}">
      ${expense.note && expense.note.length > 20 ? expense.note.substring(0, 20) + '...' : expense.note || 'No notes'}
    </td>
    <td class="expense-actions">
      <button class="btn btn-sm btn-danger" onclick="deleteExpense('${expense._id}')" title="Delete">
        🗑️
      </button>
      ${expense.receipt ? `<button class="btn btn-sm btn-outline" onclick="viewReceipt('${expense.receipt}')" title="View Receipt">📎</button>` : ''}
    </td>
  `;
  
  return row;
}

async function addExpense(event) {
  event.preventDefault();
  
  try {
    showLoadingOverlay('Adding expense...');
    
    const formData = new FormData(elements.expenseForm);
    
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add expense');
    }

    const data = await response.json();
    
    // Reset form
    elements.expenseForm.reset();
    initializeDateField();
    
    // Reload data
    await Promise.all([loadExpenses(1), loadStats()]);
    
    showToast('Expense added successfully! 🎉', 'success');
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Add expense error:', error);
    hideLoadingOverlay();
    showToast(error.message, 'error');
  }
}

async function deleteExpense(expenseId) {
  if (!confirm('Are you sure you want to delete this expense?')) {
    return;
  }

  try {
    showLoadingOverlay('Deleting expense...');
    
    const response = await fetch(`${API}/${expenseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      throw new Error('Failed to delete expense');
    }

    await Promise.all([loadExpenses(currentPage), loadStats()]);
    
    showToast('Expense deleted successfully', 'success');
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Delete expense error:', error);
    hideLoadingOverlay();
    showToast('Failed to delete expense', 'error');
  }
}

// Statistics and Charts
async function loadStats() {
  try {
    const response = await fetch(`${API}/stats`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load statistics');
    }

    const stats = await response.json();
    
    // Update summary display
    elements.totalAmount.textContent = stats.overall.total;
    elements.avgAmount.textContent = stats.overall.average;
    elements.highestAmount.textContent = stats.overall.highest;
    elements.expenseCount.textContent = stats.overall.count;
    
    // Update budget display
    const budgetUsed = stats.monthly.budgetUsed.toFixed(1);
    elements.budgetPercentage.textContent = `${budgetUsed}%`;
    elements.budgetUsed.textContent = stats.monthly.total.toFixed(2);
    
    // Update charts
    updateBudgetChart(stats.monthly);
    updateTrendChart();
    
  } catch (error) {
    console.error('Load stats error:', error);
    showToast('Failed to load statistics', 'error');
  }
}

function updateBudgetChart(monthlyStats) {
  const ctx = document.getElementById('budgetChart');
  if (!ctx) return;

  if (charts.budget) {
    charts.budget.destroy();
  }

  const used = monthlyStats.total;
  const remaining = Math.max(0, currentUser.budgetCap - used);
  const over = used > currentUser.budgetCap ? used - currentUser.budgetCap : 0;

  charts.budget = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: over > 0 ? ['Used', 'Over Budget'] : ['Used', 'Remaining'],
      datasets: [{
        data: over > 0 ? [currentUser.budgetCap, over] : [used, remaining],
        backgroundColor: over > 0 ? 
          ['#ff6b6b', '#ff3333'] : 
          ['#009688', '#e0f2f1'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      cutout: '70%'
    }
  });
}

async function updateTrendChart() {
  try {
    // Fetch last 30 days of expenses for trend
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const response = await fetch(`${API}?dateFrom=${thirtyDaysAgo.toISOString()}&limit=1000`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) return;

    const data = await response.json();
    const expensesData = data.expenses || [];
    
    // Group expenses by date
    const dailyTotals = {};
    expensesData.forEach(expense => {
      const date = new Date(expense.date).toLocaleDateString('en-IN');
      dailyTotals[date] = (dailyTotals[date] || 0) + expense.amount;
    });

    // Create chart data
    const dates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));
    const amounts = dates.map(date => dailyTotals[date]);

    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (charts.trend) {
      charts.trend.destroy();
    }

    charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Daily Expenses',
          data: amounts,
          borderColor: '#009688',
          backgroundColor: 'rgba(0, 150, 136, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + value;
              }
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Trend chart error:', error);
  }
}

// Budget Management
async function setBudget(event) {
  event.preventDefault();
  
  try {
    showLoadingOverlay('Updating budget...');
    
    const budgetAmount = parseFloat(document.getElementById('budgetAmount').value);
    
    const response = await fetch(`${USERS_API}/budget`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ budgetCap: budgetAmount })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update budget');
    }

    const data = await response.json();
    currentUser = data.user;
    
    closeBudgetModal();
    updateBudgetDisplay();
    await loadStats();
    
    showToast('Budget updated successfully! 💰', 'success');
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Set budget error:', error);
    hideLoadingOverlay();
    showToast(error.message, 'error');
  }
}

function updateBudgetDisplay() {
  if (currentUser && elements.budgetTotal) {
    elements.budgetTotal.textContent = currentUser.budgetCap.toFixed(2);
  }
}

// Modal Functions
function openBudgetModal() {
  elements.budgetModal.classList.remove('hidden');
  document.getElementById('budgetAmount').value = currentUser ? currentUser.budgetCap : '';
}

function closeBudgetModal() {
  elements.budgetModal.classList.add('hidden');
}

// Filtering and Search
function applyFilters() {
  const filters = {};
  
  const search = elements.searchExpenses.value.trim();
  if (search) filters.search = search;
  
  const category = elements.filterCategory.value;
  if (category) filters.category = category;
  
  const period = elements.filterPeriod.value;
  if (period) {
    const dates = getPeriodDates(period);
    if (dates.from) filters.dateFrom = dates.from;
    if (dates.to) filters.dateTo = dates.to;
  }
  
  loadExpenses(1, filters);
}

function clearFilters() {
  elements.searchExpenses.value = '';
  elements.filterCategory.value = '';
  elements.filterPeriod.value = '';
  loadExpenses(1);
}

function getPeriodDates(period) {
  const now = new Date();
  const dates = {};
  
  switch (period) {
    case 'today':
      dates.from = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      dates.to = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      dates.from = weekStart.toISOString();
      break;
    case 'month':
      dates.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    case 'year':
      dates.from = new Date(now.getFullYear(), 0, 1).toISOString();
      break;
  }
  
  return dates;
}

// Pagination
function updatePagination() {
  if (totalPages <= 1) {
    elements.pagination.classList.add('hidden');
    return;
  }
  
  elements.pagination.classList.remove('hidden');
  elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  
  elements.prevPage.disabled = currentPage <= 1;
  elements.nextPage.disabled = currentPage >= totalPages;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  
  const filters = getCurrentFilters();
  loadExpenses(page, filters);
}

function getCurrentFilters() {
  const filters = {};
  
  const search = elements.searchExpenses.value.trim();
  if (search) filters.search = search;
  
  const category = elements.filterCategory.value;
  if (category) filters.category = category;
  
  const period = elements.filterPeriod.value;
  if (period) {
    const dates = getPeriodDates(period);
    if (dates.from) filters.dateFrom = dates.from;
    if (dates.to) filters.dateTo = dates.to;
  }
  
  return filters;
}

// Export Functions
async function exportToCSV() {
  try {
    showLoadingOverlay('Preparing export...');
    
    // Fetch all expenses
    const response = await fetch(`${API}?limit=10000`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch expenses for export');
    }

    const data = await response.json();
    const expenses = data.expenses || [];

    if (expenses.length === 0) {
      throw new Error('No expenses to export');
    }

    // Create CSV content
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...expenses.map(expense => [
        new Date(expense.date).toLocaleDateString('en-IN'),
        `"${expense.description.replace(/"/g, '""')}"`,
        expense.amount,
        expense.category,
        `"${(expense.note || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Expenses exported successfully! 📄', 'success');
    hideLoadingOverlay();
    
  } catch (error) {
    console.error('Export error:', error);
    hideLoadingOverlay();
    showToast(error.message, 'error');
  }
}

// Utility Functions
function getCategoryIcon(category) {
  const icons = {
    'Food': '🍔',
    'Transportation': '🚗',
    'Entertainment': '🎬',
    'Healthcare': '⚕️',
    'Shopping': '🛒',
    'Bills': '💡',
    'Others': '📦'
  };
  return icons[category] || '📦';
}

function initializeDateField() {
  const dateInput = document.getElementById('date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// UI Helper Functions
function showLoader(type) {
  if (type === 'expenses') {
    elements.expensesLoader.classList.remove('hidden');
    elements.expensesList.innerHTML = '';
  }
}

function hideLoader(type) {
  if (type === 'expenses') {
    elements.expensesLoader.classList.add('hidden');
  }
}

function showLoadingOverlay(message = 'Loading...') {
  const overlay = elements.loadingOverlay;
  overlay.querySelector('span').textContent = message;
  overlay.classList.remove('hidden');
}

function hideLoadingOverlay() {
  elements.loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
  
  // Manual close
  toast.querySelector('.toast-close').onclick = () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  };
}

// Theme Management
function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  elements.toggleDark.textContent = isDark ? '☀️' : '🌙';
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    elements.toggleDark.textContent = '☀️';
  }
}

// Receipt Functions
function viewReceipt(receiptPath) {
  const receiptUrl = `http://localhost:5000/${receiptPath}`;
  window.open(receiptUrl, '_blank');
}

// Logout Function
async function logout() {
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }
  
  try {
    await fetch(`${USER_API}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}

// Event Listeners Setup
function setupEventListeners() {
  // Forms
  elements.expenseForm?.addEventListener('submit', addExpense);
  elements.budgetForm?.addEventListener('submit', setBudget);
  
  // Buttons
  elements.logoutBtn?.addEventListener('click', logout);
  elements.setBudgetBtn?.addEventListener('click', openBudgetModal);
  elements.exportCSV?.addEventListener('click', exportToCSV);
  elements.toggleDark?.addEventListener('click', toggleTheme);
  elements.refreshExpenses?.addEventListener('click', () => loadExpenses(currentPage));
  elements.clearFilters?.addEventListener('click', clearFilters);
  
  // Filters
  elements.searchExpenses?.addEventListener('input', debounce(applyFilters, 500));
  elements.filterCategory?.addEventListener('change', applyFilters);
  elements.filterPeriod?.addEventListener('change', applyFilters);
  
  // Pagination
  elements.prevPage?.addEventListener('click', () => goToPage(currentPage - 1));
  elements.nextPage?.addEventListener('click', () => goToPage(currentPage + 1));
  
  // Modal close
  elements.budgetModal?.querySelector('.modal-close')?.addEventListener('click', closeBudgetModal);
  
  // Close modal on backdrop click
  elements.budgetModal?.addEventListener('click', (e) => {
    if (e.target === elements.budgetModal) {
      closeBudgetModal();
    }
  });
  
  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBudgetModal();
    }
  });
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.budgetCap = parseFloat(localStorage.getItem('budgetCap')) || 0;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredExpenses = [...this.expenses];
        this.budgetChart = null;
        this.trendChart = null;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadBudgetCap();
        this.applyDarkMode();
        this.renderExpenses();
        this.updateSummary();
        this.renderCharts();
    }

    setupEventListeners() {
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        document.getElementById('budgetCap').addEventListener('blur', (e) => {
            this.setBudgetCap(parseFloat(e.target.value) || 0);
        });

        // Add other event listeners for filters, pagination, etc.
    }

    addExpense() {
        const description = document.getElementById('description').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const note = document.getElementById('note').value;
        const receipt = document.getElementById('receipt').files[0];

        const expense = {
            id: Date.now().toString(),
            description,
            amount,
            category,
            note,
            date: new Date().toISOString(),
            receipt: receipt ? URL.createObjectURL(receipt) : null
        };

        this.expenses.unshift(expense);
        this.saveToLocalStorage();
        this.renderExpenses();
        this.updateSummary();
        this.renderCharts();
        this.updateBudgetProgress();

        document.getElementById('expenseForm').reset();
        this.showToast('Expense added successfully!');
    }

    deleteExpense(id) {
        this.expenses = this.expenses.filter(expense => expense.id !== id);
        this.saveToLocalStorage();
        this.renderExpenses();
        this.updateSummary();
        this.renderCharts();
        this.updateBudgetProgress();
        this.showToast('Expense deleted successfully!');
    }

    // Implement other methods like applyFilters, renderExpenses, updateSummary, etc.
}

// Initialize the application
const expenseTracker = new ExpenseTracker();
