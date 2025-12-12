# Week 7: 고급 인증/인가 시스템 구현 가이드

## 🎯 학습 목표

이 과제에서는 **Refresh Token 재발급 시스템**과 **Role-Based Access Control(RBAC)**를 구현하여 실제 프로덕션 환경에서 사용 가능한 수준의 보안 시스템을 구축합니다.

---

## 🆚 인증(Authentication) vs 인가(Authorization)

### 인증 (Authentication) - "누구인가?"

- 사용자가 **본인이 맞는지 확인**하는 과정
- 로그인, 비밀번호 검증, JWT 토큰 발급
- **"당신은 홍길동이 맞나요?"**

### 인가 (Authorization) - "무엇을 할 수 있는가?"

- 인증된 사용자가 **특정 작업을 수행할 권한**이 있는지 확인
- 역할 기반 접근 제어, 리소스 소유권 검증
- **"홍길동은 이 파일을 삭제할 수 있나요?"**

---

## 🔄 Refresh Token 시스템

### 문제점: 기존 JWT의 한계

```javascript
// 기존 방식의 문제점
const token = jwt.sign(payload, secret, { expiresIn: "24h" });

// 문제:
// 1. 토큰이 탈취되면 24시간 동안 악용 가능
// 2. 짧게 설정하면 사용자가 자주 재로그인해야 함
// 3. 토큰 무효화가 어려움
```

### 해결책: Access Token + Refresh Token

```javascript
// Access Token: 실제 API 요청에 사용 (짧은 만료시간)
const accessToken = jwt.sign(payload, accessSecret, { expiresIn: "15m" });

// Refresh Token: Access Token 갱신용 (긴 만료시간)
const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: "7d" });
```

### 토큰 갱신 플로우

```
1. 로그인 → Access Token(15분) + Refresh Token(7일) 발급
2. API 요청 → Access Token 사용
3. Access Token 만료 → 401 에러 반환
4. 클라이언트 → Refresh Token으로 새 토큰 요청
5. 서버 → 새로운 Access Token + Refresh Token 쌍 발급
6. 기존 Refresh Token 무효화
```

### 데이터베이스 설계

