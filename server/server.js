const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const mysql = require('mysql2/promise'); 
const PORT = process.env.PORT || 6521;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// MySQL 연결 설정
const pool = mysql.createPool({
    host: '110.15.29.199',
    port: 9876,
    user: 'root',
    password: '1590',
    database: 'unoweflow_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 데이터베이스 연결 확인 및 재연결 로직 추가
async function checkDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('데이터베이스에 성공적으로 연결되었습니다.');
        connection.release();
    } catch (err) {
        console.error('데이터베이스 연결 중 오류 발생:', err);
        console.log('5초 후 재연결을 시도합니다...');
        setTimeout(checkDatabaseConnection, 5000);
    }
}

checkDatabaseConnection();

// 쿼리 실행 함수 개선
async function query(sql, params) {
    let retries = 3;
    while (retries > 0) {
        try {
            const [results] = await pool.execute(sql, params);
            console.log('Query SQL:', sql);
            console.log('Query params:', params);
            console.log('Query results:', JSON.stringify(results, null, 2)); // 결과를 더 자세히 로깅
            return results; // 배열 변환 로직 제거
        } catch (error) {
            console.error('데이터베이스 쿼리 실행 중 오류:', error);
            console.error('SQL:', sql);
            console.error('Parameters:', params);
            retries--;
            if (retries === 0) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// 전역 변수로 데이터 저장
let projectsData = [];
let todosData = {};
let projectAssigneesData = {};
let memosData = {};

// 서버 시작 시 데이터 로드 함수 개선
async function loadAllData() {
    try {
        const projects = await query('SELECT * FROM projects');
        const todos = await query('SELECT * FROM todos');
        const assignees = await query('SELECT * FROM project_assignees');
        const memos = await query('SELECT * FROM memos');

        projectsData = projects.map(project => ({
            ...project,
            id: project.id.toString()
        }));

        todosData = {};
        todos.forEach(todo => {
            const projectId = todo.project_id.toString();
            if (!todosData[projectId]) {
                todosData[projectId] = [];
            }
            todosData[projectId].push({
                ...todo,
                id: todo.id.toString(),
                projectId: projectId,
                dueDate: todo.due_date, // 날짜를 문자열로 그대로 사용
                completed: todo.completed === 1
            });
        });

        projectAssigneesData = {};
        assignees.forEach(assignee => {
            const projectId = assignee.project_id.toString();
            if (!projectAssigneesData[projectId]) {
                projectAssigneesData[projectId] = [];
            }
            projectAssigneesData[projectId].push(assignee.assignee_name);
        });

        memosData = {};
        memos.forEach(memo => {
            memosData[memo.project_id.toString()] = memo.content;
        });

        console.log('모든 데이터가 메모리 로드되었습니다.');
    } catch (error) {
        console.error('데이터 로드 중 오류 발생:', error);
        console.log('5초 후 데이터 로드를 재시도합니다...');
        setTimeout(loadAllData, 5000);
    }
}

// 서버 시작 시 데이터 로드
loadAllData();

const PASSWORD = '2024'; // 서버 측 비밀번호 설정

wss.on('connection', async (ws) => {
    console.log('클라이언트가 연결되었습니다.');
    
    let isAuthenticated = false; // 인증 상태 추적 플래그
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('클라이언트로부터 메시지 수신:', data);

            if (data.type === 'auth') {
                if (data.password === PASSWORD) {
                    isAuthenticated = true; // 인증 성공 시 플래그 설정
                    ws.send(JSON.stringify({ type: 'auth_result', success: true }));
                    // 인증 성공 후 전체 상태 업데이트 전송
                    await loadAllData();
                    sendFullStateUpdate(ws);
                } else {
                    ws.send(JSON.stringify({ type: 'auth_result', success: false }));
                }
            } else if (isAuthenticated) { // 인증된 클라이언트만 처리
                // 기존의 다른 메시지 처리 로직
                switch (data.type) {
                    case 'ADD_PROJECT':
                        await addProject(data.name);
                        break;
                    case 'UPDATE_PROJECT':
                        await updateProject(data.project);
                        break;
                    case 'DELETE_PROJECT':
                        await deleteProject(data.projectId);
                        break;
                    case 'ADD_TODO':
                        await addTodo(data.projectId, data.text, data.assignee, data.priority, data.dueDate);
                        break;
                    case 'UPDATE_TODO':
                        if (!data.projectId || !data.todo) {
                            console.error('UPDATE_TODO: 잘못된 데이터 형식', data);
                            return;
                        }
                        await updateTodo(data.projectId, data.todo);
                        break;
                    case 'DELETE_TODO':
                        await deleteTodo(data.projectId, data.todoId);
                        break;
                    case 'ADD_ASSIGNEE':
                        await addAssignee(data.projectId, data.assigneeName);
                        break;
                    case 'DELETE_ASSIGNEE':
                        await deleteAssignee(data.projectId, data.assigneeName);
                        break;
                    case 'GET_MEMO':
                        const memo = await getMemo(data.projectId);
                        console.log('GET_MEMO 응답:', { type: 'MEMO_UPDATE', projectId: data.projectId, content: memo });
                        ws.send(JSON.stringify({
                            type: 'MEMO_UPDATE',
                            projectId: data.projectId,
                            content: memo
                        }));
                        break;
                    case 'UPDATE_MEMO':
                        await updateMemo(data.projectId, data.content);
                        break;
                    case 'REQUEST_FULL_STATE':
                        sendFullStateUpdate(ws);
                        break;
                }
            } else {
                ws.send(JSON.stringify({ type: 'error', message: '인증되지 않은 클라이언트의 요청은 무시됩니다.' }));
            }
        } catch (error) {
            console.error('메시지 처리 중 오류 발생:', error);
        }
    });
});

