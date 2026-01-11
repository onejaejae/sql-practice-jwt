# Week 8: MySQL + Sequelize 환경 구성

## 실행 방법

### 1. MySQL 데이터베이스 시작

```bash
npm run docker:up
```

### 2. Sequelize CRUD 서버 실행

```bash
npm run dev:sequelize
```

### 3. 데이터베이스 종료

```bash
npm run docker:down
```

## API 테스트 예시

### 사용자 생성

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "email": "john@example.com", "password": "password123"}'
```

### 할일 생성 (사용자 ID 필요)

```bash
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "첫 번째 할일", "description": "Sequelize로 만든 할일", "userId": 1}'
```

### 사용자와 할일 조회 (JOIN 관계)

```bash
curl http://localhost:3000/users/1
```

### 할일 완료 처리

```bash
curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

## 주요 변화점

1. **SQLite → MySQL**: 파일 기반에서 서버 기반 DB로 전환
2. **Raw SQL → ORM**: `db.run()` 대신 `User.create()` 사용
3. **1:N 관계**: User와 Todo 간의 관계를 Sequelize로 정의
4. **자동 스키마**: Sequelize의 `sync()`로 테이블 자동 생성

## Sequelize 핵심 개념

- **Model**: 데이터베이스 테이블과 매핑되는 클래스
- **Association**: `hasMany()`, `belongsTo()`로 테이블 간 관계 정의
- **Query Methods**:
  - `User.findAll()` → `SELECT * FROM users`
  - `User.create()` → `INSERT INTO users`
  - `User.update()` → `UPDATE users SET ...`
  - `User.destroy()` → `DELETE FROM users`

## 프로젝트 구조

```
├── config/
│   └── database.js     # Sequelize 연결 설정
├── models/
│   ├── index.js        # 모델 관계 정의
│   ├── User.js         # User 모델
│   └── Todo.js         # Todo 모델
└── week8_sequelize_crud.js  # Express 서버
```
