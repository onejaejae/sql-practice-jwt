# Week 7: 심플한 인증/인가 시스템 구현 가이드

## 🎯 학습 목표

이번 과제에서는 **교육용으로 최적화된 심플한 인증/인가 시스템**을 구현합니다. 핵심 개념을 명확하게 이해할 수 있도록 복잡한 기능은 제거하고 꼭 필요한 기능만 구현합니다.

---

## 🔑 핵심 개념

### 1. 인증(Authentication) vs 인가(Authorization)

**인증(Authentication)**: "누구인가?"

- 사용자가 본인이 맞는지 확인
- 로그인, 비밀번호 검증, JWT 토큰 발급

**인가(Authorization)**: "무엇을 할 수 있는가?"

- 인증된 사용자가 특정 작업을 수행할 권한이 있는지 확인
- 역할 기반 접근 제어, 리소스 소유권 검증

### 2. Refresh Token이 필요한 이유

**기존 JWT의 문제점:**

```javascript
// 24시간 만료 토큰
const token = jwt.sign(payload, secret, { expiresIn: "24h" });

// 문제점:
// 1. 토큰 탈취 시 24시간 동안 악용 가능
// 2. 짧게 설정하면 사용자가 자주 재로그인
```

**Refresh Token 해결책:**

```javascript
// Access Token: 15분 (API 요청용)
const accessToken = jwt.sign(payload, accessSecret, { expiresIn: "15m" });

// Refresh Token: 7일 (토큰 갱신용)
const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: "7d" });
```

**장점:**

- 보안 향상: Access Token 탈취 시 피해 최소화 (15분만 유효)
- 사용성 개선: 7일간 자동 갱신으로 재로그인 불필요

### 3. 역할 기반 접근 제어 (RBAC)

**단순한 2가지 역할:**

```javascript
const ROLES = {
  USER: "USER", // 일반 사용자
  ADMIN: "ADMIN", // 관리자
};
```

**권한 매트릭스:**
| 기능 | USER | ADMIN |
|------|------|-------|
| 회원가입/로그인 | ✅ | ✅ |
| 내 정보 조회 | ✅ | ✅ |
| 모든 사용자 조회 | ❌ | ✅ |
| 내 할 일 CRUD | ✅ | ✅ |
| 모든 할 일 조회/수정 | ❌ | ✅ |

---

## 🗃️ 데이터베이스 설계

### Users 테이블 (심플 버전)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER',  -- 'USER' 또는 'ADMIN'만
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Refresh Tokens 테이블

```sql
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Todos 테이블

```sql
CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🔧 미들웨어 구현

### 1. 인증 미들웨어

```javascript
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      message: "액세스 토큰이 필요합니다",
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // 토큰에서 사용자 정보 추출
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "토큰이 만료되었습니다. refresh token으로 갱신하세요",
      });
    }
    return res.status(403).json({
      message: "유효하지 않은 토큰입니다",
    });
  }
};
```

### 2. 관리자 권한 미들웨어

```javascript
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "로그인이 필요합니다",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "관리자 권한이 필요합니다",
    });
  }

  next();
};

// 사용 예시
app.get("/admin/users", authenticateToken, requireAdmin, (req, res) => {
  // 관리자만 접근 가능
});
```

### 3. 소유권 검증 (직접 구현)

```javascript
app.patch("/todos/:id", authenticateToken, (req, res) => {
  const todoId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  // 먼저 할 일 조회
  db.get("SELECT * FROM todos WHERE id = ?", [todoId], (err, todo) => {
    if (!todo) {
      return res.status(404).json({ message: "할 일을 찾을 수 없습니다" });
    }

    // 소유권 검증: 본인 것이거나 관리자인 경우만 허용
    if (!isAdmin && todo.user_id !== userId) {
      return res.status(403).json({
        message: "본인의 할 일만 수정할 수 있습니다",
      });
    }

    // 수정 로직...
  });
});
```

---

## 📡 API 엔드포인트

### 인증 관련 API

#### POST /auth/register - 회원가입

```json
{
  "name": "홍길동",
  "email": "hong@test.com",
  "password": "password123"
}
```

**응답:**

