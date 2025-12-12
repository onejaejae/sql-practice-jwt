# 고급 인증/인가 시스템 테스트 가이드

## 🚀 서버 실행

```bash
# 의존성 설치 (한 번만 실행)
npm install

# 완전한 인증/인가 시스템 서버 실행
npm run dev:complete-auth
```

서버가 성공적으로 실행되면 다음과 같은 메시지가 출력됩니다:
```
🚀 완전한 인증/인가 시스템 서버가 시작되었습니다!
📡 서버 주소: http://localhost:3005
🔑 기본 관리자 계정 생성 완료:
   이메일: admin@system.com
   비밀번호: admin123456
```

---

## 📋 테스트 시나리오

### 1. 시스템 정보 확인 (인증 불필요)

```bash
curl -X GET http://localhost:3005/public/system-info
```

**응답 예시:**
```json
{
  "name": "Complete Auth & Authorization System",
  "version": "1.0.0",
  "features": [
    "JWT Authentication with Refresh Tokens",
    "Role-Based Access Control (RBAC)",
    "Resource Ownership Validation",
    "Account Status Management",
    "Rate Limiting",
    "Security Headers"
  ],
  "endpoints": {
    "auth": ["POST /auth/register", "POST /auth/login", "POST /auth/refresh", "POST /auth/logout"],
    "users": ["GET /users/me", "GET /admin/users", "PATCH /admin/users/:id/role"],
    "todos": ["GET /todos", "POST /todos", "PATCH /todos/:id", "DELETE /todos/:id"],
    "admin": ["GET /admin/stats"]
  }
}
```

---

## 🔐 Phase 1: 인증(Authentication) 테스트

### 1.1 회원가입 테스트

```bash
curl -X POST http://localhost:3005/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "email": "hong@example.com",
    "password": "password123"
  }'
```

**응답에서 받을 정보:**
- `user`: 사용자 기본 정보
- `tokens.accessToken`: API 요청용 토큰 (15분 만료)
- `tokens.refreshToken`: 토큰 갱신용 (7일 만료)

### 1.2 로그인 테스트

```bash
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hong@example.com",
    "password": "password123"
  }'
```

### 1.3 관리자 계정 로그인

```bash
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@system.com",
    "password": "admin123456"
  }'
```

---

## 🎫 Phase 2: Refresh Token 테스트

### 2.1 Access Token으로 API 요청

```bash
# 위에서 받은 accessToken을 사용
export ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3005/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 2.2 Access Token 만료 후 오류 확인

15분 후에 동일한 요청을 하면:
```json
{
  "message": "토큰이 만료되었습니다",
  "code": "TOKEN_EXPIRED"
}
```

### 2.3 Refresh Token으로 토큰 재발급

```bash
export REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3005/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**응답:**
- 새로운 `accessToken`과 `refreshToken` 쌍 발급
- 기존 Refresh Token은 자동으로 무효화됨

### 2.4 로그아웃 (Refresh Token 무효화)

```bash
curl -X POST http://localhost:3005/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

---

## 👥 Phase 3: RBAC (역할 기반 접근 제어) 테스트

### 3.1 일반 사용자 권한 테스트

#### 내 정보 조회 (성공)
```bash
curl -X GET http://localhost:3005/users/me \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

#### 관리자 API 접근 시도 (실패 - 403)
```bash
curl -X GET http://localhost:3005/admin/users \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

**예상 응답:**
```json
{
  "message": "접근 권한이 없습니다",
  "code": "INSUFFICIENT_PERMISSIONS",
  "required": ["admin"],
  "current": "user"
}
```

### 3.2 관리자 권한 테스트

#### 모든 사용자 조회 (성공)
```bash
export ADMIN_ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X GET "http://localhost:3005/admin/users?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

#### 사용자 역할 변경 (성공)
```bash
# 사용자 ID 2의 역할을 moderator로 변경
curl -X PATCH http://localhost:3005/admin/users/2/role \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "moderator"}'
```

#### 사용자 계정 상태 변경 (성공)
```bash
# 사용자 ID 2를 정지 상태로 변경
curl -X PATCH http://localhost:3005/admin/users/2/status \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

#### 자신의 역할 변경 시도 (실패 - 403)
```bash
# 관리자가 자신의 역할을 변경하려 할 때
curl -X PATCH http://localhost:3005/admin/users/1/role \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "user"}'
```

**예상 응답:**
```json
{
  "message": "자신의 역할은 변경할 수 없습니다",
  "code": "CANNOT_CHANGE_OWN_ROLE"
}
```

---

## 📝 Phase 4: 리소스 소유권 검증 테스트

### 4.1 할 일 생성 및 조회

#### 할 일 생성 (사용자1)
```bash
curl -X POST http://localhost:3005/todos \
  -H "Authorization: Bearer $USER1_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "사용자1의 할 일",
    "description": "중요한 업무",
    "priority": "high",
    "due_date": "2024-12-31"
  }'
