let socket;
let projects = [];
let todos = {};
let projectAssignees = {};

function initializeWebSocket() {
    console.log('WebSocket 연결 시도...');
    socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log('WebSocket 연결이 열렸습니다.');
        requestProjectList(); // 프로젝트 목록 요청
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

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'FULL_STATE_UPDATE':
            projects = data.projects;
            todos = data.todos;
            projectAssignees = data.projectAssignees || {};
            updateProjectList();
            break;
        case 'PROJECT_ADDED':
            if (data.project && data.project.name) {
                projects.push(data.project);
                updateProjectList();
            } else {
                console.error('Invalid project data received:', data);
            }
            break;
        case 'PROJECT_UPDATED':
            const projectIndex = projects.findIndex(p => p.id === data.project.id);
            if (projectIndex !== -1) {
                projects[projectIndex] = data.project;
                updateProjectInUI(data.project);
            }
            break;
        case 'PROJECT_DELETED':
            projects = projects.filter(p => p.id !== data.projectId);
            removeProjectFromUI(data.projectId);
            break;
        case 'TODO_ADDED':
        case 'TODO_UPDATED':
        case 'TODO_DELETED':
            if (!todos[data.projectId]) {
                todos[data.projectId] = [];
            }
            if (data.type === 'TODO_ADDED') {
                if (!todos[data.projectId].some(todo => todo.id === data.todo.id)) {
                    todos[data.projectId].push(data.todo);
                }
            } else if (data.type === 'TODO_UPDATED') {
                const todoIndex = todos[data.projectId].findIndex(t => t.id === data.todo.id);
                if (todoIndex !== -1) {
                    todos[data.projectId][todoIndex] = data.todo;
                }
            } else if (data.type === 'TODO_DELETED') {
                todos[data.projectId] = todos[data.projectId].filter(t => t.id !== data.todoId);
            }
            const currentProjectId = getCurrentProjectId();
            if (currentProjectId === data.projectId) {
                filterAndSortTodos(data.projectId);
                updateAssigneeProgress(data.projectId);
                showProjectStatistics(data.projectId);
            }
            break;
        case 'ASSIGNEE_ADDED':
            if (!projectAssignees[data.projectId]) {
                projectAssignees[data.projectId] = [];
            }
            if (!projectAssignees[data.projectId].includes(data.assigneeName)) {
                projectAssignees[data.projectId].push(data.assigneeName);
            }
            updateAllTodoAssigneeOptions(data.projectId);
            updateAssigneeListInModal(data.projectId);
            // 현재 프로젝트의 할 일 목록을 업데이트
            const currentProjectIdForAssignee = getCurrentProjectId();
            if (currentProjectIdForAssignee === data.projectId) {
                filterAndSortTodos(data.projectId);
            }
            break;
        case 'ASSIGNEE_DELETED':
            projectAssignees[data.projectId] = projectAssignees[data.projectId].filter(
                assignee => assignee !== data.assigneeName
            );
            updateAssigneeListInModal(data.projectId);
            break;
        case 'PROJECTS_LIST':
            if (Array.isArray(data.projects)) {
                projects = data.projects;
                updateProjectList();
            } else {
                console.error('Invalid projects list received:', data);
            }
            break;
    }
}