async function sendFullStateUpdate(ws) {
    ws.send(JSON.stringify({
        type: 'FULL_STATE_UPDATE',
        projects: projectsData,
        todos: todosData,
        projectAssignees: projectAssigneesData
    }));
}

// 프로젝트 추가 함수 수정
async function addProject(name) {
    try {
        const result = await query('INSERT INTO projects (name, progress) VALUES (?, 0)', [name]);
        const id = result.insertId;
        const newProject = { id: id.toString(), name, progress: 0 };
        projectsData.push(newProject);
        broadcastToAll({ type: 'PROJECT_ADDED', project: newProject });
    } catch (error) {
        console.error('프로젝트 추가 중 오류 발생:', error);
    }
}

// 프로젝트 업데이트 함수 수정
async function updateProject(project) {
    try {
        if (!project || !project.id) {
            console.error('유효하지 않은 프로젝트 데이터:', project);
            return;
        }

        const name = project.name || '';
        const progress = project.progress !== undefined ? project.progress : 0;

        // 프로젝트 존재 여부 확인
        const existingProjects = await query('SELECT * FROM projects WHERE id = ?', [project.id.toString()]);
        if (existingProjects.length === 0) {
            console.error('업데이트할 프로젝트를 찾을 수 없습니다:', project.id);
            return;
        }

        // 업데이트 쿼리 실행
        await query('UPDATE projects SET name = ?, progress = ? WHERE id = ?', 
            [name, progress, project.id.toString()]);

        // 업데이트된 프로젝트 조회
        const updatedProjects = await query('SELECT * FROM projects WHERE id = ?', [project.id.toString()]);
        
        if (updatedProjects.length > 0) {
            const updatedProject = {
                ...updatedProjects[0],
                id: updatedProjects[0].id.toString()
            };
            broadcastToAll({ type: 'PROJECT_UPDATED', project: updatedProject });
            
            // 메모리 내 프로젝트 데이터 업데이트
            const index = projectsData.findIndex(p => p.id === project.id.toString());
            if (index !== -1) {
                projectsData[index] = updatedProject;
            } else {
                projectsData.push(updatedProject);
            }
        }
    } catch (error) {
        console.error('프로젝트 업데이트 중 오류 발생:', error);
    }
}

