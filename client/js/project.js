function addProject() {
    const projectInput = document.getElementById('project-input');
    const projectName = projectInput.value.trim();
    if (projectName) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ADD_PROJECT', name: projectName }));
            projectInput.value = '';
        } else {
            alert('서버와의 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
        }
    } else {
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
        updateProjectInUI(updatedProject);
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

    // 프로젝트 상세 페이지 업데이트
    const projectStatistics = document.getElementById('project-statistics');
    if (projectStatistics) {
        const progressBar = projectStatistics.querySelector('.project-progress-bar');
        const progressText = projectStatistics.querySelector('.project-progress-text');
        if (progressBar && progressText) {
            const progress = project.progress || 0;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
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
            if (getCurrentProjectId() === data.projectId) {
                showProjectList();
            }
            break;
    }
}

function showProjectDetails(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        console.error('프로젝트를 찾을 수 없습니다:', projectId);
        return;
    }

    currentProject = project;
    const mainContentElement = document.getElementById('main-content');
    if (!mainContentElement) {
        console.error('main-content 요소를 찾을 수 없습니다.');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div id="project-details-container">
            <div class="project-header">
                <h2 id="project-details-title" data-project-id="${project.id}">${project.name || '이름 없음'}</h2>
                <div class="project-actions">
                    <button onclick="showMemo('${project.id}')" class="button">메모장</button>
                    <button onclick="showManageAssigneesModal('${project.id}')" class="button">담당자 관리</button>
                    <button onclick="showProjectSettingsModal('${project.id}')" class="button">프로젝트 설정</button>
                </div>
            </div>
            <div class="project-stats">
                <div id="project-statistics"></div>
                <div id="assignee-progress"></div>
            </div>
            <div class="todo-section">
                <div class="todo-header">
                    <h3>할 일 목록</h3>
                    <div class="todo-filters">
                        <select id="filter-priority" onchange="filterAndSortTodos('${project.id}')">
                            <option value="all">모든 우선순위</option>
                            <option value="high">높음</option>
                            <option value="medium">중간</option>
                            <option value="low">낮음</option>
                        </select>
                        <select id="filter-assignee" onchange="filterAndSortTodos('${project.id}')">
                            <option value="all">모든 담당자</option>
                            ${getAssigneeOptions(project.id)}
                        </select>
                        <select id="sort-by" onchange="filterAndSortTodos('${project.id}')">
                            <option value="priority">우선순위순</option>
                            <option value="dueDate">마감일순</option>
                            <option value="assignee">담당자순</option>
                        </select>
                    </div>
                </div>
                <div id="todo-input">
                    <input type="text" id="new-todo-text" placeholder="새 할 일">
                    <select id="new-todo-assignee">
                        <option value="">담당자 없음</option>
                        ${getAssigneeOptions(project.id)}
                    </select>
                    <select id="new-todo-priority">
                        <option value="low">낮음</option>
                        <option value="medium">중간</option>
                        <option value="high">높음</option>
                    </select>
                    <input type="date" id="new-todo-due-date">
                    <button onclick="addTodo('${project.id}')" class="button">추가</button>
                </div>
                <input type="text" id="todo-search" placeholder="할 일 검색" onkeyup="searchTodos('${project.id}')">
                <h4>먼저 처리할 할 일 목록</h4>
                <div id="priority-todo-list"></div>
                <h4>전체 할 일 목록</h4>
                <div id="todo-list"></div>
            </div>
            <button id="back-to-dashboard" class="btn-back" onclick="showProjectList()">프로젝트 대시보드로 이동</button>
        </div>
    `;

    showProjectStatistics(project.id);
    updateAssigneeProgress(project.id);
    
    // 필터 및 정렬 옵션 초기화
    setTimeout(() => {
        updateFilterOptions(project.id);
        filterAndSortTodos(project.id);
        if (typeof window.initializeTodoListeners === 'function') {
            window.initializeTodoListeners();
        }
    }, 0);

    // 사이드바 닫기 및 콘텐츠 영역 조정
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    if (sidebar && content) {
        sidebar.classList.remove('open');
        content.classList.remove('sidebar-open');
        content.style.marginLeft = '0';
        content.style.width = '100%';
    }

    // main-content 요소의 스타일도 조정
    mainContentElement.style.marginLeft = '0';
    mainContentElement.style.width = '100%';

    // 프로젝트 상세 정보를 표시한 후
    const projectDetailsContainer = document.getElementById('project-details-container');
    if (projectDetailsContainer) {
        projectDetailsContainer.scrollTop = 0; // 스크롤을 맨 위로 이동
    }

    // 모바일에서 ���이드바가 열려있다면 닫기
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

function getCurrentProjectId() {
    const projectDetailsTitle = document.getElementById('project-details-title');
    return projectDetailsTitle ? projectDetailsTitle.dataset.projectId : null;
}

function getAssigneeOptions(projectId, currentAssignee = '') {
    const assignees = getAssignees(projectId);
    let options = '<option value="">담당자 없음</option>';
    assignees.forEach(assignee => {
        options += `<option value="${assignee}" ${assignee === currentAssignee ? 'selected' : ''}>${assignee}</option>`;
    });
    return options;
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
                <button onclick="deleteAssignee('${projectId}', '${assignee}')" class="delete-btn">삭제</button>
            </li>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content">
            <h3>담당자 관리</h3>
            <ul id="assignee-list">
                ${assigneeListHTML}
            </ul>
            <div class="add-assignee-form">
                <input type="text" id="new-assignee-name" placeholder="새 담당자 이름">
                <button onclick="addNewAssignee('${projectId}')" class="add-btn">추가</button>
            </div>
            <button onclick="closeModal()" class="close-btn">닫기</button>
        </div>
    `;
    document.body.appendChild(modal);

    // 모달 내부 클릭 시 이벤트 전파 중지
    modal.querySelector('.modal-content').addEventListener('click', (e) => {
        e.stopPropagation();
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
        
        // 담당자 추가 후 할 일 목록 업데이트
        setTimeout(() => {
            filterAndSortTodos(projectId);
        }, 100);
    }
}

function deleteAssignee(projectId, assigneeName) {
    if (confirm(`정말로 ${assigneeName}을(를) 삭제하시겠습니까? 이 담당자의 모든 할 일이 '담당자 없음'으로 변경됩니다.`)) {
        socket.send(JSON.stringify({
            type: 'DELETE_ASSIGNEE',
            projectId: projectId,
            assigneeName: assigneeName
        }));
        removeAssigneeFromTodos(projectId, assigneeName);
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
                <button onclick="deleteAssignee('${projectId}', '${assignee}')" class="delete-btn">삭제</button>
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
        select.innerHTML = newAssigneeOptions;
        select.value = currentValue;
    });

    // 새 할 일 입력 폼의 담당자 선택 옵션도 업데이트
    const newTodoAssigneeSelect = document.getElementById('new-todo-assignee');
    if (newTodoAssigneeSelect) {
        newTodoAssigneeSelect.innerHTML = newAssigneeOptions;
    }

    // 필터 옵션도 업데이트
    updateFilterOptions(projectId);
}

function filterAndSortTodos(projectId) {
    // 이 함수의 구현은 todo.js 파일에 있어야 합니다.
    // 여기서는 todo.js의 함수를 호출하는 형태로 구현합니다.
    if (typeof window.filterAndSortTodos === 'function') {
        window.filterAndSortTodos(projectId);
    } else {
        console.error('filterAndSortTodos 함수를 찾을 수 없습니다.');
    }
}

function showProjectSettingsModal(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>프로젝트 설정</h3>
            <div class="project-name-form">
                <input type="text" id="project-name" value="${project.name}" placeholder="프로젝트 이름">
                <button onclick="updateProjectName('${projectId}')" class="add-btn">변경</button>
            </div>
            <button onclick="deleteProjectConfirm('${projectId}')" class="delete-btn">프로젝트 삭제</button>
            <button onclick="closeModal()" class="close-btn">닫기</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateProjectName(projectId) {
    const newName = document.getElementById('project-name').value.trim();
    if (newName) {
        socket.send(JSON.stringify({
            type: 'UPDATE_PROJECT',
            project: { id: projectId, name: newName }
        }));
        closeModal();
        
        // 즉시 UI 업데이트
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.name = newName;
            updateProjectInUI(project);
            updateProjectList();
        }
    } else {
        alert('프로젝트 이름을 입력해주세요.');
    }
}

function deleteProjectConfirm(projectId) {
    if (confirm('정말로 이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        socket.send(JSON.stringify({
            type: 'DELETE_PROJECT',
            projectId: projectId
        }));
        closeModal();
        showProjectList(); // 프로젝트 목록 페이지로 이동
    }
}

