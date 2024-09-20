let socket;
let projects = [];
let todos = {};
let isProjectListShown = false;

function initializeWebSocket() {
    console.log('WebSocket 연결 시도...');
    socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log('WebSocket 연결이 열렸습니다.');
        if (!isProjectListShown) {
            showProjectList();
            isProjectListShown = true;
        }
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
    console.log('WebSocket 메시지 수신:', data);
    switch (data.type) {
        case 'FULL_STATE_UPDATE':
            projects = data.projects;
            todos = data.todos;
            projectAssignees = data.projectAssignees || {};
            updateProjectList();
            break;
        case 'PROJECT_ADDED':
            console.log('새 프로젝트 추가됨:', data.project);
            projects.push(data.project);
            if (isProjectListShown) {
                addProjectToUI(data.project);
            } else {
                showProjectList();
            }
            break;
        case 'PROJECT_UPDATED':
            const index = projects.findIndex(p => p.id === data.project.id);
            if (index !== -1) {
                projects[index] = data.project;
            }
            updateProjectInUI(data.project);
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
                todos[data.projectId].push(data.todo);
            } else if (data.type === 'TODO_UPDATED') {
                const index = todos[data.projectId].findIndex(t => t.id === data.todo.id);
                if (index !== -1) {
                    todos[data.projectId][index] = data.todo;
                }
            } else if (data.type === 'TODO_DELETED') {
                todos[data.projectId] = todos[data.projectId].filter(t => t.id !== data.todoId);
            }
            updateTodoList(data.projectId);
            updateAssigneeProgress(data.projectId);
            updatePriorityTodoList(data.projectId);
            break;
        case 'ASSIGNEE_ADDED':
            if (!projectAssignees[data.projectId]) {
                projectAssignees[data.projectId] = [];
            }
            projectAssignees[data.projectId].push(data.assigneeName);
            updateAllTodoAssigneeOptions(data.projectId);
            updateAssigneeList(data.projectId);
            updateAssigneeProgress(data.projectId);
            break;
        case 'ASSIGNEE_DELETED':
            projectAssignees[data.projectId] = projectAssignees[data.projectId].filter(
                assignee => assignee !== data.assigneeName
            );
            updateAssigneeList(data.projectId);
            break;
    }
}

function updateFullState(projects, todos) {
    const projectList = document.getElementById('project-list');
    projectList.innerHTML = '';
    projects.forEach(project => {
        addProjectToUI(project);
        const projectTodos = todos[project.id] || [];
        projectTodos.forEach(todo => {
            addTodoToUI(project.id, todo);
        });
    });
}

function addProjectToUI(project) {
    const projectList = document.getElementById('project-list');
    const projectElement = createProjectElement(project);
    projectList.appendChild(projectElement);
}

function updateProjectInUI(project) {
    const projectElement = document.getElementById(`project-${project.id}`);
    if (projectElement) {
        projectElement.querySelector('.project-name').textContent = project.name;
        projectElement.querySelector('.progress-circle-value').textContent = `${project.progress}%`;
        updateProgressCircle(projectElement.querySelector('.progress-circle'));
    }
}

function removeProjectFromUI(projectId) {
    const projectElement = document.getElementById(`project-${projectId}`);
    if (projectElement) {
        projectElement.remove();
    }
}

function addTodoToUI(projectId, todo) {
    const todoList = document.querySelector(`#project-${projectId} .todo-list`);
    if (todoList) {
        const todoElement = createTodoElement(todo);
        todoList.appendChild(todoElement);
    }
}

function updateTodoInUI(projectId, updatedTodo) {
    const todoElement = document.getElementById(`todo-${updatedTodo.id}`);
    if (todoElement) {
        todoElement.querySelector('.todo-checkbox').checked = updatedTodo.completed;
        todoElement.querySelector('.todo-text').textContent = updatedTodo.text;
        const assigneeSelect = todoElement.querySelector('.todo-assignee');
        assigneeSelect.value = updatedTodo.assignee || '';
        if (!assigneeSelect.querySelector(`option[value="${updatedTodo.assignee}"]`)) {
            const option = document.createElement('option');
            option.value = updatedTodo.assignee;
            option.textContent = updatedTodo.assignee;
            assigneeSelect.appendChild(option);
        }
    }
}

function removeTodoFromUI(projectId, todoId) {
    const todoElement = document.getElementById(`todo-${todoId}`);
    if (todoElement) {
        todoElement.remove();
    }
}

