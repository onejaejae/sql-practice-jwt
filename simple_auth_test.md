# 심플한 인증/인가 시스템 테스트 가이드

## 🚀 서버 실행

```bash
# 심플한 인증/인가 시스템 서버 실행
npm run dev:simple-auth
```

서버 실행 시 출력되는 메시지:
```
🚀 심플한 인증/인가 시스템이 시작되었습니다!
📡 서버 주소: http://localhost:3006
✅ 기본 관리자 계정 생성:
   이메일: admin@test.com
   비밀번호: admin123
```

---

## 📋 API 정보 확인

```bash
curl http://localhost:3006/api/info
```

**응답:**
```json
{
  "name": "Simple Auth & Authorization System",
  "version": "1.0.0",
  "features": [
    "JWT Authentication with Refresh Tokens",
    "USER vs ADMIN Role-Based Access Control",
    "Resource Ownership Validation"
  ],
  "roles": ["USER", "ADMIN"],
  "endpoints": {
    "auth": ["POST /auth/register", "POST /auth/login", "POST /auth/refresh"],
    "users": ["GET /users/me", "GET /admin/users (ADMIN only)"],
    "todos": ["GET /todos", "POST /todos", "PATCH /todos/:id", "DELETE /todos/:id"]
  }
}
```

---

## 🔐 Phase 1: 인증 테스트

### 1.1 회원가입 (일반 사용자)

```bash
curl -X POST http://localhost:3006/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "일반사용자",
    "email": "user@test.com",
    "password": "password123"
  }'
```