function showProjectList() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <h2>프트 목록</h2>
        <div id="project-form">
            <input type="text" id="project-input" placeholder="새 프로젝트 이름">
            <button id="add-project-btn">프로젝트 추가</button>
        </div>
        <input type="text" id="project-search" placeholder="프로젝트 검색" onkeyup="searchProjects()">
        <div id="project-list"></div>
    `;
    document.getElementById('add-project-btn').addEventListener('click', addProject);
    updateProjectList();
}

function updateProjectList(filteredProjects = projects) {
    const projectList = document.getElementById('project-list');
    projectList.innerHTML = '';
    filteredProjects.forEach(project => {
        const projectElement = createProjectElement(project);
        projectList.appendChild(projectElement);
    });
}

function createProjectElement(project) {
    const projectElement = document.createElement('div');
    projectElement.id = `project-${project.id}`;
    projectElement.className = 'project';
    const progress = project.progress || 0;
    projectElement.innerHTML = `
        <h3 class="project-name">${project.name || '이름 없음'}</h3>
        <div class="progress-circle" data-progress="${progress}">
            <div class="progress-circle-value">${progress}%</div>
        </div>
        <div class="project-buttons">
            <button onclick="showProjectDetails('${project.id}')">보기</button>
            <button onclick="renameProject('${project.id}')">이름 변경</button>
            <button class="delete-btn" onclick="deleteProject('${project.id}')">삭제</button>
        </div>
    `;
    return projectElement;
}

function showProjectDetails(projectId) {
    const mainContent = document.getElementById('main-content');
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        console.error('Project not found:', projectId);
        return;
    }

    mainContent.innerHTML = `
        <h2 id="project-details-title" data-project-id="${projectId}">${project.name || '이름 없음'} 상세</h2>
        <div id="assignee-progress"></div>
        <div id="todo-filters">
            <select id="filter-priority" onchange="filterAndSortTodos('${projectId}')">
                <option value="all">모든 우선순위</option>
                <option value="high">높음</option>
                <option value="medium">중간</option>
                <option value="low">낮음</option>
            </select>
            <select id="filter-assignee" onchange="filterAndSortTodos('${projectId}')">
                <option value="all">모든 담당자</option>
                ${getAssigneeOptions(projectId)}
            </select>
            <select id="sort-by" onchange="filterAndSortTodos('${projectId}')">
                <option value="priority">우선순위순</option>
                <option value="dueDate">마감일순</option>
                <option value="assignee">담당자순</option>
            </select>
        </div>
        <div id="todo-input">
            <input type="text" id="new-todo-text" placeholder="새 할 일">
            <select id="new-todo-assignee">
                ${getAssigneeOptions(projectId)}
            </select>
            <select id="new-todo-priority">
                <option value="low">낮음</option>
                <option value="medium">중간</option>
                <option value="high">높음</option>
            </select>
            <input type="date" id="new-todo-due-date">
            <button onclick="addTodo('${projectId}')">할 일 추가</button>
        </div>
        <button onclick="showManageAssigneesModal('${projectId}')">담당자 관리</button>
        <input type="text" id="todo-search" placeholder="할 일 검색" onkeyup="searchTodos('${projectId}')">
        <h3>우선 처리할 일</h3>
        <div id="priority-todo-list"></div>
        <h3>전체 할 일 목록</h3>
        <div id="todo-list"></div>
        <div id="project-statistics"></div>
        <button onclick="showProjectList()">프로젝트 목록으로 돌아가기</button>
    `;

    updateAssigneeProgress(projectId);
    filterAndSortTodos(projectId);
    showProjectStatistics(projectId);
}

function addProject() {
    const projectInput = document.getElementById('project-input');
    const projectName = projectInput.value.trim();
    if (projectName) {
        socket.send(JSON.stringify({ type: 'ADD_PROJECT', name: projectName }));
        projectInput.value = '';
    }
}

function deleteProject(projectId) {
    if (confirm('정말로 이 프로젝트를 삭제하시겠습니까?')) {
        socket.send(JSON.stringify({ type: 'DELETE_PROJECT', projectId: projectId }));
    }
}

function renameProject(projectId) {
    const projectElement = document.getElementById(`project-${projectId}`);
    const projectNameElement = projectElement.querySelector('.project-name');
    const currentName = projectNameElement.textContent;
    const newName = prompt('새로운 프로젝트 이름을 입력하세요:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
        socket.send(JSON.stringify({
            type: 'UPDATE_PROJECT',
            project: { id: projectId, name: newName.trim() }
        }));
    }
}

function updateProjectInUI(project) {
    const projectElement = document.getElementById(`project-${project.id}`);
    if (projectElement) {
        projectElement.querySelector('.project-name').textContent = project.name || '이름 없음';
        const progressCircle = projectElement.querySelector('.progress-circle');
        const progressValue = projectElement.querySelector('.progress-circle-value');
        if (progressCircle && progressValue) {
            const progress = project.progress || 0;
            progressCircle.dataset.progress = progress;
            progressValue.textContent = `${progress}%`;
        }
    }
}

function removeProjectFromUI(projectId) {
    const projectElement = document.getElementById(`project-${projectId}`);
    if (projectElement) {
        projectElement.remove();
    }
}

function getAssignees(projectId) {
    return projectAssignees[projectId] || [];
}

function getAssigneeOptions(projectId, currentAssignee = '') {
    const assignees = getAssignees(projectId);
    return assignees.map(assignee => 
        `<option value="${assignee}" ${assignee === currentAssignee ? 'selected' : ''}>${assignee}</option>`
    ).join('');
}

function updateTodoAssignee(todoId, newAssignee) {
    const projectId = getCurrentProjectId();
    if (!projectId) {
        console.error('현재 프로젝트 ID를 찾을 수 없습니다.');
        return;
    }

    const projectTodos = todos[projectId] || [];
    const todo = projectTodos.find(t => t.id === todoId);
    if (!todo) {
        console.error(`ID가 ${todoId}인 할 일을 찾을 수 없습니다.`);
        return;
    }

    todo.assignee = newAssignee;
    updateTodo(projectId, todo);
}

function updateTodo(projectId, updatedTodo) {
    socket.send(JSON.stringify({
        type: 'UPDATE_TODO',
        projectId: projectId,
        todo: updatedTodo
    }));
}

function updateTodoStatus(todoId, completed) {
    const todoElement = document.getElementById(`todo-${todoId}`);
    if (!todoElement) {
        console.error(`Todo element with id ${todoId} not found`);
        return;
    }

    const projectId = getCurrentProjectId();
    if (!projectId) {
        console.error('Current project ID not found');
        return;
    }

    const todoText = todoElement.querySelector('.todo-text').textContent;
    const assignee = todoElement.querySelector('.todo-assignee').value;
    const priority = todoElement.querySelector('.todo-priority').value;
    const dueDate = todoElement.querySelector('.todo-due-date').value;
    const completedDate = completed ? new Date().toISOString() : null;
    
    updateTodo(projectId, { 
        id: todoId, 
        text: todoText, 
        completed: completed, 
        assignee: assignee, 
        priority: priority, 
        dueDate: dueDate,
        completedDate: completedDate 
    });
}

function updateTodoPriority(todoId, newPriority) {
    const todoElement = document.getElementById(`todo-${todoId}`);
    if (!todoElement) {
        console.error(`Todo element with id ${todoId} not found`);
        return;
    }

    const projectId = getCurrentProjectId();
    if (!projectId) {
        console.error('Current project ID not found');
        return;
    }

    const todoText = todoElement.querySelector('.todo-text').textContent;
    const completed = todoElement.querySelector('.todo-checkbox').checked;
    const assignee = todoElement.querySelector('.todo-assignee').value;
    const dueDate = todoElement.querySelector('.todo-due-date').value;
    
    updateTodo(projectId, { id: todoId, text: todoText, completed: completed, assignee: assignee, priority: newPriority, dueDate: dueDate });
}

function updateTodoDueDate(todoId, newDueDate) {
    const todoElement = document.getElementById(`todo-${todoId}`);
    if (!todoElement) {
        console.error(`Todo element with id ${todoId} not found`);
        return;
    }

    const projectId = getCurrentProjectId();
    if (!projectId) {
        console.error('Current project ID not found');
        return;
    }

    const todoText = todoElement.querySelector('.todo-text').textContent;
    const completed = todoElement.querySelector('.todo-checkbox').checked;
    const assignee = todoElement.querySelector('.todo-assignee').value;
    const priority = todoElement.querySelector('.todo-priority').value;
    
    updateTodo(projectId, { id: todoId, text: todoText, completed: completed, assignee: assignee, priority: priority, dueDate: newDueDate });
}

function getCurrentProjectId() {
    const projectDetailsTitle = document.getElementById('project-details-title');
    return projectDetailsTitle ? projectDetailsTitle.dataset.projectId : null;
}

function addNewAssignee(projectId) {
    const newAssigneeName = document.getElementById('new-assignee-name').value.trim();
    if (newAssigneeName) {
        socket.send(JSON.stringify({
            type: 'ADD_ASSIGNEE',
            projectId: projectId,
            assigneeName: newAssigneeName
        }));
        document.getElementById('new-assignee-name').value = '';
        // 담당자 목록 업데이트
        updateAssigneeListInModal(projectId);
    }
}

function updateAssigneeListInModal(projectId) {
    const assigneeList = document.getElementById('assignee-list');
    const assignees = getAssignees(projectId);
    
    let assigneeListHTML = '';
    assignees.forEach(assignee => {
        assigneeListHTML += `
            <li>
                ${assignee}
                <button onclick="deleteAssignee('${projectId}', '${assignee}')">삭제</button>
            </li>
        `;
    });
    
    assigneeList.innerHTML = assigneeListHTML;
}

function showManageAssigneesModal(projectId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const assignees = getAssignees(projectId);
    
    let assigneeListHTML = '';
    assignees.forEach(assignee => {
        assigneeListHTML += `
            <li>
                ${assignee}
                <button onclick="deleteAssignee('${projectId}', '${assignee}')">삭제</button>
            </li>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content">
            <h3>담당자 관리</h3>
            <ul id="assignee-list">
                ${assigneeListHTML}
            </ul>
            <input type="text" id="new-assignee-name" placeholder="담당자 이름">
            <button onclick="addNewAssignee('${projectId}')">담당자 추가</button>
            <button onclick="closeModal()">닫기</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

