function showProjectList() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        return;
    }
    mainContent.innerHTML = `
        <div class="content">
            <div id="project-management">
                <div id="project-input-container">
                    <input type="text" id="project-input" placeholder="새 프로젝트 이름">
                    <button onclick="addProject()" class="button">프로젝트 추가</button>
                </div>
            </div>
            <div id="main-content-placeholder">
                <h2>프로젝트를 선택하거나 새 프로젝트를 만드세요.</h2>
            </div>
        </div>
    `;
    updateProjectList();
}

function updateProjectList() {
    const sidebarProjectList = document.getElementById('project-list');
    
    if (sidebarProjectList) {
        sidebarProjectList.innerHTML = '';
        projects.forEach(project => {
            const li = document.createElement('li');
            li.className = 'project-item';
            li.id = `project-${project.id}`;
            li.innerHTML = `
                <div class="project-header">
                    <span class="project-name">${project.name}</span>
                </div>
                <div class="project-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${project.progress || 0}%"></div>
                    </div>
                    <span class="progress-text">${project.progress || 0}%</span>
                </div>
            `;
            li.addEventListener('click', () => {
                if (typeof window.showProjectDetails === 'function') {
                    window.showProjectDetails(project.id);
                } else {
                    console.error('showProjectDetails 함수를 찾을 수 없습니다.');
                }
            });
            sidebarProjectList.appendChild(li);
        });
    }
}

function searchProjects() {
    const searchTerm = document.getElementById('project-search').value.toLowerCase();
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        const projectName = item.querySelector('.project-name').textContent.toLowerCase();
        if (projectName.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

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

// 전역 스코프에 함수 노출
window.showProjectList = showProjectList;
window.addProject = addProject;
window.searchProjects = searchProjects;
window.updateProjectList = updateProjectList;