**응답:**
```json
{
  "message": "회원가입이 완료되었습니다",
  "user": {
    "id": 2,
    "name": "일반사용자",
    "email": "user@test.com",
    "role": "USER"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### 1.2 관리자 계정 로그인

```bash
curl -X POST http://localhost:3006/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }'
```

**응답:**
```json
{
  "message": "로그인 성공",
  "user": {
    "id": 1,
    "name": "관리자",
    "email": "admin@test.com",
    "role": "ADMIN"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### 1.3 입력 검증 테스트

#### 잘못된 이메일 형식
```bash
curl -X POST http://localhost:3006/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트",
    "email": "invalidemail",
    "password": "password123"
  }'
```

**응답:** 
```json
{
  "message": "올바른 이메일 형식이 아닙니다"
}
```

#### 짧은 비밀번호
```bash
curl -X POST http://localhost:3006/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트",
    "email": "test2@test.com",
    "password": "123"
  }'
```

**응답:**
```json
{
  "message": "비밀번호는 최소 6자 이상이어야 합니다"
}
```

---

## 🔄 Phase 2: Refresh Token 테스트

### 2.1 Access Token으로 API 요청

```bash
# 위에서 받은 accessToken을 환경변수로 저장
export USER_ACCESS_TOKEN="eyJhbGci..."
export ADMIN_ACCESS_TOKEN="eyJhbGci..."

# 내 정보 조회
curl -X GET http://localhost:3006/users/me \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

### 2.2 토큰 만료 시뮬레이션

15분 후에 토큰이 만료되면:
```json
{
  "message": "토큰이 만료되었습니다. refresh token으로 갱신하세요"
}
```

### 2.3 Refresh Token으로 토큰 재발급

```bash
export USER_REFRESH_TOKEN="eyJhbGci..."

curl -X POST http://localhost:3006/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$USER_REFRESH_TOKEN\"}"
```

**응답:**
```json
{
  "message": "토큰이 갱신되었습니다",
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### 2.4 유효하지 않은 Refresh Token 테스트

```bash
curl -X POST http://localhost:3006/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "invalid-token"}'
```

**응답:**
```json
{
  "message": "토큰 갱신에 실패했습니다"
}
```

---

## 👥 Phase 3: 역할 기반 접근 제어 테스트

### 3.1 일반 사용자 권한 테스트

#### 내 정보 조회 (성공)
```bash
curl -X GET http://localhost:3006/users/me \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

#### 관리자 API 접근 시도 (실패 - 403)
```bash
curl -X GET http://localhost:3006/admin/users \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

**응답:**
```json
{
  "message": "관리자 권한이 필요합니다"
}
```

### 3.2 관리자 권한 테스트

#### 모든 사용자 조회 (성공)
```bash
curl -X GET http://localhost:3006/admin/users \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

**응답:**
```json
{
  "users": [
    {
      "id": 1,
      "name": "관리자",
      "email": "admin@test.com",
      "role": "ADMIN",
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "일반사용자",
      "email": "user@test.com",
      "role": "USER",
      "createdAt": "2024-01-15T10:05:00.000Z"
    }
  ],
  "requestedBy": {
    "id": 1,
    "email": "admin@test.com",
    "name": "관리자",
    "role": "ADMIN"
  }
}
```

---

## 📝 Phase 4: Todo 소유권 검증 테스트

### 4.1 할 일 생성

#### 일반 사용자 할 일 생성
```bash
curl -X POST http://localhost:3006/todos \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "사용자1의 할 일"
  }'
```

#### 관리자 할 일 생성
```bash
curl -X POST http://localhost:3006/todos \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "관리자의 할 일"
  }'
```

### 4.2 할 일 조회 테스트

#### 일반 사용자 조회 (본인 것만)
```bash
curl -X GET http://localhost:3006/todos \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

**응답:**
```json
{
  "todos": [
    {
      "id": 1,
      "user_id": 2,
      "task": "사용자1의 할 일",
      "completed": 0,
      "createdAt": "2024-01-15T10:10:00.000Z"
    }
  ],
  "isAdmin": false,
  "user": {
    "id": 2,
    "email": "user@test.com",
    "name": "일반사용자",
    "role": "USER"
  }
}
```

#### 관리자 조회 (모든 할 일)
```bash
curl -X GET http://localhost:3006/todos \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

**응답:**
```json
{
  "todos": [
    {
      "id": 1,
      "user_id": 2,
      "task": "사용자1의 할 일",
      "completed": 0,
      "createdAt": "2024-01-15T10:10:00.000Z",
      "owner_name": "일반사용자"
    },
    {
      "id": 2,
      "user_id": 1,
      "task": "관리자의 할 일",
      "completed": 0,
      "createdAt": "2024-01-15T10:12:00.000Z",
      "owner_name": "관리자"
    }
  ],
  "isAdmin": true,
  "user": {
    "id": 1,
    "email": "admin@test.com",
    "name": "관리자",
    "role": "ADMIN"
  }
}
```

### 4.3 소유권 검증 테스트

#### 본인 할 일 수정 (성공)
```bash
# 사용자가 자신의 할 일(ID 1) 수정
curl -X PATCH http://localhost:3006/todos/1 \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "수정된 할 일",
    "completed": 1
  }'
```

#### 다른 사용자의 할 일 수정 시도 (실패 - 403)

먼저 다른 사용자 계정을 만들어보겠습니다:
```bash
# 두 번째 사용자 계정 생성
curl -X POST http://localhost:3006/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "사용자2",
    "email": "user2@test.com",
    "password": "password123"
  }'

export USER2_ACCESS_TOKEN="eyJhbGci..."

# 사용자2가 사용자1의 할 일(ID 1) 수정 시도
curl -X PATCH http://localhost:3006/todos/1 \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"completed": 1}'
```

**응답:**
```json
{
  "message": "본인의 할 일만 수정할 수 있습니다"
}
```

#### 관리자가 모든 할 일 수정 (성공)
```bash
# 관리자가 사용자1의 할 일 수정
curl -X PATCH http://localhost:3006/todos/1 \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "관리자가 수정한 할 일"
  }'
```

### 4.4 할 일 삭제 테스트

#### 본인 할 일 삭제 (성공)
```bash
# 사용자2가 자신의 할 일 삭제
curl -X DELETE http://localhost:3006/todos/3 \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN"
```

#### 다른 사용자의 할 일 삭제 시도 (실패 - 403)
```bash
# 사용자2가 사용자1의 할 일(ID 1) 삭제 시도
curl -X DELETE http://localhost:3006/todos/1 \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN"
```

**응답:**
```json
{
  "message": "본인의 할 일만 삭제할 수 있습니다"
}
```

#### 관리자가 모든 할 일 삭제 (성공)
```bash
# 관리자가 아무 할 일이나 삭제 가능
curl -X DELETE http://localhost:3006/todos/1 \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

