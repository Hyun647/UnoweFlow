function addProject() {
    const projectInput = document.getElementById('project-input');
    const projectName = projectInput.value.trim();
    if (projectName) {
        console.log('프로젝트 추가 요청:', projectName);
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ADD_PROJECT', name: projectName }));
            projectInput.value = '';
        } else {
            console.error('WebSocket 연결이 열려있지 않습니다.');
            alert('서버와의 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
        }
    } else {
        console.log('프로젝트 이름이 비어있습니다.');
        alert('프로젝트 이름을 입력해주세요.');
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
        const updatedProject = { id: projectId, name: newName.trim() };
        socket.send(JSON.stringify({
            type: 'UPDATE_PROJECT',
            project: updatedProject
        }));
    }
}

function updateProjectInUI(project) {
    console.log('프로젝트 UI 업데이트:', project);
    
    const projectIndex = projects.findIndex(p => p.id === project.id);
    if (projectIndex !== -1) {
        projects[projectIndex] = {...projects[projectIndex], ...project};
    } else {
        projects.push(project);
    }

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
    } else {
        updateProjectList();
    }

    const currentProjectId = getCurrentProjectId();
    if (currentProjectId === project.id) {
        updateProjectDetailsView(project);
    }

    const projectListElement = document.getElementById('project-list');
    if (projectListElement) {
        const existingProjectElement = projectListElement.querySelector(`#project-${project.id}`);
        if (existingProjectElement) {
            const updatedProjectElement = createProjectElement(project);
            existingProjectElement.replaceWith(updatedProjectElement);
        } else {
            const newProjectElement = createProjectElement(project);
            projectListElement.appendChild(newProjectElement);
        }
    }
}

function updateProjectDetailsView(project) {
    const projectDetailsTitle = document.getElementById('project-details-title');
    if (projectDetailsTitle) {
        projectDetailsTitle.textContent = `${project.name || '이름 없음'} 상세`;
    }
}

function removeProjectFromUI(projectId) {
    const projectElement = document.getElementById(`project-${projectId}`);
    if (projectElement) {
        projectElement.remove();
    }
}

function handleProjectChange(data) {
    switch (data.type) {
        case 'PROJECT_ADDED':
            if (data.project && data.project.name) {
                projects.push(data.project);
                updateProjectList();
                console.log('프로젝트 추가됨:', data.project);
            } else {
                console.error('Invalid project data received:', data);
            }
            break;
        case 'PROJECT_UPDATED':
            updateProjectInUI(data.project);
            console.log('프로젝트 업데이트됨:', data.project);
            break;
        case 'PROJECT_DELETED':
            projects = projects.filter(p => p.id !== data.projectId);
            removeProjectFromUI(data.projectId);
            console.log('프로젝트 삭제됨:', data.projectId);
            break;
    }
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
        <input type="text" id="todo-search" placeholder="할 일 검색">
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

    document.getElementById('todo-search').addEventListener('input', () => searchTodos(projectId));
}

function getCurrentProjectId() {
    const projectDetailsTitle = document.getElementById('project-details-title');
    return projectDetailsTitle ? projectDetailsTitle.dataset.projectId : null;
}

function getAssigneeOptions(projectId, currentAssignee = '') {
    const assignees = getAssignees(projectId);
    return assignees.map(assignee => 
        `<option value="${assignee}" ${assignee === currentAssignee ? 'selected' : ''}>${assignee}</option>`
    ).join('');
}

function getAssignees(projectId) {
    return projectAssignees[projectId] || [];
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

function addNewAssignee(projectId) {
    const newAssigneeName = document.getElementById('new-assignee-name').value.trim();
    if (newAssigneeName) {
        socket.send(JSON.stringify({
            type: 'ADD_ASSIGNEE',
            projectId: projectId,
            assigneeName: newAssigneeName
        }));
        document.getElementById('new-assignee-name').value = '';
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
    
    if (assigneeList) {
        assigneeList.innerHTML = assigneeListHTML;
    }

    // 할 일 목록의 담당자 선택 옵션도 업데이트
    updateTodoAssigneeOptions(projectId);
    
    // 작업률 창 업데이트
    updateAssigneeProgress(projectId);
}

function updateTodoAssigneeOptions(projectId) {
    const assigneeSelects = document.querySelectorAll('.todo-assignee');
    const newAssigneeOptions = getAssigneeOptions(projectId);
    assigneeSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = `<option value="">담당자 없음</option>${newAssigneeOptions}`;
        select.value = currentValue;
    });

    // 새 할 일 입력 폼의 담당자 선택 옵션도 업데이트
    const newTodoAssigneeSelect = document.getElementById('new-todo-assignee');
    if (newTodoAssigneeSelect) {
        newTodoAssigneeSelect.innerHTML = `<option value="">담당자 없음</option>${newAssigneeOptions}`;
    }
}

// 기존 코드 유지...