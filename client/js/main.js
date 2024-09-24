let socket;
let projects = [];
let todos = {};
let projectAssignees = {};
let reconnectInterval; // 재연결을 위한 인터벌 변수

function initializeMainPage(authenticatedSocket) {
    console.log('메인 페이지 초기화');
    socket = authenticatedSocket;
    setupWebSocketHandlers();
    showProjectList();
    setupEventListeners();
    requestFullStateUpdate();
    updateConnectionStatus(); // 초기 연결 상태 업데이트
}

function setupWebSocketHandlers() {
    socket.onmessage = (event) => {
        console.log('WebSocket 메시지 수신:', event.data);
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    socket.onclose = (event) => {
        console.log('WebSocket 연결이 끊어졌습니다.');
        updateConnectionStatus(false); // 연결 상태 업데이트
        reconnect(); // 재연결 시도
    };

    socket.onerror = (error) => {
        console.error('WebSocket 연결 오류:', error);
    };
}

function reconnect() {
    if (reconnectInterval) return; // 이미 재연결 시도 중이면 종료
    reconnectInterval = setInterval(() => {
        console.log('서버에 재연결 시도 중...');
        socket = new WebSocket(socket.url); // 기존 소켓 URL로 새 소켓 생성
        socket.onopen = () => {
            console.log('서버에 재연결되었습니다.');
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            updateConnectionStatus(true); // 연결 상태 업데이트
            setupWebSocketHandlers(); // 핸들러 재설정
            requestFullStateUpdate(); // 상태 업데이트 요청
        };
    }, 3000); // 3초마다 재연결 시도
}

function updateConnectionStatus(isConnected = true) {
    const statusIndicator = document.getElementById('connection-status');
    if (statusIndicator) {
        statusIndicator.style.backgroundColor = isConnected ? 'green' : 'red';
    }
}

function requestFullStateUpdate() {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'REQUEST_FULL_STATE' }));
    } else {
        console.error('WebSocket이 열려있지 않습니다. 상태 업데이트를 요청할 수 없습니다.');
    }
}

