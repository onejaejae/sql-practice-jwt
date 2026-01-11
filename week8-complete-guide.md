# Week 8: RDBMS 전환 및 ORM 도입 완벽 가이드

## 목차

- [Part 1: 왜 MySQL로 전환해야 할까?](#part-1-왜-mysql로-전환해야-할까)
- [Part 2: Docker로 MySQL 쉽게 설치하기](#part-2-docker로-mysql-쉽게-설치하기)
- [Part 3: ORM (Object-Relational Mapping) 이해하기](#part-3-orm-object-relational-mapping-이해하기)
- [Part 4: Sequelize 설정 및 모델 정의](#part-4-sequelize-설정-및-모델-정의)
- [Part 5: CRUD 작업을 Sequelize로](#part-5-crud-작업을-sequelize로)
- [Part 6: 관계형 데이터베이스 - Relationship](#part-6-관계형-데이터베이스---relationship)
- [Part 7: 7주차 인증 시스템 + Sequelize 통합](#part-7-7주차-인증-시스템--sequelize-통합)
- [Part 8: 과제](#part-8-과제)

---

# Part 1: 왜 MySQL로 전환해야 할까?

## 🎯 학습 목표

지금까지 우리는 **SQLite**를 사용해서 데이터베이스를 다뤘습니다. SQLite는 배우기 쉽고 설정이 간단하지만, 실무에서는 대부분 **MySQL**이나 **PostgreSQL** 같은 서버 기반 데이터베이스를 사용합니다. 이번 파트에서는 **왜 전환이 필요한지** 이해합니다.

---

## 1. SQLite vs MySQL 비교

### SQLite: 파일 기반 데이터베이스

```
┌─────────────────────────────────────┐
│           Node.js 서버              │
│  ┌─────────────────────────────┐   │
│  │      SQLite 라이브러리       │   │
│  │  ┌─────────────────────┐   │   │
│  │  │   database.db 파일   │   │   │
│  │  └─────────────────────┘   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

특징:
- 데이터베이스가 하나의 파일로 저장됨
- 별도의 서버 프로세스 없이 직접 파일에 접근
- 설정이 매우 간단 (npm install sqlite3만 하면 끝!)
```

### MySQL: 서버 기반 데이터베이스

```
┌─────────────────┐         ┌─────────────────┐
│  Node.js 서버   │ ◄─────► │   MySQL 서버    │
│                 │  네트워크  │                 │
│  (클라이언트)    │  연결     │  (데이터 저장)   │
└─────────────────┘         └─────────────────┘

특징:
- MySQL이 별도의 프로세스(서버)로 실행됨
- Node.js는 네트워크를 통해 MySQL 서버에 연결
- 여러 애플리케이션이 동시에 접속 가능
```

---

## 2. 상세 비교표

| 구분 | SQLite | MySQL |
|------|--------|-------|
| **구조** | 파일 기반 (`.db` 파일 하나) | 서버 기반 (별도 프로세스) |
| **설치** | npm install만 하면 끝 | 서버 설치 필요 (Docker 추천) |
| **동시 접속** | 제한적 (쓰기 작업 시 Lock) | 수천 개의 동시 연결 지원 |
| **데이터 크기** | 소규모 (수 GB까지) | 대규모 (TB 단위 가능) |
| **성능** | 단일 사용자에겐 빠름 | 다중 사용자 환경에서 우수 |
| **백업** | 파일 복사하면 끝 | mysqldump 등 전용 도구 |
| **실무 사용** | 테스트, 프로토타입, 모바일 앱 | 웹 서비스, 기업 시스템 |

---

## 3. 언제 무엇을 사용할까?

### SQLite를 사용하면 좋은 경우

```javascript
// ✅ SQLite가 적합한 상황

// 1. 개발 및 테스트 환경
// - 빠르게 프로토타입 만들 때
// - 로컬에서 혼자 개발할 때

// 2. 소규모 프로젝트
// - 동시 사용자가 몇 명 안 될 때
// - 데이터가 많지 않을 때 (수천~수만 건)

// 3. 임베디드 시스템
// - 모바일 앱 (Android, iOS)
// - 데스크톱 애플리케이션
```

### MySQL을 사용해야 하는 경우

```javascript
// ✅ MySQL이 필요한 상황

// 1. 실제 서비스 운영
// - 사용자가 동시에 접속하는 웹 서비스
// - 데이터 안정성이 중요한 서비스

// 2. 대규모 데이터
// - 수십만~수억 건의 데이터
// - 복잡한 쿼리와 분석이 필요할 때

// 3. 팀 협업
// - 여러 개발자가 같은 DB를 사용
// - 여러 서버가 하나의 DB에 연결
```

---

## 4. 실무에서 MySQL을 사용하는 이유

### 이유 1: 동시성 처리

```javascript
// SQLite의 한계
// 여러 사용자가 동시에 글을 작성하면?

// 사용자 A: INSERT INTO posts (title) VALUES ('A의 글');
// 사용자 B: INSERT INTO posts (title) VALUES ('B의 글');
// 사용자 C: INSERT INTO posts (title) VALUES ('C의 글');

// SQLite: 한 번에 하나씩만 처리 (나머지는 대기)
// MySQL: 동시에 처리 가능!
```

### 이유 2: 확장성

```
                    SQLite (확장 불가)
                    ┌─────────────────┐
                    │   서버 + DB     │
                    │   (한 덩어리)    │
                    └─────────────────┘

                    MySQL (확장 가능)
┌─────────┐  ┌─────────┐  ┌─────────┐
│ 서버 1  │  │ 서버 2  │  │ 서버 3  │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └────────────┼────────────┘
                  │
           ┌──────┴──────┐
           │  MySQL DB   │
           └─────────────┘

→ 서버만 늘리면 더 많은 사용자 처리 가능!
```

### 이유 3: 안정성과 백업

```javascript
// MySQL의 안정성 기능들

// 1. 트랜잭션 (Transaction)
// - 여러 작업을 하나로 묶어서 처리
// - 중간에 실패하면 전부 취소 (롤백)

// 2. 복제 (Replication)
// - 데이터를 여러 서버에 복사
// - 하나가 죽어도 서비스 계속 가능

// 3. 자동 백업
// - 정기적으로 데이터 백업
// - 문제 발생 시 복구 가능
```

---

## 5. 전환의 좋은 점

```javascript
// 우리가 7주차에 작성한 코드 (SQLite)
db.run("INSERT INTO users (name, email) VALUES (?, ?)",
    [name, email],
    function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, email });
    }
);

// 8주차에 작성할 코드 (Sequelize + MySQL)
const user = await User.create({ name, email });
res.json(user);

// 훨씬 간결하고 읽기 쉬워집니다!
```

---

# Part 2: Docker로 MySQL 쉽게 설치하기

## 🎯 학습 목표

MySQL을 직접 설치하는 것은 복잡하고 환경마다 다릅니다. **Docker**를 사용하면 **한 줄의 명령어**로 MySQL을 실행할 수 있습니다!

---

## 1. Docker란 무엇인가?

### 컨테이너의 개념

Docker를 이해하려면 **컨테이너**를 이해해야 합니다.

```
🚢 실제 세계의 컨테이너
┌─────────────────────────────────────────────────────┐
│  배에 실린 컨테이너들                                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
│  │ 🍎  │ │ 👕  │ │ 📺  │ │ 🚗  │                   │
│  │과일 │ │옷   │ │가전 │ │자동차│                   │
│  └─────┘ └─────┘ └─────┘ └─────┘                   │
│                                                     │
│  각 컨테이너는 독립적으로 포장되어 있음              │
│  어떤 배에 실어도 내용물은 그대로 유지됨             │
└─────────────────────────────────────────────────────┘

💻 소프트웨어 세계의 컨테이너 (Docker)
┌─────────────────────────────────────────────────────┐
│  컴퓨터에서 실행되는 컨테이너들                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ MySQL   │ │ Node.js │ │ Redis   │               │
│  │ 8.0     │ │ 20      │ │ 7.0     │               │
│  └─────────┘ └─────────┘ └─────────┘               │
│                                                     │
│  각 컨테이너는 독립적으로 실행됨                     │
│  어떤 컴퓨터에서도 동일하게 작동함                   │
└─────────────────────────────────────────────────────┘
```

### Docker를 사용하는 이유

```
❌ Docker 없이 MySQL 설치
┌─────────────────────────────────────────────────────┐
│ 1. MySQL 다운로드 사이트 접속                        │
│ 2. 운영체제에 맞는 버전 선택                         │
│ 3. 설치 파일 다운로드                                │
│ 4. 설치 마법사 실행                                  │
│ 5. root 비밀번호 설정                                │
│ 6. 서비스 등록                                       │
│ 7. 환경 변수 설정                                    │
│ 8. 방화벽 설정                                       │
│ ... 30분 ~ 1시간 소요 + 환경마다 다른 문제 발생      │
└─────────────────────────────────────────────────────┘

✅ Docker로 MySQL 설치
┌─────────────────────────────────────────────────────┐
│ $ docker-compose up -d                              │
│                                                     │
│ 끝! (약 1분 소요)                                    │
│                                                     │
│ - Mac, Windows, Linux 모두 동일한 명령어            │
│ - 모두가 같은 버전의 MySQL 사용                      │
│ - 삭제도 간단: docker-compose down                  │
└─────────────────────────────────────────────────────┘
```

### 가상머신 vs Docker

```
가상머신 (Virtual Machine)
┌─────────────────────────────────────────────────────┐
│  내 컴퓨터 (Host OS: Windows/Mac)                   │
│  ┌───────────────────────────────────────────────┐ │
│  │  가상머신 소프트웨어 (VirtualBox, VMware)      │ │
│  │  ┌─────────────────┐ ┌─────────────────┐     │ │
│  │  │  Guest OS       │ │  Guest OS       │     │ │
│  │  │  (Ubuntu)       │ │  (CentOS)       │     │ │
│  │  │  ┌───────────┐ │ │  ┌───────────┐ │     │ │
│  │  │  │  MySQL    │ │ │  │  Node.js  │ │     │ │
│  │  │  └───────────┘ │ │  └───────────┘ │     │ │
│  │  └─────────────────┘ └─────────────────┘     │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
→ 무거움! OS 전체를 가상화 (수 GB)

Docker 컨테이너
┌─────────────────────────────────────────────────────┐
│  내 컴퓨터 (Host OS: Windows/Mac)                   │
│  ┌───────────────────────────────────────────────┐ │
│  │  Docker Engine                                 │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐   │ │
│  │  │  MySQL    │ │  Node.js  │ │  Redis    │   │ │
│  │  │  (컨테이너)│ │  (컨테이너)│ │  (컨테이너)│   │ │
│  │  └───────────┘ └───────────┘ └───────────┘   │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
→ 가벼움! 필요한 것만 포함 (수십 MB)
```

---

## 2. Docker Desktop 설치

### Mac 설치

```bash
# 방법 1: 공식 사이트에서 다운로드
# https://www.docker.com/products/docker-desktop/
# "Download for Mac" 클릭 → DMG 파일 실행 → Applications 폴더로 드래그

# 방법 2: Homebrew 사용 (터미널)
brew install --cask docker
```

### Windows 설치

```bash
# 1. 공식 사이트에서 다운로드
# https://www.docker.com/products/docker-desktop/
# "Download for Windows" 클릭

# 2. 설치 파일 실행
# - WSL 2 (Windows Subsystem for Linux) 설치 필요
# - 설치 중 "Use WSL 2 instead of Hyper-V" 선택

# 3. 컴퓨터 재시작
```

### 설치 확인

```bash
# 터미널에서 다음 명령어 실행
docker --version
# Docker version 24.0.7, build afdd53b

docker-compose --version
# Docker Compose version v2.23.0
```

---

## 3. docker-compose.yml 이해하기

프로젝트에 이미 `docker-compose.yml` 파일이 있습니다. 하나씩 살펴봅시다.

```yaml
# docker-compose.yml

version: '3.8'  # docker-compose 파일 형식 버전

services:       # 실행할 컨테이너들 정의
  mysql:        # 서비스 이름 (우리가 정한 이름)
    image: mysql:8.0  # 사용할 이미지와 버전
    container_name: sql-practice-mysql  # 컨테이너 이름
    restart: unless-stopped  # 종료되면 자동 재시작

    environment:  # 환경 변수 설정
      MYSQL_ROOT_PASSWORD: rootpassword   # root 계정 비밀번호
      MYSQL_DATABASE: sql_practice        # 자동 생성할 DB 이름
      MYSQL_USER: sqluser                 # 일반 사용자 이름
      MYSQL_PASSWORD: sqlpassword         # 일반 사용자 비밀번호

    ports:
      - "3306:3306"  # 호스트포트:컨테이너포트 매핑

    volumes:
      - mysql_data:/var/lib/mysql  # 데이터 영구 저장
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql  # 초기화 SQL

    command: --default-authentication-plugin=mysql_native_password

volumes:
  mysql_data:  # 볼륨 정의 (데이터 영구 저장용)
```

### 주요 설정 설명

```
┌─────────────────────────────────────────────────────┐
│  ports: "3306:3306"                                 │
│                                                     │
│  ┌─────────────┐        ┌─────────────────────┐   │
│  │ 내 컴퓨터   │        │   Docker 컨테이너   │   │
│  │             │        │                     │   │
│  │ localhost   │◄──────►│   MySQL 서버       │   │
│  │ :3306       │  포트  │   :3306            │   │
│  │             │  연결  │                     │   │
│  └─────────────┘        └─────────────────────┘   │
│                                                     │
│  Node.js에서 localhost:3306으로 접속하면            │
│  Docker 안의 MySQL 서버로 연결됨!                   │
└─────────────────────────────────────────────────────┘
```

---

## 4. MySQL 컨테이너 실행하기

### 컨테이너 시작

```bash
# 프로젝트 폴더에서 실행
cd /path/to/sql-practice

# 컨테이너 시작 (-d는 백그라운드 실행)
docker-compose up -d

# 출력 예시:
# [+] Running 2/2
#  ✔ Network sql-practice_default  Created
#  ✔ Container sql-practice-mysql  Started
```

### 컨테이너 상태 확인

```bash
# 실행 중인 컨테이너 확인
docker ps

# 출력 예시:
# CONTAINER ID   IMAGE       STATUS          PORTS                    NAMES
# a1b2c3d4e5f6   mysql:8.0   Up 2 minutes    0.0.0.0:3306->3306/tcp   sql-practice-mysql

# 컨테이너 로그 확인 (문제 발생 시 유용)
docker logs sql-practice-mysql
```

### MySQL 접속 테스트

```bash
# 방법 1: Docker 내부에서 MySQL 클라이언트 실행
docker exec -it sql-practice-mysql mysql -u sqluser -p
# 비밀번호 입력: sqlpassword

# MySQL 프롬프트가 나타나면 성공!
mysql> SHOW DATABASES;
# +--------------------+
# | Database           |
# +--------------------+
# | sql_practice       |
# | information_schema |
# +--------------------+

mysql> exit
```

### 자주 사용하는 Docker 명령어

```bash
# 컨테이너 시작
docker-compose up -d

# 컨테이너 중지
docker-compose down

# 컨테이너 + 데이터 삭제 (주의!)
docker-compose down -v

# 컨테이너 재시작
docker-compose restart

# 실행 중인 컨테이너 확인
docker ps

# 모든 컨테이너 확인 (중지된 것 포함)
docker ps -a

# 컨테이너 로그 보기
docker logs sql-practice-mysql

# 실시간 로그 보기
docker logs -f sql-practice-mysql
```

---

## 5. 연결 테스트 (Node.js에서)

Docker에서 MySQL이 실행되고 있으니, Node.js에서 연결해봅시다.

```javascript
// test-connection.js
const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        // MySQL 연결
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'sqluser',
            password: 'sqlpassword',
            database: 'sql_practice'
        });

        console.log('✅ MySQL 연결 성공!');

        // 테스트 쿼리 실행
        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('테스트 쿼리 결과:', rows[0].result); // 2

        // 연결 종료
        await connection.end();
        console.log('연결 종료');

    } catch (error) {
        console.error('❌ MySQL 연결 실패:', error.message);
    }
}

testConnection();
```

```bash
# 실행
node test-connection.js

# 출력:
# ✅ MySQL 연결 성공!
# 테스트 쿼리 결과: 2
# 연결 종료
```

---

## 6. 흔한 문제 해결

### 문제 1: 포트 충돌

```bash
# 에러 메시지
Error: Bind for 0.0.0.0:3306 failed: port is already allocated

# 해결: 이미 3306 포트를 사용 중
# 방법 1: 기존 MySQL 서비스 중지
# 방법 2: docker-compose.yml에서 포트 변경
ports:
  - "3307:3306"  # 3307로 변경
```

### 문제 2: 컨테이너가 시작되지 않음

```bash
# 로그 확인
docker logs sql-practice-mysql

# 흔한 원인: 이전 데이터와 충돌
# 해결: 볼륨 삭제 후 재시작
docker-compose down -v
docker-compose up -d
```

### 문제 3: Node.js에서 연결 실패

```javascript
// 에러: ECONNREFUSED (연결 거부)
// 원인: MySQL 서버가 아직 준비 안 됨

// 해결: MySQL 컨테이너가 완전히 시작될 때까지 대기 (약 30초)
// 또는 재시도 로직 추가

async function connectWithRetry(maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const connection = await mysql.createConnection({...});
            console.log('연결 성공!');
            return connection;
        } catch (error) {
            console.log(`연결 시도 ${i + 1}/${maxRetries} 실패, 재시도 중...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    throw new Error('MySQL 연결 실패');
}
```

---

## 📝 Part 1~2 정리

### 배운 내용

1. **SQLite vs MySQL**
   - SQLite: 파일 기반, 간단, 소규모 프로젝트용
   - MySQL: 서버 기반, 확장성, 실무 서비스용

2. **Docker**
   - 컨테이너: 격리된 실행 환경
   - 장점: 설치 간편, 환경 통일, 쉬운 관리

3. **docker-compose**
   - 여러 컨테이너를 쉽게 관리
   - `docker-compose up -d`로 시작
   - `docker-compose down`으로 종료

### 다음 파트 예고

Part 3에서는 **ORM (Sequelize)**를 도입해서, SQL 쿼리 대신 JavaScript 코드로 데이터베이스를 다루는 방법을 배웁니다!

---

# Part 3: ORM (Object-Relational Mapping) 이해하기

## 🎯 학습 목표

지금까지 우리는 SQL 쿼리를 직접 문자열로 작성했습니다. 이번 파트에서는 **ORM**을 사용해서 **JavaScript 객체**로 데이터베이스를 다루는 방법을 배웁니다.

---

## 1. ORM이란?

### 기본 개념

**ORM (Object-Relational Mapping)**은 **객체(Object)**와 **관계형 데이터베이스(Relational Database)**를 연결해주는 기술입니다.

```
┌─────────────────────────────────────────────────────┐
│  JavaScript 세계              데이터베이스 세계      │
│                                                     │
│  ┌─────────────────┐         ┌─────────────────┐   │
│  │  User 객체      │  ◄───►  │  users 테이블   │   │
│  │  {              │   ORM   │  ┌───┬─────┐   │   │
│  │    id: 1,       │  변환   │  │id │name │   │   │
│  │    name: "홍길동"│         │  ├───┼─────┤   │   │
│  │  }              │         │  │1  │홍길동│   │   │
│  └─────────────────┘         │  └───┴─────┘   │   │
│                               └─────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### SQL 직접 작성 vs ORM 사용

```javascript
// ❌ 기존 방식: SQL 직접 작성
db.run(
    "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
    [name, email, age],
    function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, email, age });
    }
);

// ✅ ORM 방식: JavaScript 메서드 사용
const user = await User.create({ name, email, age });
res.json(user);
```

---

## 2. SQL vs Sequelize 비교표

| 작업 | SQL | Sequelize |
|------|-----|-----------|
| 전체 조회 | `SELECT * FROM users` | `User.findAll()` |
| 조건 조회 | `SELECT * FROM users WHERE id = 1` | `User.findByPk(1)` |
| 검색 | `SELECT * FROM users WHERE name = '홍길동'` | `User.findOne({ where: { name: '홍길동' }})` |
| 생성 | `INSERT INTO users (name) VALUES ('홍길동')` | `User.create({ name: '홍길동' })` |
| 수정 | `UPDATE users SET name = '김철수' WHERE id = 1` | `User.update({ name: '김철수' }, { where: { id: 1 }})` |
| 삭제 | `DELETE FROM users WHERE id = 1` | `User.destroy({ where: { id: 1 }})` |

---

## 3. ORM의 장점과 단점

### 장점

```javascript
// 1. 코드 가독성 향상
// SQL 버전 - 읽기 어려움
const query = `
    SELECT u.*, COUNT(t.id) as todo_count
    FROM users u
    LEFT JOIN todos t ON u.id = t.user_id
    WHERE u.role = 'USER'
    GROUP BY u.id
`;

// ORM 버전 - 직관적
const users = await User.findAll({
    where: { role: 'USER' },
    include: [{ model: Todo, as: 'todos' }]
});

// 2. SQL Injection 방지
// SQL 버전 - 취약할 수 있음
const query = `SELECT * FROM users WHERE email = '${email}'`;  // 위험!

// ORM 버전 - 자동으로 안전하게 처리
const user = await User.findOne({ where: { email } });  // 안전!

// 3. 데이터베이스 독립성
// MySQL, PostgreSQL, SQLite 등을 코드 변경 없이 전환 가능
```

### 단점

```javascript
// 1. 학습 곡선
// - ORM 문법을 별도로 배워야 함
// - 복잡한 쿼리는 ORM으로 표현하기 어려울 수 있음

// 2. 성능
// - 복잡한 쿼리의 경우 최적화된 SQL보다 느릴 수 있음
// - N+1 문제 등 주의 필요

// 3. 추상화의 한계
// - 매우 복잡한 쿼리는 Raw SQL을 사용해야 할 수 있음
const [results] = await sequelize.query('복잡한 SQL...');
```

---

## 4. Sequelize 소개

**Sequelize**는 Node.js에서 가장 많이 사용되는 ORM입니다.

```javascript
// 지원하는 데이터베이스
// - MySQL
// - PostgreSQL
// - SQLite
// - MariaDB
// - Microsoft SQL Server

// 주요 기능
// - 모델 정의 및 관계 설정
// - CRUD 작업
// - 마이그레이션
// - 유효성 검증
// - 트랜잭션
```

---

# Part 4: Sequelize 설정 및 모델 정의

## 1. 프로젝트 설정

### 필요한 패키지 설치

```bash
# Sequelize 핵심 패키지
npm install sequelize

# MySQL 드라이버
npm install mysql2
```

### 프로젝트 구조

```
sql-practice/
├── config/
│   └── database.js      # DB 연결 설정
├── models/
│   ├── index.js         # 모델 통합 및 관계 설정
│   ├── User.js          # User 모델
│   └── Todo.js          # Todo 모델
├── week8_sequelize_crud.js  # 메인 서버 파일
└── docker-compose.yml   # MySQL 컨테이너 설정
```

---

## 2. 데이터베이스 연결 설정

```javascript
// config/database.js
const { Sequelize } = require('sequelize');

// Sequelize 인스턴스 생성
const sequelize = new Sequelize(
    'sql_practice',    // 데이터베이스 이름
    'sqluser',         // 사용자 이름
    'sqlpassword',     // 비밀번호
    {
        host: 'localhost',   // MySQL 서버 주소
        port: 3306,          // 포트 번호
        dialect: 'mysql',    // 사용할 DB 종류

        // 로깅 설정 (개발 중에는 true로)
        logging: console.log,

        // 타임스탬프 컬럼 설정
        define: {
            timestamps: true,      // createdAt, updatedAt 자동 생성
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
        },

        // 커넥션 풀 설정
        pool: {
            max: 5,        // 최대 연결 수
            min: 0,        // 최소 연결 수
            acquire: 30000, // 연결 획득 타임아웃 (ms)
            idle: 10000    // 유휴 연결 타임아웃 (ms)
        }
    }
);

// 연결 테스트 함수
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL 데이터베이스 연결 성공!');
        return sequelize;
    } catch (error) {
        console.error('❌ 데이터베이스 연결 실패:', error);
        throw error;
    }
};

module.exports = { sequelize, connectDB };
```

---

## 3. DataTypes 종류

Sequelize에서 사용할 수 있는 데이터 타입들입니다.

```javascript
const { DataTypes } = require('sequelize');

// 문자열 타입
DataTypes.STRING         // VARCHAR(255)
DataTypes.STRING(100)    // VARCHAR(100)
DataTypes.TEXT           // TEXT (긴 문자열)
DataTypes.CHAR(10)       // CHAR(10) (고정 길이)

// 숫자 타입
DataTypes.INTEGER        // INTEGER
DataTypes.BIGINT         // BIGINT
DataTypes.FLOAT          // FLOAT
DataTypes.DOUBLE         // DOUBLE
DataTypes.DECIMAL(10, 2) // DECIMAL(10, 2)

// 불리언
DataTypes.BOOLEAN        // TINYINT(1)

// 날짜/시간
DataTypes.DATE           // DATETIME
DataTypes.DATEONLY       // DATE (날짜만)
DataTypes.TIME           // TIME (시간만)

// 기타
DataTypes.JSON           // JSON
DataTypes.UUID           // UUID
DataTypes.ENUM('A', 'B') // ENUM
```

---

## 4. User 모델 정의

```javascript
// models/User.js
const { DataTypes } = require('sequelize');

// 모델을 함수로 내보내기 (sequelize 인스턴스를 받음)
const User = (sequelize) => {
    return sequelize.define('User', {
        // 컬럼 정의
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,           // 기본키
            autoIncrement: true         // 자동 증가
        },
        username: {
            type: DataTypes.STRING(100),
            allowNull: false,           // NOT NULL
            unique: true,               // UNIQUE 제약조건
            validate: {
                notEmpty: true,         // 빈 문자열 불가
                len: [2, 100]           // 길이 제한
            }
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true           // 이메일 형식 검증
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                len: [6, 255]           // 최소 6자
            }
        }
    }, {
        // 모델 옵션
        tableName: 'users',             // 실제 테이블 이름
        timestamps: true                // createdAt, updatedAt 자동 관리
    });
};

module.exports = User;
```

---

## 5. Todo 모델 정의

```javascript
// models/Todo.js
const { DataTypes } = require('sequelize');

const Todo = (sequelize) => {
    return sequelize.define('Todo', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: '제목은 비워둘 수 없습니다'  // 커스텀 에러 메시지
                }
            }
        },
        description: {
            type: DataTypes.TEXT,       // 긴 텍스트
            allowNull: true             // NULL 허용
        },
        completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false         // 기본값
        }
        // userId는 관계 설정 시 자동으로 추가됨
    }, {
        tableName: 'todos',
        timestamps: true
    });
};

module.exports = Todo;
```

---

## 6. 모델 통합 및 관계 설정

```javascript
// models/index.js
const { sequelize } = require('../config/database');
const UserModel = require('./User');
const TodoModel = require('./Todo');

// 모델 초기화
const User = UserModel(sequelize);
const Todo = TodoModel(sequelize);

// 관계 설정: User(1) : Todo(N)
// 한 사용자가 여러 개의 할 일을 가질 수 있음

// User 입장: "나는 여러 개의 Todo를 가지고 있다"
User.hasMany(Todo, {
    foreignKey: 'userId',   // Todo 테이블에 userId 컬럼 생성
    as: 'todos'             // User.getTodos() 메서드 생성
});

// Todo 입장: "나는 한 명의 User에게 속한다"
Todo.belongsTo(User, {
    foreignKey: 'userId',   // 외래키 이름
    as: 'user'              // Todo.getUser() 메서드 생성
});

// 데이터베이스 동기화 함수
const syncDatabase = async () => {
    try {
        // force: false - 테이블이 있으면 그대로 유지
        // force: true - 테이블 삭제 후 재생성 (주의!)
        await sequelize.sync({ force: false });
        console.log('✅ 데이터베이스 테이블 동기화 완료!');
    } catch (error) {
        console.error('❌ 데이터베이스 동기화 실패:', error);
        throw error;
    }
};

module.exports = {
    sequelize,
    User,
    Todo,
    syncDatabase
};
```

---

# Part 5: CRUD 작업을 Sequelize로

## 1. Create (생성)

### 단일 레코드 생성

```javascript
// SQL: INSERT INTO users (username, email, password) VALUES (?, ?, ?)
const user = await User.create({
    username: '홍길동',
    email: 'hong@test.com',
    password: 'password123'
});

console.log(user.id);        // 자동 생성된 ID
console.log(user.username);  // '홍길동'
console.log(user.toJSON());  // 전체 데이터를 객체로
```

### 여러 레코드 한 번에 생성

```javascript
// SQL: INSERT INTO users ... VALUES (...), (...), (...)
const users = await User.bulkCreate([
    { username: '사용자1', email: 'user1@test.com', password: 'pass1' },
    { username: '사용자2', email: 'user2@test.com', password: 'pass2' },
    { username: '사용자3', email: 'user3@test.com', password: 'pass3' }
]);

console.log(`${users.length}명의 사용자가 생성되었습니다`);
```

---

## 2. Read (조회)

### 전체 조회 - findAll()

```javascript
// SQL: SELECT * FROM users
const users = await User.findAll();

// 조건 추가
// SQL: SELECT * FROM users WHERE role = 'USER'
const normalUsers = await User.findAll({
    where: { role: 'USER' }
});

// 정렬 추가
// SQL: SELECT * FROM users ORDER BY createdAt DESC
const sortedUsers = await User.findAll({
    order: [['createdAt', 'DESC']]
});

// 특정 컬럼만 선택
// SQL: SELECT id, username, email FROM users
const partialUsers = await User.findAll({
    attributes: ['id', 'username', 'email']
});
```

### 단일 조회 - findByPk(), findOne()

```javascript
// Primary Key로 조회
// SQL: SELECT * FROM users WHERE id = 1
const user = await User.findByPk(1);

// 조건으로 단일 조회
// SQL: SELECT * FROM users WHERE email = 'hong@test.com' LIMIT 1
const userByEmail = await User.findOne({
    where: { email: 'hong@test.com' }
});

// 없으면 null 반환
if (!user) {
    return res.status(404).json({ error: 'User not found' });
}
```

### 복잡한 조건 사용

```javascript
const { Op } = require('sequelize');

// OR 조건
// SQL: WHERE email = 'a@test.com' OR email = 'b@test.com'
const users = await User.findAll({
    where: {
        [Op.or]: [
            { email: 'a@test.com' },
            { email: 'b@test.com' }
        ]
    }
});

// LIKE 검색
// SQL: WHERE username LIKE '%홍%'
const searchUsers = await User.findAll({
    where: {
        username: { [Op.like]: '%홍%' }
    }
});

// 범위 검색
// SQL: WHERE age BETWEEN 20 AND 30
const ageRangeUsers = await User.findAll({
    where: {
        age: { [Op.between]: [20, 30] }
    }
});
```

---

## 3. Update (수정)

### Model.update() 사용

```javascript
// SQL: UPDATE users SET username = '김철수' WHERE id = 1
const [updatedCount] = await User.update(
    { username: '김철수' },           // 수정할 데이터
    { where: { id: 1 } }              // 조건
);

console.log(`${updatedCount}개의 레코드가 수정되었습니다`);

// 수정된 데이터 조회
const updatedUser = await User.findByPk(1);
```

### 인스턴스에서 직접 수정

```javascript
// 먼저 조회
const user = await User.findByPk(1);

if (user) {
    // 속성 변경
    user.username = '새로운이름';
    user.email = 'new@test.com';

    // 저장
    await user.save();

    console.log('수정 완료:', user.toJSON());
}
```

---

## 4. Delete (삭제)

### Model.destroy() 사용

```javascript
// SQL: DELETE FROM users WHERE id = 1
const deletedCount = await User.destroy({
    where: { id: 1 }
});

if (deletedCount === 0) {
    return res.status(404).json({ error: 'User not found' });
}

console.log(`${deletedCount}개의 레코드가 삭제되었습니다`);
```

### 인스턴스에서 직접 삭제

```javascript
const user = await User.findByPk(1);

if (user) {
    await user.destroy();
    console.log('사용자가 삭제되었습니다');
}
```

---

## 5. 에러 처리

Sequelize는 특정 상황에서 특별한 에러를 발생시킵니다.

```javascript
app.post('/users', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const newUser = await User.create({
            username,
            email,
            password
        });

        res.status(201).json(newUser);

    } catch (error) {
        // Unique 제약조건 위반
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                error: 'Username or email already exists',
                details: error.errors.map(e => e.message)
            });
        }

        // 유효성 검증 실패
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors.map(e => e.message)
            });
        }

        // 기타 에러
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

---

## 📝 Part 3~5 정리

### 배운 내용

1. **ORM 개념**
   - 객체와 데이터베이스 테이블을 매핑
   - SQL 대신 JavaScript 메서드 사용

2. **Sequelize 설정**
   - 데이터베이스 연결 (config/database.js)
   - 모델 정의 (models/*.js)
   - DataTypes 사용법

3. **CRUD 작업**
   - Create: `Model.create()`
   - Read: `findAll()`, `findByPk()`, `findOne()`
   - Update: `Model.update()`, `instance.save()`
   - Delete: `Model.destroy()`, `instance.destroy()`

### 다음 파트 예고

Part 6에서는 **관계(Relationship)**를 자세히 다룹니다. User와 Todo가 어떻게 연결되고, 관련 데이터를 함께 조회하는 방법을 배웁니다!

---

# Part 6: 관계형 데이터베이스 - Relationship

## 🎯 학습 목표

관계형 데이터베이스의 **핵심**은 테이블 간의 **관계(Relationship)**입니다. 이번 파트에서는 User와 Todo의 **1:N 관계**를 설정하고, **JOIN**을 통해 관련 데이터를 함께 조회하는 방법을 배웁니다.

---

## 1. 관계의 종류

### 1:1 (One-to-One) 관계

```
┌─────────────┐         ┌─────────────┐
│    User     │ ◄─────► │   Profile   │
│  (사용자)    │   1:1   │   (프로필)   │
└─────────────┘         └─────────────┘

예시: 한 사용자는 하나의 프로필만 가질 수 있음
```

### 1:N (One-to-Many) 관계 ← 이번 주 핵심!

```
┌─────────────┐         ┌─────────────┐
│    User     │ ◄─────► │    Todo     │
│  (사용자)    │   1:N   │   (할 일)   │
└─────────────┘         └─────────────┘

예시: 한 사용자는 여러 개의 할 일을 가질 수 있음
      하지만 각 할 일은 한 명의 사용자에게만 속함
```

### N:M (Many-to-Many) 관계

```
┌─────────────┐         ┌─────────────┐
│   Student   │ ◄─────► │   Course    │
│   (학생)    │   N:M   │   (수업)    │
└─────────────┘         └─────────────┘

예시: 한 학생이 여러 수업을 들을 수 있고
      한 수업에 여러 학생이 있을 수 있음
```

---

## 2. User와 Todo의 1:N 관계

### 관계 시각화

```
┌──────────────────────────────────────────────────────┐
│  User (사용자)                                        │
│  ┌─────┬──────────┬─────────────────┐               │
│  │ id  │ username │ email           │               │
│  ├─────┼──────────┼─────────────────┤               │
│  │ 1   │ 홍길동    │ hong@test.com   │               │
│  │ 2   │ 김철수    │ kim@test.com    │               │
│  └─────┴──────────┴─────────────────┘               │
│                                                      │
│  Todo (할 일)                                         │
│  ┌─────┬────────────────┬───────────┬─────────────┐ │
│  │ id  │ title          │ completed │ userId (FK) │ │
│  ├─────┼────────────────┼───────────┼─────────────┤ │
│  │ 1   │ Node.js 공부    │ false     │ 1           │ │
│  │ 2   │ Docker 배우기   │ true      │ 1           │ │
│  │ 3   │ React 학습      │ false     │ 2           │ │
│  └─────┴────────────────┴───────────┴─────────────┘ │
│                                                      │
│  userId 1 (홍길동) → Todo 1, 2                       │
│  userId 2 (김철수) → Todo 3                          │
└──────────────────────────────────────────────────────┘
```

### Foreign Key (외래키) 이해

```javascript
// Foreign Key (FK)란?
// 다른 테이블의 Primary Key를 참조하는 컬럼

// Todo 테이블의 userId는 User 테이블의 id를 참조
// 이를 통해 "이 할 일이 어떤 사용자의 것인지" 알 수 있음

// SQL로 표현하면:
/*
CREATE TABLE todos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255),
    completed BOOLEAN,
    userId INT,
    FOREIGN KEY (userId) REFERENCES users(id)
);
*/
```

---

## 3. Sequelize에서 관계 설정

### hasMany / belongsTo

```javascript
// models/index.js

// 1. User가 여러 Todo를 "가진다" (has many)
User.hasMany(Todo, {
    foreignKey: 'userId',   // Todo 테이블에 생성될 FK 컬럼명
    as: 'todos',            // 관계의 별칭 (User.getTodos() 사용 가능)
    onDelete: 'CASCADE'     // User 삭제 시 관련 Todo도 삭제
});

// 2. Todo가 User에 "속한다" (belongs to)
Todo.belongsTo(User, {
    foreignKey: 'userId',   // 외래키 컬럼명
    as: 'user'              // 관계의 별칭 (Todo.getUser() 사용 가능)
});
```

### 양방향 관계 설정의 의미

```javascript
// hasMany: User → Todo 방향 (1 → N)
// "사용자가 할 일들을 조회할 때 사용"
const user = await User.findByPk(1);
const todos = await user.getTodos();  // 이 사용자의 모든 할 일

// belongsTo: Todo → User 방향 (N → 1)
// "할 일이 속한 사용자를 조회할 때 사용"
const todo = await Todo.findByPk(1);
const owner = await todo.getUser();   // 이 할 일의 소유자
```

---

## 4. JOIN이란?

### SQL JOIN 개념

```sql
-- 기존 방식: 두 번의 쿼리
SELECT * FROM users WHERE id = 1;        -- 사용자 조회
SELECT * FROM todos WHERE userId = 1;    -- 할 일 조회

-- JOIN 방식: 한 번의 쿼리로 관련 데이터 함께 조회
SELECT users.*, todos.*
FROM users
LEFT JOIN todos ON users.id = todos.userId
WHERE users.id = 1;
```

### JOIN 종류

```
INNER JOIN: 양쪽 테이블에 모두 있는 데이터만
┌────────┐     ┌────────┐
│ User   │     │ Todo   │
│   ┌────┼─────┼────┐   │
│   │    │     │    │   │   ← 이 부분만 결과에 포함
│   └────┼─────┼────┘   │
└────────┘     └────────┘

LEFT JOIN: 왼쪽 테이블의 모든 데이터 + 매칭되는 오른쪽 데이터
┌────────┬────────────────┐
│ User   │ Todo (있으면)  │
│ 전체   │ 매칭되는 것만  │
└────────┴────────────────┘
→ Todo가 없는 User도 결과에 포함 (Todo 컬럼은 NULL)
```

---

## 5. Sequelize의 include 옵션

### 기본 사용법

```javascript
// User 조회 시 관련 Todo들 함께 가져오기
const user = await User.findByPk(1, {
    include: [{
        model: Todo,
        as: 'todos'  // 관계 설정 시 지정한 별칭
    }]
});

// 결과:
// {
//     id: 1,
//     username: '홍길동',
//     email: 'hong@test.com',
//     todos: [
//         { id: 1, title: 'Node.js 공부', completed: false },
//         { id: 2, title: 'Docker 배우기', completed: true }
//     ]
// }
```

### 모든 User와 각자의 Todo들 조회

```javascript
// SQL: SELECT * FROM users LEFT JOIN todos ON ...
const users = await User.findAll({
    include: [{
        model: Todo,
        as: 'todos'
    }]
});

// 결과: 각 사용자별로 할 일 목록이 포함됨
users.forEach(user => {
    console.log(`${user.username}의 할 일:`);
    user.todos.forEach(todo => {
        console.log(`  - ${todo.title}`);
    });
});
```

### Todo 조회 시 소유자 정보 포함

```javascript
// Todo를 조회하면서 소유자 정보 함께 가져오기
const todos = await Todo.findAll({
    include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email']  // 특정 컬럼만
    }]
});

// 결과:
// {
//     id: 1,
//     title: 'Node.js 공부',
//     completed: false,
//     user: {
//         id: 1,
//         username: '홍길동',
//         email: 'hong@test.com'
//     }
// }
```

---

## 6. 관계를 활용한 API 구현

### 사용자의 할 일 목록 조회

```javascript
// GET /users/:id/todos
app.get('/users/:id/todos', async (req, res) => {
    try {
        // 사용자 존재 확인
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 해당 사용자의 할 일 조회
        const todos = await Todo.findAll({
            where: { userId: req.params.id },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'email']
            }]
        });

        res.json(todos);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch user todos' });
    }
});
```

### 사용자 정보와 할 일 함께 조회

```javascript
// GET /users/:id (할 일 포함)
app.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            include: [{
                model: Todo,
                as: 'todos'
            }]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
```

### 특정 사용자에게 할 일 추가

```javascript
// POST /todos
app.post('/todos', async (req, res) => {
    try {
        const { title, description, userId } = req.body;

        // 사용자 존재 확인
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 할 일 생성 (userId 연결)
        const newTodo = await Todo.create({
            title,
            description,
            userId  // Foreign Key
        });

        // 사용자 정보 포함하여 반환
        const todoWithUser = await Todo.findByPk(newTodo.id, {
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'email']
            }]
        });

        res.status(201).json(todoWithUser);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to create todo' });
    }
});
```

---

## 7. N+1 문제와 해결

### N+1 문제란?

```javascript
// ❌ N+1 문제 발생 코드
const users = await User.findAll();  // 1번의 쿼리

