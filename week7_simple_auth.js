/*
Week 7: 심플한 인증/인가 시스템 
- Refresh Token 재발급
- USER vs ADMIN 역할 구분
- 소유권 기반 접근 제어

테스트 방법:
1. npm install 실행
2. node week7_simple_auth.js 실행 (포트 3006)
3. 기본 관리자 계정: admin@test.com / admin123

API 목록:
- POST /auth/register - 회원가입 (USER 역할)
- POST /auth/login - 로그인
- POST /auth/refresh - 토큰 재발급
- GET /users/me - 내 정보
- GET /admin/users - 모든 사용자 조회 (ADMIN 전용)
- GET /todos - 할 일 목록 (본인 것만 / ADMIN은 전체)
- POST /todos - 할 일 생성
- PATCH /todos/:id - 할 일 수정 (본인 것만 / ADMIN은 전체)
- DELETE /todos/:id - 할 일 삭제 (본인 것만 / ADMIN은 전체)
*/

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

// 심플한 인증 미들웨어 import
const {
  generateTokenPair,
  verifyRefreshToken,
  authenticateToken,
  requireAdmin,
  requireSelfOrAdmin,
} = require("./middleware/simpleAuth");

const app = express();
const PORT = 3006;

app.use(express.json());

// 데이터베이스 연결
const dbPath = path.join(__dirname, "simple_auth.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err.message);
  } else {
    console.log("simple_auth.db 데이터베이스 연결 성공!");
  }
});

// 테이블 생성
db.serialize(() => {
  // 사용자 테이블 (심플 버전)
  db.run(
    `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER',
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

  // Refresh Token 저장 테이블
  db.run(
    `
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `,
    (err) => {
      if (err) {
        console.error("refresh_tokens 테이블 생성 실패:", err.message);
      } else {
        console.log("refresh_tokens 테이블 준비 완료!");
      }
    }
  );

  // Todo 테이블
  db.run(
    `
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
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

  // 기본 관리자 계정 생성
  db.get(
    "SELECT * FROM users WHERE email = ?",
    ["admin@test.com"],
    async (err, admin) => {
      if (err) {
        console.error("관리자 계정 확인 실패:", err.message);
        return;
      }

      if (!admin) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        db.run(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
          ["관리자", "admin@test.com", hashedPassword, "ADMIN"],
          function (err) {
            if (err) {
              console.error("관리자 계정 생성 실패:", err.message);
            } else {
              console.log("✅ 기본 관리자 계정 생성:");
              console.log("   이메일: admin@test.com");
              console.log("   비밀번호: admin123");
            }
          }
        );
      }
    }
  );
});

// 유틸리티 함수
function isValidEmail(email) {
  return email && email.includes("@");
}

