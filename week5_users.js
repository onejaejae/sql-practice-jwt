/*
Step 5 과제 2: 사용자 관리 API (SQLite 버전)

테스트 방법:
1. npm install express sqlite3 실행
2. node week5_users.js 실행
3. 브라우저에서 http://localhost:3001/users 접속하여 테스트
4. Postman이나 curl로 API 테스트:
   - GET /users: 모든 사용자 조회
   - GET /users/1: 특정 사용자 조회
   - POST /users: {"name": "홍길동", "email": "hong@test.com", "age": 25} 형태로 데이터 전송
   - PATCH /users/1: {"name": "새이름", "age": 30} 형태로 사용자 정보 수정
   - DELETE /users/1: 특정 사용자 삭제

필수 조건:
- 동일한 이메일 중복 불가 (UNIQUE 제약조건 활용)
- name, email은 필수값
- 이메일에 @ 포함 검증
- 에러 처리 철저히
*/

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json());

// 데이터베이스 연결
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
    } else {
        console.log('users.db 데이터베이스 연결 성공!');
    }
});

// 테이블 생성
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        age INTEGER
    )
`, (err) => {
    if (err) {
        console.error('테이블 생성 실패:', err.message);
    } else {
        console.log('users 테이블 준비 완료!');
    }
});

// 이메일 유효성 검사 함수
function isValidEmail(email) {
    return email && email.includes('@') && email.includes('.');
}

// API 엔드포인트

// GET /users: 모든 사용자 조회
app.get('/users', (req, res) => {
    db.all('SELECT * FROM users ORDER BY id', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GET /users/:id: 특정 사용자 조회
app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
        }
        res.json(row);
    });
});

// POST /users: 새 사용자 추가
app.post('/users', (req, res) => {
    const { name, email, age } = req.body;
    
    // 필수 값 검증
    if (!name || !email) {
        return res.status(400).json({ message: "이름과 이메일은 필수입니다" });
    }
    
    // 이메일 유효성 검증
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: "올바른 이메일 형식이 아닙니다 (@가 포함되어야 함)" });
    }
    
    // age가 제공된 경우 숫자인지 확인
    if (age !== undefined && (isNaN(age) || age < 0)) {
        return res.status(400).json({ message: "나이는 0 이상의 숫자여야 합니다" });
    }
    
    db.run(
        'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
        [name, email, age || null],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: "이미 존재하는 이메일입니다" });
                }
                return res.status(500).json({ error: err.message });
            }
            
            res.status(201).json({
                id: this.lastID,
                name,
                email,
                age: age || null
            });
        }
    );
});

// PATCH /users/:id: 사용자 정보 수정
app.patch('/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, age } = req.body;
    
    // 수정할 필드만 동적으로 쿼리 생성
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
        if (!name.trim()) {
            return res.status(400).json({ message: "이름은 빈 값일 수 없습니다" });
        }
        updates.push('name = ?');
        values.push(name);
    }
    
    if (email !== undefined) {
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: "올바른 이메일 형식이 아닙니다 (@가 포함되어야 함)" });
        }
        updates.push('email = ?');
        values.push(email);
    }
    
    if (age !== undefined) {
        if (age !== null && (isNaN(age) || age < 0)) {
            return res.status(400).json({ message: "나이는 0 이상의 숫자여야 합니다" });
        }
        updates.push('age = ?');
        values.push(age);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ message: "수정할 내용이 없습니다" });
    }
    
    values.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(sql, values, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: "이미 존재하는 이메일입니다" });
            }
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
        }
        
        // 수정된 데이터 조회 후 반환
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(row);
        });
    });
});

// DELETE /users/:id: 사용자 삭제
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
        }
        
        res.json({ message: "사용자가 삭제되었습니다" });
    });
});

// GET /users/search: 이메일로 사용자 검색 (추가 기능)
app.get('/users/search/:email', (req, res) => {
    const { email } = req.params;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: "해당 이메일의 사용자를 찾을 수 없습니다" });
        }
        res.json(row);
    });
});

// GET /users/stats: 사용자 통계 (추가 기능)
app.get('/users/stats', (req, res) => {
    db.get(`
        SELECT
            COUNT(*) as total_users,
            AVG(age) as average_age,
            MIN(age) as youngest,
            MAX(age) as oldest,
            COUNT(age) as users_with_age
        FROM users
        WHERE age IS NOT NULL
    `, [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row);
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`사용자 관리 API 서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});

// 프로세스 종료 시 데이터베이스 연결 정리
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('데이터베이스 연결 종료 실패:', err.message);
        } else {
            console.log('데이터베이스 연결이 정상적으로 종료되었습니다.');
        }
        process.exit(0);
    });
});