for (const user of users) {
    const todos = await user.getTodos();  // N번의 쿼리!
    console.log(user.username, todos.length);
}

// 사용자가 100명이면: 1 + 100 = 101번의 쿼리 실행!
```

### 해결: include 사용 (Eager Loading)

```javascript
// ✅ include로 한 번에 조회
const users = await User.findAll({
    include: [{
        model: Todo,
        as: 'todos'
    }]
});  // 1~2번의 쿼리로 해결

users.forEach(user => {
    console.log(user.username, user.todos.length);
});
```

---

## 📝 Part 6 정리

### 배운 내용

1. **관계의 종류**
   - 1:1, 1:N, N:M 관계
   - User-Todo는 1:N 관계

2. **Sequelize 관계 설정**
   - `hasMany`: 1쪽에서 N쪽을 참조
   - `belongsTo`: N쪽에서 1쪽을 참조

3. **JOIN과 include**
   - `include` 옵션으로 관련 데이터 함께 조회
   - N+1 문제 해결

### 다음 파트 예고

Part 7에서는 **7주차 인증 시스템을 Sequelize로 전환**합니다. SQLite 기반 코드를 MySQL + Sequelize로 업그레이드합니다!

---

# Part 7: 7주차 인증 시스템 + Sequelize 통합

## 🎯 학습 목표

7주차에서 SQLite로 구현한 인증/인가 시스템을 **MySQL + Sequelize**로 전환합니다. 기존 코드의 구조는 유지하면서 데이터베이스 계층만 교체합니다.

---

## 1. 기존 SQLite 코드 분석

### 7주차 구조 (week7_simple_auth.js)

```javascript
// 기존 SQLite 방식
const Database = require('./utils/database');
const db = new Database('simple_auth.db');

