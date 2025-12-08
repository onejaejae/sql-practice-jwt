/*
Step 5 과제 1: To-Do 리스트 API (SQLite 버전)

테스트 방법:
1. npm install express sqlite3 실행
2. node week5_todos.js 실행
3. 브라우저에서 http://localhost:3000/todos 접속하여 테스트
4. Postman이나 curl로 API 테스트:
   - GET /todos: 모든 할 일 조회
   - GET /todos/1: 특정 할 일 조회
   - POST /todos: {"task": "새 할 일"} 형태로 데이터 전송
   - PATCH /todos/1: {"completed": 1} 형태로 완료 상태 변경
   - DELETE /todos/1: 특정 할 일 삭제
   - GET /todos/stats: 할 일 통계
*/

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3001;

app.use(express.json());

// 데이터베이스 연결
const dbPath = path.join(__dirname, "todos.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err.message);
  } else {
    console.log("todos.db 데이터베이스 연결 성공!");
  }
});

// 테이블 생성
db.run(
  `
    CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        createdAt TEXT
    )
`,
  (err) => {
    if (err) {
      console.error("테이블 생성 실패:", err.message);
    } else {
      console.log("todos 테이블 준비 완료!");
    }
  }
);

// API 엔드포인트

// GET /todos: 모든 할 일 조회
app.get("/todos", (req, res) => {
  db.all("SELECT * FROM todos ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /todos/:id: 특정 할 일 조회
app.get("/todos/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM todos WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: "할 일을 찾을 수 없습니다" });
    }
    res.json(row);
  });
});

// POST /todos: 새 할 일 추가
app.post("/todos", (req, res) => {
  console.log("excecute-----");
  const { task } = req.body;

  if (!task) {
    return res.status(400).json({ message: "task는 필수입니다" });
  }

  const createdAt = new Date().toISOString();

  db.run(
    "INSERT INTO todos (task, createdAt) VALUES (?, ?)",
    [task, createdAt],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        id: this.lastID,
        task,
        completed: 0,
        createdAt,
      });
    }
  );
});

// PATCH /todos/:id: 할 일 완료 상태 변경
app.patch("/todos/:id", (req, res) => {
  const { id } = req.params;
  const { completed, task } = req.body;

  const updates = [];
  const values = [];

  if (completed !== undefined) {
    updates.push("completed = ?");
    values.push(completed ? 1 : 0);
  }

  if (task !== undefined) {
    updates.push("task = ?");
    values.push(task);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "수정할 내용이 없습니다" });
  }

  values.push(id);
  const sql = `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`;

  db.run(sql, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "할 일을 찾을 수 없습니다" });
    }

    // 수정된 데이터 조회 후 반환
    db.get("SELECT * FROM todos WHERE id = ?", [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    });
  });
});

// DELETE /todos/:id: 할 일 삭제
app.delete("/todos/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM todos WHERE id = ?", [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "할 일을 찾을 수 없습니다" });
    }

    res.json({ message: "할 일이 삭제되었습니다" });
  });
});

// GET /todos/stats: 할 일 통계 (Step 5 과제 3)
app.get("/todos/stats", (req, res) => {
  db.get(
    `
        SELECT
            COUNT(*) as total,
            SUM(completed) as completed,
            COUNT(*) - SUM(completed) as pending
        FROM todos
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
  console.log(`To-Do API 서버가 http://localhost:${PORT}에서 실행 중입니다.`);
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
