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
            dueDate: dueDate ? new Date(dueDate).toISOString() : null
        }));
        document.getElementById('new-todo-text').value = '';
        document.getElementById('new-todo-assignee').value = '';
        document.getElementById('new-todo-priority').value = 'low';
        document.getElementById('new-todo-due-date').value = '';
    }
}

function updateTodoAssignee(todoId, newAssignee) {
    const projectId = getCurrentProjectId();
    if (!projectId) {
        console.error('현재 프로젝트 ID를 찾을 수 없습니다.');
        return;
    }

    const projectTodos = todos[projectId] || [];
    const todo = projectTodos.find(t => t.id.toString() === todoId);
    if (!todo) {
        console.error(`ID가 ${todoId}인 할 일을 찾을 수 없습니다.`);
        return;
    }

    todo.assignee = newAssignee;
    updateTodo(projectId, todo);
    
    // UI 업데이트
    const todoElement = document.getElementById(`todo-${todoId}`);
    if (todoElement) {
        const assigneeSelect = todoElement.querySelector('.todo-assignee');
        if (assigneeSelect) {
            assigneeSelect.value = newAssignee;
        }
    }
}

function updateTodo(projectId, updatedTodo) {
    console.log('updateTodo 호출됨:', updatedTodo);
    const todoToUpdate = {
        id: updatedTodo.id,
        text: updatedTodo.text,
        completed: updatedTodo.completed,
        assignee: updatedTodo.assignee,
        priority: updatedTodo.priority,
        dueDate: updatedTodo.dueDate ? new Date(updatedTodo.dueDate).toISOString() : null
    };
    socket.send(JSON.stringify({
        type: 'UPDATE_TODO',
        projectId: projectId,
        todo: todoToUpdate
    }));
}

function searchTodos(projectId) {
    const searchTerm = document.getElementById('todo-search').value.toLowerCase();
    filterAndSortTodos(projectId, searchTerm);
}

function filterAndSortTodos(projectId, searchTerm = '') {
    const priorityFilter = document.getElementById('filter-priority');
    const assigneeFilter = document.getElementById('filter-assignee');
    const sortOrder = document.getElementById('sort-by');

    let filteredTodos = todos[projectId] || [];

    // 검색어 필터링
    if (searchTerm) {
        filteredTodos = filteredTodos.filter(todo => 
            todo.text.toLowerCase().includes(searchTerm) ||
            (todo.assignee && todo.assignee.toLowerCase().includes(searchTerm))
        );
    }

    // 우선순위 필터링
    if (priorityFilter && priorityFilter.value !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.priority === priorityFilter.value);
    }

    // 담당자 필터링
    if (assigneeFilter && assigneeFilter.value !== 'all') {
        filteredTodos = filteredTodos.filter(todo => todo.assignee === assigneeFilter.value);
    }

    // 정렬
    if (sortOrder) {
        filteredTodos.sort((a, b) => {
            if (sortOrder.value === 'priority') {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            } else if (sortOrder.value === 'dueDate') {
                return new Date(a.dueDate) - new Date(b.dueDate);
            } else if (sortOrder.value === 'assignee') {
                return (a.assignee || '').localeCompare(b.assignee || '');
            }
            return 0;
        });
    }

    updateTodoList(filteredTodos);
}

function updateAssigneeProgress(projectId) {
    const assigneeProgressElement = document.getElementById('assignee-progress');
    if (!assigneeProgressElement) return;

    const projectTodos = todos[projectId] || [];
    const assignees = getAssignees(projectId);

    let progressHTML = '<h3>담당자별 작업률</h3>';
    assignees.forEach(assignee => {
        const assigneeTodos = projectTodos.filter(todo => todo.assignee === assignee);
        const totalTodos = assigneeTodos.length;
        const completedTodos = assigneeTodos.filter(todo => todo.completed).length;
        const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

        progressHTML += `
            <div class="assignee-progress">
                <span>${assignee}: ${progress}% (${completedTodos}/${totalTodos})</span>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
            </div>
        `;
    });

    assigneeProgressElement.innerHTML = progressHTML;
}