// 테이블 생성 (Raw SQL)
await db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// 사용자 조회 (Raw SQL)
const user = await db.get(
    "SELECT * FROM users WHERE email = ?",
    [email]
);

// 사용자 생성 (Raw SQL)
const result = await db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name, email, hashedPassword, "USER"]
);
```

---

## 2. Sequelize 모델로 전환

### User 모델 (인증용 확장)

```javascript
// models/AuthUser.js
const { DataTypes } = require('sequelize');

const AuthUser = (sequelize) => {
    return sequelize.define('AuthUser', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('USER', 'ADMIN'),
            defaultValue: 'USER'
        }
    }, {
        tableName: 'auth_users',
        timestamps: true
    });
};

module.exports = AuthUser;
```

### RefreshToken 모델

```javascript
// models/RefreshToken.js
const { DataTypes } = require('sequelize');

const RefreshToken = (sequelize) => {
    return sequelize.define('RefreshToken', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        token: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
        // userId는 관계 설정으로 자동 추가
    }, {
        tableName: 'refresh_tokens',
        timestamps: true
    });
};

module.exports = RefreshToken;
```

### Todo 모델 (인증 연동)

```javascript
// models/AuthTodo.js
const { DataTypes } = require('sequelize');

const AuthTodo = (sequelize) => {
    return sequelize.define('AuthTodo', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        task: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
        // userId는 관계 설정으로 자동 추가
    }, {
        tableName: 'auth_todos',
        timestamps: true
    });
};

