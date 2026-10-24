import { io } from 'socket.io-client';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runLiveSmokeTests() {
  console.log('====================================================');
  console.log('🚀 DEVCOLLAB LIVE SYSTEM INTEGRATION & SMOKE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${API_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health check returns status 200');
    assert(healthData.data?.database?.connected === true, 'MongoDB Atlas connection is active and healthy');

    // 2. Authentication: Admin (Ayush), Member (Sarah), Viewer (Alex)
    const login = async (email, password) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { status: res.status, ...data };
    };

    const adminLogin = await login('ayush@example.com', 'Password123');
    assert(adminLogin.status === 200 && adminLogin.data?.token, 'Admin (ayush@example.com) successfully logged in');
    const adminToken = adminLogin.data.token;

    const memberLogin = await login('sarah.dev@example.com', 'Password123');
    assert(memberLogin.status === 200 && memberLogin.data?.token, 'Member (sarah.dev@example.com) successfully logged in');
    const memberToken = memberLogin.data.token;
    const memberId = memberLogin.data.user.id || memberLogin.data.user._id;

    const viewerLogin = await login('alex.viewer@example.com', 'Password123');
    assert(viewerLogin.status === 200 && viewerLogin.data?.token, 'Viewer (alex.viewer@example.com) successfully logged in');
    const viewerToken = viewerLogin.data.token;

    // 3. Workspace & Project Retrieval
    const wsRes = await fetch(`${API_URL}/workspaces`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const wsData = await wsRes.json();
    assert(wsRes.status === 200 && wsData.data.length > 0, 'Admin can list workspaces');
    const workspaceId = wsData.data[0]._id;

    const projRes = await fetch(`${API_URL}/workspaces/${workspaceId}/projects`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const projData = await projRes.json();
    assert(projRes.status === 200 && projData.data.length > 0, 'Admin can retrieve projects with metrics');
    const projectId = projData.data[0]._id;

    // 4. Zero-Trust RBAC: Viewer cannot create tasks
    const viewerForbiddenTask = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Viewer Task',
        priority: 'LOW',
        status: 'TODO'
      })
    });
    assert(viewerForbiddenTask.status === 403, 'RBAC: Viewer blocked from creating tasks (403 Forbidden)');

    // 5. Member creates a new task
    const testTaskTitle = `Live Verification Task ${Date.now()}`;
    const createTaskRes = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        title: testTaskTitle,
        description: 'Automated test task for live smoke verification',
        priority: 'HIGH',
        status: 'TODO',
        assigneeId: memberId
      })
    });
    const createdTaskData = await createTaskRes.json();
    assert(createTaskRes.status === 201, 'Member successfully created a task');
    const task = createdTaskData.data;
    const taskId = task._id;

    // 6. Optimistic Concurrency Control: Status update and version advance
    const updateTaskRes = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        version: task.version
      })
    });
    const updatedTaskData = await updateTaskRes.json();
    assert(updateTaskRes.status === 200, 'Member moved task to IN_PROGRESS');
    assert(updatedTaskData.data.version === task.version + 1, 'Task version correctly advanced (OCC)');

    // 7. OCC Conflict Detection: Stale version update rejected
    const conflictRes = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        priority: 'URGENT',
        version: task.version // Stale version 1
      })
    });
    assert(conflictRes.status === 409, 'OCC: Stale update rejected with 409 Conflict');

    // 8. Add Comment
    const commentRes = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        body: 'Automated smoke test comment: Looking great!'
      })
    });
    const commentData = await commentRes.json();
    assert(commentRes.status === 201, 'Member added comment to task');

    // 9. Activity Audit Timeline
    const activityRes = await fetch(`${API_URL}/tasks/${taskId}/activities`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    const activityData = await activityRes.json();
    assert(activityRes.status === 200, 'Retrieved task activity history');
    assert(activityData.data.length >= 2, 'Activity log records creation and status change events');

    // 10. Real-time Socket.IO Connection & Room Broadcast
    const socketConnectedPromise = new Promise((resolve) => {
      const socket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { token: adminToken }
      });

      socket.on('connect', () => {
        socket.emit('join:workspace', { workspaceId }, (roomRes) => {
          assert(roomRes.success === true, 'Socket.IO: User authenticated and joined workspace room');

          // Listen for task:deleted event
          socket.on('task:deleted', (data) => {
            assert(data.taskId === taskId, 'Socket.IO: Received real-time task:deleted broadcast');
            socket.disconnect();
            resolve();
          });

          // Trigger task deletion from REST
          fetch(`${API_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` }
          }).then((delRes) => {
            assert(delRes.status === 200, 'Admin deleted test task cleanly');
          });
        });
      });
    });

    await socketConnectedPromise;

    // 11. Notification Retrieval & Mark All Read
    const notifRes = await fetch(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200, 'Member can fetch in-app notifications');

    const markAllRes = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({ workspaceId })
    });
    assert(markAllRes.status === 200, 'Member can mark all notifications as read');

    console.log('\n====================================================');
    console.log(`📊 LIVE SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error during live smoke tests:', error);
    process.exit(1);
  }
}

runLiveSmokeTests();
