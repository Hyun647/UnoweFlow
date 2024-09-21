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
            <div id="dashboard">
                <h2>프로젝트 대시보드</h2>
                <div id="project-summary">
                    <div class="summary-card">
                        <h3>전체 프로젝트</h3>
                        <p id="total-projects">0</p>
                    </div>
                    <div class="summary-card">
                        <h3>진행 중인 프로젝트</h3>
                        <p id="ongoing-projects">0</p>
                    </div>
                    <div class="summary-card">
                        <h3>완료된 프로젝트</h3>
                        <p id="completed-projects">0</p>
                    </div>
                </div>
                <div id="recent-activities">
                    <h3>공지사항</h3>
                    <ul id="activity-list">
                        <!-- 공지사항 목록이 여기에 동적으로 추가됩니다 -->
                    </ul>
                </div>
            </div>
        </div>
    `;
    updateProjectList();
    updateDashboard();
}

function updateDashboard() {
    const totalProjects = projects.length;
    const ongoingProjects = projects.filter(p => p.progress < 100).length;
    const completedProjects = projects.filter(p => p.progress === 100).length;

    document.getElementById('total-projects').textContent = totalProjects;
    document.getElementById('ongoing-projects').textContent = ongoingProjects;
    document.getElementById('completed-projects').textContent = completedProjects;

    // 최근 활동 업데이트 (예시)
    const activityList = document.getElementById('activity-list');
    activityList.innerHTML = `
        <li>UnoweFlow로 프로젝트 관리의 효율성을 높이세요!</li>
        <li>직관적인 UI로 팀 협업이 더욱 쉬워집니다.</li>
        <li>지금 바로 UnoweFlow를 시작해보세요!</li>
    `;
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
    updateDashboard(); // 프로젝트 리스트가 업데이트될 때마다 대시보드도 업데이트
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