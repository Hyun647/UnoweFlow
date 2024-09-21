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

    // 새로운 스타일 적용
    applyMemoStyles();
}

function applyMemoStyles() {
    const mainContent = document.getElementById('main-content');
    const memoContainer = document.getElementById('memo-container');
    const memoHeader = document.getElementById('memo-header');
    const memoContent = document.getElementById('memo-content');
    const memoEditor = document.getElementById('memo-editor');
    const contentContainer = document.getElementById('content-container');
    const memoTextarea = document.getElementById('memo');

    // 메인 컨텐츠 영역 전체 너비 사용
    mainContent.style.width = '100%';
    mainContent.style.maxWidth = '100%';
    mainContent.style.padding = '0';

    memoContainer.style.display = 'flex';
    memoContainer.style.flexDirection = 'column';
    memoContainer.style.height = 'calc(100vh - 60px)';
    memoContainer.style.padding = '20px';
    memoContainer.style.boxSizing = 'border-box';
    memoContainer.style.width = '100%';

    memoHeader.style.marginBottom = '20px';

    memoContent.style.display = 'flex';
    memoContent.style.flexGrow = '1';
    memoContent.style.gap = '20px';

    memoEditor.style.flex = '1';
    memoEditor.style.display = 'flex';
    memoEditor.style.flexDirection = 'column';

    memoTextarea.style.flexGrow = '1';
    memoTextarea.style.resize = 'none';
    memoTextarea.style.padding = '10px';
    memoTextarea.style.fontSize = '16px';
    memoTextarea.style.lineHeight = '1.5';
    memoTextarea.style.width = '100%';

    contentContainer.style.flex = '1';
    contentContainer.style.overflow = 'auto';
    contentContainer.style.padding = '10px';
    contentContainer.style.border = '1px solid var(--border-color)';
    contentContainer.style.borderRadius = '4px';
    contentContainer.style.width = '100%';
}

function toggleEditor() {
    const memoEditor = document.getElementById('memo-editor');
    const contentContainer = document.getElementById('content-container');
    const toggleButton = document.getElementById('toggle-editor');

    isEditorVisible = !isEditorVisible;
    
    if (isEditorVisible) {
        memoEditor.style.display = 'flex';
        memoEditor.style.flex = '1';
        contentContainer.style.flex = '1';
        toggleButton.textContent = '에디터 숨기기';
    } else {
        memoEditor.style.display = 'none';
        contentContainer.style.flex = '2';
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

function showMemoModal(memoContent) {
    const modalContent = `
        <h3>메모 내용</h3>
        <p>${memoContent}</p>
        <button onclick="closeModal()" class="button close-btn">닫기</button>
    `;
    createModal(modalContent);
}