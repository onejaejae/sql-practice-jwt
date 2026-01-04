/*
JWT 인증 시스템이 적용된 사용자 관리 API

테스트 방법:
1. npm install 실행
2. npm run dev:auth (또는 node week5_auth_users.js) 실행
3. API 테스트:
   - POST /auth/register: 회원가입
   - POST /auth/login: 로그인 (JWT 토큰 발급)
   - GET /users: 모든 사용자 조회 (인증 필요)
   - GET /users/me: 내 정보 조회 (인증 필요)
   - PATCH /users/me: 내 정보 수정 (인증 필요)

헤더에 Authorization: Bearer <token> 형태로 JWT 토큰 전송 필요
*/

const express = require("express");
const bcrypt = require("bcryptjs");
const path = require("path");
const Database = require("./utils/database");
const {
  generateToken,
  authenticateToken,
  optionalAuth,
} = require("./middleware/auth");

const app = express();
const PORT = 3002;

app.use(express.json());

// 데이터베이스 연결
const dbPath = path.join(__dirname, "auth_users.db");
const db = new Database(dbPath);
console.log("auth_users.db 데이터베이스 연결 성공!");

// 테이블 생성 (password 필드 추가)
(async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          age INTEGER,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("users 테이블 준비 완료!");
  } catch (error) {
    console.error("테이블 생성 실패:", error.message);
  }
})();

// 이메일 유효성 검사 함수
function isValidEmail(email) {
  return email && email.includes("@") && email.includes(".");
}

// 비밀번호 유효성 검사 함수
function isValidPassword(password) {
  return password && password.length >= 6;
}

// ================================
// 인증 관련 API 엔드포인트
// ================================

// POST /auth/register: 회원가입
app.post("/auth/register", async (req, res) => {
  const { name, email, password, age } = req.body;

  // 필수 값 검증
  if (!name || !email || !password) {
    return res.status(400).json({
      message: "이름, 이메일, 비밀번호는 필수입니다",
    });
  }

  // 이메일 유효성 검증
  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "올바른 이메일 형식이 아닙니다",
    });
  }

  // 비밀번호 유효성 검증
  if (!isValidPassword(password)) {
    return res.status(400).json({
      message: "비밀번호는 최소 6자 이상이어야 합니다",
    });
  }

  // age가 제공된 경우 숫자인지 확인
  if (age !== undefined && (isNaN(age) || age < 0)) {
    return res.status(400).json({
      message: "나이는 0 이상의 숫자여야 합니다",
    });
  }

  try {
    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log("hashedPassword----------", hashedPassword);

    const result = await db.run(
      "INSERT INTO users (name, email, password, age) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, age || null]
    );

    // JWT 토큰 생성
    const token = generateToken({
      id: result.lastID,
      email,
      name,
    });

    res.status(201).json({
      message: "회원가입이 완료되었습니다",
      user: {
        id: result.lastID,
        name,
        email,
        age: age || null,
      },
      token,
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({
        message: "이미 존재하는 이메일입니다",
      });
    }
    res.status(500).json({
      message: "서버 오류가 발생했습니다",
      error: error.message,
    });
  }
});

// POST /auth/login: 로그인
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // 필수 값 검증
  if (!email || !password) {
    return res.status(400).json({
      message: "이메일과 비밀번호를 입력해주세요",
    });
  }

  try {
    // 사용자 조회
    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      return res.status(401).json({
        message: "존재하지 않는 이메일입니다",
      });
    }

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        message: "비밀번호가 틀렸습니다",
      });
    }

    // JWT 토큰 생성
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    res.json({
      message: "로그인 성공",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({
      message: "로그인 처리 중 오류가 발생했습니다",
      error: error.message,
    });
  }
});

// ================================
// 보호된 API 엔드포인트 (인증 필요)
// ================================

// GET /users: 모든 사용자 조회 (인증 필요)
app.get("/users", authenticateToken, async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT id, name, email, age, password, createdAt FROM users ORDER BY id",
      []
    );
    res.json({
      users: rows,
      requestedBy: req.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /users/me: 내 정보 조회 (인증 필요)
app.get("/users/me", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await db.get(
      "SELECT id, name, email, age, createdAt FROM users WHERE id = ?",
      [userId]
    );
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /users/me: 내 정보 수정 (인증 필요)
app.patch("/users/me", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { name, age, currentPassword, newPassword } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(400).json({ message: "이름은 빈 값일 수 없습니다" });
    }
    updates.push("name = ?");
    values.push(name);
  }

  if (age !== undefined) {
    if (age !== null && (isNaN(age) || age < 0)) {
      return res
        .status(400)
        .json({ message: "나이는 0 이상의 숫자여야 합니다" });
    }
    updates.push("age = ?");
    values.push(age);
  }

  // 비밀번호 변경 요청이 있는 경우
  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({
        message: "현재 비밀번호를 입력해주세요",
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        message: "새 비밀번호는 최소 6자 이상이어야 합니다",
      });
    }

    // 현재 비밀번호 확인 후 처리
    db.get(
      "SELECT password FROM users WHERE id = ?",
      [userId],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        try {
          const isValidCurrent = await bcrypt.compare(
            currentPassword,
            user.password
          );
          if (!isValidCurrent) {
            return res.status(401).json({
              message: "현재 비밀번호가 틀렸습니다",
            });
          }

          const hashedNewPassword = await bcrypt.hash(newPassword, 10);
          updates.push("password = ?");
          values.push(hashedNewPassword);

          // 업데이트 실행
          executeUpdate();
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
      }
    );
    return;
  }

  executeUpdate();

  function executeUpdate() {
    if (updates.length === 0) {
      return res.status(400).json({ message: "수정할 내용이 없습니다" });
    }

    updates.push("updatedAt = CURRENT_TIMESTAMP");
    values.push(userId);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;

    db.run(sql, values, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      // 수정된 데이터 조회 후 반환 (비밀번호 제외)
      db.get(
        "SELECT id, name, email, age, updatedAt FROM users WHERE id = ?",
        [userId],
        (err, row) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            message: "정보가 수정되었습니다",
            user: row,
          });
        }
      );
    });
  }
});

// DELETE /users/me: 회원 탈퇴 (인증 필요)
app.delete("/users/me", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      message: "비밀번호를 입력해주세요",
    });
  }

  // 비밀번호 확인 후 탈퇴 처리
  db.get(
    "SELECT password FROM users WHERE id = ?",
    [userId],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }

      try {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({
            message: "비밀번호가 틀렸습니다",
          });
        }

        // 사용자 삭제
        db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          res.json({
            message: "회원 탈퇴가 완료되었습니다",
          });
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
});

// ================================
// 공개 API 엔드포인트
// ================================

// GET /public/users/count: 전체 사용자 수 (인증 불필요)
app.get("/public/users/count", (req, res) => {
  db.get("SELECT COUNT(*) as userCount FROM users", [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(
    `JWT 인증 API 서버가 http://localhost:${PORT}에서 실행 중입니다.`
  );
});

// 프로세스 종료 시 데이터베이스 연결 정리
process.on("SIGINT", async () => {
  try {
    await db.safeClose();
    process.exit(0);
  } catch (error) {
    console.error("데이터베이스 연결 종료 실패:", error.message);
    process.exit(1);
  }
});