function updateTodoList(projectId, filteredTodos = todos[projectId] || []) {
    const todoListElement = document.getElementById('todo-list');
    const priorityTodoListElement = document.getElementById('priority-todo-list');
    
    todoListElement.innerHTML = '';
    priorityTodoListElement.innerHTML = '';

    const table = createTodoTable(filteredTodos, projectId);
    todoListElement.appendChild(table);

    const priorityTodos = getPriorityTodos(filteredTodos, projectId);
    const priorityTable = createTodoTable(priorityTodos, projectId);
    priorityTodoListElement.appendChild(priorityTable);

    // 담당자 옵션 업데이트
    updateAllTodoAssigneeOptions(projectId);
}

function createTodoTable(todos, projectId) {
    const table = document.createElement('table');
    table.className = 'todo-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>완료</th>
                <th>내용</th>
                <th>담당자</th>
                <th>우선순위</th>
                <th>마일</th>
                <th>작업</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tableBody = table.querySelector('tbody');

    todos.forEach(todo => {
        const todoRow = createTodoRow(todo, projectId);
        tableBody.appendChild(todoRow);
    });

    return table;
}

function createTodoRow(todo, projectId) {
    const row = document.createElement('tr');
    row.className = 'todo-item';
    row.id = `todo-${todo.id}`;
    row.innerHTML = `
        <td><input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} onchange="updateTodoStatus('${todo.id}', this.checked)"></td>
        <td><span class="todo-text">${todo.text}</span></td>
        <td>
            <select class="todo-assignee" onchange="updateTodoAssignee('${todo.id}', this.value)">
                ${getAssigneeOptions(projectId, todo.assignee)}
            </select>
        </td>
        <td>
            <select class="todo-priority" onchange="updateTodoPriority('${todo.id}', this.value)">
                <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>낮음</option>
                <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>중간</option>
                <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>높음</option>
            </select>
        </td>
        <td><input type="date" class="todo-due-date" value="${todo.dueDate || ''}" onchange="updateTodoDueDate('${todo.id}', this.value)"></td>
        <td>
            <button onclick="editTodo('${todo.id}')">수정</button>
            <button onclick="deleteTodo('${todo.id}')">삭제</button>
        </td>
    `;
    return row;
}

