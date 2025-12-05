import http, { IncomingMessage, ServerResponse } from 'node:http';
import { AssignmentEngine } from '../src/core/AssignmentEngine';
import { MOCK_HISTORY, MOCK_MEETING_WEEK, MOCK_PUBLISHERS } from '../src/mocks/mockData';
import {
  AssignmentHistory,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResponse,
  MeetingPart,
  Publisher,
  ApprovalStatus,
} from '../src/types/models';

const PORT = Number(process.env.PORT ?? 3333);

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const consumeJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const rawBody = await consumeBody(req);
  if (!rawBody) {
    return {} as T;
  }
  return JSON.parse(rawBody) as T;
};

const meetingDataset = {
  meetingDate: MOCK_MEETING_WEEK[0]?.week ?? new Date().toISOString().split('T')[0],
  parts: MOCK_MEETING_WEEK,
  publishers: MOCK_PUBLISHERS,
  history: MOCK_HISTORY,
};

interface AssignmentApprovalRecord {
  storageKey: string;
  assignmentId?: string;
  meetingPartId: string;
  meetingDate: string;
  status: ApprovalStatus;
  approvedByElderId?: string;
  updatedAt: string;
}

const approvalStore = new Map<string, AssignmentApprovalRecord>();

const getApprovalKey = (meetingDate: string, meetingPartId: string) => `${meetingDate}::${meetingPartId}`;

const persistApprovalRecord = (payload: Omit<AssignmentApprovalRecord, 'storageKey' | 'updatedAt'> & { storageKey?: string }): AssignmentApprovalRecord => {
  const storageKey = payload.storageKey ?? getApprovalKey(payload.meetingDate, payload.meetingPartId);
  const record: AssignmentApprovalRecord = {
    storageKey,
    assignmentId: payload.assignmentId,
    meetingPartId: payload.meetingPartId,
    meetingDate: payload.meetingDate,
    status: payload.status,
    approvedByElderId: payload.approvedByElderId,
    updatedAt: new Date().toISOString(),
  };
  approvalStore.set(storageKey, record);
  return record;
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname, searchParams } = url;

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/meetingData') {
    sendJson(res, 200, meetingDataset);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/assignmentApprovals') {
    const requestedWeek = searchParams.get('meetingDate');
    const records = Array.from(approvalStore.values()).filter(record =>
      requestedWeek ? record.meetingDate === requestedWeek : true
    );
    sendJson(res, 200, { records });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/assignmentApprovals') {
    try {
      const body = await consumeJsonBody<{
        assignmentId?: string;
        meetingPartId?: string;
        meetingDate?: string;
        status?: ApprovalStatus;
        approvedByElderId?: string;
      }>(req);

      if (!body.meetingPartId || !body.status) {
        sendJson(res, 400, { error: 'meetingPartId and status are required' });
        return;
      }

      const record = persistApprovalRecord({
        assignmentId: body.assignmentId,
        meetingPartId: body.meetingPartId,
        meetingDate: body.meetingDate ?? meetingDataset.meetingDate,
        status: body.status,
        approvedByElderId: body.approvedByElderId,
      });

      sendJson(res, 200, { record });
    } catch (error) {
      console.error('[mock-api] Failed to persist approval', error);
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/assignmentApprovals/bulk') {
    try {
      const body = await consumeJsonBody<{
        meetingDate?: string;
        updates?: Array<{
          assignmentId?: string;
          meetingPartId: string;
          status: ApprovalStatus;
          approvedByElderId?: string;
        }>;
      }>(req);

      const meetingDate = body.meetingDate ?? meetingDataset.meetingDate;
      const updates = Array.isArray(body.updates) ? body.updates : [];

      const records = updates.map(update =>
        persistApprovalRecord({
          assignmentId: update.assignmentId,
          meetingPartId: update.meetingPartId,
          meetingDate,
          status: update.status,
          approvedByElderId: update.approvedByElderId,
        })
      );

      sendJson(res, 200, { records });
    } catch (error) {
      console.error('[mock-api] Failed to persist bulk approvals', error);
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/generateAssignments') {
    try {
      const payload = await consumeJsonBody<Partial<GenerateAssignmentsRequest>>(req);

      const parts = payload.parts ?? meetingDataset.parts;
      const publishers = payload.publishers ?? meetingDataset.publishers;
      const history = payload.history ?? meetingDataset.history;
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
  console.log('Available endpoints:');
  console.log('  GET  /api/meetingData');
  console.log('  POST /api/generateAssignments');
  console.log('  GET  /api/assignmentApprovals');
  console.log('  POST /api/assignmentApprovals');
  console.log('  POST /api/assignmentApprovals/bulk');
});