module.exports = AuthTodo;
```

---

## 3. 관계 설정

```javascript
// models/authIndex.js
const { sequelize } = require('../config/database');
const AuthUserModel = require('./AuthUser');
const RefreshTokenModel = require('./RefreshToken');
const AuthTodoModel = require('./AuthTodo');

// 모델 초기화
const AuthUser = AuthUserModel(sequelize);
const RefreshToken = RefreshTokenModel(sequelize);
const AuthTodo = AuthTodoModel(sequelize);

// User : RefreshToken = 1 : N
AuthUser.hasMany(RefreshToken, {
    foreignKey: 'userId',
    as: 'refreshTokens',
    onDelete: 'CASCADE'
});
RefreshToken.belongsTo(AuthUser, {
    foreignKey: 'userId',
    as: 'user'
});

// User : Todo = 1 : N
AuthUser.hasMany(AuthTodo, {
    foreignKey: 'userId',
    as: 'todos',
    onDelete: 'CASCADE'
});
AuthTodo.belongsTo(AuthUser, {
    foreignKey: 'userId',
    as: 'user'
});

module.exports = { sequelize, AuthUser, RefreshToken, AuthTodo };
```

---

## 4. 코드 변환 비교

### 회원가입 변환

```javascript
// ❌ 기존 SQLite 방식
app.post("/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, "USER"]
    );

    res.status(201).json({
        user: { id: result.lastID, name, email, role: "USER" }
    });
});

