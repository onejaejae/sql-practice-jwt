# JWT 인증 API 테스트 가이드

## 서버 실행

```bash
# JWT 인증 사용자 API (포트 3002)
npm run dev:auth

# JWT 인증 To-Do API (포트 3003) 
npm run dev:auth-todos
```

## 1. 회원가입 테스트

### POST /auth/register
```bash
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "email": "hong@test.com", 
    "password": "123456",
    "age": 25
  }'
```

**응답 예시:**
```json
{
  "message": "회원가입이 완료되었습니다",
  "user": {
    "id": 1,
    "name": "홍길동", 
    "email": "hong@test.com",
    "age": 25
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 2. 로그인 테스트

### POST /auth/login
```bash
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hong@test.com",
    "password": "123456"
  }'
```

**응답에서 토큰을 복사해두세요!**

## 3. 보호된 API 테스트 (JWT 토큰 필요)

### 토큰 사용 방법
헤더에 `Authorization: Bearer <토큰>` 추가

### GET /users/me - 내 정보 조회
```bash
curl -X GET http://localhost:3002/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### PATCH /users/me - 내 정보 수정
```bash
curl -X PATCH http://localhost:3002/users/me \
  -H "Authorization: Bearer <토큰>" \
  -H "Content-Type: application/json" \
  -d '{
    "age": 26
  }'
```

### 비밀번호 변경
```bash
curl -X PATCH http://localhost:3002/users/me \
  -H "Authorization: Bearer <토큰>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "123456",
    "newPassword": "newpass123"
  }'
```

## 4. To-Do API 테스트 (포트 3003)

먼저 포트 3003에서 회원가입/로그인하여 토큰을 발급받으세요.

### 회원가입
```bash
curl -X POST http://localhost:3003/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "김철수",
    "email": "kim@test.com",
    "password": "123456"
  }'
```

### 할 일 추가
```bash
curl -X POST http://localhost:3003/todos \
  -H "Authorization: Bearer <토큰>" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "JWT 인증 공부하기"
  }'
```

### 내 할 일 목록 조회
```bash
curl -X GET http://localhost:3003/todos \
  -H "Authorization: Bearer <토큰>"
```

### 할 일 완료 처리
```bash
curl -X PATCH http://localhost:3003/todos/1 \
  -H "Authorization: Bearer <토큰>" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": 1
  }'
```

### 내 할 일 통계
```bash
curl -X GET http://localhost:3003/todos/stats \
  -H "Authorization: Bearer <토큰>"
```

## 5. 공개 API 테스트 (인증 불필요)

### 전체 사용자 수 조회
```bash
curl -X GET http://localhost:3002/public/users/count
```

### 전체 통계 조회
```bash
curl -X GET http://localhost:3003/public/stats
```

## 6. 오류 상황 테스트

### 잘못된 토큰
```bash
curl -X GET http://localhost:3002/users/me \
  -H "Authorization: Bearer invalid-token"
```

**응답:**
```json
{
  "message": "유효하지 않은 토큰입니다"
}
```

### 토큰 없음
```bash
curl -X GET http://localhost:3002/users/me
```

**응답:**
```json
{
  "message": "액세스 토큰이 필요합니다"
}
```

### 권한 없는 할 일 수정 시도
다른 사용자의 할 일을 수정하려고 할 때:
```json
{
  "message": "할 일을 찾을 수 없거나 수정 권한이 없습니다"
}
```

## 7. Postman 테스트

### Headers 설정
- `Content-Type: application/json`
- `Authorization: Bearer <토큰>`

### Body 설정 (POST/PATCH)
- `raw` 선택
- `JSON` 형식 선택
- JSON 데이터 입력

## 보안 특징

1. **비밀번호 해싱**: bcrypt 사용하여 평문 저장 방지
2. **JWT 토큰**: 서버 세션 없는 상태 비저장 인증
3. **토큰 만료**: 24시간 후 자동 만료
4. **권한 분리**: 본인 데이터만 접근 가능
5. **SQL Injection 방지**: 플레이스홀더 사용

## 데이터베이스 확인

### SQLite CLI로 확인
```bash
# 인증 사용자 DB
sqlite3 auth_users.db
SELECT * FROM users;

# 인증 To-Do DB  
sqlite3 auth_todos.db
SELECT * FROM users;
SELECT * FROM todos;
```

JWT 토큰을 통해 안전하고 확장 가능한 API 인증 시스템이 구현되었습니다!