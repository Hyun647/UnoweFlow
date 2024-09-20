let socket;
let projects = [];
let todos = {};
let projectAssignees = {};

function initializeWebSocket() {
    console.log('WebSocket 연결 시도...');
    socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log('WebSocket 연결이 열렸습니다.');
        showProjectList();
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
            projects.push(data.project);
            updateProjectList();
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
            updateAssigneeList(data.projectId);
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
            updateAssigneeList(data.projectId);
            break;
    }
}

function showProjectList() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <h2>프로젝트 목록</h2>
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
    projectElement.innerHTML = `
        <h3 class="project-name" onclick="showProjectDetails('${project.id}')">${project.name}</h3>
        <button onclick="editProject('${project.id}')">편집</button>
        <div class="progress-circle" data-progress="${project.progress || 0}">
            <div class="progress-circle-value">${project.progress || 0}%</div>
        </div>
        <button onclick="deleteProject('${project.id}')">삭제</button>
    `;
    return projectElement;
}

function showProjectDetails(projectId) {
    const mainContent = document.getElementById('main-content');
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    mainContent.innerHTML = `
        <h2 id="project-details-title" data-project-id="${projectId}">${project.name} 상세</h2>
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

function editProject(projectId) {
    const projectElement = document.getElementById(`project-${projectId}`);
    const projectNameElement = projectElement.querySelector('.project-name');
    const newName = prompt('프로젝트 이름을 수정하세요:', projectNameElement.textContent);
    if (newName && newName.trim() !== '') {
        socket.send(JSON.stringify({
            type: 'UPDATE_PROJECT',
            project: { id: projectId, name: newName.trim() }
        }));
    }
}

function updateProjectInUI(project) {
    const projectElement = document.getElementById(`project-${project.id}`);
    if (projectElement) {
        projectElement.querySelector('.project-name').textContent = project.name;
        projectElement.querySelector('.progress-circle-value').textContent = `${project.progress}%`;
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
    let options = '<option value="">미지정</option>';
    options += assignees.map(assignee => 
        `<option value="${assignee}" ${assignee === currentAssignee ? 'selected' : ''}>${assignee}</option>`
    ).join('');
    return options;
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
        // 모달을 닫습니다.
        closeModal();
    }
}

function deleteAssignee(projectId, assigneeName) {
    if (confirm(`정말로 ${assigneeName}을(를) 삭제하시겠습니까?`)) {
        socket.send(JSON.stringify({
            type: 'DELETE_ASSIGNEE',
            projectId: projectId,
            assigneeName: assigneeName
        }));
    }
}

function updateAssigneeList(projectId) {
    const assigneeList = document.getElementById('assignee-list');
    if (!assigneeList) return;
    
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
    
    updateAllTodoAssigneeOptions(projectId);
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

function deleteTodo(todoId) {
    const projectId = getCurrentProjectId();
    if (projectId) {
        if (confirm('정말로 이 할 일을 삭제하시겠습니까?')) {
            socket.send(JSON.stringify({
                type: 'DELETE_TODO',
                projectId: projectId,
                todoId: todoId
            }));
        }
    } else {
        console.error('현재 프로젝트 ID를 을 수 없습니다.');
    }
}

function editTodo(todoId) {
    const todoElement = document.getElementById(`todo-${todoId}`);
    const todoTextElement = todoElement.querySelector('.todo-text');
    const newText = prompt('할 일을 수정하세요:', todoTextElement.textContent);
    if (newText && newText.trim() !== '') {
        const projectId = getCurrentProjectId();
        const updatedTodo = {
            id: todoId,
            text: newText.trim(),
            completed: todoElement.querySelector('.todo-checkbox').checked,
            assignee: todoElement.querySelector('.todo-assignee').value,
            priority: todoElement.querySelector('.todo-priority').value,
            dueDate: todoElement.querySelector('.todo-due-date').value
        };
        updateTodo(projectId, updatedTodo);
    }
}

function filterAndSortTodos(projectId) {
    const filterPriority = document.getElementById('filter-priority').value;
    const filterAssignee = document.getElementById('filter-assignee').value;
    const sortBy = document.getElementById('sort-by').value;

    let filteredTodos = todos[projectId] || [];

    if (filterPriority !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.priority === filterPriority);
    }
    if (filterAssignee !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.assignee === filterAssignee);
    }

    filteredTodos.sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
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
    statisticsElement.innerHTML = statistics;
}

function searchProjects() {
    const searchInput = document.getElementById('project-search');
    const searchTerm = searchInput.value.toLowerCase();
    const filteredProjects = projects.filter(project => project.name.toLowerCase().includes(searchTerm));
    updateProjectList(filteredProjects);
}

function searchTodos(projectId) {
    const searchInput = document.getElementById('todo-search');
    const searchTerm = searchInput.value.toLowerCase();
    const filteredTodos = todos[projectId] || [];
    const filteredAndSortedTodos = filteredTodos.filter(todo => todo.text.toLowerCase().includes(searchTerm));
    updateTodoList(projectId, filteredAndSortedTodos);
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
            <input type="text" id="new-assignee-name" placeholder=" 담당자 이름">
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
                <th>마감일</th>
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
    const assignees = ['미지정', ...getAssignees(projectId)];

    let progressHTML = '';
    assignees.forEach(assignee => {
        const assigneeTodos = projectTodos.filter(todo => (todo.assignee || '미지정') === assignee);
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

window.addEventListener('load', () => {
    console.log('페이지 로드됨');
    initializeWebSocket();
});