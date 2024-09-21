let socket;
let projects = [];
let todos = {};
let projectAssignees = {};

function initializeWebSocket() {
    console.log('WebSocket 연결 시도...');
    socket = new WebSocket('ws:/110.15.29.199:3000');

    socket.onopen = () => {
        console.log('WebSocket이 연결되었습니다.');
        requestFullStateUpdate();
    };

    socket.onmessage = (event) => {
        console.log('WebSocket 메시지 수신');
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'FULL_STATE_UPDATE':
                projects = data.projects;
                todos = data.todos;
                projectAssignees = data.projectAssignees || {};
                if (document.getElementById('project-list')) {
                    updateProjectList();
                }
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
                projectAssignees[data.projectId].push(data.assigneeName);
                updateAssigneeListInModal(data.projectId);
                updateAssigneeProgress(data.projectId);
                // 담당자가 추가된 후 할 일 목록 업데이트
                if (getCurrentProjectId() === data.projectId) {
                    filterAndSortTodos(data.projectId);
                }
                break;
            case 'ASSIGNEE_DELETED':
                if (projectAssignees[data.projectId]) {
                    projectAssignees[data.projectId] = projectAssignees[data.projectId].filter(a => a !== data.assigneeName);
                }
                updateAssigneeListInModal(data.projectId);
                updateAssigneeProgress(data.projectId);
                removeAssigneeFromTodos(data.projectId, data.assigneeName);
                break;
            case 'MEMO_UPDATE':
                if (typeof handleMemoUpdate === 'function') {
                    handleMemoUpdate(data);
                }
                break;
            default:
        }
    };

    socket.onclose = (event) => {
        console.log('WebSocket 연결이 끊어졌습니다.');
        setTimeout(initializeWebSocket, 3000);
    };

    socket.onerror = (error) => {
        console.error('WebSocket 연결 오류');
    };
}

function requestFullStateUpdate() {
    socket.send(JSON.stringify({ type: 'REQUEST_FULL_STATE' }));
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'FULL_STATE_UPDATE':
            projects = data.projects;
            todos = data.todos;
            projectAssignees = data.projectAssignees || {};
            if (document.getElementById('project-list')) {
                updateProjectList();
            }
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
            projectAssignees[data.projectId].push(data.assigneeName);
            updateAssigneeListInModal(data.projectId);
            updateAssigneeProgress(data.projectId);
            // 담당자가 추가된 후 할 일 목록 업데이트
            if (getCurrentProjectId() === data.projectId) {
                filterAndSortTodos(data.projectId);
            }
            break;
        case 'ASSIGNEE_DELETED':
            if (projectAssignees[data.projectId]) {
                projectAssignees[data.projectId] = projectAssignees[data.projectId].filter(a => a !== data.assigneeName);
            }
            updateAssigneeListInModal(data.projectId);
            updateAssigneeProgress(data.projectId);
            removeAssigneeFromTodos(data.projectId, data.assigneeName);
            break;
        default:
    }
}

function removeAssigneeFromTodos(projectId, assigneeName) {
    if (todos[projectId]) {
        todos[projectId] = todos[projectId].map(todo => {
            if (todo.assignee === assigneeName) {
                return { ...todo, assignee: '' };
            }
            return todo;
        });
        
        // 현재 프로젝트 페이지에 있다면 할 일 목록 업데이트
        const currentProjectId = getCurrentProjectId();
        if (currentProjectId === projectId) {
            filterAndSortTodos(projectId);
        }
        
        // 서버에 업데이트된 할 일 정보 전송
        todos[projectId].forEach(todo => {
            if (todo.assignee === '') {
                socket.send(JSON.stringify({
                    type: 'UPDATE_TODO',
                    projectId: projectId,
                    todo: todo
                }));
            }
        });
    }
}

// 페이지 로드 시 WebSocket 연결 초기화 및 이벤트 리스너 추가
window.addEventListener('load', () => {
    initializeWebSocket();
    showProjectList();  // 초기 화면으로 프로젝트 목록 표시
    
    // 햄버거 메뉴 클릭 이벤트 리스너 추가
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', toggleSidebar);
    } else {
    }

    // 프로젝트 검색 이벤트 리스너 추가
    const projectSearch = document.getElementById('project-search');
    if (projectSearch) {
        projectSearch.addEventListener('input', searchProjects);
    } else {
    }
});

// 전역 스코프에서 필요한 함수들을 정의하거나 다른 파일에서 가져옵니다.
// 예: window.showProjectDetails = showProjectDetails;

function updateProjectInUI(project) {
    const projectElement = document.getElementById(`project-${project.id}`);
    if (projectElement) {
        const projectNameElement = projectElement.querySelector('.project-name');
        if (projectNameElement) {
            projectNameElement.textContent = project.name || '이름 없음';
        }
        const progressBar = projectElement.querySelector('.progress-bar');
        const progressText = projectElement.querySelector('.progress-text');
        if (progressBar && progressText) {
            const progress = project.progress || 0;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
        }
    }
    // 프로젝트 목록 페이지에 있을 경우에만 updateProjectList 호출
    const projectList = document.getElementById('project-list');
    if (projectList) {
        updateProjectList();
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    if (sidebar && content) {
        sidebar.classList.toggle('open');
        content.classList.toggle('sidebar-open');
        
        // 트랜지션이 끝난 후 레이아웃 재조정
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300); // CSS 트랜지션 시간과 일치시킴
    }
}

// closeSidebar 함수도 유사하게 수정
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    if (sidebar && content) {
        sidebar.classList.remove('open');
        content.classList.remove('sidebar-open');
        
        // 트랜지션이 끝난 후 레이아웃 재조정
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300); // CSS 트랜지션 시간과 일치시킴
    }
}

// 전역 스코프에 노출
window.toggleSidebar = toggleSidebar;

window.closeSidebar = closeSidebar;

function handleProjectChange(data) {
    switch (data.type) {
        case 'PROJECT_ADDED':
            if (data.project && data.project.name) {
                projects.push(data.project);
                updateProjectList();
            } else {
                console.error('Invalid project data received:', data);
            }
            break;
        case 'PROJECT_UPDATED':
            const index = projects.findIndex(p => p.id === data.project.id);
            if (index !== -1) {
                projects[index] = data.project;
                updateProjectInUI(data.project);
                updateProjectList();
            }
            break;
        case 'PROJECT_DELETED':
            projects = projects.filter(p => p.id !== data.projectId);
            removeProjectFromUI(data.projectId);
            updateProjectList();
            // 만약 현재 삭제된 프로젝의 상세 페이지를 보고 있다면 프로젝트 목록으로 이동
            if (getCurrentProjectId() === data.projectId) {
                showProjectList();
            }
            break;
    }
}

// showProjectDetails 함수를 전역 스코프에 노출
if (typeof window.showProjectDetails !== 'function') {
    window.showProjectDetails = function(projectId) {
        if (typeof showProjectDetails === 'function') {
            showProjectDetails(projectId);
        }
    };
}