// ✅ Sequelize 방식
app.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await AuthUser.create({
            name,
            email,
            password: hashedPassword,
            role: 'USER'
        });

        res.status(201).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: "이미 존재하는 이메일입니다" });
        }
        res.status(500).json({ message: "서버 오류" });
    }
});
```

### 로그인 변환

```javascript
// ❌ 기존 SQLite 방식
app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await db.get(
        "SELECT * FROM users WHERE email = ?",
        [email]
    );

    if (!user) {
        return res.status(401).json({ message: "존재하지 않는 이메일" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    // ...
});

// ✅ Sequelize 방식
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await AuthUser.findOne({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ message: "존재하지 않는 이메일" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        // ...
    } catch (error) {
        res.status(500).json({ message: "로그인 처리 중 오류" });
    }
});
```

### Refresh Token 저장 변환

```javascript
// ❌ 기존 SQLite 방식
async function saveRefreshToken(userId, refreshToken) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.run(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        [userId, refreshToken, expiresAt]
    );

    return result.lastID;
}

// ✅ Sequelize 방식
async function saveRefreshToken(userId, token) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const refreshToken = await RefreshToken.create({
        userId,
        token,
        expiresAt
    });

    return refreshToken.id;
}
```

### Todo 조회 변환 (소유권 검증)

```javascript
// ❌ 기존 SQLite 방식
app.get("/todos", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    let query, params;
    if (isAdmin) {
        query = `SELECT t.*, u.name as owner_name
                 FROM todos t JOIN users u ON t.user_id = u.id`;
        params = [];
    } else {
        query = "SELECT * FROM todos WHERE user_id = ?";
        params = [userId];
    }

    const todos = await db.all(query, params);
    res.json({ todos });
});