function showProjectStatistics(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        console.error('프로젝트를 찾을 수 없습니다:', projectId);
        return;
    }

    const projectTodos = todos[projectId] || [];
    const totalTodos = projectTodos.length;
    const completedTodos = projectTodos.filter(todo => todo.completed).length;
    const completionRate = totalTodos > 0 ? (completedTodos / totalTodos * 100).toFixed(2) : 0;

    const statistics = `
        <h3>프로젝트 통계</h3>
        <div class="project-progress-bar-container">
            <div class="project-progress-bar" style="width: ${completionRate}%"></div>
            <span class="project-progress-text">${completionRate}%</span>
        </div>
        <p>전체 할 일: ${totalTodos}</p>
        <p>완료된 할 일: ${completedTodos}</p>
        <p>완료율: ${completionRate}%</p>
    `;

    const statisticsElement = document.getElementById('project-statistics');
    if (statisticsElement) {
        statisticsElement.innerHTML = statistics;
    }

    // 프로젝트 진행률 업데이트
    const updatedProgress = Math.round(parseFloat(completionRate));
    socket.send(JSON.stringify({
        type: 'UPDATE_PROJECT',
        project: { 
            id: projectId, 
            name: project.name, // 프로젝트 이름 포함
            progress: updatedProgress 
        }
    }));

    // 담당자별 작업률 업데이트
    updateAssigneeProgress(projectId);
}

function updateTodoList(filteredTodos) {
    const todoListElement = document.getElementById('todo-list');
    const priorityTodoListElement = document.getElementById('priority-todo-list');
    const projectId = getCurrentProjectId();
    
    if (!todoListElement || !priorityTodoListElement) {
        console.error('Todo list elements not found');
        return;
    }

    todoListElement.innerHTML = '';
    priorityTodoListElement.innerHTML = '';

    const priorityTodos = getPriorityTodos(filteredTodos);
    
    if (priorityTodos.length > 0) {
        const priorityTable = createTodoTable(priorityTodos, projectId);
        priorityTodoListElement.appendChild(priorityTable);
    } else {
        priorityTodoListElement.innerHTML = '<p>우선 처리할 일이 없습니다.</p>';
    }

    if (filteredTodos.length > 0) {
        const table = createTodoTable(filteredTodos, projectId);
        todoListElement.appendChild(table);
    } else {
        todoListElement.innerHTML = '<p>할 일이 없습니다.</p>';
    }

    console.log('Todo list updated:', filteredTodos.length, 'items');
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
    row.setAttribute('data-priority', todo.priority);
    
    let dueDateValue = todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '';
    console.log(`createTodoRow - 할 일 ID: ${todo.id}, 마감일: ${dueDateValue}`);
    
    row.innerHTML = `
        <td data-label="완료">
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} onchange="updateTodoStatus('${todo.id}', this.checked)">
        </td>
        <td data-label="내용">
            <span class="todo-text">${todo.text}</span>
        </td>
        <td data-label="담당자">
            <select class="todo-assignee" onchange="updateTodoAssignee('${todo.id}', this.value)">
                <option value="">미지정</option>
                ${getAssigneeOptions(projectId, todo.assignee)}
            </select>
        </td>
        <td data-label="우선순위">
            <select class="todo-priority" onchange="updateTodoPriority('${todo.id}', this.value)">
                <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>낮음</option>
                <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>중간</option>
                <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>높음</option>
            </select>
        </td>
        <td data-label="마감일">
            <input type="date" class="todo-due-date" value="${dueDateValue}" onchange="updateTodoDueDate('${todo.id}', this.value)">
        </td>
        <td class="todo-actions">
            <button onclick="editTodo('${todo.id}')" class="button">수정</button>
            <button onclick="deleteTodo('${todo.id}')" class="button delete-btn">삭제</button>
        </td>
    `;
    return row;
}

function getAssigneeOptions(projectId, currentAssignee = '') {
    const assignees = getAssignees(projectId);
    return assignees.map(assignee => 
        `<option value="${assignee}" ${assignee === currentAssignee ? 'selected' : ''}>${assignee}</option>`
    ).join('');
}

function getAssignees(projectId) {
    // Set을 사용하여 중복 제거
    return [...new Set(projectAssignees[projectId] || [])];
}

function getPriorityTodos(todos) {
    return todos.filter(todo => {
        return !todo.completed && todo.priority === 'high';
    });
}

