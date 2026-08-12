import dotenv from 'dotenv';
dotenv.config();
import path from 'path';

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import restaurantRoutes from './routes/restaurant.routes';
import menuRoutes from './routes/menu.routes';
import tableRoutes from './routes/table.routes';
import orderRoutes from './routes/order.routes';
import billRoutes from './routes/bill.routes';
import kotRoutes from './routes/kot.routes';
import crmRoutes from './routes/crm.routes';
import inventoryRoutes from './routes/inventory.routes';
import reportRoutes from './routes/report.routes';
import notificationRoutes from './routes/notification.routes';
import integrationRoutes from './routes/integration.routes';
import subscriptionRoutes from './routes/subscription.routes';
import superadminRoutes from './routes/superadmin.routes';

const app = express();
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust in production
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('join_branch', (branchId: string) => {
    socket.join(branchId);
    console.log(`[Socket] Client ${socket.id} joined branch room: ${branchId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Expose io object on express request so controllers can use it
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Extend Express Request to include Socket.IO
declare global {
  namespace Express {
    interface Request {
      io?: Server;
    }
  }
}

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate Limiter (Prevent brute-force)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Limit each IP to 100 (prod) or 10000 (dev) requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', apiLimiter);

// Routes
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Canwe POS Backend API Server is running!',
    frontendUrl: 'http://localhost:3000',
    healthCheck: 'http://localhost:4000/health',
    timestamp: new Date()
  });
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});
app.use('/api/auth', authRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/kots', kotRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/superadmin', superadminRoutes);

// Serve Mock POS UI Dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Server] Canwe POS backend running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
}

export { app, server, io };
