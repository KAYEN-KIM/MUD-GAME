import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import { setupWebSocketServer } from './server/ws';
import restRouter from './server/rest';

const PORT = parseInt(process.env.PORT || '3000', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);

// Express 앱 설정
const app = express();

app.use(cors());
app.use(express.json());
app.use(restRouter);

// REST API 서버 시작
app.listen(PORT, () => {
  console.log(`REST API server running on port ${PORT}`);
});

// WebSocket 서버 시작
const wss = new WebSocket.Server({ port: WS_PORT });
setupWebSocketServer(wss);

console.log(`WebSocket server running on port ${WS_PORT}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  wss.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  wss.close(() => {
    process.exit(0);
  });
});

