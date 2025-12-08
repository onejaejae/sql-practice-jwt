# SQL Practice & JWT Authentication Project

SQLite와 Node.js를 활용한 실습 프로젝트입니다. 
기본 SQL 실습부터 JWT 토큰 기반 인증 시스템까지 단계별로 구현되어 있습니다.

## 🎯 프로젝트 목표

- SQLite 데이터베이스 기본 CRUD 작업 학습
- Express.js를 활용한 REST API 개발
- JWT 토큰 기반 인증 시스템 구현
- 보안성 있는 웹 API 설계 및 구현

## 파일 구조

```
sql-practice/
├── package.json                    # Node.js 프로젝트 설정
├── step3_products_queries.sql      # Step 3: Products 테이블 SQL 쿼리
├── week5_todos.js                  # Step 5-1: To-Do 리스트 API
├── week5_users.js                  # Step 5-2: 사용자 관리 API  
├── week5_test_queries.sql          # 테스트용 SQL 쿼리들
├── todos.db                        # To-Do SQLite 데이터베이스 (실행 후 생성)
├── users.db                        # 사용자 SQLite 데이터베이스 (실행 후 생성)
└── README.md                       # 프로젝트 설명서
```

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. To-Do API 서버 실행
```bash
npm run start:todos
# 또는
node week5_todos.js
```
서버 주소: http://localhost:3000

### 3. 사용자 관리 API 서버 실행 (별도 터미널에서)
```bash
npm run start:users
# 또는  
node week5_users.js
```
서버 주소: http://localhost:3001

## API 엔드포인트

### To-Do API (포트 3000)
- `GET /todos` - 모든 할 일 조회
- `GET /todos/:id` - 특정 할 일 조회
- `POST /todos` - 새 할 일 추가
- `PATCH /todos/:id` - 할 일 수정/완료 상태 변경
- `DELETE /todos/:id` - 할 일 삭제
- `GET /todos/stats` - 할 일 통계

#### 예시 요청
```bash
# 새 할 일 추가
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"task": "SQLite 공부하기"}'

# 할 일 완료 처리
curl -X PATCH http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": 1}'
```

### 사용자 관리 API (포트 3001)
- `GET /users` - 모든 사용자 조회
- `GET /users/:id` - 특정 사용자 조회
- `POST /users` - 새 사용자 추가
- `PATCH /users/:id` - 사용자 정보 수정
- `DELETE /users/:id` - 사용자 삭제
- `GET /users/search/:email` - 이메일로 사용자 검색
- `GET /users/stats` - 사용자 통계

#### 예시 요청
```bash
# 새 사용자 추가
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name": "홍길동", "email": "hong@test.com", "age": 25}'

# 사용자 정보 수정
curl -X PATCH http://localhost:3001/users/1 \
  -H "Content-Type: application/json" \
  -d '{"age": 26}'
```

## Step 3: Products 테이블 실습

`step3_products_queries.sql` 파일에는 다음 내용이 포함되어 있습니다:

1. Products 테이블 생성
2. 5개 이상의 상품 데이터 INSERT
3. 가격 조건 조회 쿼리
4. 재고 수정 UPDATE 쿼리  
5. 상품 삭제 DELETE 쿼리

SQLite CLI에서 실행:
```bash
sqlite3 products.db < step3_products_queries.sql
```

## 데이터베이스 직접 조작

### SQLite CLI 사용
```bash
# To-Do 데이터베이스 접속
sqlite3 todos.db

# 사용자 데이터베이스 접속
sqlite3 users.db

# SQL 쿼리 실행 예시
.schema              # 테이블 구조 확인
SELECT * FROM todos; # 모든 할 일 조회
.quit                # 종료
```

### 테스트 쿼리 실행
```bash
sqlite3 todos.db < week5_test_queries.sql
```

## 주요 기능

### 데이터 검증
- **To-Do API**: task 필수 값 검증, 자동 생성 시간
- **사용자 API**: name/email 필수 값, 이메일 형식 검증, 중복 이메일 방지

### 에러 처리
- 400: 잘못된 요청 (필수 값 누락, 형식 오류)
- 404: 리소스를 찾을 수 없음
- 409: 중복 데이터 (이메일 중복)
- 500: 서버 내부 오류

### SQL Injection 방지
모든 쿼리에서 플레이스홀더(?) 사용으로 보안 강화

### 데이터 영속성
SQLite 데이터베이스 파일로 서버 재시작 후에도 데이터 유지

## 개발 시 고려사항

1. **ID 관리**: AUTOINCREMENT 사용으로 자동 ID 생성
2. **데이터 타입**: TEXT, INTEGER 적절한 선택
3. **제약조건**: NOT NULL, UNIQUE 활용으로 데이터 무결성 보장
4. **콜백 패턴**: 비동기 데이터베이스 작업 처리

## Thinking Points (과제에서 제시된 고민거리들)

### ID 자동 생성 vs 직접 지정
- ✅ AUTOINCREMENT 사용: 동시성 문제 해결, 고유성 보장
- ❌ 직접 지정: 중복 가능성, 동시성 문제

### 비밀번호 저장 방식
- ✅ 해싱(bcrypt 등) 사용 권장
- ❌ 평문 저장: 보안 취약점

### 데이터 타입 선택
- 전화번호: TEXT 권장 (국제번호, 형식 유지)
- 숫자: INTEGER (010 → 10으로 변환됨)

### 테이블 설계
- ✅ 정규화된 관계형 설계 (Posts-Comments 분리)
- ❌ 단일 테이블에 모든 데이터 (검색, 수정 어려움)

## 확장 가능한 기능

1. 사용자별 할 일 관리 (Foreign Key 관계)
2. 인증/인가 시스템 (JWT)
3. 페이징 처리
4. 검색 기능 강화
5. 실시간 알림 (WebSocket)