import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_callout(doc, text, title=None, border_color="4F46E5", bg_color="F8FAFC"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Left border only
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/><w:top w:val="none"/><w:right w:val="none"/><w:bottom w:val="none"/></w:tcBorders>')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    if title:
        run_title = p.add_run(f"📌 {title}\n")
        run_title.bold = True
        run_title.font.name = "Arial"
        run_title.font.size = Pt(10.5)
        run_title.font.color.rgb = RGBColor(30, 41, 59)
    run_text = p.add_run(text)
    run_text.font.name = "Arial"
    run_text.font.size = Pt(9.5)
    run_text.font.color.rgb = RGBColor(71, 85, 105)
    doc.add_paragraph()

def add_code_block(doc, code_str, title=None):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, "0F172A") # Dark slate
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    if title:
        rt = p.add_run(f"// {title}\n")
        rt.bold = True
        rt.font.name = "Consolas"
        rt.font.size = Pt(8.5)
        rt.font.color.rgb = RGBColor(56, 189, 248) # Cyan
    rc = p.add_run(code_str)
    rc.font.name = "Consolas"
    rc.font.size = Pt(8.5)
    rc.font.color.rgb = RGBColor(226, 232, 240)
    doc.add_paragraph()

def style_table(tbl, col_widths, headers, data, header_bg="1E293B"):
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    # Header row
    hdr_row = tbl.rows[0]
    for i, h_text in enumerate(headers):
        cell = hdr_row.cells[i]
        cell.text = h_text
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for run in p.runs:
            run.bold = True
            run.font.name = "Arial"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(255, 255, 255)
            
    # Data rows
    for r_idx, row_data in enumerate(data):
        row = tbl.add_row()
        bg = "FFFFFF" if r_idx % 2 == 0 else "F8FAFC"
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = str(val)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.font.name = "Arial"
                run.font.size = Pt(8.5)
                run.font.color.rgb = RGBColor(51, 65, 85)
                
    # Column widths
    for row in tbl.rows:
        for i, w in enumerate(col_widths):
            row.cells[i].width = Inches(w)

