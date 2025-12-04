import http, { IncomingMessage, ServerResponse } from 'node:http';
import { AssignmentEngine } from '../src/core/AssignmentEngine';
import { MOCK_HISTORY, MOCK_MEETING_WEEK, MOCK_PUBLISHERS } from '../src/mocks/mockData';
import {
  AssignmentHistory,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
  MeetingPart,
  Publisher,
} from '../src/types/models';

const PORT = Number(process.env.PORT ?? 3333);

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
};

const consumeBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/generateAssignments') {
    try {
      const rawBody = await consumeBody(req);
      const payload: Partial<GenerateAssignmentsRequest> = rawBody ? JSON.parse(rawBody) : {};

      const parts = payload.parts ?? MOCK_MEETING_WEEK;
      const publishers = payload.publishers ?? MOCK_PUBLISHERS;
      const history = payload.history ?? MOCK_HISTORY;
      const meetingDate = payload.meetingDate ?? parts[0]?.week ?? new Date().toISOString().split('T')[0];

      const result = AssignmentEngine.generateAssignments(parts, publishers, history, meetingDate);
      const responseBody: GenerateAssignmentsResponse = {
        assignments: result.assignments,
        warnings: result.warnings,
      };

      sendJson(res, 200, responseBody);
    } catch (error) {
      console.error('[mock-api] Failed to handle request', error);
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`Mock AssignmentEngine API listening on http://localhost:${PORT}`);
  console.log('POST /api/generateAssignments to produce assignments.');
});