// ✅ Sequelize 방식
app.get("/todos", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === "ADMIN";

        const whereClause = isAdmin ? {} : { userId };

        const todos = await AuthTodo.findAll({
            where: whereClause,
            include: [{
                model: AuthUser,
                as: 'user',
                attributes: ['id', 'name', 'email']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json({ todos, isAdmin });
    } catch (error) {
        res.status(500).json({ message: "할 일 목록 조회 실패" });
    }
});
```

---

## 5. 주요 변환 패턴 정리

| 기존 SQLite | Sequelize |
|------------|-----------|
| `db.get("SELECT * FROM users WHERE id = ?", [id])` | `User.findByPk(id)` |
| `db.get("SELECT * FROM users WHERE email = ?", [email])` | `User.findOne({ where: { email }})` |
| `db.all("SELECT * FROM todos")` | `Todo.findAll()` |
| `db.run("INSERT INTO users (...) VALUES (...)")` | `User.create({...})` |
| `db.run("UPDATE users SET ... WHERE id = ?")` | `User.update({...}, { where: { id }})` |
| `db.run("DELETE FROM users WHERE id = ?")` | `User.destroy({ where: { id }})` |
| `result.lastID` | `instance.id` |
| `this.changes` | `[affectedCount]` |

---

## 📝 Part 7 정리

### 변환 핵심 포인트

1. **Raw SQL → Sequelize 메서드**
   - `db.get()` → `Model.findOne()`, `Model.findByPk()`
   - `db.all()` → `Model.findAll()`
   - `db.run()` → `Model.create()`, `Model.update()`, `Model.destroy()`

2. **에러 처리 개선**
   - Sequelize 특화 에러 (UniqueConstraintError 등) 활용
   - try-catch로 일관된 에러 처리

3. **관계 활용**
   - `include` 옵션으로 관련 데이터 함께 조회
   - JOIN 쿼리를 직접 작성할 필요 없음

---

# Part 8: 과제

## 🎯 과제 목표

이번 주 과제에서는 **Docker + MySQL + Sequelize**를 사용하여 사용자와 할 일을 관리하는 API를 구현합니다.

---

## 📋 기본 과제 (필수)

### 환경 설정

- [ ] Docker Desktop 설치
- [ ] `docker-compose up -d`로 MySQL 컨테이너 실행
- [ ] MySQL 연결 테스트 확인

### Sequelize 설정

- [ ] `config/database.js` - DB 연결 설정
- [ ] `models/User.js` - User 모델 정의
- [ ] `models/Todo.js` - Todo 모델 정의
- [ ] `models/index.js` - 관계 설정 (hasMany, belongsTo)

### API 구현

**Users API:**
- [ ] `GET /users` - 모든 사용자 조회 (todos 포함)
- [ ] `POST /users` - 새 사용자 생성
- [ ] `GET /users/:id` - 특정 사용자 조회 (todos 포함)
- [ ] `PUT /users/:id` - 사용자 정보 수정
- [ ] `DELETE /users/:id` - 사용자 삭제

**Todos API:**
- [ ] `GET /todos` - 모든 할 일 조회 (user 정보 포함)
- [ ] `POST /todos` - 새 할 일 생성 (userId 필요)
- [ ] `GET /todos/:id` - 특정 할 일 조회
- [ ] `PUT /todos/:id` - 할 일 수정
- [ ] `DELETE /todos/:id` - 할 일 삭제

**Relations API:**
- [ ] `GET /users/:id/todos` - 특정 사용자의 할 일 목록

---

## 🚀 심화 과제 (선택)

### 인증 시스템 통합

- [ ] User 모델에 `password`, `role` 컬럼 추가
- [ ] RefreshToken 모델 생성
- [ ] 회원가입 (`POST /auth/register`)
- [ ] 로그인 (`POST /auth/login`)
- [ ] 토큰 갱신 (`POST /auth/refresh`)
- [ ] 인증 미들웨어 적용
- [ ] 소유권 검증 (본인 할 일만 수정/삭제)

### 에러 처리 고도화

- [ ] SequelizeUniqueConstraintError 처리
- [ ] SequelizeValidationError 처리
- [ ] 일관된 에러 응답 형식

---

## 🧪 테스트 시나리오

### 1. 사용자 생성 및 조회

```bash
# 사용자 생성
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"username": "홍길동", "email": "hong@test.com", "password": "pass123"}'

# 응답 예시:
# {
#   "id": 1,
#   "username": "홍길동",
#   "email": "hong@test.com",
#   "createdAt": "2025-01-10T..."
# }

# 모든 사용자 조회 (할 일 포함)
curl http://localhost:3000/users

# 특정 사용자 조회
curl http://localhost:3000/users/1
```

### 2. 할 일 생성 및 조회

```bash
# 할 일 생성 (userId 필요)
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Sequelize 공부", "description": "ORM 배우기", "userId": 1}'

# 모든 할 일 조회 (사용자 정보 포함)
curl http://localhost:3000/todos

# 특정 사용자의 할 일 조회
curl http://localhost:3000/users/1/todos
```

### 3. 수정 및 삭제

```bash
# 사용자 정보 수정
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"username": "김철수"}'

