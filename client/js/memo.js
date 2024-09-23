let currentProjectId = null;
let isEditorVisible = false; // 기본값을 false로 유지
let isTyping = false;
let typingTimer;
const TYPING_INTERVAL = 2000; // 2초

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
                    <button id="toggle-editor" onclick="toggleEditor()">에디터 보이기</button>
                    <button onclick="showProjectDetails('${projectId}')">일정으로 돌아가기</button>
                </div>
            </div>
            <div id="memo-content">
                <div id="memo-editor" style="display: none;">
                    <textarea id="memo"></textarea>
                </div>
                <div id="content-container"></div>
            </div>
        </div>
    `;
    loadMemo(projectId);

    closeSidebar();
    applyMemoStyles();
    
    // 에디터를 숨기고 컨텐츠 컨테이너를 전체 너비로 설정
    const contentContainer = document.getElementById('content-container');
    contentContainer.style.flex = '1';
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
    memoContent.style.height = 'calc(100% - 60px)'; // 헤더 높이를 뺀 나머지 높이

    memoEditor.style.flex = '1';
    memoEditor.style.display = 'none'; // 기본적으로 숨김 상태로 설정
    memoEditor.style.height = '100%'; // 전체 높이 사용

    memoTextarea.style.width = '100%';
    memoTextarea.style.height = '100%';
    memoTextarea.style.resize = 'none';
    memoTextarea.style.padding = '10px';
    memoTextarea.style.fontSize = '16px';
    memoTextarea.style.lineHeight = '1.5';

    contentContainer.style.flex = '1';
    contentContainer.style.overflow = 'auto';
    contentContainer.style.padding = '10px';
    contentContainer.style.border = '1px solid var(--border-color)';
    contentContainer.style.borderRadius = '4px';
    contentContainer.style.width = '100%';
    contentContainer.style.height = '100%'; // 전체 높이 사용
}

function toggleEditor() {
    const memoEditor = document.getElementById('memo-editor');
    const contentContainer = document.getElementById('content-container');
    const toggleButton = document.getElementById('toggle-editor');

    isEditorVisible = !isEditorVisible;
    
    if (isEditorVisible) {
        memoEditor.style.display = 'block';
        memoEditor.style.width = '50%';
        contentContainer.style.width = '50%';
        toggleButton.textContent = '에디터 숨기기';
    } else {
        memoEditor.style.display = 'none';
        contentContainer.style.width = '100%';
        toggleButton.textContent = '에디터 보이기';
    }
}

function loadMemo(projectId) {
    console.log('메모 로드 요청:', projectId);
    socket.send(JSON.stringify({
        type: 'GET_MEMO',
        projectId: projectId
    }));
}

function updateMemo(content) {
    console.log('메모 업데이트:', content);
    const memoTextarea = document.getElementById('memo');
    const contentContainer = document.getElementById('content-container');
    if (memoTextarea && contentContainer) {
        if (!isTyping) {
            memoTextarea.value = content;
            renderContent(content);
        } else {
            console.log('사용자가 입력 중이어서 메모 업데이트를 건너뜁니다.');
        }
    } else {
        console.error('메모 텍스트 영역 또는 컨텐츠 컨테이너를 찾을 수 없습니다.');
    }
}

function saveMemo() {
    const memoTextarea = document.getElementById('memo');
    const content = memoTextarea.value;
    console.log('메모 저장 시도:', content);
    if (currentProjectId) {
        socket.send(JSON.stringify({
            type: 'UPDATE_MEMO',
            projectId: currentProjectId,
            content: content
        }));
    } else {
        console.error('현재 프로젝트 ID가 없습니다.');
    }
}

function renderContent(content) {
    console.log('메모 렌더링:', content);
    const contentContainer = document.getElementById('content-container');
    const html = marked.parse(content);
    contentContainer.innerHTML = html;
}

// 메모 입력 이벤트 처리
document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'memo') {
        isTyping = true;
        clearTimeout(typingTimer);
        clearTimeout(e.target.timeout);
        
        e.target.timeout = setTimeout(() => {
            saveMemo();
        }, 300); // 타이핑 후 300ms 후에 저장

        typingTimer = setTimeout(() => {
            isTyping = false;
        }, TYPING_INTERVAL);
    }
});

// 서버로부터 메모 업데이트 처리
function handleMemoUpdate(data) {
    console.log('서버로부터 메모 업데이트 수신:', data);
    if (data.projectId === currentProjectId) {
        if (!isTyping) {
            updateMemo(data.content);
        } else {
            console.log('사용자가 입력 중이어서 서버 업데이트를 연기합니다.');
            setTimeout(() => {
                if (!isTyping) {
                    updateMemo(data.content);
                }
            }, TYPING_INTERVAL);
        }
    } else {
        console.log('현재 프로젝트와 일치하지 않는 메모 업데이트:', data);
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