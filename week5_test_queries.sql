-- Week 5: 테스트용 SQL 쿼리들
-- 이 파일은 SQLite CLI나 DB 브라우저에서 실행할 수 있는 테스트 쿼리들을 포함합니다.

-- ================================
-- TODOS 테이블 테스트 쿼리들
-- ================================

-- 1. todos 테이블 생성 (week5_todos.js에서 자동 생성됨)
CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    createdAt TEXT
);

-- 2. 테스트 데이터 삽입
INSERT INTO todos (task, createdAt) VALUES 
('Node.js 공부하기', datetime('now')),
('SQLite 튜토리얼 완주하기', datetime('now')),
('To-Do API 테스트하기', datetime('now')),
('프로젝트 문서 작성하기', datetime('now')),
('코드 리뷰하기', datetime('now'));

-- 3. 모든 할 일 조회
SELECT * FROM todos ORDER BY createdAt DESC;

-- 4. 특정 할 일 조회
SELECT * FROM todos WHERE id = 1;

-- 5. 완료되지 않은 할 일만 조회
SELECT * FROM todos WHERE completed = 0;

-- 6. 완료된 할 일만 조회
SELECT * FROM todos WHERE completed = 1;

-- 7. 할 일 완료 상태 변경
UPDATE todos SET completed = 1 WHERE id = 1;
UPDATE todos SET completed = 1 WHERE id = 3;

-- 8. 특정 할 일 삭제
DELETE FROM todos WHERE id = 5;

-- 9. 할 일 통계 조회
SELECT
    COUNT(*) as total,
    SUM(completed) as completed,
    COUNT(*) - SUM(completed) as pending
FROM todos;

-- 10. 날짜별 생성된 할 일 개수
SELECT 
    DATE(createdAt) as date,
    COUNT(*) as todos_created
FROM todos 
GROUP BY DATE(createdAt)
ORDER BY date DESC;

-- ================================
-- USERS 테이블 테스트 쿼리들
-- ================================

-- 1. users 테이블 생성 (week5_users.js에서 자동 생성됨)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    age INTEGER
);

-- 2. 테스트 데이터 삽입
INSERT INTO users (name, email, age) VALUES 
('김철수', 'kim@test.com', 25),
('이영희', 'lee@example.com', 30),
('박지민', 'park@gmail.com', 28),
('최민수', 'choi@naver.com', 35),
('정수빈', 'jung@daum.net', 22);

-- 3. 모든 사용자 조회
SELECT * FROM users ORDER BY id;

-- 4. 특정 사용자 조회
SELECT * FROM users WHERE id = 1;

-- 5. 이메일로 사용자 검색
SELECT * FROM users WHERE email = 'kim@test.com';

-- 6. 나이 조건으로 사용자 검색
SELECT * FROM users WHERE age >= 30;
SELECT * FROM users WHERE age BETWEEN 25 AND 30;

-- 7. 사용자 정보 수정
UPDATE users SET age = 26 WHERE id = 1;
UPDATE users SET name = '김철수(수정됨)' WHERE email = 'kim@test.com';

-- 8. 특정 사용자 삭제
DELETE FROM users WHERE id = 5;

-- 9. 사용자 통계
SELECT
    COUNT(*) as total_users,
    AVG(age) as average_age,
    MIN(age) as youngest,
    MAX(age) as oldest,
    COUNT(age) as users_with_age
FROM users
WHERE age IS NOT NULL;

-- 10. 이메일 도메인별 사용자 수
SELECT 
    SUBSTR(email, INSTR(email, '@') + 1) as domain,
    COUNT(*) as user_count
FROM users 
GROUP BY SUBSTR(email, INSTR(email, '@') + 1)
ORDER BY user_count DESC;

-- ================================
-- PRODUCTS 테이블 테스트 쿼리들 (Step 3)
-- ================================

-- 1. products 테이블 생성
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
);

-- 2. 상품 데이터 삽입
INSERT INTO products (name, price, stock) VALUES 
('아이폰 14', 120000, 50),
('갤럭시 S23', 110000, 30),
('맥북 프로', 250000, 10),
('아이패드', 80000, 25),
('에어팟 프로', 30000, 100),
('키보드', 8000, 200),
('마우스', 5000, 150);

-- 3. 모든 상품 조회
SELECT * FROM products;

-- 4. 가격이 10000 이상인 상품만 조회
SELECT * FROM products WHERE price >= 10000;

-- 5. 재고가 부족한 상품 (50개 미만)
SELECT * FROM products WHERE stock < 50;

-- 6. 가격별 정렬
SELECT * FROM products ORDER BY price DESC;
SELECT * FROM products ORDER BY price ASC;

-- 7. 특정 상품의 재고 수정
UPDATE products SET stock = 45 WHERE name = '아이폰 14';
UPDATE products SET stock = 35 WHERE id = 2;

-- 8. 특정 상품 삭제
DELETE FROM products WHERE name = '마우스';

-- 9. 상품 통계
SELECT
    COUNT(*) as total_products,
    AVG(price) as average_price,
    MAX(price) as most_expensive,
    MIN(price) as cheapest,
    SUM(stock) as total_inventory
FROM products;

-- 10. 가격대별 상품 분포
SELECT 
    CASE 
        WHEN price < 10000 THEN '1만원 미만'
        WHEN price < 50000 THEN '1만원-5만원'
        WHEN price < 100000 THEN '5만원-10만원'
        WHEN price < 200000 THEN '10만원-20만원'
        ELSE '20만원 이상'
    END as price_range,
    COUNT(*) as product_count
FROM products 
GROUP BY 
    CASE 
        WHEN price < 10000 THEN '1만원 미만'
        WHEN price < 50000 THEN '1만원-5만원'
        WHEN price < 100000 THEN '5만원-10만원'
        WHEN price < 200000 THEN '10만원-20만원'
        ELSE '20만원 이상'
    END
ORDER BY MIN(price);

-- ================================
-- 고급 쿼리 예시들
-- ================================

-- 1. 테이블간 조인이 필요한 경우를 위한 샘플 (관계 설정)
-- 실제 프로젝트에서는 user_id와 함께 todos를 관리할 수 있음

-- 2. 트랜잭션 예시 (SQLite에서 지원)
BEGIN TRANSACTION;
UPDATE products SET stock = stock - 1 WHERE id = 1;
INSERT INTO todos (task, createdAt) VALUES ('상품 주문 처리', datetime('now'));
COMMIT;

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- 4. 뷰(View) 생성 예시
CREATE VIEW IF NOT EXISTS active_todos AS
SELECT id, task, createdAt 
FROM todos 
WHERE completed = 0;

-- 뷰 사용
SELECT * FROM active_todos;

-- 5. 테이블 정보 조회 (SQLite 시스템 테이블)
SELECT name FROM sqlite_master WHERE type='table';
PRAGMA table_info(todos);
PRAGMA table_info(users);
PRAGMA table_info(products);

-- ================================
-- 데이터 정리 쿼리들
-- ================================

-- 모든 테스트 데이터 삭제 (주의: 데이터가 모두 삭제됨)
-- DELETE FROM todos;
-- DELETE FROM users;
-- DELETE FROM products;

-- 테이블 삭제 (주의: 테이블이 완전히 삭제됨)
-- DROP TABLE IF EXISTS todos;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS products;