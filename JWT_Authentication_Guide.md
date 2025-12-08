# JWT 인증 시스템 구현 과제 가이드

## 📚 과제 개요

이 과제에서는 **JWT(JSON Web Token)** 기반의 인증 시스템을 구현하여 보안성 있는 REST API를 개발합니다. 사용자 회원가입, 로그인, 그리고 인증이 필요한 API 엔드포인트를 구현하게 됩니다.

## 🎯 학습 목표

- JWT 토큰 기반 인증 시스템의 동작 원리 이해
- bcrypt를 활용한 안전한 비밀번호 저장 방법 학습
- 미들웨어(Middleware) 패턴을 통한 인증 로직 분리
- 사용자별 데이터 접근 권한 제어 구현
- 보안성 있는 API 설계 및 구현

---

## 📖 핵심 개념 이해하기

### 1. JWT (JSON Web Token) 🔑

**JWT란?**
- JSON 형태의 정보를 안전하게 전송하기 위한 토큰 기반 인증 방식
- 서버가 세션을 저장하지 않는 **stateless** 인증 방식
- 클라이언트가 토큰을 저장하고 매 요청마다 헤더에 포함하여 전송

**JWT 구조:**
```
Header.Payload.Signature
```

**예시:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjc4ODg2NDAwLCJleHAiOjE2Nzg5NzI4MDB9.signature
```

**JWT의 장점:**
- 서버 메모리에 세션 저장 불필요
- 확장성이 좋음 (마이크로서비스 환경에 적합)
- 모바일 앱에서도 사용 가능

**JWT의 단점:**
- 토큰 크기가 세션 ID보다 큼
- 토큰 무효화가 어려움 (만료 전까지)

### 2. bcrypt 🔐

**bcrypt란?**
- 비밀번호를 안전하게 해싱하는 라이브러리
- **Salt**를 자동으로 생성하여 무지개 테이블 공격 방지
- **느린 해싱** 방식으로 브루트 포스 공격 방어

**동작 방식:**
```javascript
// 비밀번호 해싱
const hashedPassword = await bcrypt.hash('myPassword123', 10);
// 결과: $2b$10$N9qo8uLOy2VpYAk...

