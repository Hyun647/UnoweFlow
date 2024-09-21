const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
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

let projects = [];
let todos = {};
let projectAssignees = {};

// WebSocket 연결 설정
wss.on('connection', (ws) => {
    console.log('클라이언트가 연결되었습니다.');
    
    // 새로운 클라이언트에게 현재 전체 상태 전송
    ws.send(JSON.stringify({
        type: 'FULL_STATE_UPDATE',
        projects: projects,
        todos: todos,
        projectAssignees: projectAssignees
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log('클라이언트로부터 메시지 수신:', data);

        switch (data.type) {
            case 'ADD_PROJECT':
                addProject(data.name);
                break;
            case 'UPDATE_PROJECT':
                updateProject(data.project);
                break;
            case 'DELETE_PROJECT':
                deleteProject(data.projectId);
                break;
            case 'ADD_TODO':
                addTodo(data.projectId, data.text, data.assignee, data.priority, data.dueDate);
                break;
            case 'UPDATE_TODO':
                const updatedTodo = data.todo;  
                if (updatedTodo && updatedTodo.id) {
                    updateTodo(data.projectId, updatedTodo);
                    broadcastToAll(JSON.stringify({
                        type: 'TODO_UPDATED',
                        projectId: data.projectId,
                        todo: updatedTodo
                    }));
                } else {
                    console.error('Invalid todo data received:', data);
                }
                break;
            case 'DELETE_TODO':
                deleteTodo(data.projectId, data.todoId);
                break;
            case 'ADD_ASSIGNEE':
                addAssignee(data.projectId, data.assigneeName);
                break;
            case 'DELETE_ASSIGNEE':
                deleteAssignee(data.projectId, data.assigneeName);
                break;
        }
    });
});

function addProject(name) {
    const newProject = { 
        id: Date.now().toString(), 
        name: name,
        progress: 0
    };
    projects.push(newProject);
    todos[newProject.id] = [];
    projectAssignees[newProject.id] = [];
    broadcastToAll({ type: 'PROJECT_ADDED', project: newProject });
    console.log('프로젝트 추가됨:', newProject);  // 디버깅을 위한 로그
}

function updateProject(project) {
    const index = projects.findIndex(p => p.id === project.id);
    if (index !== -1) {
        projects[index] = {...projects[index], ...project};
        broadcastToAll({ type: 'PROJECT_UPDATED', project: projects[index] });
        console.log('프로젝트 업데이트됨:', projects[index]);  // 디버깅을 위한 로그
    }
}

function deleteProject(projectId) {
    projects = projects.filter(p => p.id !== projectId);
    delete todos[projectId];
    delete projectAssignees[projectId];
    broadcastToAll({ type: 'PROJECT_DELETED', projectId: projectId });
}

function addTodo(projectId, text, assignee, priority, dueDate) {
    const newTodo = { 
        id: Date.now().toString(), 
        text: text,
        completed: false,
        assignee: assignee,
        priority: priority,
        dueDate: dueDate
    };
    if (!todos[projectId]) {
        todos[projectId] = [];
    }
    todos[projectId].push(newTodo);
    updateProjectProgress(projectId);
    broadcastToAll({ type: 'TODO_ADDED', projectId: projectId, todo: newTodo });
}

function updateTodo(projectId, updatedTodo) {
    const todoIndex = todos[projectId].findIndex(t => t.id === updatedTodo.id);
    if (todoIndex !== -1) {
        todos[projectId][todoIndex] = updatedTodo;
        updateProjectProgress(projectId);
        broadcastToAll({ type: 'TODO_UPDATED', projectId: projectId, todo: updatedTodo });
    }
}

function deleteTodo(projectId, todoId) {
    todos[projectId] = todos[projectId].filter(t => t.id !== todoId);
    updateProjectProgress(projectId);
    broadcastToAll({ type: 'TODO_DELETED', projectId: projectId, todoId: todoId });
}

function updateProjectProgress(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (project && todos[projectId]) {
        const totalTodos = todos[projectId].length;
        const completedTodos = todos[projectId].filter(todo => todo.completed).length;
        project.progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
        broadcastToAll({ type: 'PROJECT_UPDATED', project: project });
    }
}

function broadcastToAll(message) {
    const messageString = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
    console.log('브로드캐스트 메시지:', messageString);  // 디버깅을 위한 로그
}

function addAssignee(projectId, assigneeName) {
    if (!projectAssignees[projectId]) {
        projectAssignees[projectId] = [];
    }
    if (!projectAssignees[projectId].includes(assigneeName)) {
        projectAssignees[projectId].push(assigneeName);
        broadcastToAll({ 
            type: 'ASSIGNEE_ADDED', 
            projectId: projectId, 
            assigneeName: assigneeName 
        });
    }
}

function deleteAssignee(projectId, assigneeName) {
    if (projectAssignees[projectId]) {
        projectAssignees[projectId] = projectAssignees[projectId].filter(a => a !== assigneeName);
        broadcastToAll({ 
            type: 'ASSIGNEE_DELETED', 
            projectId: projectId, 
            assigneeName: assigneeName 
        });
    }
}

// REST API 엔드포인트
app.get('/projects', (req, res) => {
    res.json(projects);
});

app.get('/projects/:id/todos', (req, res) => {
    const projectId = req.params.id;
    res.json(todos[projectId] || []);
});

server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});