```sql
-- Refresh Token 저장 테이블
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,           -- Refresh Token 값
    expires_at TEXT NOT NULL,      -- 만료 시간
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_revoked INTEGER DEFAULT 0,  -- 무효화 여부
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 장점

- **보안 향상**: Access Token 탈취 시 피해 최소화 (15분만 유효)
- **사용성 개선**: Refresh Token으로 자동 갱신 (7일간 재로그인 불필요)
- **토큰 무효화**: DB에서 Refresh Token 삭제/무효화 가능
- **세밀한 제어**: 디바이스별, 세션별 토큰 관리

---

## 🛡️ RBAC (Role-Based Access Control)

### 역할 기반 접근 제어란?

사용자에게 **역할(Role)**을 부여하고, 각 역할에 따라 **권한(Permission)**을 제어하는 시스템

### 데이터베이스 설계

```sql
-- 사용자 테이블에 역할 추가
CREATE TABLE u (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',        -- 역할
    status TEXT NOT NULL DEFAULT 'active',    -- 계정 상태
    permissions TEXT DEFAULT '[]',            -- JSON 형태의 권한 배열
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 역할 정의

```javascript
const ROLES = {
  USER: "user", // 일반 사용자
  MODERATOR: "moderator", // 중간 관리자
  ADMIN: "admin", // 최고 관리자
};

const PERMISSIONS = {
  READ_OWN: "read_own", // 본인 데이터 읽기
  WRITE_OWN: "write_own", // 본인 데이터 수정
  DELETE_OWN: "delete_own", // 본인 데이터 삭제
  READ_ALL: "read_all", // 모든 데이터 읽기
  WRITE_ALL: "write_all", // 모든 데이터 수정
  DELETE_ALL: "delete_all", // 모든 데이터 삭제
  MANAGE_USERS: "manage_users", // 사용자 관리
};
```

### 역할별 권한 매트릭스

| 기능                   | User | Moderator | Admin |
| ---------------------- | ---- | --------- | ----- |
| 본인 정보 조회/수정    | ✅   | ✅        | ✅    |
| 본인 할 일 CRUD        | ✅   | ✅        | ✅    |
| 다른 사용자 할 일 조회 | ❌   | ✅        | ✅    |
| 사용자 역할 변경       | ❌   | ❌        | ✅    |
| 계정 상태 관리         | ❌   | ❌        | ✅    |
| 시스템 통계 조회       | ❌   | ❌        | ✅    |

---

## 🔧 미들웨어 구현

### 1. 역할 검증 미들웨어

```javascript
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "인증이 필요합니다",
        code: "AUTH_REQUIRED",
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "접근 권한이 없습니다",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  };
};

// 사용 예시
app.get("/admin/users", authenticateToken, checkRole("admin"), (req, res) => {
  // 관리자만 접근 가능
});
```

### 2. 소유권 검증 미들웨어

```javascript
const checkOwnership = (resourceIdParam = "id", userIdField = "user_id") => {
  return async (req, res, next) => {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    // 관리자는 모든 리소스에 접근 가능
    if (currentUserRole === "admin") {
      return next();
    }

    // 소유권 검증 함수를 req에 추가
    req.checkOwnership = (resource) => {
      return resource && resource[userIdField] === currentUserId;
    };

    next();
  };
};

// 사용 예시
app.patch(
  "/todos/:id",
  authenticateToken,
  checkOwnership("id", "user_id"),
  (req, res) => {
    // 본인의 할 일만 수정 가능 (관리자 예외)
    db.get("SELECT * FROM todos WHERE id = ?", [req.params.id], (err, todo) => {
      if (!req.checkOwnership(todo)) {
        return res.status(403).json({ message: "권한이 없습니다" });
      }
      // 수정 로직...
    });
  }
);
```

### 3. 계정 상태 검증 미들웨어

```javascript
const checkAccountStatus = (req, res, next) => {
  const user = req.user;

  if (user.status === "inactive") {
    return res.status(403).json({
      message: "비활성화된 계정입니다",
      code: "ACCOUNT_INACTIVE",
    });
  }

  if (user.status === "suspended") {
    return res.status(403).json({
      message: "정지된 계정입니다",
      code: "ACCOUNT_SUSPENDED",
    });
  }

  next();
};
```

---

## 🔐 보안 강화

### 1. Helmet.js - 보안 헤더 설정

```javascript
const helmet = require("helmet");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);
```

### 2. CORS 설정

```javascript
const cors = require("cors");

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"], // 허용 도메인
    credentials: true, // 쿠키 허용
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

### 3. Rate Limiting

```javascript
const rateLimit = require("express-rate-limit");

// 일반 요청 제한
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100회
  message: "요청이 너무 많습니다",
});

// 인증 요청 제한 (더 엄격)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 5, // 최대 5회
  message: "로그인 시도가 너무 많습니다",
});