def build_document():
    doc = docx.Document()
    
    # Page setup
    for sec in doc.sections:
        sec.top_margin = Inches(0.8)
        sec.bottom_margin = Inches(0.8)
        sec.left_margin = Inches(0.8)
        sec.right_margin = Inches(0.8)
        
    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Arial'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(5)

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("DevCollab — Enterprise SaaS Platform\nSystem Architecture, API Specification & Technical Interview Guide")
    run_title.bold = True
    run_title.font.size = Pt(20)
    run_title.font.color.rgb = RGBColor(30, 41, 59)
    
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(16)
    run_sub = p_sub.add_run("Author: Ayush Anand | Stack: React 19, Express 5, MongoDB Atlas, Socket.IO, Docker\nLive App: https://devcollab-ten-black.vercel.app | Repo: https://github.com/imayush1304/devcollab")
    run_sub.font.size = Pt(9.5)
    run_sub.font.color.rgb = RGBColor(79, 70, 229)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # -------------------------------------------------------------
    # 1. EXECUTIVE SUMMARY & LIVE DEPLOYMENT TOPOLOGY
    # -------------------------------------------------------------
    h1 = doc.add_heading("1. Executive Summary & Live Deployment Topology", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    
    p = doc.add_paragraph(
        "DevCollab is an enterprise-grade, real-time project management platform inspired by Jira, Linear, and Trello. "
        "Engineered for high-concurrency environments, it features zero-trust Role-Based Access Control (Admin, Member, Viewer), "
        "Optimistic Concurrency Control (OCC) using Mongoose document versioning (__v) to prevent lost updates, bidirectional "
        "low-latency state synchronization with Socket.IO room isolation, and an exhaustive 80-test automated verification suite."
    )
    
    add_callout(
        doc,
        "Frontend Application (Vercel): https://devcollab-ten-black.vercel.app\n"
        "Backend API & WebSockets (Render): https://devcollab-8zpg.onrender.com\n"
        "Health & Cluster Diagnostics: https://devcollab-8zpg.onrender.com/api/health\n"
        "GitHub Source Repository: https://github.com/imayush1304/devcollab\n"
        "Demo Accounts: Admin (ayush@example.com), Member (sarah.dev@example.com), Viewer (alex.viewer@example.com) — Password: Password123!",
        title="LIVE PRODUCTION DEPLOYMENT & VERIFIED ACCESS"
    )

    # -------------------------------------------------------------
    # 2. SYSTEM ARCHITECTURE & DUAL TRANSPORT DESIGN
    # -------------------------------------------------------------
    h1 = doc.add_heading("2. End-to-End System Architecture", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p = doc.add_paragraph(
        "The system decouples state mutation from real-time state broadcast by utilizing a dual-transport paradigm: "
        "Stateless HTTPS REST for atomic CRUD operations and persistent WSS (WebSockets) for delta broadcasts."
    )

    tbl_arch = doc.add_table(rows=1, cols=3)
    arch_headers = ["Layer", "Technologies", "Responsibilities & Engineering Guarantees"]
    arch_data = [
        ["Client Presentation", "React 19, Vite, @dnd-kit, Custom CSS Glassmorphism", "Optimistic drag-and-drop, state cache, rollback handling, audio-visual notification indicators."],
        ["Security & Reverse Proxy", "Nginx, Helmet, Express Rate Limiter, CORS Firewall", "IP rate limiting (5000 dev / 300 prod), origin whitelisting (*.vercel.app), XSS/MIME/Clickjacking protection."],
        ["Application Backend", "Node.js 22, Express 5, Clean Service/Controller Pattern", "Zero-trust RBAC middleware, transactional business logic, OCC version resolution, input validation schemas."],
        ["Real-Time Engine", "Socket.IO Server, Handshake JWT Authenticator", "Room subscription management (workspace:<id>, user:<id>), sub-50ms delta broadcasting, zero cross-tenant leakage."],
        ["Data Persistence", "MongoDB Atlas Replica Set, Mongoose 8.x ODM", "Compound indexed query acceleration, atomic findOneAndUpdate version locking, audit log retention."]
    ]
    style_table(tbl_arch, [1.4, 2.0, 3.4], arch_headers, arch_data)
    doc.add_paragraph()

    # -------------------------------------------------------------
    # 3. DATABASE SCHEMA & ENTITY RELATIONSHIP MODEL
    # -------------------------------------------------------------
    h1 = doc.add_heading("3. Database Schema & Data Models", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p = doc.add_paragraph("The database leverages MongoDB Atlas with 8 strictly typed schemas and custom compound indexes:")

    tbl_db = doc.add_table(rows=1, cols=4)
    db_headers = ["Model", "Key Attributes & Types", "Index Optimization", "Cardinality & Relationships"]
    db_data = [
        ["User", "_id, name (str), email (uniq str), password (bcrypt 12), avatar", "{ email: 1 } (Unique)", "1-to-N Memberships, Tasks assigned, Comments created"],
        ["Workspace", "_id, name, slug (uniq str), description, ownerId (FK)", "{ slug: 1 } (Unique)", "1-to-N Memberships, Projects, Tasks, and Activities"],
        ["Membership", "_id, userId (FK), workspaceId (FK), role (Admin/Member/Viewer)", "{ userId: 1, workspaceId: 1 } (Unique)", "Maps User to Workspace with strict RBAC privilege levels"],
        ["Project", "_id, name, key (str), description, workspaceId (FK)", "{ workspaceId: 1, key: 1 }", "Belongs to Workspace; contains 1-to-N Kanban Tasks"],
        ["Task", "_id, title, status (enum), priority, order (float), __v (int), projectId, workspaceId, assigneeId", "{ projectId: 1, status: 1, order: 1 }", "OCC versioned document; belongs to Project & Workspace; has N Comments"],
        ["Comment", "_id, taskId (FK), authorId (FK), content (str), createdAt", "{ taskId: 1, createdAt: 1 }", "Threaded comment on specific task; triggers assignee alerts"],
        ["Activity", "_id, workspaceId (FK), userId (FK), action (enum), entityType, details", "{ workspaceId: 1, createdAt: -1 }", "Immutable audit timeline log for compliance and board history"],
        ["Notification", "_id, recipientId (FK), actorId (FK), type, title, message, read (bool)", "{ recipientId: 1, read: 1, createdAt: -1 }", "Real-time user alert; fast unread count aggregation"]
    ]
    style_table(tbl_db, [1.1, 2.3, 1.8, 1.6], db_headers, db_data)
    doc.add_paragraph()

    # -------------------------------------------------------------
    # 4. COMPREHENSIVE REST API SPECIFICATION
    # -------------------------------------------------------------
    h1 = doc.add_heading("4. Comprehensive REST API Specification", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p = doc.add_paragraph("All protected endpoints enforce JWT authentication via HttpOnly cookies or Bearer Authorization headers.")

    tbl_api = doc.add_table(rows=1, cols=5)
    api_headers = ["Method", "Endpoint Route", "RBAC Access", "Payload / Parameters", "Success Response"]
    api_data = [
        ["POST", "/api/auth/register", "Public", "{ name, email, password }", "201 Created + Token & User Object"],
        ["POST", "/api/auth/login", "Public", "{ email, password }", "200 OK + JWT Cookie & User Profile"],
        ["POST", "/api/auth/logout", "Authenticated", "None", "200 OK + Cleared Auth Cookie"],
        ["GET", "/api/auth/me", "Authenticated", "None", "200 OK + Current User Profile"],
        ["GET", "/api/workspaces", "Authenticated", "None", "200 OK + List of user's active workspaces"],
        ["POST", "/api/workspaces", "Authenticated", "{ name, description }", "201 Created (Creator assigned Admin)"],
        ["GET", "/api/workspaces/:id", "Viewer+", "params: id", "200 OK + Workspace details & member metrics"],
        ["POST", "/api/workspaces/:id/members", "Admin", "{ email, role }", "200 OK + Membership created/invited"],
        ["DELETE", "/api/workspaces/:id/members/:uid", "Admin", "params: id, uid", "200 OK + Member removed"],
        ["GET", "/api/projects/workspaces/:wid", "Viewer+", "params: wid", "200 OK + Projects list with task counts"],
        ["POST", "/api/projects/workspaces/:wid", "Member+", "{ name, key, description }", "201 Created + New Project"],
        ["GET", "/api/tasks/projects/:pid", "Viewer+", "params: pid, ?status, ?priority", "200 OK + Grouped/Sorted Kanban tasks"],
        ["POST", "/api/tasks/projects/:pid", "Member+", "{ title, description, priority, assigneeId }", "201 Created + Broadcast task:created"],
        ["PATCH", "/api/tasks/:id", "Member+", "{ status, order, expectedVersion }", "200 OK (or 409 Conflict if __v mismatch)"],
        ["DELETE", "/api/tasks/:id", "Admin/Creator", "params: id", "200 OK + Broadcast task:deleted"],
        ["GET", "/api/tasks/:id/comments", "Viewer+", "params: id", "200 OK + Comment thread with authors"],
        ["POST", "/api/tasks/:id/comments", "Member+", "{ content }", "201 Created + Broadcast notification"],
        ["GET", "/api/notifications", "Authenticated", "query: ?unreadOnly=true", "200 OK + Notifications & unread count"],
        ["PATCH", "/api/notifications/:id/read", "Recipient", "params: id", "200 OK + Marked read"],
        ["PATCH", "/api/notifications/read-all", "Recipient", "None", "200 OK + All user alerts marked read"],
        ["GET", "/api/health", "Public", "None", "200 OK + DB connection & uptime status"]
    ]
    style_table(tbl_api, [0.8, 2.2, 1.1, 1.7, 1.2], api_headers, api_data)
    doc.add_paragraph()

    # -------------------------------------------------------------
    # 5. CORE ALGORITHMS & CRITICAL CODE IMPLEMENTATIONS
    # -------------------------------------------------------------
    h1 = doc.add_heading("5. Core Algorithms & Critical Code Implementations", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    # 5.1 OCC
    h2 = doc.add_heading("5.1 Optimistic Concurrency Control (OCC) with Mongoose __v", level=2)
    p = doc.add_paragraph(
        "To prevent lost updates when two team members reorder or drag tasks concurrently, we implement OCC. "
        "The update query atomically checks if the document version matches the client's cached version. "
        "If a concurrent modification has occurred, the version check fails, returning null, which triggers an HTTP 409 Conflict."
    )
    add_code_block(
        doc,
        "// server/src/services/task.service.js\n"
        "const updateTask = async (taskId, updates, expectedVersion, userId, workspaceId) => {\n"
        "  const query = { _id: taskId, workspaceId };\n"
        "  if (expectedVersion !== undefined) {\n"
        "    query.__v = expectedVersion; // Lock condition\n"
        "  }\n\n"
        "  const updatedTask = await Task.findOneAndUpdate(\n"
        "    query,\n"
        "    { $set: updates, $inc: { __v: 1 } }, // Atomically bump version\n"
        "    { new: true, runValidators: true }\n"
        "  );\n\n"
        "  if (!updatedTask) {\n"
        "    // Either task was deleted or version was bumped by another client\n"
        "    const current = await Task.findById(taskId);\n"
        "    if (current && expectedVersion !== undefined && current.__v !== expectedVersion) {\n"
        "      throw new ConflictError('Task was modified by another user. Reloading latest state...');\n"
        "    }\n"
        "    throw new NotFoundError('Task not found');\n"
        "  }\n"
        "  return updatedTask;\n"
        "};",
        title="Atomic OCC Update Query"
    )

    # 5.2 Floating point ordering
    h2 = doc.add_heading("5.2 Fractional / Floating-Point Kanban Card Ordering", level=2)
    p = doc.add_paragraph(
        "Traditional SQL reordering updates all N rows when moving an item (O(N) write cost). "
        "DevCollab uses fractional positioning: new_order = (prev_order + next_order) / 2.0. "
        "Moving a card between 1000 and 2000 results in 1500, requiring only a single document write (O(1)). "
        "If the difference drops below 0.0001, an asynchronous re-normalization re-spreads items evenly."
    )
    add_code_block(
        doc,
        "// client/src/pages/KanbanBoard.jsx\n"
        "const calculateNewOrder = (items, destinationIndex) => {\n"
        "  if (items.length === 0) return 1000;\n"
        "  if (destinationIndex === 0) return items[0].order / 2;\n"
        "  if (destinationIndex >= items.length) return items[items.length - 1].order + 1000;\n"
        "  const prev = items[destinationIndex - 1].order;\n"
        "  const next = items[destinationIndex].order;\n"
        "  return (prev + next) / 2;\n"
        "};",
        title="O(1) Fractional Card Positioning"
    )

    # 5.3 WebSockets Room Isolation
    h2 = doc.add_heading("5.3 WebSocket Room Isolation & Handshake Authentication", level=2)
    p = doc.add_paragraph(
        "Socket connections verify JWT credentials during the initial WebSocket HTTP handshake. "
        "Upon verification, the socket joins exclusively authorized rooms: `workspace:<id>` and `user:<id>`. "
        "State changes in Workspace A are never broadcast to Workspace B."
    )
    add_code_block(
        doc,
        "// server/src/sockets/socketHandler.js\n"
        "io.use(async (socket, next) => {\n"
        "  try {\n"
        "    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie?.jwt;\n"
        "    if (!token) return next(new Error('Authentication required'));\n"
        "    const decoded = verifyToken(token);\n"
        "    socket.user = decoded;\n"
        "    next();\n"
        "  } catch (err) {\n"
        "    next(new Error('Invalid token'));\n"
        "  }\n"
        "});\n\n"
        "// Scoped room broadcast\n"
        "io.to(`workspace:${workspaceId}`).emit('task:updated', { task: updatedTask, actorId });",
        title="Isolated Socket Handshake & Tenant Broadcast"
    )

    # 5.4 Zero-Trust RBAC Middleware
    h2 = doc.add_heading("5.4 Zero-Trust RBAC Middleware (Admin, Member, Viewer)", level=2)
    p = doc.add_paragraph(
        "Every API route verifies workspace membership and checks the role hierarchy before controller execution:"
    )
    add_code_block(
        doc,
        "// server/src/middleware/workspaceAuth.js\n"
        "const ROLE_WEIGHTS = { Admin: 3, Member: 2, Viewer: 1 };\n\n"
        "export const requireRole = (minRole) => {\n"
        "  return async (req, res, next) => {\n"
        "    const { workspaceId } = req.params;\n"
        "    const membership = await Membership.findOne({ userId: req.user.id, workspaceId });\n"
        "    if (!membership) throw new ForbiddenError('Not a member of this workspace');\n"
        "    if (ROLE_WEIGHTS[membership.role] < ROLE_WEIGHTS[minRole]) {\n"
        "      throw new ForbiddenError(`Action requires ${minRole} privilege level`);\n"
        "    }\n"
        "    req.membership = membership;\n"
        "    next();\n"
        "  };\n"
        "};",
        title="Role Hierarchy Verification Middleware"
    )

    # -------------------------------------------------------------
    # 6. FRONTEND ENGINEERING & UX INNOVATIONS
    # -------------------------------------------------------------
    h1 = doc.add_heading("6. Frontend Engineering & UX Innovations", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p = doc.add_paragraph(
        "The frontend is built with React 19 and custom Vanilla CSS design tokens (glassmorphism, subtle micro-animations):"
    )
    doc.add_paragraph("• Dual Authentication Resilience: Authenticates using HttpOnly SameSite=None cookies with an Axios request interceptor providing Bearer fallback from localStorage for non-browser clients.")
    doc.add_paragraph("• Optimistic UI with Rollback: Kanban moves immediately update React state. If the server throws 409 Conflict, the board reverts to the previous snapshot and displays an interactive toast notification.")
    doc.add_paragraph("• Pointer & Touch Sensor Calibration: Configured @dnd-kit sensors with 8px drag activation threshold to distinguish intentional drags from simple clicks.")
    doc.add_paragraph("• Real-Time Notification Bell: Displays live unread badge, smooth dropdown animation, direct card-click focus, and mark-all-read capability.")

    # -------------------------------------------------------------
    # 7. AUTOMATED TESTING SUITE (80/80 TESTS PASSING)
    # -------------------------------------------------------------
    h1 = doc.add_heading("7. Automated Testing Architecture", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    tbl_tests = doc.add_table(rows=1, cols=3)
    t_headers = ["Test Suite File", "Tests Count", "Scope & Critical Scenarios Covered"]
    t_data = [
        ["health.test.js", "3 tests", "Server uptime, diagnostic database status, ping latency."],
        ["auth.test.js", "12 tests", "Registration validation, Bcrypt 12 salt rounds, JWT expiry, invalid credentials."],
        ["workspace.test.js", "10 tests", "Multi-tenancy isolation, unique slug generation, member invitations, owner safeguards."],
        ["project_task.test.js", "10 tests", "Project hierarchy, task lifecycle (TODO->IN_PROGRESS->DONE), priority filtering."],
        ["comment_activity.test.js", "9 tests", "Threaded comments, author profile population, activity timeline audit entries."],
        ["socket.test.js", "6 tests", "WebSocket upgrade handshake, room joining security, cross-tenant isolation."],
        ["notification.test.js", "9 tests", "In-app alerts on task assignment, unread count caching, mark-all-read mutations."],
        ["edge_cases.test.js", "21 tests", "Simultaneous write collisions, duplicate slugs, invalid ObjectIDs, RBAC escalation attempts."],
        ["TOTAL SUITE", "80 / 80 PASS", "100% test pass rate across unit, integration, concurrency, and security suites."]
    ]
    style_table(tbl_tests, [1.6, 1.2, 4.0], t_headers, t_data)
    doc.add_paragraph()

    # -------------------------------------------------------------
    # 8. EXHAUSTIVE INTERVIEW Q&A GUIDE (TIER-1 COMPANIES)
    # -------------------------------------------------------------
    h1 = doc.add_heading("8. Product-Based Company Interview Guide (All Scopes)", level=1)
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)

    p = doc.add_paragraph(
        "This section prepares you for Tier-1 engineering interviews (Google, Amazon, Uber, Atlassian, Microsoft, Meta) "
        "by covering every architectural dimension of DevCollab across 6 distinct interview scopes."
    )

    questions = [
        # Scope 1
        ("Scope 1: Concurrency & Distributed Systems",
         "Q1: How do you prevent lost updates when two users move the same Kanban task simultaneously?",
         "Answer: We implement Optimistic Concurrency Control (OCC) using Mongoose document versioning (__v). "
         "When an update is initiated, the client sends the task's expected version. The backend query executes:\n"
         "  Task.findOneAndUpdate({ _id: taskId, __v: expectedVersion }, { $set: updates, $inc: { __v: 1 } })\n"
         "If user B updated the card first, the version is already incremented. The database query finds 0 matching documents "
         "and returns null. The backend throws an HTTP 409 Conflict. The client catches this, displays an informative toast, "
         "and rolls back the optimistic UI move while re-fetching the canonical document from the server. "
         "This avoids heavy distributed database locking (Pessimistic 2PL) while guaranteeing zero data loss."),

        ("Scope 1: Concurrency & Distributed Systems",
         "Q2: Why did you choose Optimistic Locking over Pessimistic Locking?",
         "Answer: In web-scale collaborative SaaS applications, human think-time is measured in seconds/minutes, while database transactions "
         "take milliseconds. If User A opens a modal and we hold a pessimistic lock (e.g., SELECT ... FOR UPDATE or mutex), all other users "
         "are blocked from even viewing or commenting on that task until User A releases the lock. "
         "Optimistic locking assumes collisions are infrequent (~1%), enabling high read and write throughput without database deadlocks. "
         "If collisions do occur, OCC fails fast with 409 Conflict."),

        # Scope 2
        ("Scope 2: WebSockets & Real-Time Scalability",
         "Q3: How do you scale Socket.IO across multiple server instances in production?",
         "Answer: In our current setup, Socket.IO manages rooms in-memory on a single Node.js instance. To scale horizontally across multiple instances "
         "behind an AWS ALB / Nginx load balancer:\n"
         "1. Redis Pub/Sub Adapter (@socket.io/redis-adapter): When an instance emits 'task:updated' to room 'workspace:123', the event is published "
         "to a shared Redis channel. All other server instances receive the pub/sub message and broadcast it to their locally connected clients.\n"
         "2. Sticky Sessions: Since WebSockets start as an HTTP polling handshake before upgrading, the load balancer uses ip_hash or a cookie "
         "to route polling packets to the same instance until WebSocket upgrade completes."),

        ("Scope 2: WebSockets & Real-Time Scalability",
         "Q4: How did you ensure zero cross-tenant data leakage over WebSockets?",
         "Answer: Socket.IO events are never broadcast globally via io.emit(). We enforce strict Room Isolation:\n"
         "1. Handshake JWT authentication ensures every socket has a verified user identity (socket.user).\n"
         "2. When a user navigates to a workspace, the client emits 'workspace:join'. The server queries Membership to verify that "
         "socket.user.id is indeed an active member of that workspace before calling socket.join(`workspace:${workspaceId}`).\n"
         "3. All mutations (task created, moved, deleted, comments) emit strictly to io.to(`workspace:${workspaceId}`).emit(). "
         "Clients in other workspaces are physically unaware of and cannot listen to those packets."),

        # Scope 3
        ("Scope 3: Database & Performance Optimization",
         "Q5: How did you optimize MongoDB queries for high-volume Kanban boards?",
         "Answer: We established compound indexes mapped directly to query equality, sort, and range access patterns (ESR Rule):\n"
         "1. Tasks: Index { projectId: 1, status: 1, order: 1 } ensures that loading columns and sorting cards is satisfied entirely from index memory (B-tree index scan) with 0 in-memory sorting overhead.\n"
         "2. Activity Timeline: Index { workspaceId: 1, createdAt: -1 } allows instantaneous pagination for audit history without scanning un-related workspace records.\n"
         "3. Notifications: Index { recipientId: 1, read: 1, createdAt: -1 } allows sub-5ms lookup for the unread notification bell indicator."),

        ("Scope 3: Database & Performance Optimization",
         "Q6: Why use fractional floating-point ordering over integer indexing for Kanban cards?",
         "Answer: If tasks use integer positions (1, 2, 3, 4, ...), dragging task 100 to position 2 requires shifting 98 documents in the database: "
         "UPDATE tasks SET order = order + 1 WHERE order >= 2. That is an O(N) write operation with high write contention and write amplification. "
         "With fractional ordering, moving an item between item A (order: 1000) and item B (order: 2000) calculates new_order = (1000 + 2000)/2 = 1500. "
         "This requires updating exactly 1 document (O(1) write cost). If floating-point precision delta drops below 0.0001, a background worker re-normalizes the column."),

        # Scope 4
        ("Scope 4: Security & Authentication",
         "Q7: Explain your dual authentication strategy (HttpOnly Cookie vs Bearer Header).",
         "Answer: In modern web applications, storing JWTs exclusively in localStorage leaves the application vulnerable to token theft via Cross-Site Scripting (XSS). "
         "We set HttpOnly, Secure, SameSite=None session cookies so browser scripts cannot read the token. "
         "However, in cross-domain environments, mobile apps, or headless API clients, third-party cookie blocking can occasionally occur. "
         "Therefore, our Axios interceptor also attaches 'Authorization: Bearer <token>' as a secondary layer. The server's auth middleware checks: "
         "const token = req.cookies.jwt || req.headers.authorization?.split(' ')[1]. This achieves maximum enterprise security and cross-platform resilience."),

        ("Scope 4: Security & Authentication",
         "Q8: How does your Role-Based Access Control (RBAC) work across workspaces?",
         "Answer: We employ a zero-trust multi-tenant RBAC model with three hierarchical roles: Admin (level 3), Member (level 2), and Viewer (level 1).\n"
         "Privileges are scoped per workspace via the Membership collection, not stored on the global User document. "
         "This allows Ayush to be an Admin in 'Engineering Workspace' while being a read-only Viewer in 'Marketing Workspace'. "
         "The requireRole(minRole) middleware verifies membership and evaluates whether ROLE_WEIGHTS[membership.role] >= ROLE_WEIGHTS[minRole]. "
         "Critical administrative actions (member removal, workspace deletion) strictly enforce Admin privileges."),

        # Scope 5
        ("Scope 5: Frontend Architecture & UX",
         "Q9: What is the difference between Optimistic UI and Pessimistic UI in your Kanban board?",
         "Answer: Pessimistic UI waits for the network response before updating the view. On a 150ms 4G connection, dragging a task card would feel sluggish and freeze. "
         "DevCollab uses Optimistic UI: when the drag ends, React state immediately updates the card's column and position locally. "
         "Concurrently, an API request is fired in the background. If the request succeeds, state commits silently. If it fails (network error or 409 Conflict), "
         "the client catches the error, reverts the card to its original position snapshot, and alerts the user. This delivers the snappy 60fps UX of native desktop apps."),

        ("Scope 5: Frontend Architecture & UX",
         "Q10: Why did you choose @dnd-kit over older libraries like react-beautiful-dnd?",
         "Answer: react-beautiful-dnd is no longer actively maintained by Atlassian and does not support modern React 18/19 concurrent rendering features. "
         "@dnd-kit is modular, headless, lightweight, and built natively with React Hooks. It provides first-class PointerSensor and TouchSensor APIs, "
         "collision detection algorithms (closestCorners, rectIntersection), and accessibility (ARIA keyboard navigation) out of the box."),

        # Scope 6
        ("Scope 6: Behavioral, Edge Cases & Architecture Defense",
         "Q11: What was the most challenging technical bug you encountered in DevCollab, and how did you resolve it?",
         "Answer: The most challenging issue was handling cross-site cookie blocking between Vercel and Render in production. "
         "Initially, cookies had sameSite: 'lax', which browsers silently reject when making cross-origin requests from https://devcollab.vercel.app to https://devcollab.onrender.com. "
         "We resolved this by: (1) Setting sameSite: 'none' and secure: true in production, (2) adding app.set('trust proxy', 1) in Express so Express recognizes HTTPS behind Render's reverse proxy, "
         "and (3) configuring the dual-fallback Authorization Bearer header in Axios interceptors, ensuring seamless authentication across all network topologies."),

        ("Scope 6: Behavioral, Edge Cases & Architecture Defense",
         "Q12: If given 3 more months on this codebase, what would you build next?",
         "Answer: Three high-value architectural additions:\n"
         "1. Redis Caching & PubSub Adapter: Integrate Redis for sub-millisecond workspace metadata caching and multi-instance WebSocket horizontal scaling.\n"
         "2. CRDTs / Operational Transformation: For collaborative rich-text task descriptions (like Notion/Google Docs).\n"
         "3. Background Asynchronous Workers (BullMQ + Redis): Offload email notifications, daily digest reports, and file export generation from the main Node.js event loop.")
    ]

    for scope, q, a in questions:
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(8)
        p_q.paragraph_format.space_after = Pt(2)
        r_scope = p_q.add_run(f"[{scope}]\n")
        r_scope.bold = True
        r_scope.font.size = Pt(8.5)
        r_scope.font.color.rgb = RGBColor(79, 70, 229)
        
        r_q = p_q.add_run(q)
        r_q.bold = True
        r_q.font.size = Pt(10.5)
        r_q.font.color.rgb = RGBColor(15, 23, 42)
        
        p_a = doc.add_paragraph()
        p_a.paragraph_format.space_before = Pt(0)
        p_a.paragraph_format.space_after = Pt(6)
        r_a = p_a.add_run(a)
        r_a.font.size = Pt(9.5)
        r_a.font.color.rgb = RGBColor(51, 65, 85)

    # Output file paths
    output_docx = os.path.abspath("DevCollab_Master_Architecture_and_Interview_Guide.docx")
    doc.save(output_docx)
    print(f"DOCX created successfully at: {output_docx}")

    # Convert to PDF using win32com if available
    try:
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        pdf_path = os.path.abspath("DevCollab_Master_Architecture_and_Interview_Guide.pdf")
        doc_in = word.Documents.Open(output_docx)
        doc_in.SaveAs(pdf_path, FileFormat=17) # 17 = wdFormatPDF
        doc_in.Close()
        word.Quit()
        print(f"PDF created successfully at: {pdf_path}")
    except Exception as e:
        print(f"PDF conversion note: {e}")

if __name__ == "__main__":
    build_document()