function createProjectElement(project) {
    const projectElement = document.createElement('div');
    projectElement.id = `project-${project.id}`;
    projectElement.className = 'project';
    projectElement.innerHTML = `
        <h3 class="project-name" onclick="showProjectDetails('${project.id}')">${project.name}</h3>
        <div class="progress-circle" data-progress="${project.progress || 0}">
            <div class="progress-circle-left">
                <div class="progress-circle-bar"></div>
            </div>
            <div class="progress-circle-right">
                <div class="progress-circle-bar"></div>
            </div>
            <div class="progress-circle-value">${project.progress || 0}%</div>
        </div>
        <button onclick="deleteProject('${project.id}')">프로젝트 삭제</button>
    `;
    
    updateProgressCircle(projectElement.querySelector('.progress-circle'));
    
    return projectElement;
}

function createTodoElement(todo) {
    const todoElement = document.createElement('li');
    todoElement.id = `todo-${todo.id}`;
    todoElement.className = 'todo-item';
    todoElement.innerHTML = `
        <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} onchange="updateTodoStatus('${todo.id}', this.checked)">
        <span class="todo-text">${todo.text}</span>
        <select class="todo-assignee" onchange="updateTodoAssignee('${todo.id}', this.value)">
            ${getAssigneeOptions(getCurrentProjectId(), todo.assignee)}
        </select>
        <select class="todo-priority" onchange="updateTodoPriority('${todo.id}', this.value)">
            <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>낮음</option>
            <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>중간</option>
            <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>높음</option>
        </select>
        <input type="date" class="todo-due-date" value="${todo.dueDate || ''}" onchange="updateTodoDueDate('${todo.id}', this.value)">
        <button onclick="deleteTodo('${todo.id}')">삭제</button>
    `;
    return todoElement;
}

let projectAssignees = {};

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
    
    socket.send(JSON.stringify({
        type: 'UPDATE_TODO',
        projectId: projectId,
        todo: { id: todoId, text: todoText, completed: completed, assignee: newAssignee }
    }));
}

function updateProgressCircle(element) {
    const progress = parseInt(element.getAttribute('data-progress'));
    const degree = (progress / 100) * 360;
    const rightHalf = element.querySelector('.progress-circle-right .progress-circle-bar');
    const leftHalf = element.querySelector('.progress-circle-left .progress-circle-bar');

    if (progress <= 50) {
        rightHalf.style.transform = `rotate(${degree}deg)`;
    } else {
        rightHalf.style.transform = 'rotate(180deg)';
        leftHalf.style.transform = `rotate(${degree - 180}deg)`;
    }
}

function addProject() {
    console.log('addProject 함수 호출됨');
    const projectInput = document.getElementById('project-input');
    const projectName = projectInput.value.trim();
    if (projectName) {
        console.log('프로젝트 추가 요청:', projectName);
        socket.send(JSON.stringify({ type: 'ADD_PROJECT', name: projectName }));
        projectInput.value = '';
    }
}

function deleteProject(projectId) {
    if (confirm('정말로 이 프로젝트를 삭제하시겠습니까?')) {
        socket.send(JSON.stringify({ type: 'DELETE_PROJECT', projectId: projectId }));
    }
}

function showProjectDetails(projectId) {
    const mainContent = document.getElementById('main-content');
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const projectTodos = todos[projectId] || [];

    mainContent.innerHTML = `
        <h2 id="project-details-title" data-project-id="${projectId}">${project.name} 상세</h2>
        <div id="assignee-progress"></div>
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
        <h3>우선 처리할 일</h3>
        <ul id="priority-todo-list"></ul>
        <h3>전체 할 일 목록</h3>
        <ul id="todo-list"></ul>
        <button onclick="showProjectList()">프로젝트 목록으로 돌아가기</button>
    `;

    updateAssigneeProgress(projectId);
    updateTodoList(projectId);
    updatePriorityTodoList(projectId);
}

