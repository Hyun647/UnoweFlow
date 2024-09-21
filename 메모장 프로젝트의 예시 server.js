const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// 메모 내용을 저장할 변수
let savedMemo = "";

// 데이터베이스 연결 풀 생성
const pool = mysql.createPool({
  host: '110.15.29.199',
  user: 'root',
  password: '1590',
  database: 'notepad_db',
  port: 9876,
  connectTimeout: 10000
});

// 서버 시작 시 데이터베이스 연결 테스트
function testDatabaseConnection() {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('데이터베이스 연결 오류:', err);
      console.error('오류 코드:', err.code);
      console.error('오류 메시지:', err.message);
      console.error('오류 스택:', err.stack);
    } else {
      console.log('데이터베이스 연결 성공');
      connection.release();
    }
  });
}

testDatabaseConnection();

// 서버 시작 시 가장 최근 메모 로드
pool.query('SELECT content FROM notes ORDER BY id DESC LIMIT 1', (error, results) => {
    if (error) {
        console.error('초기 메모 로드 중 오류:', error);
    } else if (results.length > 0) {
        savedMemo = results[0].content;
        console.log('초기 메모 로드 완료');
    }
});

// 정적 파일 제공 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    console.log('새 클라이언트가 연결되었습니다.');

    // 데이터베이스에서 가장 최근 메모를 가져와 클라이언트에게 전송
    pool.query('SELECT content FROM notes ORDER BY id DESC LIMIT 1', (error, results) => {
        if (error) {
            console.error('메모 로드 중 오류:', error);
        } else if (results.length > 0) {
            savedMemo = results[0].content;
            ws.send(savedMemo);
        }
    });

    // 클라이언트로부터 메시지를 받았을 때 처리
    ws.on('message', (message) => {
        const text = message.toString();

        // 저장된 메모를 업데이트
        savedMemo = text;

        // 데이터베이스에 메모 저장
        pool.query('INSERT INTO notes (content) VALUES (?)', [savedMemo], (error, results) => {
            if (error) {
                console.error('메모 저장 중 오류:', error);
            } else {
                console.log(`메모 저장 성공. ID: ${results.insertId}`);
            }
        });

        // 모든 클라이언트에게 메모 전송
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(savedMemo);
            }
        });
    });

    ws.on('close', () => {
        console.log('클라이언트 연결이 종료되었습니다.');
    });
});

// REST API 엔드포인트
app.post('/save', (req, res) => {
  console.log('메모 저장 요청 받음');
  const { content } = req.body;
  console.log('저장할 메모 내용:', content);
  pool.query('INSERT INTO notes (content) VALUES (?)', [content], (error, results) => {
    if (error) {
      console.error('메모 저장 중 오류:', error);
      res.status(500).json({ success: false, message: '메모 저장 중 오류가 발생했습니다.', error: error.message });
    } else {
      console.log('메모 저장 결과:', results);
      res.json({ success: true, id: results.insertId });
      console.log(`메모 저장 성공. ID: ${results.insertId}`);
    }
  });
});

app.get('/load/:id', (req, res) => {
  console.log('메모 로드 요청 받음');
  const { id } = req.params;
  console.log('로드할 메모 ID:', id);
  pool.query('SELECT content FROM notes WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('메모 로드 중 오류:', error);
      res.status(500).json({ success: false, message: '메모 로드 중 오류가 발생했습니다.' });
    } else if (results.length > 0) {
      res.json({ success: true, content: results[0].content });
      console.log('메모 로드 성공');
    } else {
      res.status(404).json({ success: false, message: '메모를 찾을 수 없습니다.' });
      console.log('메모를 찾을 수 없음');
    }
  });
});

// 서버 실행
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    testDatabaseConnection();
});

// 주기적으로 데이터베이스 연결 상태 확인
setInterval(() => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('데이터베이스 연결 상태 확인: 오류', err);
    } else {
      console.log('데이터베이스 연결 상태 확인: 연결됨');
      connection.release();
    }
  });
}, 60000); // 1분마다 확인