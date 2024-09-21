let socket;
let projects = [];
let todos = {};
let projectAssignees = {};

function initializeWebSocket() {
    console.log('WebSocket 연결 시도...');
    socket = new WebSocket('ws:/110.15.29.199:6521');

    socket.onopen = () => {
        console.log('WebSocket이 연결되었습니다.');
        requestFullStateUpdate();
    };

    socket.onmessage = (event) => {
        console.log('WebSocket 메시지 수신:', event.data); // 원본 메시지 로깅
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
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

// 페이지 로드 시 WebSocket 연결 초기화 및 이벤트 리스너 추가
window.addEventListener('load', () => {
    initializeWebSocket();
    showProjectList();  // 초기 화면으로 프로젝트 목록 표시
    
    // 햄버거 메뉴 클릭 이벤트 리스너 추가
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', toggleSidebar);
    } else {
        console.error('햄버거 메뉴 요소를 찾을 수 없습니다.');
    }

    // 프로젝트 검색 이벤트 리스너 추가
    const projectSearch = document.getElementById('project-search');
    if (projectSearch) {
        projectSearch.addEventListener('input', searchProjects);
    } else {
        console.error('프로젝트 검색 입력 요소를 찾을 수 없습니다.');
    }

    // 페이지 로드 완료 후 전체 상태 업데이트 요청
    setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
            requestFullStateUpdate();
        }
    }, 1000);
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
            // 만약 현재 삭제된 프로젝트의 상세 페이지를 보고 있다면 프로젝트 목록으로 이동
            if (getCurrentProjectId() === data.projectId) {
                showProjectList();
            }
            break;
    }
}

// showProjectDetails 함수를 전역 스코프에 출
if (typeof window.showProjectDetails !== 'function') {
    window.showProjectDetails = function(projectId) {
        if (typeof showProjectDetails === 'function') {
            showProjectDetails(projectId);
        }
    };
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

document.addEventListener('DOMContentLoaded', function() {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');

    hamburgerMenu.addEventListener('click', function() {
        sidebar.classList.toggle('open');
        content.classList.toggle('sidebar-open');
    });
});

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
                <span class="assignee">${todo.assignee || '미배정'}</span>
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