function showProjectList() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div id="project-form">
            <input type="text" id="project-input" placeholder="새 프로젝트 이름">
            <button id="add-project-btn">프로젝트 추가</button>
        </div>
        <div id="project-list"></div>
    `;
    document.getElementById('add-project-btn').addEventListener('click', addProject);
    console.log('프로젝트 추가 버튼에 이벤트 리스너 추가됨');
    updateProjectList();
}

function updateProjectList() {
    const projectList = document.getElementById('project-list');
    projectList.innerHTML = '';
    projects.forEach(project => {
        addProjectToUI(project);
    });
}

function updateAssigneeProgress(projectId) {
    const assigneeProgressElement = document.getElementById('assignee-progress');
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

    // 프로젝트 전체 진행률 업데이트
    const totalTodos = projectTodos.length;
    const totalCompleted = projectTodos.filter(todo => todo.completed).length;
    const projectProgress = totalTodos > 0 ? Math.round((totalCompleted / totalTodos) * 100) : 0;
    
    const projectElement = document.getElementById(`project-${projectId}`);
    if (projectElement) {
        const progressCircle = projectElement.querySelector('.progress-circle');
        progressCircle.setAttribute('data-progress', projectProgress);
        progressCircle.querySelector('.progress-circle-value').textContent = `${projectProgress}%`;
        updateProgressCircle(progressCircle);
    }
}

function updateTodoList(projectId) {
    const todoListElement = document.getElementById('todo-list');
    todoListElement.innerHTML = `
        <table>
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
        </table>
    `;
    const tableBody = todoListElement.querySelector('tbody');

    const projectTodos = todos[projectId] || [];
    projectTodos.forEach(todo => {
        const todoRow = createTodoRow(todo, projectId);
        tableBody.appendChild(todoRow);
    });
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
        <td><button onclick="deleteTodo('${todo.id}')">삭제</button></td>
    `;
    return row;
}

function updatePriorityTodoList(projectId) {
    const priorityTodoListElement = document.getElementById('priority-todo-list');
    priorityTodoListElement.innerHTML = `
        <table>
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
        </table>
    `;
    const tableBody = priorityTodoListElement.querySelector('tbody');

    const projectTodos = todos[projectId] || [];
    const priorityTodos = getPriorityTodos(projectTodos);
    
    priorityTodos.forEach(todo => {
        const todoRow = createTodoRow(todo, projectId);
        tableBody.appendChild(todoRow);
    });
}

function getPriorityTodos(todos) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return todos.filter(todo => {
        if (todo.completed) return false;

        const dueDate = new Date(todo.dueDate);
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        return (todo.priority === 'high') ||
               (todo.priority === 'medium' && daysUntilDue <= 3) ||
               (daysUntilDue <= 1);
    }).sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);

        if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return dateA - dateB;
    });
}

function addTodo(projectId) {
    const todoText = document.getElementById('new-todo-text').value.trim();
    const assignee = document.getElementById('new-todo-assignee').value;
    const priority = document.getElementById('new-todo-priority').value;
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
        // 입력 필드 초기화
        document.getElementById('new-todo-text').value = '';
        document.getElementById('new-todo-assignee').value = '';
        document.getElementById('new-todo-priority').value = 'low';
        document.getElementById('new-todo-due-date').value = '';
    }
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
            <input type="text" id="new-assignee-name" placeholder="새 담당자 이름">
            <button onclick="addNewAssignee('${projectId}')">담당자 추가</button>
            <button onclick="closeModal()">닫기</button>
        </div>
    `;
    document.body.appendChild(modal);

    // 모달 외부 클릭 시 닫기
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
    
    updateTodo(projectId, { id: todoId, text: todoText, completed: completed, assignee: assignee, priority: priority, dueDate: dueDate });
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
        updateAssigneeList(projectId);
    }
}

function deleteAssignee(projectId, assigneeName) {
    if (confirm(`정말로 ${assigneeName}을(를) 삭제하시겠습니까?`)) {
        socket.send(JSON.stringify({
            type: 'DELETE_ASSIGNEE',
            projectId: projectId,
            assigneeName: assigneeName
        }));
        updateAssigneeList(projectId);
    }
}

function updateAssigneeList(projectId) {
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
    
    // 모든 할 일 항목의 담당자 선택 옵션 업데이트
    updateAllTodoAssigneeOptions(projectId);
}

function updateAllTodoAssigneeOptions(projectId) {
    const todoItems = document.querySelectorAll('.todo-item');
    todoItems.forEach(todoItem => {
        const assigneeSelect = todoItem.querySelector('.todo-assignee');
        const currentAssignee = assigneeSelect.value;
        assigneeSelect.innerHTML = getAssigneeOptions(projectId, currentAssignee);
    });
    
    // 새 할 일 추가 폼의 담당자 선택 옵션도 업데이트
    const newTodoAssigneeSelect = document.getElementById('new-todo-assignee');
    if (newTodoAssigneeSelect) {
        newTodoAssigneeSelect.innerHTML = getAssigneeOptions(projectId);
    }
}

window.addEventListener('load', () => {
    console.log('페이지 로드됨');
    initializeWebSocket();
});