function updateTodoStatus(todoId, completed) {
    const projectId = getCurrentProjectId();
    todoId = todoId.toString();
    const todo = todos[projectId].find(t => t.id.toString() === todoId);
    if (todo) {
        todo.completed = completed;
        updateTodo(projectId, todo);
    }
}

function updateTodoPriority(todoId, priority) {
    const projectId = getCurrentProjectId();
    todoId = todoId.toString();
    const todo = todos[projectId].find(t => t.id.toString() === todoId);
    if (todo) {
        todo.priority = priority;
        updateTodo(projectId, todo);
        filterAndSortTodos(projectId); // 우선순위 변경 후 목록 다시 필터링 및 정렬
    }
}

function updateTodoDueDate(todoId, newDate) {
    const projectId = getCurrentProjectId();
    if (!projectId) {
        console.error('현재 프로젝트 ID를 찾을 수 없습니다.');
        return;
    }

    // todoId를 문자열로 변환
    todoId = todoId.toString();
    
    const projectTodos = todos[projectId] || [];
    const todo = projectTodos.find(t => t.id.toString() === todoId);
    if (todo) {
        // 날짜 형식을 ISO 문자열로 변환
        todo.dueDate = newDate ? new Date(newDate).toISOString() : null;
        console.log('마감일 업데이트:', todo);
        updateTodo(projectId, todo);
    } else {
        console.error(`ID가 ${todoId}인 할 일을 찾을 수 없습니다.`);
    }
}

function editTodo(todoId) {
    const projectId = getCurrentProjectId();
    todoId = todoId.toString();
    const todo = todos[projectId].find(t => t.id.toString() === todoId);
    if (todo) {
        const newText = prompt('할 일 수정:', todo.text);
        if (newText !== null && newText.trim() !== '') {
            todo.text = newText.trim();
            updateTodo(projectId, todo);
        }
    }
}

function deleteTodo(todoId) {
    const projectId = getCurrentProjectId();
    todoId = todoId.toString();
    if (confirm('정말로 이 할 일을 삭제하시겠습니까?')) {
        socket.send(JSON.stringify({
            type: 'DELETE_TODO',
            projectId: projectId,
            todoId: todoId
        }));
    }
}

function handleTodoChange(data) {
    console.log('handleTodoChange 함수 호출됨 (todo.js):', data);
    if (!todos[data.projectId]) {
        todos[data.projectId] = [];
    }
    switch (data.type) {
        case 'TODO_ADDED':
        case 'TODO_UPDATED':
            const updatedTodo = {
                ...data.todo,
                dueDate: data.todo.dueDate ? new Date(data.todo.dueDate).toISOString() : null
            };
            
            const todoIndex = todos[data.projectId].findIndex(t => t.id.toString() === updatedTodo.id.toString());
            if (todoIndex !== -1) {
                todos[data.projectId][todoIndex] = updatedTodo;
            } else {
                todos[data.projectId].push(updatedTodo);
            }
            console.log('업데이트된 할 일:', updatedTodo);
            break;
        case 'TODO_DELETED':
            todos[data.projectId] = todos[data.projectId].filter(t => t.id.toString() !== data.todoId.toString());
            break;
    }
    const currentProjectId = getCurrentProjectId();
    if (currentProjectId === data.projectId) {
        filterAndSortTodos(data.projectId);
        updateAssigneeProgress(data.projectId);
        showProjectStatistics(data.projectId);
    }
    updateProjectInUI(projects.find(p => p.id === data.projectId));
}

function getCurrentProjectId() {
    const projectDetailsTitle = document.getElementById('project-details-title');
    return projectDetailsTitle ? projectDetailsTitle.dataset.projectId : null;
}

function initializeTodoListeners() {
    const priorityFilter = document.getElementById('filter-priority');
    const assigneeFilter = document.getElementById('filter-assignee');
    const sortOrder = document.getElementById('sort-by');

    if (priorityFilter) {
        priorityFilter.addEventListener('change', () => filterAndSortTodos(getCurrentProjectId()));
    }
    if (assigneeFilter) {
        assigneeFilter.addEventListener('change', () => filterAndSortTodos(getCurrentProjectId()));
    }
    if (sortOrder) {
        sortOrder.addEventListener('change', () => filterAndSortTodos(getCurrentProjectId()));
    }
}

// 이 함수를 전역 스코프에 노출시킵니다.
window.initializeTodoListeners = initializeTodoListeners;