# 할 일 완료 처리
curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# 할 일 삭제
curl -X DELETE http://localhost:3000/todos/1

# 사용자 삭제 (관련 할 일도 함께 삭제됨)
curl -X DELETE http://localhost:3000/users/1
```

---

## 📁 제출 파일 구조

```
sql-practice/
├── config/
│   └── database.js         # DB 연결 설정
├── models/
│   ├── index.js            # 모델 통합 및 관계 설정
│   ├── User.js             # User 모델
│   └── Todo.js             # Todo 모델
├── week8_sequelize_crud.js # 메인 서버 파일
├── docker-compose.yml      # Docker 설정
└── package.json
```

---

## 💡 힌트

### 1. 에러 처리 패턴

```javascript
try {
    const user = await User.create({ username, email, password });
    res.status(201).json(user);
} catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: '이미 존재하는 이메일입니다' });
    }
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: '서버 오류' });
}
```

### 2. include 사용법

```javascript
// User 조회 시 todos 포함
const user = await User.findByPk(id, {
    include: [{ model: Todo, as: 'todos' }]
});

// Todo 조회 시 user 정보 포함
const todos = await Todo.findAll({
    include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email']  // 비밀번호 제외
    }]
});
```

### 3. 관계 설정 확인

```javascript
// models/index.js에서 반드시 양방향 설정
User.hasMany(Todo, { foreignKey: 'userId', as: 'todos' });
Todo.belongsTo(User, { foreignKey: 'userId', as: 'user' });
```

---

## ✅ 최종 체크리스트

### 기본 과제

- [ ] Docker로 MySQL 실행 가능
- [ ] Sequelize로 DB 연결 성공
- [ ] User, Todo 모델 정의 완료
- [ ] 1:N 관계 설정 완료
- [ ] Users CRUD API 작동
- [ ] Todos CRUD API 작동
- [ ] `GET /users/:id/todos` 작동
- [ ] include로 관계 데이터 조회 가능

### 심화 과제 (선택)

- [ ] 인증 시스템 (회원가입, 로그인)
- [ ] JWT Access/Refresh Token
- [ ] 소유권 검증 미들웨어
- [ ] 에러 처리 고도화

---

## 🎉 마무리

이번 주에 배운 내용:

1. **SQLite → MySQL 전환**: 파일 기반에서 서버 기반 DB로 업그레이드
2. **Docker**: 복잡한 설치 없이 MySQL 환경 구축
3. **ORM (Sequelize)**: SQL 대신 JavaScript 메서드로 DB 조작
4. **관계 설정**: hasMany, belongsTo로 1:N 관계 정의
5. **include**: JOIN 없이 관련 데이터 함께 조회

다음 주에는 **데이터 유효성 검사(Validation)**와 **트랜잭션**을 배웁니다!