// 새로운 함수: 필터 옵션 업데이트
function updateFilterOptions(projectId) {
    const filterAssignee = document.getElementById('filter-assignee');
    if (filterAssignee) {
        const assignees = getAssignees(projectId);
        let options = '<option value="all">모든 담당자</option>';
        assignees.forEach(assignee => {
            options += `<option value="${assignee}">${assignee}</option>`;
        });
        filterAssignee.innerHTML = options;
    }
}

function showProjectList() {
    const mainContentElement = document.getElementById('main-content');
    if (!mainContentElement) {
        console.error('main-content 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 프로젝트 목록 페이지 HTML 생성
    mainContentElement.innerHTML = `
        <div id="project-dashboard">
            <h2>프로젝트 목록</h2>
            <div id="project-list-container"></div>
        </div>
    `;
    
    // 프로젝트 목록 업데이트
    updateProjectList();
    
    // 사이드바 열기 및 콘텐츠 영역 조정
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    if (sidebar && content) {
        sidebar.classList.add('open');
        content.classList.add('sidebar-open');
        content.style.marginLeft = '250px';
        content.style.width = 'calc(100% - 250px)';
    }
}

// 전역 스코프에 함수 노출
window.showProjectDetails = showProjectDetails;
window.showProjectList = showProjectList;