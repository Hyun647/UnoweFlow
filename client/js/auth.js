let socket;

function connectWebSocket() {
    socket = new WebSocket('ws://110.15.29.199:6521');
    
    socket.onopen = () => {
        console.log('웹소켓 연결됨');
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_result') {
            if (data.success) {
                showMainPage();
            } else {
                alert('비밀번호가 틀렸습니다.');
            }
        }
    };
}

function authenticate() {
    const password = document.getElementById('password').value;
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'auth', password }));
    } else {
        console.error('WebSocket is not open');
        alert('서버 연결에 문제가 있습니다. 페이지를 새로고침 해주세요.');
    }
}

function showMainPage() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-container').style.display = 'block';
}

window.onload = () => {
    connectWebSocket();
};