require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes.js');
const inventoryRoutes = require('./routes/inventory.routes.js');
const posRoutes = require('./routes/pos.routes.js');
const reportsRoutes = require('./routes/reports.routes.js');
const auditRoutes = require('./routes/audit.routes.js');
const notificationsRoutes = require('./routes/notifications.routes.js');

const { initWebSocket } = require('./sockets/index.js');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: "YAB Chemicals API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const server = http.createServer(app);

initWebSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("YAB Chemicals server running on port " + PORT);
  console.log("Environment: " + process.env.NODE_ENV);
  console.log("WebSocket server initialized");
});
