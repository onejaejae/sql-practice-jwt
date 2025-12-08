-- Step 3: Products 테이블 생성 및 기본 SQL 쿼리
-- 1. products 테이블 생성 (id, name, price, stock 컬럼 포함)
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
);

-- 2. 5개 이상의 상품 데이터 INSERT
INSERT INTO products (name, price, stock) VALUES ('아이폰 14', 120000, 50);
INSERT INTO products (name, price, stock) VALUES ('갤럭시 S23', 110000, 30);
INSERT INTO products (name, price, stock) VALUES ('맥북 프로', 250000, 10);
INSERT INTO products (name, price, stock) VALUES ('아이패드', 80000, 25);
INSERT INTO products (name, price, stock) VALUES ('에어팟 프로', 30000, 100);
INSERT INTO products (name, price, stock) VALUES ('키보드', 8000, 200);
INSERT INTO products (name, price, stock) VALUES ('마우스', 5000, 150);

-- 3. 가격이 10000 이상인 상품만 조회하는 SELECT 쿼리
SELECT * FROM products WHERE price >= 10000;

-- 4. 특정 상품의 재고(stock)를 수정하는 UPDATE 쿼리
-- 예: 아이폰 14의 재고를 45개로 수정
UPDATE products SET stock = 45 WHERE name = '아이폰 14';

-- 또는 id를 사용하여 수정
UPDATE products SET stock = 35 WHERE id = 2;

-- 5. 특정 상품을 삭제하는 DELETE 쿼리
-- 예: 마우스 상품 삭제
DELETE FROM products WHERE name = '마우스';

-- 또는 id를 사용하여 삭제
DELETE FROM products WHERE id = 7;

-- 추가 조회 쿼리들
-- 전체 상품 목록 조회
SELECT * FROM products;

-- 가격 기준 내림차순 정렬
SELECT * FROM products ORDER BY price DESC;

-- 재고가 50개 미만인 상품들
SELECT * FROM products WHERE stock < 50;

-- 상품 개수 조회
SELECT COUNT(*) as total_products FROM products;

-- 평균 가격 조회
SELECT AVG(price) as average_price FROM products;