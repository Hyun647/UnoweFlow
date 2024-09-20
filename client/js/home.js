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
    console.log('프로젝트 리스트 업데이트:', filteredProjects);
    const projectList = document.getElementById('project-list');
    if (!projectList) {
        console.error('project-list 요소를 찾을 수 없습니다.');
        return;
    }
    projectList.innerHTML = '';
    if (filteredProjects.length === 0) {
        projectList.innerHTML = '<p>프로젝트가 없습니다.</p>';
    } else {
        filteredProjects.forEach(project => {
            if (project && typeof project.name === 'string') {
                const projectElement = createProjectElement(project);
                projectList.appendChild(projectElement);
            }
        });
    }
    console.log('프로젝트 리스트 HTML:', projectList.innerHTML); // 디버깅용 로그 추가
}

function createProjectElement(project) {
    const projectElement = document.createElement('div');
    projectElement.id = `project-${project.id}`;
    projectElement.className = 'project';
    const progress = project.progress || 0;
    projectElement.innerHTML = `
        <h3 class="project-name">${project.name || '이름 없음'}</h3>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progress}%"></div>
            <span class="progress-text">${progress}%</span>
        </div>
        <div class="project-buttons">
            <button onclick="showProjectDetails('${project.id}')">보기</button>
            <button onclick="renameProject('${project.id}')">이름 변경</button>
            <button class="delete-btn" onclick="deleteProject('${project.id}')">삭제</button>
        </div>
    `;
    return projectElement;
}

function searchProjects() {
    const searchInput = document.getElementById('project-search');
    const searchTerm = searchInput.value.toLowerCase();
    const filteredProjects = projects.filter(project => {
        if (project && typeof project.name === 'string') {
            return project.name.toLowerCase().includes(searchTerm);
        }
        return false;
    });
    updateProjectList(filteredProjects);
}

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

// 페이지 로드 시 프로젝트 목록 표시
window.addEventListener('DOMContentLoaded', () => {
    showProjectList();
});