function getPriorityTodos(todos, projectId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return todos.filter(todo => {
        if (todo.completed) return false;

        const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
        const daysUntilDue = dueDate ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)) : Infinity;

        return (todo.priority === 'high') ||
               (todo.priority === 'medium' && daysUntilDue <= 3) ||
               (daysUntilDue <= 1);
    }).sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
}

function updateAssigneeProgress(projectId) {
    const assigneeProgressElement = document.getElementById('assignee-progress');
    if (!assigneeProgressElement) return;

    const projectTodos = todos[projectId] || [];
    const assignees = getAssignees(projectId);

    let progressHTML = '';
    assignees.forEach(assignee => {
        const assigneeTodos = projectTodos.filter(todo => todo.assignee === assignee);
        const totalTodos = assigneeTodos.length;
        const completedTodos = assigneeTodos.filter(todo => todo.completed).length;
        const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

        progressHTML += `
            <div class="assignee-progress">
                <span>${assignee}: ${progress}% (${completedTodos}/${totalTodos})</span>
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
        `;
    });

    assigneeProgressElement.innerHTML = progressHTML;
}

function addTodo(projectId) {
    const todoText = document.getElementById('new-todo-text').value.trim();
    const assignee = document.getElementById('new-todo-assignee').value;
    const priority = document.getElementById('new-todo-priority').value || 'low';
    const dueDate = document.getElementById('new-todo-due-date').value;
    if (todoText) {
        socket.send(JSON.stringify({ 
            type: 'ADD_TODO', 
            projectId: projectId, 
            text: todoText, 
            assignee: assignee,
            priority: priority,
            dueDate: dueDate
        }));
        document.getElementById('new-todo-text').value = '';
        document.getElementById('new-todo-assignee').value = '';
        document.getElementById('new-todo-priority').value = 'low';
        document.getElementById('new-todo-due-date').value = '';
    }
}

