/*
JWT 인증 시스템이 적용된 To-Do 리스트 API

테스트 방법:
1. npm install 실행
2. npm run dev:auth-todos (또는 node week5_auth_todos.js) 실행
3. 먼저 사용자 인증 API에서 회원가입/로그인으로 토큰 발급받기
4. API 테스트 (인증이 필요한 API는 헤더에 Authorization: Bearer <token> 포함):
   - POST /auth/register: 회원가입 (인증 불필요)
   - POST /auth/login: 로그인 (인증 불필요)
   - GET /todos: 내 할 일 조회 (인증 필요)
   - POST /todos: 새 할 일 추가 (인증 필요)
   - PATCH /todos/:id: 할 일 수정 (인증 필요, 본인 소유만 가능)
   - DELETE /todos/:id: 할 일 삭제 (인증 필요, 본인 소유만 가능)
   - GET /todos/stats: 내 할 일 통계 (인증 필요)
*/

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");
const { generateToken, authenticateToken } = require("./middleware/auth");

const app = express();
const PORT = 3004;

app.use(express.json());

// 데이터베이스 연결
const dbPath = path.join(__dirname, "auth_todos.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err.message);
  } else {
    console.log("auth_todos.db 데이터베이스 연결 성공!");
  }
});

// 테이블 생성
db.serialize(() => {
  // 사용자 테이블
  db.run(
    `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `,
    (err) => {
      if (err) {
        console.error("users 테이블 생성 실패:", err.message);
      } else {
        console.log("users 테이블 준비 완료!");
      }
    }
  );

  // To-do 테이블 (user_id 추가로 사용자별 할 일 관리)
  db.run(
    `
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `,
    (err) => {
      if (err) {
        console.error("todos 테이블 생성 실패:", err.message);
      } else {
        console.log("todos 테이블 준비 완료!");
      }
    }
  );
});

// 유틸리티 함수들
function isValidEmail(email) {
  return email && email.includes("@") && email.includes(".");
}

function isValidPassword(password) {
  return password && password.length >= 6;
}

// ================================
// 인증 관련 API 엔드포인트
// ================================

// POST /auth/register: 회원가입
app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "이름, 이메일, 비밀번호는 필수입니다",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      message: "올바른 이메일 형식이 아닙니다",
    });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      message: "비밀번호는 최소 6자 이상이어야 합니다",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({
              message: "이미 존재하는 이메일입니다",
            });
          }
          return res.status(500).json({ error: err.message });
        }

        const token = generateToken({
          id: this.lastID,
          email,
          name,
        });

        res.status(201).json({
          message: "회원가입이 완료되었습니다",
          user: {
            id: this.lastID,
            name,
            email,
          },
          token,
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      message: "서버 오류가 발생했습니다",
      error: error.message,
    });
  }
});

// POST /auth/login: 로그인
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "이메일과 비밀번호를 입력해주세요",
    });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      return res.status(401).json({
        message: "존재하지 않는 이메일입니다",
      });
    }

    try {
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({
          message: "비밀번호가 틀렸습니다",
        });
      }

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
});

// ================================
// To-Do 관련 API 엔드포인트 (인증 필요)
// ================================

// GET /todos: 내 할 일 목록 조회
app.get("/todos", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(
    "SELECT * FROM todos WHERE user_id = ? ORDER BY createdAt DESC",
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        todos: rows,
        user: req.user,
      });
    }
  );
});

// GET /todos/:id: 특정 할 일 조회
app.get("/todos/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.get(
    "SELECT * FROM todos WHERE id = ? AND user_id = ?",
    [id, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({
          message: "할 일을 찾을 수 없습니다",
        });
      }
      res.json(row);
    }
  );
});

// POST /todos: 새 할 일 추가
app.post("/todos", authenticateToken, (req, res) => {
  const { task } = req.body;
  const userId = req.user.id;

  if (!task) {
    return res.status(400).json({
      message: "task는 필수입니다",
    });
  }

  db.run(
    "INSERT INTO todos (user_id, task) VALUES (?, ?)",
    [userId, task],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // 생성된 할 일 조회
      db.get("SELECT * FROM todos WHERE id = ?", [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.status(201).json({
          message: "할 일이 추가되었습니다",
          todo: row,
        });
      });
    }
  );
});

// PATCH /todos/:id: 할 일 수정 (완료 상태 변경 등)
app.patch("/todos/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { task, completed } = req.body;
  const userId = req.user.id;

  const updates = [];
  const values = [];

  if (task !== undefined) {
    if (!task.trim()) {
      return res.status(400).json({
        message: "할 일은 빈 값일 수 없습니다",
      });
    }
    updates.push("task = ?");
    values.push(task);
  }

  if (completed !== undefined) {
    updates.push("completed = ?");
    values.push(completed ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      message: "수정할 내용이 없습니다",
    });
  }

  updates.push("updatedAt = CURRENT_TIMESTAMP");
  values.push(id, userId);
  const sql = `UPDATE todos SET ${updates.join(
    ", "
  )} WHERE id = ? AND user_id = ?`;

  db.run(sql, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({
        message: "할 일을 찾을 수 없거나 수정 권한이 없습니다",
      });
    }

    // 수정된 데이터 조회
    db.get(
      "SELECT * FROM todos WHERE id = ? AND user_id = ?",
      [id, userId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          message: "할 일이 수정되었습니다",
          todo: row,
        });
      }
    );
  });
});

// DELETE /todos/:id: 할 일 삭제
app.delete("/todos/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.run(
    "DELETE FROM todos WHERE id = ? AND user_id = ?",
    [id, userId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          message: "할 일을 찾을 수 없거나 삭제 권한이 없습니다",
        });
      }

      res.json({
        message: "할 일이 삭제되었습니다",
      });
    }
  );
});

// GET /todos/stats: 내 할 일 통계
app.get("/todos/stats", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    `
        SELECT
            COUNT(*) as total,
            SUM(completed) as completed,
            COUNT(*) - SUM(completed) as pending
        FROM todos 
        WHERE user_id = ?
    `,
    [userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        stats: row,
        user: req.user,
      });
    }
  );
});

// GET /users/me: 내 정보 조회
app.get("/users/me", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    "SELECT id, name, email, createdAt FROM users WHERE id = ?",
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        return res.status(404).json({
          message: "사용자를 찾을 수 없습니다",
        });
      }
      res.json(user);
    }
  );
});

// ================================
// 공개 API (인증 불필요)
// ================================

// GET /public/stats: 전체 통계
app.get("/public/stats", (req, res) => {
  db.get(
    `
        SELECT
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM todos) as total_todos,
            (SELECT COUNT(*) FROM todos WHERE completed = 1) as completed_todos
    `,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    }
  );
});

// 서버 시작
app.listen(PORT, () => {
  console.log(
    `JWT 인증 To-Do API 서버가 http://localhost:${PORT}에서 실행 중입니다.`
  );
});

// 프로세스 종료 시 데이터베이스 연결 정리
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error("데이터베이스 연결 종료 실패:", err.message);
    } else {
      console.log("데이터베이스 연결이 정상적으로 종료되었습니다.");
    }
    process.exit(0);
  });
});
