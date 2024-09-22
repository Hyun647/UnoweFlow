let authSocket;

function connectAuthWebSocket() {
    authSocket = new WebSocket('ws://110.15.29.199:6521');
    
    authSocket.onopen = () => {
        console.log('인증용 웹소켓 연결됨');
    };
    
    authSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_result') {
            if (data.success) {
                showMainContent();
            } else {
                alert('비밀번호가 틀렸습니다.');
                document.getElementById('password').value = ''; // 비밀번호 입력 필드 초기화
            }
        }
    };
}

function authenticate() {
    const password = document.getElementById('password').value;
    if (authSocket.readyState === WebSocket.OPEN) {
        authSocket.send(JSON.stringify({ type: 'auth', password }));
    } else {
        console.error('WebSocket is not open');
        alert('서버 연결에 문제가 있습니다. 페이지를 새로고침 해주세요.');
    }
}

function showMainContent() {
    document.getElementById('auth-container').style.display = 'none';
    document.querySelector('header').style.display = 'block';
    document.querySelector('main').style.display = 'flex';
    if (typeof window.initializeMainPage === 'function') {
        window.initializeMainPage(authSocket);
    } else {
        console.error('initializeMainPage 함수를 찾을 수 없습니다.');
    }
}

window.onload = () => {
    connectAuthWebSocket();
    document.querySelector('header').style.display = 'none';
    document.querySelector('main').style.display = 'none';
    
    // 비밀번호 입력 필드에 이벤트 리스너 추가
    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // 기본 제출 동작 방지
            authenticate();
        }
    });
};

// 전역 스코프에 함수 노출
window.authenticate = authenticate;