// Refresh Token 저장
function saveRefreshToken(userId, refreshToken) {
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [userId, refreshToken, expiresAt],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// Refresh Token 검증
function validateRefreshToken(refreshToken) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT rt.*, u.id as user_id, u.name, u.email, u.role 
             FROM refresh_tokens rt 
             JOIN users u ON rt.user_id = u.id 
             WHERE rt.token = ? AND datetime(rt.expires_at) > datetime('now')`,
      [refreshToken],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// ================================
// 인증 관련 API
// ================================

// POST /auth/register - 회원가입 (일반 사용자만)
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

  if (password.length < 6) {
    return res.status(400).json({
      message: "비밀번호는 최소 6자 이상이어야 합니다",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, "USER"], // 일반 사용자로 가입
      async function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({
              message: "이미 존재하는 이메일입니다",
            });
          }
          return res.status(500).json({
            message: "회원가입 중 오류가 발생했습니다",
          });
        }

        // 토큰 생성
        const payload = {
          id: this.lastID,
          email,
          name,
          role: "USER",
        };

        const { accessToken, refreshToken } = generateTokenPair(payload);

        // Refresh Token 저장
        try {
          await saveRefreshToken(this.lastID, refreshToken);

          res.status(201).json({
            message: "회원가입이 완료되었습니다",
            user: {
              id: this.lastID,
              name,
              email,
              role: "USER",
            },
            accessToken,
            refreshToken,
          });
        } catch (tokenError) {
          return res.status(500).json({
            message: "토큰 생성 중 오류가 발생했습니다",
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({
      message: "서버 오류가 발생했습니다",
    });
  }
});

// POST /auth/login - 로그인
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "이메일과 비밀번호를 입력해주세요",
    });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({
        message: "로그인 처리 중 오류가 발생했습니다",
      });
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

      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      const { accessToken, refreshToken } = generateTokenPair(payload);

      // Refresh Token 저장
      saveRefreshToken(user.id, refreshToken)
        .then(() => {
          res.json({
            message: "로그인 성공",
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
            accessToken,
            refreshToken,
          });
        })
        .catch(() => {
          return res.status(500).json({
            message: "토큰 생성 중 오류가 발생했습니다",
          });
        });
    } catch (error) {
      res.status(500).json({
        message: "로그인 처리 중 오류가 발생했습니다",
      });
    }
  });
});

// POST /auth/refresh - 토큰 재발급
app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      message: "Refresh Token이 필요합니다",
    });
  }

  try {
    // Refresh Token 검증
    verifyRefreshToken(refreshToken);

    // DB에서 토큰 유효성 확인
    const tokenData = await validateRefreshToken(refreshToken);

    if (!tokenData) {
      return res.status(401).json({
        message: "유효하지 않거나 만료된 Refresh Token입니다",
      });
    }

    // 새로운 토큰 쌍 생성
    const payload = {
      id: tokenData.user_id,
      email: tokenData.email,
      name: tokenData.name,
      role: tokenData.role,
    };

    const { accessToken, refreshToken: newRefreshToken } =
      generateTokenPair(payload);

    // 기존 토큰 삭제하고 새 토큰 저장
    db.run("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);
    await saveRefreshToken(tokenData.user_id, newRefreshToken);

    res.json({
      message: "토큰이 갱신되었습니다",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Refresh Token이 만료되었습니다. 다시 로그인해주세요",
      });
    }

    return res.status(401).json({
      message: "토큰 갱신에 실패했습니다",
    });
  }
});

// ================================
// 사용자 관리 API
// ================================

// GET /users/me - 내 정보 조회
app.get("/users/me", authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    "SELECT id, name, email, role, createdAt FROM users WHERE id = ?",
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "사용자 정보 조회 중 오류가 발생했습니다",
        });
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

// GET /admin/users - 모든 사용자 조회 (관리자 전용)
app.get("/admin/users", authenticateToken, requireAdmin, (req, res) => {
  db.all(
    "SELECT id, name, email, role, createdAt FROM users ORDER BY createdAt DESC",
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({
          message: "사용자 목록 조회 중 오류가 발생했습니다",
        });
      }

      res.json({
        users,
        requestedBy: req.user,
      });
    }
  );
});

// ================================
// Todo 관리 API (소유권 기반 접근 제어)
// ================================

// GET /todos - 할 일 목록 조회
app.get("/todos", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  let query, params;

  if (isAdmin) {
    // 관리자는 모든 할 일 조회 가능
    query = `
            SELECT t.*, u.name as owner_name 
            FROM todos t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.createdAt DESC
        `;
    params = [];
  } else {
    // 일반 사용자는 본인 할 일만 조회
    query = "SELECT * FROM todos WHERE user_id = ? ORDER BY createdAt DESC";
    params = [userId];
  }

  db.all(query, params, (err, todos) => {
    if (err) {
      return res.status(500).json({
        message: "할 일 목록 조회 중 오류가 발생했습니다",
      });
    }

    res.json({
      todos,
      isAdmin,
      user: req.user,
    });
  });
});

// POST /todos - 새 할 일 추가
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
        return res.status(500).json({
          message: "할 일 생성 중 오류가 발생했습니다",
        });
      }

      // 생성된 할 일 조회
      db.get("SELECT * FROM todos WHERE id = ?", [this.lastID], (err, todo) => {
        if (err) {
          return res.status(500).json({
            message: "생성된 할 일 조회 중 오류가 발생했습니다",
          });
        }

        res.status(201).json({
          message: "할 일이 추가되었습니다",
          todo,
        });
      });
    }
  );
});

// PATCH /todos/:id - 할 일 수정 (소유권 검증)
app.patch("/todos/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { task, completed } = req.body;
  const userId = req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  // 먼저 할 일 조회
  db.get("SELECT * FROM todos WHERE id = ?", [id], (err, todo) => {
    if (err) {
      return res.status(500).json({
        message: "할 일 조회 중 오류가 발생했습니다",
      });
    }

    if (!todo) {
      return res.status(404).json({
        message: "할 일을 찾을 수 없습니다",
      });
    }

    // 소유권 검증: 본인 것이거나 관리자인 경우만 허용
    if (!isAdmin && todo.user_id !== userId) {
      return res.status(403).json({
        message: "본인의 할 일만 수정할 수 있습니다",
      });
    }

    // 수정할 필드들
    const updates = [];
    const values = [];

    if (task !== undefined) {
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

    values.push(id);
    const sql = `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`;

    db.run(sql, values, function (err) {
      if (err) {
        return res.status(500).json({
          message: "할 일 수정 중 오류가 발생했습니다",
        });
      }

      // 수정된 할 일 조회
      db.get("SELECT * FROM todos WHERE id = ?", [id], (err, updatedTodo) => {
        if (err) {
          return res.status(500).json({
            message: "수정된 할 일 조회 중 오류가 발생했습니다",
          });
        }

        res.json({
          message: "할 일이 수정되었습니다",
          todo: updatedTodo,
        });
      });
    });
  });
});

// DELETE /todos/:id - 할 일 삭제 (소유권 검증)
app.delete("/todos/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === "ADMIN";

  // 먼저 할 일 조회
  db.get("SELECT * FROM todos WHERE id = ?", [id], (err, todo) => {
    if (err) {
      return res.status(500).json({
        message: "할 일 조회 중 오류가 발생했습니다",
      });
    }

    if (!todo) {
      return res.status(404).json({
        message: "할 일을 찾을 수 없습니다",
      });
    }

    // 소유권 검증: 본인 것이거나 관리자인 경우만 허용
    if (!isAdmin && todo.user_id !== userId) {
      return res.status(403).json({
        message: "본인의 할 일만 삭제할 수 있습니다",
      });
    }

    db.run("DELETE FROM todos WHERE id = ?", [id], function (err) {
      if (err) {
        return res.status(500).json({
          message: "할 일 삭제 중 오류가 발생했습니다",
        });
      }

      res.json({
        message: "할 일이 삭제되었습니다",
      });
    });
  });
});

// ================================
// 공개 API
// ================================

// GET /api/info - API 정보
app.get("/api/info", (req, res) => {
  res.json({
    name: "Simple Auth & Authorization System",
    version: "1.0.0",
    features: [
      "JWT Authentication with Refresh Tokens",
      "USER vs ADMIN Role-Based Access Control",
      "Resource Ownership Validation",
    ],
    roles: ["USER", "ADMIN"],
    endpoints: {
      auth: ["POST /auth/register", "POST /auth/login", "POST /auth/refresh"],
      users: ["GET /users/me", "GET /admin/users (ADMIN only)"],
      todos: [
        "GET /todos",
        "POST /todos",
        "PATCH /todos/:id",
        "DELETE /todos/:id",
      ],
    },
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log("🚀 심플한 인증/인가 시스템이 시작되었습니다!");
  console.log(`📡 서버 주소: http://localhost:${PORT}`);
  console.log("🔐 구현된 기능:");
  console.log("   ✅ Refresh Token 재발급 시스템");
  console.log("   ✅ USER vs ADMIN 역할 구분");
  console.log("   ✅ 리소스 소유권 검증");
  console.log("📚 API 정보: GET /api/info");
});

// 프로세스 종료 시 정리
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