```

#### 할 일 생성 (사용자2)
```bash
curl -X POST http://localhost:3005/todos \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "사용자2의 할 일",
    "description": "일반 업무",
    "priority": "medium"
  }'
```

#### 본인 할 일 목록 조회 (성공)
```bash
# 사용자1은 본인 할 일만 조회
curl -X GET http://localhost:3005/todos \
  -H "Authorization: Bearer $USER1_ACCESS_TOKEN"

# 사용자2는 본인 할 일만 조회  
curl -X GET http://localhost:3005/todos \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN"
```

#### 관리자는 모든 할 일 조회 (성공)
```bash
curl -X GET http://localhost:3005/todos \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### 4.2 소유권 검증 테스트

#### 본인 할 일 수정 (성공)
```bash
# 할 일 ID 1이 사용자1의 것이라고 가정
curl -X PATCH http://localhost:3005/todos/1 \
  -H "Authorization: Bearer $USER1_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": 1,
    "title": "수정된 제목"
  }'
```

#### 다른 사용자의 할 일 수정 시도 (실패 - 403)
```bash
# 사용자2가 사용자1의 할 일(ID 1)을 수정하려 할 때
curl -X PATCH http://localhost:3005/todos/1 \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"completed": 1}'
```

**예상 응답:**
```json
{
  "message": "본인의 할 일만 수정할 수 있습니다",
  "code": "ACCESS_DENIED"
}
```

#### 관리자가 모든 할 일 수정 (성공)
```bash
# 관리자는 모든 사용자의 할 일 수정 가능
curl -X PATCH http://localhost:3005/todos/1 \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority": "urgent"}'
```

#### 할 일 삭제 테스트
```bash
# 본인 할 일 삭제 (성공)
curl -X DELETE http://localhost:3005/todos/2 \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN"

# 다른 사용자의 할 일 삭제 시도 (실패 - 403)
curl -X DELETE http://localhost:3005/todos/1 \
  -H "Authorization: Bearer $USER2_ACCESS_TOKEN"
```

---

## 📊 Phase 5: 관리자 통계 및 시스템 관리

### 5.1 시스템 통계 조회 (관리자 전용)