app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use(generalLimiter);
```

---

## 📡 API 엔드포인트

### 인증 관련 API

#### POST /auth/register - 회원가입

```json
{
  "name": "홍길동",
  "email": "hong@example.com",
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
    "email": "hong@example.com",
    "role": "user"
  },
  "tokens": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "accessTokenExpiresIn": "15m",
    "refreshTokenExpiresIn": "7d"
  }
}
```

#### POST /auth/login - 로그인

```json
{
  "email": "hong@example.com",
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
  "tokens": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "accessTokenExpiresIn": "15m",
    "refreshTokenExpiresIn": "7d"
  }
}
```

#### POST /auth/logout - 로그아웃

```json
{
  "refreshToken": "eyJhbGci..."
}
```

### 사용자 관리 API

#### GET /users/me - 내 정보 조회

**헤더:** `Authorization: Bearer <accessToken>`

#### GET /admin/users - 모든 사용자 조회 (관리자 전용)

**쿼리 파라미터:**

- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 10)
- `role`: 역할 필터
- `status`: 상태 필터

#### PATCH /admin/users/:id/role - 사용자 역할 변경 (관리자 전용)

```json
{
  "role": "moderator"
}
```

#### PATCH /admin/users/:id/status - 계정 상태 변경 (관리자 전용)

```json
{
  "status": "suspended"
}
```

### Todo 관리 API (소유권 검증)

#### GET /todos - 할 일 목록 조회

- **일반 사용자**: 본인의 할 일만 조회
- **관리자**: 모든 사용자의 할 일 조회

#### POST /todos - 새 할 일 추가

```json
{
  "title": "프로젝트 완성하기",
  "description": "JWT 인증 시스템 구현",
  "priority": "high",
  "due_date": "2024-12-31"
}
```

#### PATCH /todos/:id - 할 일 수정

- **소유권 검증**: 본인의 할 일만 수정 가능
- **관리자**: 모든 할 일 수정 가능

#### DELETE /todos/:id - 할 일 삭제

- **소유권 검증**: 본인의 할 일만 삭제 가능
- **관리자**: 모든 할 일 삭제 가능

---

## 🧪 테스트 시나리오

### 1. 회원가입 및 토큰 발급

```bash
curl -X POST http://localhost:3005/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트유저",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. 로그인

```bash
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Access Token으로 API 요청

```bash
# 내 정보 조회
curl -X GET http://localhost:3005/users/me \
  -H "Authorization: Bearer <accessToken>"

# 할 일 추가
curl -X POST http://localhost:3005/todos \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title": "JWT 공부하기", "priority": "high"}'
```

### 4. Access Token 만료 후 Refresh

```bash
# Access Token 만료 시 401 에러
curl -X GET http://localhost:3005/users/me \
  -H "Authorization: Bearer <expiredAccessToken>"

# Refresh Token으로 갱신
curl -X POST http://localhost:3005/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refreshToken>"}'
```

### 5. 관리자 전용 API 테스트

```bash
# 관리자 계정으로 로그인
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@system.com",
    "password": "admin123456"
  }'

# 모든 사용자 조회 (관리자만 가능)
curl -X GET http://localhost:3005/admin/users \
  -H "Authorization: Bearer <adminAccessToken>"

# 사용자 역할 변경 (관리자만 가능)
curl -X PATCH http://localhost:3005/admin/users/2/role \
  -H "Authorization: Bearer <adminAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"role": "moderator"}'
```

### 6. 권한 부족 테스트

```bash
# 일반 사용자가 관리자 API 요청 시 403 에러
curl -X GET http://localhost:3005/admin/users \
  -H "Authorization: Bearer <userAccessToken>"

# 다른 사용자의 할 일 수정 시도 시 403 에러
curl -X PATCH http://localhost:3005/todos/999 \
  -H "Authorization: Bearer <userAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

---

## ✅ 구현 체크리스트

### 기본 기능

- [ ] Refresh Token 저장/검증/무효화 시스템
- [ ] Access Token + Refresh Token 쌍 발급
- [ ] 토큰 재발급 API (`/auth/refresh`)
- [ ] 로그아웃 시 Refresh Token 무효화
- [ ] 사용자 역할(role) 기반 권한 제어
- [ ] 계정 상태(status) 관리

### 미들웨어

- [ ] `checkRole()` - 역할 기반 접근 제어
- [ ] `checkOwnership()` - 리소스 소유권 검증
- [ ] `checkAccountStatus()` - 계정 상태 확인
- [ ] `requireAdmin` - 관리자 전용 접근
- [ ] `requireSelfOrAdmin` - 본인 또는 관리자만 접근

### 보안 기능

- [ ] Helmet.js 보안 헤더 설정
- [ ] CORS 정책 설정
- [ ] Rate Limiting (일반/인증 요청 분리)
- [ ] 비밀번호 해싱 (bcrypt)
- [ ] SQL Injection 방지

### API 엔드포인트

