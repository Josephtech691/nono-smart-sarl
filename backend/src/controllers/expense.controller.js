const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { createdAtRange } = require('../utils/orderSearch');

// Gestion des depenses + estimation du benefice (section 51)
const listExpenses = asyncHandler(async (req, res) => {
  const expenses = await prisma.expense.findMany({ orderBy: { incurredAt: 'desc' } });
  res.json(expenses);
});

const createExpense = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.incurredAt) data.incurredAt = new Date(data.incurredAt);
  const expense = await prisma.expense.create({ data });
  res.status(201).json(expense);
});

const deleteExpense = asyncHandler(async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.json({ message: 'Depense supprimee' });
});

// GET /api/expenses/profit-estimate?from=&to=
const profitEstimate = asyncHandler(async (req, res) => {
  // Dates « AAAA-MM-JJ » (jours de Douala) ; la date de fin inclut toute la journee.
  const range = createdAtRange(req.query.from, req.query.to);

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' }, ...(range ? { createdAt: range } : {}) },
      select: { subtotal: true, deliveryFee: true, total: true },
    }),
    prisma.expense.findMany({ where: range ? { incurredAt: range } : undefined }),
  ]);

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const deliveryCosts = orders.reduce((s, o) => s + o.deliveryFee, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const estimatedProfit = revenue - totalExpenses - deliveryCosts;

  res.json({ revenue, deliveryCosts, totalExpenses, estimatedProfit });
});

module.exports = { listExpenses, createExpense, deleteExpense, profitEstimate };