// 비밀번호 검증
const isValid = await bcrypt.compare('myPassword123', hashedPassword);
// 결과: true 또는 false
```

**Salt Rounds:**
- 숫자가 클수록 더 안전하지만 더 느림
- 일반적으로 10-12 사용 권장

### 3. Access Token vs Refresh Token 🔄

**Access Token (액세스 토큰):**
- 실제 API 요청에 사용되는 토큰
- 짧은 만료 시간 (15분 ~ 1시간)
- 탈취 위험을 최소화

**Refresh Token (리프레시 토큰) - Optional:**
- Access Token을 갱신하기 위한 토큰
- 긴 만료 시간 (1주 ~ 1개월)
- 보안 저장소에 안전하게 보관

**토큰 갱신 플로우:**
```
1. 로그인 → Access Token + Refresh Token 발급
2. API 요청 → Access Token 사용
3. Access Token 만료 → Refresh Token으로 새 Access Token 요청
4. Refresh Token도 만료 → 재로그인 필요
```

### 4. Middleware (미들웨어) 🔗

**미들웨어란?**
- 요청(Request)과 응답(Response) 사이에서 실행되는 함수
- 인증, 로깅, 데이터 검증 등의 공통 기능 구현
- 코드 재사용성과 유지보수성 향상

**Express 미들웨어 예시:**
```javascript
const authenticateToken = (req, res, next) => {
    // 1. 토큰 추출
    const token = req.headers['authorization']?.split(' ')[1];
    
    // 2. 토큰 검증
    if (!token) {
        return res.status(401).json({ message: '토큰이 필요합니다' });
    }
    
    try {
        // 3. 토큰 디코딩 및 사용자 정보 추출
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next(); // 다음 미들웨어로 진행
    } catch (error) {
        return res.status(403).json({ message: '유효하지 않은 토큰' });
    }
};
```

### 5. HTTP 상태 코드 📡

**주요 인증 관련 상태 코드:**
- `200 OK`: 요청 성공
- `201 Created`: 리소스 생성 성공 (회원가입)
- `400 Bad Request`: 잘못된 요청 (필수 값 누락)
- `401 Unauthorized`: 인증 필요 (토큰 없음/만료)
- `403 Forbidden`: 권한 없음 (유효하지 않은 토큰)
- `409 Conflict`: 리소스 충돌 (이메일 중복)

---

## 🚀 구현해야 할 API 목록

### 1. 인증 관련 API (Public)

#### POST /auth/register - 회원가입
**요청:**
```json
{
    "name": "홍길동",
    "email": "hong@example.com",
    "password": "password123",
    "age": 25
}
```

**응답:**
```json
{
    "message": "회원가입이 완료되었습니다",
    "user": {
        "id": 1,
        "name": "홍길동",
        "email": "hong@example.com",
        "age": 25
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**구현 요구사항:**
- [ ] 필수 값 검증 (name, email, password)
- [ ] 이메일 형식 검증 (@ 포함)
- [ ] 비밀번호 최소 길이 검증 (6자 이상)
- [ ] 이메일 중복 검사
- [ ] 비밀번호 bcrypt 해싱
- [ ] JWT 토큰 생성 및 반환

#### POST /auth/login - 로그인
**요청:**
```json
{
    "email": "hong@example.com",
    "password": "password123"
}
```

**응답:**
```json
{
    "message": "로그인 성공",
    "user": {
        "id": 1,
        "name": "홍길동",
        "email": "hong@example.com",
        "age": 25
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**구현 요구사항:**
- [ ] 이메일로 사용자 조회
- [ ] bcrypt로 비밀번호 검증
- [ ] JWT 토큰 생성 및 반환
- [ ] 적절한 에러 메시지 반환

### 2. 보호된 API (Private - 인증 필요)

#### GET /users/me - 내 정보 조회
**헤더:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**응답:**
```json
{
    "id": 1,
    "name": "홍길동",
    "email": "hong@example.com",
    "age": 25,
    "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### PATCH /users/me - 내 정보 수정
**요청:**
```json
{
    "name": "김철수",
    "age": 26
}
```

#### DELETE /users/me - 회원 탈퇴
**요청:**
```json
{
    "password": "password123"
}
```

### 3. To-Do API (Private - 사용자별 데이터 분리)

#### GET /todos - 내 할 일 목록 조회
#### POST /todos - 새 할 일 추가
#### PATCH /todos/:id - 할 일 수정 (본인 소유만)
#### DELETE /todos/:id - 할 일 삭제 (본인 소유만)
#### GET /todos/stats - 내 할 일 통계

### 4. 공개 API (Public)

#### GET /public/stats - 전체 통계
**응답:**
```json
{
    "total_users": 100,
    "total_todos": 500,
    "completed_todos": 300
}
```

---

## 🗃️ 데이터베이스 스키마

### Users 테이블
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,      -- bcrypt 해시값
    age INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Todos 테이블
```sql
CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,           -- 사용자별 데이터 분리
    task TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🔧 구현 가이드

### 1. 프로젝트 설정

**의존성 설치:**
```bash
npm install express sqlite3 jsonwebtoken bcryptjs
npm install --save-dev nodemon
```

**package.json 스크립트 추가:**
```json
{
    "scripts": {
        "dev": "nodemon server.js",
        "start": "node server.js"
    }
}
```

### 2. 폴더 구조
```
project/
├── middleware/
│   └── auth.js              # JWT 인증 미들웨어
├── server.js                # 메인 서버 파일
├── package.json
└── README.md
```

### 3. 핵심 구현 파일

#### middleware/auth.js
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-super-secret-key'; // 실제로는 환경변수 사용

// JWT 토큰 생성
const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

// JWT 토큰 검증
const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

// 인증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            message: '액세스 토큰이 필요합니다' 
        });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded; // 토큰 정보를 req.user에 저장
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '토큰이 만료되었습니다' });
        }
        return res.status(403).json({ message: '유효하지 않은 토큰입니다' });
    }
};

module.exports = { generateToken, verifyToken, authenticateToken };
```

### 4. 보안 고려사항

#### 비밀번호 해싱
```javascript
const bcrypt = require('bcryptjs');

// 회원가입 시
const hashedPassword = await bcrypt.hash(password, 10);

// 로그인 시
const isValidPassword = await bcrypt.compare(password, user.password);
```

#### JWT 토큰 사용
```javascript
// 헤더에서 토큰 추출
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

// 토큰 검증
const decoded = jwt.verify(token, JWT_SECRET);
```

#### 사용자별 데이터 접근 제어
```javascript
// 본인 데이터만 접근 가능하도록 user_id 조건 추가
db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?', [todoId, req.user.id]);
```

---

## 🧪 테스트 시나리오

### 1. 회원가입 테스트
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트유저",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. 로그인 테스트
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. 인증이 필요한 API 테스트
```bash
# 로그인 응답에서 받은 토큰을 사용
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 4. To-Do 생성 및 조회
```bash
# 할 일 추가
curl -X POST http://localhost:3000/todos \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task": "JWT 공부하기"}'

# 내 할 일 목록 조회
curl -X GET http://localhost:3000/todos \
  -H "Authorization: Bearer TOKEN"
```

---

## ✅ 체크리스트

### 기본 구현 (필수)
- [ ] JWT 인증 미들웨어 구현
- [ ] bcrypt 비밀번호 해싱
- [ ] 회원가입 API
- [ ] 로그인 API
- [ ] 내 정보 조회 API
- [ ] 사용자별 To-Do CRUD API
- [ ] 적절한 HTTP 상태 코드 사용
- [ ] 에러 처리 구현

### 보안 강화 (권장)
- [ ] 환경변수로 JWT 비밀키 관리
- [ ] 토큰 만료 시간 설정
- [ ] SQL Injection 방지 (플레이스홀더 사용)
- [ ] 입력 데이터 검증 및 sanitization
- [ ] 사용자별 데이터 접근 권한 제어

### 심화 기능 (선택)
- [ ] Refresh Token 구현
- [ ] 비밀번호 변경 기능
- [ ] 회원 탈퇴 기능
- [ ] 로그아웃 기능 (토큰 블랙리스트)
- [ ] Rate Limiting 적용
- [ ] 로그인 시도 제한

---

## 🚨 주의사항

### 보안 관련
1. **JWT 비밀키는 절대 코드에 하드코딩하지 말고 환경변수 사용**
2. **비밀번호는 절대 평문으로 저장하지 말고 bcrypt 해싱**
3. **토큰은 HTTPS 환경에서만 사용 권장**
4. **토큰에는 민감한 정보(비밀번호 등) 포함 금지**

### 개발 관련
1. **에러 메시지에 시스템 내부 정보 노출 금지**
2. **SQL Injection 방지를 위해 플레이스홀더 사용**
3. **사용자 입력 데이터는 항상 검증**
4. **API 응답에는 일관된 형태 유지**

---

## 💡 추가 학습 자료

### 개념 정리
- [JWT 공식 문서](https://jwt.io/)
- [bcrypt 동작 원리](https://en.wikipedia.org/wiki/Bcrypt)
- [Express 미들웨어 가이드](https://expressjs.com/ko/guide/using-middleware.html)

### 보안 모범 사례
- [OWASP Top 10](https://owasp.org/Top10/)
- [Node.js 보안 체크리스트](https://blog.risingstack.com/node-js-security-checklist/)

### 실무 고려사항
- 토큰 저장소 선택 (localStorage vs sessionStorage vs httpOnly cookie)
- 토큰 갱신 전략
- 멀티 디바이스 로그인 관리
- 소셜 로그인 연동

---

## 🎓 제출 가이드

### 제출할 파일
1. `server.js` - 메인 서버 파일
2. `middleware/auth.js` - 인증 미들웨어
3. `package.json` - 프로젝트 설정
4. `README.md` - 실행 방법 및 API 문서

### README.md 포함 내용
- 프로젝트 설명
- 설치 및 실행 방법
- API 엔드포인트 목록
- 테스트 방법
- 구현된 보안 기능

### 평가 기준
- **기능 구현 완성도** (40%)
- **보안 구현 수준** (30%)
- **코드 품질 및 구조** (20%)
- **문서화 및 테스트** (10%)

---

이제 JWT 인증 시스템 구현에 도전해보세요! 🚀

막히는 부분이 있다면 언제든 질문하고, 단계별로 차근차근 구현해나가세요. 완성되면 정말 실무에서도 사용할 수 있는 수준의 인증 시스템을 갖게 될 것입니다!