function handleWebSocketMessage(data) {
    console.log('처리 중인 메시지:', data);
    switch (data.type) {
        case 'FULL_STATE_UPDATE':
            projects = data.projects || [];
            todos = data.todos || {};
            projectAssignees = data.projectAssignees || {};
            
            // todos 객체의 각 프로젝트 ID를 문자열로 변환
            todos = Object.keys(todos).reduce((acc, key) => {
                acc[key.toString()] = todos[key].map(todo => ({
                    ...todo,
                    id: todo.id.toString(),
                    projectId: key.toString() // projectId를 key(프로젝트 ID)로 설정
                }));
                return acc;
            }, {});

            if (document.getElementById('project-list')) {
                updateProjectList();
            }
            // 현재 프로젝트의 할 일 목록 업데이트
            const currentProjectId = getCurrentProjectId();
            if (currentProjectId) {
                updateTodoList(currentProjectId);
            }
            break;
        case 'PROJECT_ADDED':
            if (data.project) {
                projects.push(data.project);
                updateProjectList();
            } else {
                console.error('PROJECT_ADDED: 프로젝트 데이터가 없습니다.', data);
            }
            break;
        case 'PROJECT_UPDATED':
            if (data.project && data.project.id) {
                const index = projects.findIndex(p => p.id === data.project.id);
                if (index !== -1) {
                    projects[index] = data.project;
                    updateProjectInUI(data.project);
                    updateProjectList();
                } else {
                    console.error('PROJECT_UPDATED: 해당 ID의 프로젝트를 찾을 수 없습니다.', data.project.id);
                }
            } else {
                console.error('PROJECT_UPDATED: 유효하지 않은 프로젝트 데이터', data);
            }
            break;
        case 'PROJECT_DELETED':
            if (data.projectId) {
                projects = projects.filter(p => p.id !== data.projectId);
                removeProjectFromUI(data.projectId);
                updateProjectList();
                if (getCurrentProjectId() === data.projectId) {
                    showProjectList();
                }
            } else {
                console.error('PROJECT_DELETED: 프로젝트 ID가 없습니다.', data);
            }
            break;
        case 'TODO_ADDED':
        case 'TODO_UPDATED':
        case 'TODO_DELETED':
            console.log('할 일 변경 감지:', data);
            handleTodoChange(data);
            break;
        case 'ASSIGNEE_ADDED':
            if (data.projectId && data.assigneeName) {
                if (!projectAssignees[data.projectId]) {
                    projectAssignees[data.projectId] = [];
                }
                projectAssignees[data.projectId].push(data.assigneeName);
                updateAssigneeListInModal(data.projectId);
                updateAssigneeProgress(data.projectId);
                if (getCurrentProjectId() === data.projectId) {
                    filterAndSortTodos(data.projectId);
                }
            } else {
                console.error('ASSIGNEE_ADDED: 유효하지 않은 데이터', data);
            }
            break;
        case 'ASSIGNEE_DELETED':
            if (data.projectId && data.assigneeName) {
                if (projectAssignees[data.projectId]) {
                    projectAssignees[data.projectId] = projectAssignees[data.projectId].filter(a => a !== data.assigneeName);
                }
                updateAssigneeListInModal(data.projectId);
                updateAssigneeProgress(data.projectId);
                removeAssigneeFromTodos(data.projectId, data.assigneeName);
            } else {
                console.error('ASSIGNEE_DELETED: 유효하지 않은 데이터', data);
            }
            break;
        case 'MEMO_UPDATE':
            console.log('메모 업데이트 메시지 수신:', data);
            handleMemoUpdate(data);
            break;
        default:
            console.warn('알 수 없는 시지 타입:', data.type);
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

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    const body = document.body;

    sidebar.classList.toggle('open');
    content.classList.toggle('sidebar-open');
    body.classList.toggle('sidebar-open');

    // 사이드바가 열릴 때 컨텐츠 영역 마진 조정
    if (sidebar.classList.contains('open')) {
        content.style.marginLeft = '250px';
    } else {
        content.style.marginLeft = '0';
    }
}

// closeSidebar 함수 유사하게 수정
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    
    if (sidebar && content) {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            sidebar.style.transition = 'none';
            content.style.transition = 'none';
        }

        sidebar.classList.remove('open');
        content.classList.remove('sidebar-open');

        if (isMobile) {
            sidebar.offsetHeight;
            content.offsetHeight;
            setTimeout(() => {
                sidebar.style.transition = '';
                content.style.transition = '';
            }, 0);
        }

        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, isMobile ? 0 : 300);
    }
}

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
            // 만약 현재 삭제된 프로젝트의 상세 페이지를 보고 있다면 프로젝트 목록으로 이동
            if (getCurrentProjectId() === data.projectId) {
                showProjectList();
            }
            break;
    }
}

