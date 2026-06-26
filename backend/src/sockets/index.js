const WebSocket = require('ws');
const { WebSocketServer } = require('ws');

const connectedClients = new Map();

const initWebSocket = (httpServer) => {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    let currentUserId = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'register' && data.userId) {
          currentUserId = data.userId;
          connectedClients.set(currentUserId, ws);
          console.log(`User ${currentUserId} connected via WebSocket`);
        }
      } catch (err) {
        // Ignore JSON parse errors for non-registration messages
      }
    });

    ws.on('close', () => {
      if (currentUserId) {
        connectedClients.delete(currentUserId);
        console.log(`User ${currentUserId} disconnected`);
      }
    });

    ws.on('error', (err) => {
      console.error(err);
    });
  });
};

const sendToUser = (userId, payload) => {
  const ws = connectedClients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    console.log(`Sent WebSocket event to user ${userId}`);
  } else {
    console.log(`User ${userId} not connected, skipping`);
  }
};

module.exports = { initWebSocket, sendToUser };
