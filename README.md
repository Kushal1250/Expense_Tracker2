# 💸 Expense Tracker 2

A full-stack, responsive, and modern expense tracking web application designed to help users manage their personal finances with ease. It includes budgeting, analytics, secure login, offline access, and receipt uploads.

![Banner](https://img.shields.io/badge/MERN%20Stack-Full%20Project-green?style=for-the-badge&logo=mongodb)

## 🔍 Project Overview

**Expense Tracker 2** allows users to:
- Track daily/monthly/yearly expenses
- Set and monitor monthly budget limits
- Visualize category-wise spending
- Upload and store expense receipts
- Get notifications for overspending
- Export data as Excel/PDF
- Access offline via PWA support

---

## 🚀 Features

✅ User Authentication (JWT + bcrypt)  
✅ Monthly Budget & Progress Bar  
✅ Receipt Upload (Image Support)  
✅ Category & Time Filtering  
✅ Pie and Line Graph Analytics  
✅ Notes for Every Expense  
✅ Dark Mode + Responsive Design  
✅ PWA: Offline Support  
✅ PDF/Excel Export  
✅ Notification Alerts  
✅ Persistent Login

---

## 🛠️ Tech Stack

| Frontend         | Backend         | Database       | Other Features       |
|------------------|------------------|----------------|-----------------------|
| HTML, CSS, JS     | Node.js + Express | MongoDB        | JWT Auth, Multer (file uploads) |
| React (optional) | REST API         | Mongoose       | PWA, Chart.js, PDFKit/ExcelJS |

---

## 📁 Project Structure

Expense_Tracker2/
├── backend/
│ ├── models/
│ ├── routes/
│ └── server.js
├── frontend/
│ ├── index.html
│ ├── script.js
│ └── style.css
├── uploads/
├── .env
├── package.json
└── README.md



---

## 🧑‍💻 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Kushal1250/Expense_Tracker2.git
cd Expense_Tracker2


npm install
cd frontend
npm install


# Backend
npm run server

# Frontend (optional if using React)
npm start