function createModal(content, modalId) {
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = modalId;
    modal.innerHTML = `
        <div class="modal-content">
            ${content}
            <div class="modal-footer">
                <button onclick="closeModal('${modalId}')" class="button close-btn">닫기</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    openModal(modalId);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function updateTodoList(projectId) {
    console.log('updateTodoList 함수 호출됨, projectId:', projectId);
    console.log('todos[projectId]:', todos[projectId]);

    const todoList = document.getElementById('todo-list');
    if (!todoList) {
        console.error('todo-list 요소를 찾을 수 없습니다.');
        return;
    }
    todoList.innerHTML = '';
    if (todos[projectId]) {
        todos[projectId].forEach(todo => {
            console.log('처리 중인 할 일:', todo);
            const li = document.createElement('li');
            let dueDateValue = todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '';
            console.log(`할 일 ID: ${todo.id}, 원본 마감일: ${todo.dueDate}, 변환된 마감일 값: ${dueDateValue}`);
            li.innerHTML = `
                <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodoComplete('${projectId}', '${todo.id}')">
                <span class="${todo.completed ? 'completed' : ''}">${todo.text}</span>
                <span class="assignee">${todo.assignee || '미지정'}</span>
                <span class="priority">${todo.priority}</span>
                <input type="date" class="todo-due-date" value="${dueDateValue}" onchange="updateTodoDueDate('${projectId}', '${todo.id}', this.value)">
                <button onclick="editTodo('${projectId}', '${todo.id}')">수정</button>
                <button onclick="deleteTodo('${projectId}', '${todo.id}')">삭제</button>
            `;
            todoList.appendChild(li);
        });
    } else {
        console.log('해당 프로젝트의 할 일이 없습니다.');
    }
}

function updateTodoDueDate(projectId, todoId, newDate) {
    const todo = todos[projectId].find(t => t.id === todoId);
    if (todo) {
        todo.dueDate = newDate === '' ? null : newDate;
        console.log('마감일 업데이트:', todo);
        console.log(`업데이트된 마감일: ${todo.dueDate}`);
        socket.send(JSON.stringify({
            type: 'UPDATE_TODO',
            projectId: projectId,
            todo: {
                ...todo,
                dueDate: todo.dueDate
            }
        }));
    }
}

function handleTodoChange(data) {
    console.log('handleTodoChange 함수 호출됨, 받은 데이터:', data);
    const { projectId, todo } = data;
    if (!todos[projectId]) {
        todos[projectId] = [];
    }
    
    const updatedTodo = {
        ...todo,
        dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : null
    };
    
    const index = todos[projectId].findIndex(t => t.id === updatedTodo.id);
    if (index !== -1) {
        todos[projectId][index] = updatedTodo;
    } else {
        todos[projectId].push(updatedTodo);
    }
    
    console.log(`할 일 업데이트/추가 후:`, updatedTodo);
    
    if (getCurrentProjectId() === projectId) {
        updateTodoList(projectId);
    }
}

function setupEventListeners() {
    // 여기에 필요한 이벤트 리스너를 추가합니다.
    // 예: 프로젝트 추가 버튼 클릭 이벤트 등
}

function showProjectList() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error('main-content 요소를 찾을 수 없습니다.');
        return;
    }
    mainContent.innerHTML = `
        <div id="project-management">
            <div id="project-input-container">
                <input type="text" id="project-input" placeholder="새 프로젝트 이름">
                <button onclick="addProject()">추가</button>
            </div>
        </div>
        <ul id="project-list"></ul>
    `;
    updateProjectList();
}

function updateProjectList() {
    const projectList = document.getElementById('project-list');
    if (!projectList) {
        console.error('project-list 요소를 찾을 수 없습니다.');
        return;
    }
    projectList.innerHTML = '';
    projects.forEach(project => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="project-item">
                <span class="project-name">${project.name}</span>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${project.progress || 0}%"></div>
                    <span class="progress-text">${project.progress || 0}%</span>
                </div>
                <button onclick="showProjectDetails('${project.id}')">상세 보기</button>
                <button onclick="editProject('${project.id}')">수정</button>
                <button onclick="deleteProject('${project.id}')">삭제</button>
            </div>
        `;
        projectList.appendChild(li);
    });
}

function addProject() {
    const projectInput = document.getElementById('project-input');
    if (projectInput) {
        const projectName = projectInput.value.trim();
        if (projectName !== '') {
            socket.send(JSON.stringify({
                type: 'ADD_PROJECT',
                project: {
                    name: projectName
                }
            }));
            projectInput.value = '';
        }
    }
}

function showProjectDetails(projectId) {
    // 프로젝트 상세 보기 로직 구현
    console.log(`프로젝트 상세 보기: ${projectId}`);
}

function editProject(projectId) {
    // 프로젝트 수정 로직 구현
    console.log(`프로젝트 수정: ${projectId}`);
}

function deleteProject(projectId) {
    // 프로젝트 삭제 로직 구현
    console.log(`프로젝트 삭제: ${projectId}`);
}

function hideAllSections() {
    const sections = document.querySelectorAll('main > div');
    sections.forEach(section => {
        section.style.display = 'none';
    });
}

function showSection(sectionId) {
    hideAllSections();
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
}

// 전역 스코프에 함수들을 노출
window.initializeMainPage = initializeMainPage;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.addProject = addProject;
window.showProjectDetails = showProjectDetails;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.hideAllSections = hideAllSections;
window.showSection = showSection;