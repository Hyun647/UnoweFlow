let currentProjectId = null;
let isEditorVisible = true;

function showMemo(projectId) {
    currentProjectId = projectId;
    const project = projects.find(p => p.id === projectId);
    const projectName = project ? project.name : '알 수 없는 프로젝트';
    
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div id="memo-container">
            <div id="memo-header">
                <h2>${projectName} 메모장</h2>
                <div>
                    <button id="toggle-editor" onclick="toggleEditor()">에디터 토글</button>
                    <button onclick="showProjectDetails('${projectId}')">일정으로 돌아가기</button>
                </div>
            </div>
            <div id="memo-content">
                <div id="memo-editor">
                    <textarea id="memo"></textarea>
                </div>
                <div id="content-container"></div>
            </div>
        </div>
    `;
    loadMemo(projectId);

    // 사이드바 닫기
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    sidebar.classList.remove('open');
    content.classList.remove('sidebar-open');
}

function toggleEditor() {
    const memoEditor = document.getElementById('memo-editor');
    const contentContainer = document.getElementById('content-container');
    const toggleButton = document.getElementById('toggle-editor');

    isEditorVisible = !isEditorVisible;
    
    if (isEditorVisible) {
        memoEditor.style.display = 'block';
        memoEditor.style.flex = '1';
        contentContainer.style.flex = '1';
        toggleButton.textContent = '에디터 숨기기';
    } else {
        memoEditor.style.display = 'none';
        contentContainer.style.flex = '1';
        toggleButton.textContent = '에디터 보이기';
    }
}

function loadMemo(projectId) {
    socket.send(JSON.stringify({
        type: 'GET_MEMO',
        projectId: projectId
    }));
}

function updateMemo(content) {
    const memoTextarea = document.getElementById('memo');
    const contentContainer = document.getElementById('content-container');
    if (memoTextarea && contentContainer) {
        memoTextarea.value = content;
        renderContent(content);
    }
}

function saveMemo() {
    const memoTextarea = document.getElementById('memo');
    const content = memoTextarea.value;
    if (currentProjectId) {
        socket.send(JSON.stringify({
            type: 'UPDATE_MEMO',
            projectId: currentProjectId,
            content: content
        }));
    }
}

function renderContent(content) {
    const contentContainer = document.getElementById('content-container');
    const html = marked.parse(content);
    contentContainer.innerHTML = html;
}

// 메모 입력 이벤트 처리
document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'memo') {
        clearTimeout(e.target.timeout);
        e.target.timeout = setTimeout(() => {
            saveMemo();
            renderContent(e.target.value);
        }, 300); // 타이핑 후 300ms 후에 저장 및 렌더링
    }
});

// 서버로부터 메모 업데이트 처리
function handleMemoUpdate(data) {
    if (data.projectId === currentProjectId) {
        updateMemo(data.content);
    }
}

// 전역 스코프에 노출
window.showMemo = showMemo;
window.handleMemoUpdate = handleMemoUpdate;
window.toggleEditor = toggleEditor;