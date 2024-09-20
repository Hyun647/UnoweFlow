let socket;
let projects = [];
let todos = {};
let projectAssignees = {};

function initializeWebSocket() {
    console.log('WebSocket 연결 시도...');
    socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log('WebSocket 연결이 열렸습니다.');
        requestFullStateUpdate();
    };

    socket.onmessage = (event) => {
        console.log('WebSocket 메시지 수신:', event.data);
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    socket.onclose = (event) => {
        console.log('WebSocket 연결이 닫혔습니다.', event.reason);
        setTimeout(initializeWebSocket, 3000);
    };

    socket.onerror = (error) => {
        console.error('WebSocket 오류:', error);
    };
}

function requestFullStateUpdate() {
    socket.send(JSON.stringify({ type: 'REQUEST_FULL_STATE' }));
}

function handleWebSocketMessage(data) {
    console.log('WebSocket 메시지 수신:', data);
    switch (data.type) {
        case 'FULL_STATE_UPDATE':
            projects = data.projects;
            todos = data.todos;
            projectAssignees = data.projectAssignees || {};
            updateProjectList();
            break;
        case 'PROJECT_ADDED':
        case 'PROJECT_UPDATED':
        case 'PROJECT_DELETED':
            handleProjectChange(data);
            break;
        case 'TODO_ADDED':
        case 'TODO_UPDATED':
        case 'TODO_DELETED':
            handleTodoChange(data);
            break;
        case 'ASSIGNEE_ADDED':
            if (!projectAssignees[data.projectId]) {
                projectAssignees[data.projectId] = [];
            }
            if (!projectAssignees[data.projectId].includes(data.assigneeName)) {
                projectAssignees[data.projectId].push(data.assigneeName);
            }
            updateAssigneeListInModal(data.projectId);
            updateAssigneeProgress(data.projectId);
            break;
        case 'ASSIGNEE_DELETED':
            if (projectAssignees[data.projectId]) {
                projectAssignees[data.projectId] = projectAssignees[data.projectId].filter(a => a !== data.assigneeName);
            }
            updateAssigneeListInModal(data.projectId);
            updateAssigneeProgress(data.projectId);
            break;
        default:
            console.log('알 수 없는 메시지 타입:', data.type);
    }
}

// 페이지 로드 시 WebSocket 연결 초화
window.addEventListener('load', () => {
    initializeWebSocket();
    showProjectList();  // 초기 화면으로 프로젝트 목록 표시
});