---

## 🧪 종합 테스트 시나리오

### 자동화 테스트 스크립트

```bash
#!/bin/bash

BASE_URL="http://localhost:3006"
echo "🚀 심플한 인증/인가 시스템 테스트 시작"

# 1. API 정보 확인
echo "📋 1. API 정보 확인..."
curl -s "$BASE_URL/api/info" | jq .name

# 2. 회원가입
echo "📝 2. 회원가입 테스트..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트유저",
    "email": "test@example.com",
    "password": "password123"
  }')

USER_ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .accessToken)
USER_REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .refreshToken)
echo "✅ 회원가입 완료"

# 3. 관리자 로그인
echo "👨‍💼 3. 관리자 로그인..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }')

ADMIN_ACCESS_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r .accessToken)
echo "✅ 관리자 로그인 완료"

# 4. 권한 테스트
echo "🔐 4. 권한 테스트..."

# 일반 사용자가 관리자 API 접근 시도 (403이어야 함)
USER_ADMIN_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X GET "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN")

if [ "$USER_ADMIN_RESPONSE" = "403" ]; then
  echo "✅ 일반 사용자 권한 제한 정상 작동"
else
  echo "❌ 일반 사용자 권한 제한 오류"
fi

# 관리자가 사용자 목록 조회 (200이어야 함)
ADMIN_USERS_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X GET "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

if [ "$ADMIN_USERS_RESPONSE" = "200" ]; then
  echo "✅ 관리자 권한 정상 작동"
else
  echo "❌ 관리자 권한 오류"
fi

# 5. 할 일 생성 및 소유권 테스트
echo "📝 5. 할 일 및 소유권 테스트..."

# 할 일 생성
TODO_RESPONSE=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "테스트 할 일"
  }')

TODO_ID=$(echo "$TODO_RESPONSE" | jq -r .todo.id)
echo "✅ 할 일 생성 완료 (ID: $TODO_ID)"

# 6. Refresh Token 테스트
echo "🔄 6. Refresh Token 테스트..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$USER_REFRESH_TOKEN\"}")

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r .accessToken)

if [ "$NEW_ACCESS_TOKEN" != "null" ] && [ "$NEW_ACCESS_TOKEN" != "" ]; then
  echo "✅ 토큰 갱신 성공"
else
  echo "❌ 토큰 갱신 실패"
fi

echo "🎉 테스트 완료!"
```

이 스크립트를 `simple_test.sh`로 저장하고 실행:
```bash
chmod +x simple_test.sh
./simple_test.sh
```

---

## 🔍 디버깅 및 데이터베이스 확인

### SQLite 데이터베이스 직접 조회
```bash
# 데이터베이스 접속
sqlite3 simple_auth.db

# 사용자 목록 확인
SELECT id, name, email, role FROM users;

# Refresh Token 상태 확인
SELECT user_id, expires_at FROM refresh_tokens 
WHERE datetime(expires_at) > datetime('now');

# 할 일 목록 확인
SELECT t.id, t.task, t.user_id, u.name as owner 
FROM todos t 
JOIN users u ON t.user_id = u.id;

# 종료
.quit
```

### 로그 확인
서버 실행 중인 터미널에서 실시간으로 요청/응답 로그를 확인할 수 있습니다.

---

## 📈 성능 테스트

### 동시 요청 테스트
```bash
# 10개의 동시 요청
for i in {1..10}; do
  curl -s http://localhost:3006/api/info &
done
wait
echo "동시 요청 테스트 완료"
```

### 응답 시간 측정
```bash
# 응답 시간 측정
time curl -s http://localhost:3006/users/me \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

---

이 테스트 가이드를 통해 **심플한 인증/인가 시스템**의 핵심 기능들을 체계적으로 검증할 수 있습니다! 

**교육용**에 최적화되어 복잡한 기능은 제거하고 **Refresh Token + RBAC + 소유권 검증**의 핵심 개념만 명확하게 구현되었습니다. 🎓