```json
{
  "message": "회원가입이 완료되었습니다",
  "user": {
    "id": 1,
    "name": "홍길동",
    "email": "hong@test.com",
    "role": "USER"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

#### POST /auth/login - 로그인

```json
{
  "email": "hong@test.com",
  "password": "password123"
}
```

#### POST /auth/refresh - 토큰 재발급

```json
{
  "refreshToken": "eyJhbGci..."
}
```

**응답:**

```json
{
  "message": "토큰이 갱신되었습니다",
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### 사용자 관리 API

#### GET /users/me - 내 정보 조회

**헤더:** `Authorization: Bearer <accessToken>`

#### GET /admin/users - 모든 사용자 조회 (관리자 전용)

**헤더:** `Authorization: Bearer <adminAccessToken>`

### Todo 관리 API (소유권 검증)

#### GET /todos - 할 일 목록 조회

- **USER**: 본인의 할 일만 조회
- **ADMIN**: 모든 사용자의 할 일 조회

#### POST /todos - 새 할 일 추가

```json
{
  "task": "JWT 공부하기"
}
```

#### PATCH /todos/:id - 할 일 수정

```json
{
  "task": "수정된 할 일",
  "completed": 1
}
```

#### DELETE /todos/:id - 할 일 삭제

- 본인의 할 일만 삭제 가능 (관리자는 모든 할 일 삭제 가능)

---

## 🧪 테스트 시나리오

### 1. 회원가입 및 로그인

```bash
# 회원가입
curl -X POST http://localhost:3006/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "일반사용자",
    "email": "user@test.com",
    "password": "password123"
  }'

# 관리자 로그인 (기본 계정)
curl -X POST http://localhost:3006/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }'
```

### 2. Refresh Token 테스트

```bash
# 15분 후 Access Token 만료되면
curl -X GET http://localhost:3006/users/me \
  -H "Authorization: Bearer <expiredAccessToken>"

# 응답: {"message": "토큰이 만료되었습니다. refresh token으로 갱신하세요"}

# Refresh Token으로 갱신
curl -X POST http://localhost:3006/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refreshToken>"}'
```

### 3. 권한 테스트

```bash
# 일반 사용자가 관리자 API 접근 시도 (403 에러)
curl -X GET http://localhost:3006/admin/users \
  -H "Authorization: Bearer <userAccessToken>"

# 관리자가 모든 사용자 조회 (성공)
curl -X GET http://localhost:3006/admin/users \
  -H "Authorization: Bearer <adminAccessToken>"
```

### 4. 소유권 검증 테스트

```bash
# 사용자1이 할 일 생성
curl -X POST http://localhost:3006/todos \
  -H "Authorization: Bearer <user1AccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"task": "사용자1의 할 일"}'

# 사용자2가 사용자1의 할 일 수정 시도 (403 에러)
curl -X PATCH http://localhost:3006/todos/1 \
  -H "Authorization: Bearer <user2AccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"completed": 1}'

# 관리자가 모든 할 일 수정 (성공)
curl -X PATCH http://localhost:3006/todos/1 \
  -H "Authorization: Bearer <adminAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"completed": 1}'
```

---

## 🚀 실행 방법

### 1. 서버 실행

```bash
npm run dev:simple-auth
```

### 2. 기본 계정 정보

- **관리자 계정**: admin@test.com / admin123
- **일반 사용자**: 회원가입으로 생성

### 3. API 정보 확인

```bash
curl http://localhost:3006/api/info
```

---

## ✅ 구현 체크리스트

### 기본 기능

- [ ] JWT Access Token + Refresh Token 시스템
- [ ] 회원가입 (USER 역할로 고정)
- [ ] 로그인 (토큰 쌍 발급)
- [ ] 토큰 재발급 (`/auth/refresh`)
- [ ] USER vs ADMIN 역할 구분

### 미들웨어

- [ ] `authenticateToken` - JWT 토큰 검증
- [ ] `requireAdmin` - 관리자 권한 확인

### API 엔드포인트

- [ ] `POST /auth/register` - 회원가입
- [ ] `POST /auth/login` - 로그인
- [ ] `POST /auth/refresh` - 토큰 재발급
- [ ] `GET /users/me` - 내 정보 조회
- [ ] `GET /admin/users` - 모든 사용자 조회 (관리자)
- [ ] Todo CRUD with 소유권 검증

### 소유권 검증

- [ ] 일반 사용자: 본인 리소스만 접근
- [ ] 관리자: 모든 리소스 접근 가능
- [ ] 403 에러 적절한 반환

---

## 💡 핵심 학습 포인트

### 1. 토큰 관리 전략

```javascript
// 클라이언트에서 토큰 자동 갱신 로직
const refreshTokens = async () => {
  try {
    const response = await fetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: localStorage.getItem("refreshToken"),
      }),
    });

    const data = await response.json();
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);

    return data.accessToken;
  } catch (error) {
    // Refresh Token도 만료된 경우 로그인 페이지로 이동
    window.location.href = "/login";
  }
};
```

### 2. 권한 기반 UI 제어

```javascript
// React 예시
const AdminOnly = ({ user, children }) => {
  if (user.role !== "ADMIN") {
    return <div>관리자만 접근 가능합니다</div>;
  }
  return children;
};

// 사용
<AdminOnly user={currentUser}>
  <UserManagement />
</AdminOnly>;
```

### 3. 에러 처리 패턴

```javascript
// 일관된 에러 응답 형식
const sendError = (res, status, message) => {
  res.status(status).json({ message });
};

// 사용
if (!user) {
  return sendError(res, 404, "사용자를 찾을 수 없습니다");
}
```

---

## 🔍 디버깅 팁

### 1. JWT 토큰 내용 확인

```bash
# JWT 디코딩 (jwt.io 사이트 이용 권장)
echo "$ACCESS_TOKEN" | cut -d'.' -f2 | base64 -d | jq .
```

### 2. 데이터베이스 직접 확인

```bash
sqlite3 simple_auth.db
SELECT id, name, email, role FROM users;
SELECT user_id, expires_at FROM refresh_tokens;
```

### 3. 권한 확인 로그

```javascript
// 디버깅용 로그 추가
const requireAdmin = (req, res, next) => {
  console.log(`Admin 권한 체크: ${req.user.email} (${req.user.role})`);

  if (req.user.role !== "ADMIN") {
    console.log("권한 거부됨");
    return res.status(403).json({ message: "관리자 권한이 필요합니다" });
  }

  console.log("관리자 권한 확인됨");
  next();
};
```

---

이제 복잡하지 않은 **교육용 인증/인가 시스템**으로 핵심 개념을 명확하게 학습할 수 있습니다! 🎓

멘티들이 이해하기 쉽도록 **USER/ADMIN 2가지 역할**과 **기본적인 소유권 검증**에 집중하여 구현했습니다.