// 프로젝트 진행률 업데이트 함수 수정
async function updateProjectProgress(projectId) {
    try {
        const projectIdStr = projectId.toString();
        const todos = await query('SELECT * FROM todos WHERE project_id = ?', [projectIdStr]);
        
        if (!Array.isArray(todos)) {
            console.error('todos가 배열이 아닙니다:', todos);
            return;
        }
        
        const totalTodos = todos.length;
        let completedTodos = 0;

        for (const todo of todos) {
            if (todo.completed === 1 || todo.completed === true) {
                completedTodos++;
            }
        }

        const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
        
        await query('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectIdStr]);
        const updatedProjects = await query('SELECT * FROM projects WHERE id = ?', [projectIdStr]);
        
        if (updatedProjects.length > 0) {
            const updatedProject = {
                ...updatedProjects[0],
                id: updatedProjects[0].id.toString()
            };
            broadcastToAll({ type: 'PROJECT_UPDATED', project: updatedProject });
            
            // 메모리 내 프로젝트 데이터 업데이트
            const index = projectsData.findIndex(p => p.id === projectIdStr);
            if (index !== -1) {
                projectsData[index] = updatedProject;
            }
        } else {
            console.error('업데이트된 프로젝트를 찾을 수 없습니다:', projectId);
        }
    } catch (error) {
        console.error('프로젝트 진행률 업데이트 중 오류 발생:', error);
    }
}

// 프로젝트 삭제 함수 수정
async function deleteProject(projectId) {
    try {
        await query('DELETE FROM projects WHERE id = ?', [projectId.toString()]);
        await query('DELETE FROM todos WHERE project_id = ?', [projectId.toString()]);
        await query('DELETE FROM project_assignees WHERE project_id = ?', [projectId.toString()]);
        await query('DELETE FROM memos WHERE project_id = ?', [projectId.toString()]);
        broadcastToAll({ type: 'PROJECT_DELETED', projectId: projectId.toString() });
    } catch (error) {
        console.error('프로젝트 삭제 중 오류 발생:', error);
    }
}

// 할 일 추가 함수 수정
async function addTodo(projectId, text, assignee, priority, dueDate) {
    try {
        let formattedDueDate = null;
        if (dueDate) {
            const date = new Date(dueDate);
            formattedDueDate = date.toISOString().slice(0, 10);
        }

        const result = await query(
            'INSERT INTO todos (project_id, text, assignee, priority, due_date) VALUES (?, ?, ?, ?, ?)',
            [projectId.toString(), text, assignee || null, priority, formattedDueDate]
        );
        const todoId = result.insertId;
        const newTodo = { id: todoId.toString(), projectId: projectId.toString(), text, assignee: assignee || null, priority, dueDate: formattedDueDate, completed: false };
        broadcastToAll({ type: 'TODO_ADDED', projectId: projectId.toString(), todo: newTodo });
        return newTodo;
    } catch (error) {
        console.error('할 일 추가 중 오류 발생:', error);
        throw error;
    }
}

// 할 일 업데이트 함수 수정
async function updateTodo(projectId, updatedTodo) {
    try {
        console.log('업데이트할 할 일 데이터:', updatedTodo);

        if (!updatedTodo || typeof updatedTodo !== 'object') {
            console.error('유효하지 않은 할 일 데이터:', updatedTodo);
            return;
        }

        const todoId = updatedTodo.id ? updatedTodo.id.toString() : null;
        if (!todoId) {
            console.error('할 일 ID가 없습니다:', updatedTodo);
            return;
        }

        // 날짜를 문자열로 직접 저장
        const dueDate = updatedTodo.dueDate || null;

        // 할 일이 존재하는지 먼저 확인
        const existingTodos = await query('SELECT * FROM todos WHERE id = ?', [todoId]);
        if (existingTodos.length === 0) {
            console.error('업데이트할 할 일을 찾을 수 없습니다:', todoId);
            return;
        }

        // 업데이트 쿼리 실행
        await query('UPDATE todos SET text = ?, completed = ?, assignee = ?, priority = ?, due_date = ? WHERE id = ?', 
            [updatedTodo.text || '', updatedTodo.completed ? 1 : 0, updatedTodo.assignee || null, updatedTodo.priority || '', dueDate, todoId]);
        
        // 업데이트된 할 일 조회
        const updatedTodos = await query('SELECT * FROM todos WHERE id = ?', [todoId]);
        
        if (updatedTodos.length === 0) {
            console.error('업데이트된 할 일을 찾을 수 없습니다:', todoId);
            return;
        }

        const todo = updatedTodos[0];
        
        const todoForClient = {
            id: todo.id.toString(),
            projectId: todo.project_id.toString(),
            text: todo.text,
            completed: todo.completed === 1,
            assignee: todo.assignee || null,
            priority: todo.priority,
            dueDate: todo.due_date
        };

        console.log('서버에서 업데이트된 할 일:', todoForClient);
        broadcastToAll({ type: 'TODO_UPDATED', projectId: projectId.toString(), todo: todoForClient });
        await updateProjectProgress(projectId);
    } catch (error) {
        console.error('할 일 업데이트 중 오류 발생:', error);
        console.error('오류 상세:', error.stack);
    }
}

// 할 일 삭제 함수 수정
async function deleteTodo(projectId, todoId) {
    try {
        await query('DELETE FROM todos WHERE id = ?', [todoId]);
        broadcastToAll({ type: 'TODO_DELETED', projectId: projectId.toString(), todoId: todoId.toString() });
        
        // 프로젝트의 모든 할 일을 가져옵니다.
        const [remainingTodos] = await query('SELECT * FROM todos WHERE project_id = ?', [projectId.toString()]);
        
        // 남은 할 일이 없으면 프로젝트 진행률을 0으로 설정합니다.
        if (remainingTodos.length === 0) {
            await query('UPDATE projects SET progress = 0 WHERE id = ?', [projectId.toString()]);
            const [updatedProject] = await query('SELECT * FROM projects WHERE id = ?', [projectId.toString()]);
            if (updatedProject.length > 0) {
                broadcastToAll({ type: 'PROJECT_UPDATED', project: updatedProject[0] });
            }
        } else {
            // 남은 할 일이 있으면 정상적으로 진행률을 업데이트합니다.
            await updateProjectProgress(projectId);
        }
    } catch (error) {
        console.error('할 일 삭제 중 오류 발생:', error);
    }
}

// 담당자 추가 함수 수정
async function addAssignee(projectId, assigneeName) {
    try {
        await query('INSERT INTO project_assignees (project_id, assignee_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE assignee_name = assignee_name', [projectId.toString(), assigneeName]);
        if (!projectAssigneesData[projectId]) {
            projectAssigneesData[projectId] = [];
        }
        if (!projectAssigneesData[projectId].includes(assigneeName)) {
            projectAssigneesData[projectId].push(assigneeName);
        }
        broadcastToAll({ type: 'ASSIGNEE_ADDED', projectId: projectId.toString(), assigneeName: assigneeName });
    } catch (error) {
        console.error('담당자 추가 중 오류 발생:', error);
    }
}

// 담당자 삭제 함수 수정
async function deleteAssignee(projectId, assigneeName) {
    try {
        await query('DELETE FROM project_assignees WHERE project_id = ? AND assignee_name = ?', [projectId.toString(), assigneeName]);
        broadcastToAll({ type: 'ASSIGNEE_DELETED', projectId: projectId.toString(), assigneeName: assigneeName });
    } catch (error) {
        console.error('담당자 삭제 중 오류 발생:', error);
    }
}

// 메모 가져오기 함수 수정
async function getMemo(projectId) {
    try {
        const memos = await query('SELECT content FROM memos WHERE project_id = ?', [projectId.toString()]);
        console.log('getMemo 결과:', memos);
        return memos.length > 0 ? memos[0].content : '';
    } catch (error) {
        console.error('메모 조회 중 오류 발생:', error);
        return '';
    }
}

// 메모 업데이트 함수 수정
async function updateMemo(projectId, content) {
    try {
        console.log('메모 업데이트 시도:', projectId, content);
        await query('INSERT INTO memos (project_id, content) VALUES (?, ?) ON DUPLICATE KEY UPDATE content = ?', 
            [projectId.toString(), content, content]);
        
        // 메모리 내 데이터 업데이트
        memosData[projectId.toString()] = content;
        
        console.log('메모 업데이트 성공');
        // 모든 클라이언트에게 업데이트된 메모 브로드캐스트
        broadcastToAll({ 
            type: 'MEMO_UPDATE', 
            projectId: projectId.toString(), 
            content: content 
        });
    } catch (error) {
        console.error('메모 업데이트 중 오류 발생:', error);
    }
}

function broadcastToAll(message) {
    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

// REST API 엔드포인트
app.get('/projects', async (req, res) => {
    try {
        const [projects] = await pool.query('SELECT * FROM projects');
        res.json(projects);
    } catch (error) {
        console.error('프로젝트 조회 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

app.get('/projects/:id/todos', async (req, res) => {
    const projectId = req.params.id;
    try {
        const [todos] = await pool.query('SELECT * FROM todos WHERE project_id = ?', [projectId]);
        res.json(todos);
    } catch (error) {
        console.error('할 일 조회 중 오류 발생:', error);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 주기적으로 데이터베이스와 동기화
setInterval(async () => {
    await loadAllData();
}, 60000); // 예: 1분마다 동기화

server.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 http://0.0.0.0:${PORT} 에서 실행 중입니다.`);
});