- [ ] `/auth/register` - 회원가입
- [ ] `/auth/login` - 로그인
- [ ] `/auth/refresh` - 토큰 재발급
- [ ] `/auth/logout` - 로그아웃
- [ ] `/users/me` - 내 정보 조회
- [ ] `/admin/users` - 사용자 목록 조회 (관리자)
- [ ] `/admin/users/:id/role` - 역할 변경 (관리자)
- [ ] `/admin/users/:id/status` - 상태 변경 (관리자)
- [ ] `/todos` - 할 일 CRUD (소유권 검증)
- [ ] `/admin/stats` - 시스템 통계 (관리자)

### 에러 처리

- [ ] 일관된 에러 응답 형식
- [ ] 적절한 HTTP 상태 코드 사용
- [ ] 에러 코드 및 메시지 표준화
- [ ] 보안에 민감한 정보 노출 방지

---

## 🚨 보안 고려사항

### 토큰 관리

1. **Access Token**: 짧은 만료시간 (15분) 설정
2. **Refresh Token**: 긴 만료시간 (7일) 하지만 DB에서 관리
3. **토큰 무효화**: 로그아웃, 계정 상태 변경 시 즉시 무효화
4. **토큰 저장**: 클라이언트에서 안전한 저장소 사용 권장

### 역할 및 권한

1. **최소 권한 원칙**: 필요한 최소한의 권한만 부여
2. **역할 상속**: 상위 역할이 하위 권한 포함
3. **관리자 보호**: 관리자는 자신의 역할/상태 변경 불가
4. **권한 검증**: 모든 민감한 작업에 권한 확인

### 입력 검증

1. **데이터 타입 검증**: 모든 입력값의 타입과 형식 확인
2. **길이 제한**: 문자열 필드의 최대/최소 길이 설정
3. **특수문자 처리**: XSS, SQL Injection 방지
4. **화이트리스트**: 허용된 값만 받아들이기

---

## 💡 실무 팁

### 1. 토큰 관리 전략

```javascript
// 클라이언트 사이드 토큰 자동 갱신 로직
const apiClient = axios.create({
  baseURL: "http://localhost:3005",
});

// 요청 인터셉터: Access Token 자동 첨부
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 토큰 만료 시 자동 갱신
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === "TOKEN_EXPIRED"
    ) {
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const response = await axios.post("/auth/refresh", { refreshToken });

        localStorage.setItem("accessToken", response.data.tokens.accessToken);
        localStorage.setItem("refreshToken", response.data.tokens.refreshToken);

        // 원래 요청 재시도
        error.config.headers.Authorization = `Bearer ${response.data.tokens.accessToken}`;
        return axios.request(error.config);
      } catch (refreshError) {
        // Refresh Token도 만료된 경우 로그인 페이지로 이동
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

### 2. 역할별 UI 제어

```javascript
// React 예시: 역할별 컴포넌트 렌더링
const RoleBasedComponent = ({ user, children, allowedRoles }) => {
  if (!allowedRoles.includes(user.role)) {
    return <div>권한이 없습니다</div>;
  }
  return children;
};

// 사용 예시
<RoleBasedComponent user={currentUser} allowedRoles={["admin"]}>
  <AdminPanel />
</RoleBasedComponent>;
```

### 3. 디버깅을 위한 로깅

```javascript
// 인증/인가 관련 로그 기록
const authLogger = (action, user, resource = null) => {
  console.log({
    timestamp: new Date().toISOString(),
    action,
    user: { id: user.id, email: user.email, role: user.role },
    resource,
    ip: req.ip,
  });
};

// 사용 예시
app.patch("/todos/:id", authenticateToken, (req, res) => {
  authLogger("UPDATE_TODO_ATTEMPT", req.user, { todoId: req.params.id });
  // 로직...
});
```

---

이제 실무에서 사용 가능한 수준의 완전한 인증/인가 시스템을 구현해보세요! 🚀

단계별로 천천히 구현하면서 각 보안 기능의 동작 원리를 이해하는 것이 중요합니다.