```bash
curl -X GET http://localhost:3005/admin/stats \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

**응답 예시:**
```json
{
  "summary": {
    "totalUsers": 3,
    "activeUsers": 2,
    "totalTodos": 5,
    "completedTodos": 2,
    "completionRate": "40.00%"
  },
  "roleDistribution": [
    { "role": "user", "count": 2 },
    { "role": "admin", "count": 1 }
  ],
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "generatedBy": "System Admin"
}
```

### 5.2 일반 사용자의 통계 접근 시도 (실패)

```bash
curl -X GET http://localhost:3005/admin/stats \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN"
```

**예상 응답:**
```json
{
  "message": "접근 권한이 없습니다",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

---

## ⚡ Phase 6: Rate Limiting 테스트

### 6.1 인증 요청 Rate Limit 테스트

빠르게 연속으로 로그인 시도 (5회 이상):
```bash
# 1-5번째 시도는 정상 처리
for i in {1..6}; do
  echo "시도 $i:"
  curl -X POST http://localhost:3005/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "wrong@example.com",
      "password": "wrongpassword"
    }'
  echo ""
done
```

6번째 시도부터는 다음 응답:
```json
{
  "message": "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
  "code": "AUTH_RATE_LIMIT_EXCEEDED"
}
```

### 6.2 일반 API Rate Limit 테스트

빠르게 연속으로 API 호출 (100회 이상):
```bash
for i in {1..101}; do
  curl -s http://localhost:3005/public/system-info > /dev/null
  if [ $((i % 10)) -eq 0 ]; then
    echo "완료: $i/101"
  fi
done

# 101번째 호출
curl http://localhost:3005/public/system-info
```

101번째 호출부터는 Rate Limit 응답이 나타납니다.

---

## 🔒 Phase 7: 계정 상태 관리 테스트

### 7.1 계정 정지 후 접근 테스트

#### 1단계: 사용자 계정 정지
```bash
# 관리자가 사용자 ID 2를 정지
curl -X PATCH http://localhost:3005/admin/users/2/status \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'
```

#### 2단계: 정지된 계정으로 로그인 시도
```bash
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com",
    "password": "password123"
  }'
```

**예상 응답:**
```json
{
  "message": "정지된 계정입니다",
  "code": "ACCOUNT_SUSPENDED"
}
```

#### 3단계: 기존 토큰으로 API 접근 시도
```bash
# 정지 전에 발급받은 토큰으로 시도
curl -X GET http://localhost:3005/users/me \
  -H "Authorization: Bearer $SUSPENDED_USER_TOKEN"
```

**예상 응답:**
```json
{
  "message": "정지된 계정입니다",
  "code": "ACCOUNT_SUSPENDED"
}
```

### 7.2 계정 복구 테스트

```bash
# 관리자가 계정을 다시 활성화
curl -X PATCH http://localhost:3005/admin/users/2/status \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'

# 복구 후 로그인 테스트
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com", 
    "password": "password123"
  }'
```

---

## 🧪 자동화 테스트 스크립트

### 전체 테스트 자동화 스크립트

```bash
#!/bin/bash

BASE_URL="http://localhost:3005"
echo "🚀 고급 인증/인가 시스템 테스트 시작"

# 1. 시스템 정보 확인
echo "📋 1. 시스템 정보 확인..."
curl -s "$BASE_URL/public/system-info" | jq .name

# 2. 회원가입
echo "📝 2. 회원가입 테스트..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트유저",
    "email": "test@example.com",
    "password": "password123"
  }')

USER_ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .tokens.accessToken)
USER_REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .tokens.refreshToken)

echo "✅ 회원가입 완료, Access Token: ${USER_ACCESS_TOKEN:0:20}..."

# 3. 관리자 로그인
echo "👨‍💼 3. 관리자 로그인..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@system.com",
    "password": "admin123456"
  }')

ADMIN_ACCESS_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r .tokens.accessToken)
echo "✅ 관리자 로그인 완료, Access Token: ${ADMIN_ACCESS_TOKEN:0:20}..."

# 4. 권한 테스트
echo "🔐 4. 권한 테스트..."

# 사용자가 관리자 API 접근 시도 (실패해야 함)
USER_ADMIN_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X GET "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN")

if [ "$USER_ADMIN_RESPONSE" = "403" ]; then
  echo "✅ 권한 제어 정상 작동 (403 Forbidden)"
else
  echo "❌ 권한 제어 오류 (응답 코드: $USER_ADMIN_RESPONSE)"
fi

# 관리자가 사용자 목록 조회 (성공해야 함)
ADMIN_USERS_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X GET "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

if [ "$ADMIN_USERS_RESPONSE" = "200" ]; then
  echo "✅ 관리자 권한 정상 작동 (200 OK)"
else
  echo "❌ 관리자 권한 오류 (응답 코드: $ADMIN_USERS_RESPONSE)"
fi

# 5. 할 일 생성 및 소유권 테스트
echo "📝 5. 할 일 및 소유권 테스트..."

# 할 일 생성
TODO_RESPONSE=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "테스트 할 일",
    "priority": "high"
  }')

TODO_ID=$(echo "$TODO_RESPONSE" | jq -r .todo.id)
echo "✅ 할 일 생성 완료 (ID: $TODO_ID)"

# 6. Refresh Token 테스트
echo "🔄 6. Refresh Token 테스트..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$USER_REFRESH_TOKEN\"}")

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r .tokens.accessToken)

if [ "$NEW_ACCESS_TOKEN" != "null" ] && [ "$NEW_ACCESS_TOKEN" != "" ]; then
  echo "✅ 토큰 갱신 성공, 새 토큰: ${NEW_ACCESS_TOKEN:0:20}..."
else
  echo "❌ 토큰 갱신 실패"
fi

# 7. 통계 조회 테스트
echo "📊 7. 관리자 통계 테스트..."
STATS_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X GET "$BASE_URL/admin/stats" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

if [ "$STATS_RESPONSE" = "200" ]; then
  echo "✅ 통계 조회 성공"
else
  echo "❌ 통계 조회 실패 (응답 코드: $STATS_RESPONSE)"
fi

echo "🎉 테스트 완료!"
```

이 스크립트를 `test.sh`로 저장하고 실행 권한을 부여한 후 실행:
```bash
chmod +x test.sh
./test.sh
```

---

## 📈 성능 및 보안 모니터링

### 응답 시간 측정
```bash
# 각 API의 응답 시간 측정
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3005/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

`curl-format.txt` 파일 내용:
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

### 동시 접속 테스트 (Apache Bench 사용)
```bash
# 동시 접속자 10명, 총 100회 요청
ab -n 100 -c 10 -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:3005/users/me
```

---

## 🔍 디버깅 팁

### 1. 토큰 디코딩 (JWT 내용 확인)
```bash
# JWT 토큰의 payload 부분 디코딩 (온라인 도구 jwt.io 사용 권장)
echo "$ACCESS_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

### 2. 데이터베이스 직접 조회
```bash
# SQLite CLI로 데이터베이스 확인
sqlite3 complete_auth.db

# 사용자 목록 조회
.schema users
SELECT id, name, email, role, status FROM users;

# Refresh Token 상태 확인
SELECT user_id, expires_at, is_revoked FROM refresh_tokens;

# 할 일 목록 조회
SELECT t.id, t.title, t.user_id, u.name as owner FROM todos t 
JOIN users u ON t.user_id = u.id;
```

### 3. 로그 모니터링
서버 실행 시 콘솔에서 실시간으로 로그를 확인하여 인증/인가 과정을 추적할 수 있습니다.

---

이 테스트 가이드를 통해 완전한 인증/인가 시스템의 모든 기능을 체계적으로 검증할 수 있습니다! 🚀