function filterAndSortTodos(projectId) {
    const filterPriority = document.getElementById('filter-priority').value;
    const filterAssignee = document.getElementById('filter-assignee').value;
    const sortBy = document.getElementById('sort-by').value;

    let filteredTodos = todos[projectId] || [];

    // 우선순위 필터링
    if (filterPriority !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.priority === filterPriority);
    }

    // 담당자 필터링
    if (filterAssignee !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.assignee === filterAssignee);
    }

    // 정렬
    filteredTodos.sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            case 'dueDate':
                return new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31');
            case 'assignee':
                return (a.assignee || '').localeCompare(b.assignee || '');
            default:
                return 0;
        }
    });

    updateTodoList(projectId, filteredTodos);
}

function updateAllTodoAssigneeOptions(projectId) {
    const todoItems = document.querySelectorAll('.todo-item');
    todoItems.forEach(todoItem => {
        const assigneeSelect = todoItem.querySelector('.todo-assignee');
        if (assigneeSelect) {
            const currentAssignee = assigneeSelect.value;
            assigneeSelect.innerHTML = getAssigneeOptions(projectId, currentAssignee);
        }
    });
    
    // 새 할 일 입력 폼의 담당자 옵션도 업데이트
    const newTodoAssigneeSelect = document.getElementById('new-todo-assignee');
    if (newTodoAssigneeSelect) {
        newTodoAssigneeSelect.innerHTML = getAssigneeOptions(projectId);
    }

    // 필터 옵션도 업데이트
    const filterAssigneeSelect = document.getElementById('filter-assignee');
    if (filterAssigneeSelect) {
        const currentFilterAssignee = filterAssigneeSelect.value;
        filterAssigneeSelect.innerHTML = `<option value="all">모든 담당자</option>${getAssigneeOptions(projectId, currentFilterAssignee)}`;
    }
}

function showProjectStatistics(projectId) {
    const project = projects.find(p => p.id === projectId);
    const projectTodos = todos[projectId] || [];
    const totalTodos = projectTodos.length;
    const completedTodos = projectTodos.filter(todo => todo.completed).length;
    const completionRate = totalTodos > 0 ? (completedTodos / totalTodos * 100).toFixed(2) : 0;

    const statistics = `
        <h3>프로젝트 통계</h3>
        <p>전체 할 일: ${totalTodos}</p>
        <p>완료된 할 일: ${completedTodos}</p>
        <p>완료율: ${completionRate}%</p>
    `;

    const statisticsElement = document.getElementById('project-statistics');
    if (statisticsElement) {
        statisticsElement.innerHTML = statistics;
    }

    // 프로젝트 진행률 업데이트
    project.progress = Math.round(parseFloat(completionRate));
    updateProjectInUI(project);

    // 서버에 프로젝트 진행률 업데이트 요청
    socket.send(JSON.stringify({
        type: 'UPDATE_PROJECT',
        project: { id: projectId, progress: project.progress }
    }));
}

function requestProjectList() {
    socket.send(JSON.stringify({ type: 'GET_PROJECTS' }));
}

window.addEventListener('load', () => {
    console.log('페이지 로드됨');
    initializeWebSocket();
});