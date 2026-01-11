/*
Week 8: Sequelize 기반 인증/인가 시스템 (심화 과제 예시)

7주차의 SQLite 기반 인증 시스템을 MySQL + Sequelize로 전환한 버전입니다.

실행 방법:
1. Docker로 MySQL 실행: docker-compose up -d
2. 서버 시작: npm run dev:sequelize-auth (또는 node week8_sequelize_auth.js)
3. 기본 포트: 3007
4. 기본 관리자 계정: admin@test.com / admin123

API 목록:
- POST /auth/register - 회원가입
- POST /auth/login - 로그인
- POST /auth/refresh - 토큰 갱신
- GET /users/me - 내 정보 조회
- GET /admin/users - 모든 사용자 조회 (ADMIN 전용)
- GET /todos - 할 일 목록 (본인 것만 / ADMIN은 전체)
- POST /todos - 할 일 생성
- PATCH /todos/:id - 할 일 수정
- DELETE /todos/:id - 할 일 삭제
*/

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Sequelize, DataTypes, Op } = require("sequelize");

const app = express();
const PORT = 3007;

// JWT 설정
const ACCESS_TOKEN_SECRET = "week8-access-secret-key";
const REFRESH_TOKEN_SECRET = "week8-refresh-secret-key";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

app.use(cors());
app.use(express.json());

// =================================
// Sequelize 설정 및 모델 정의
// =================================

const sequelize = new Sequelize("sql_practice", "sqluser", "sqlpassword", {
  host: "localhost",
  port: 3306,
  dialect: "mysql",
  logging: false,
  define: {
    timestamps: true,
  },
});

// User 모델
const User = sequelize.define(
  "AuthUser",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("USER", "ADMIN"),
      defaultValue: "USER",
    },
  },
  {
    tableName: "auth_users",
  }
);

// RefreshToken 모델
const RefreshToken = sequelize.define(
  "RefreshToken",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "auth_refresh_tokens",
  }
);

// Todo 모델
const Todo = sequelize.define(
  "AuthTodo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    task: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "auth_todos",
  }
);

// 관계 설정
User.hasMany(RefreshToken, { foreignKey: "userId", as: "refreshTokens", onDelete: "CASCADE" });
RefreshToken.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Todo, { foreignKey: "userId", as: "todos", onDelete: "CASCADE" });
Todo.belongsTo(User, { foreignKey: "userId", as: "user" });

// =================================
// JWT 유틸리티 함수
// =================================

function generateTokenPair(payload) {
  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ id: payload.id }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

async function saveRefreshToken(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId, token, expiresAt });
}

// =================================
// 미들웨어
// =================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "액세스 토큰이 필요합니다" });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "토큰이 만료되었습니다", code: "TOKEN_EXPIRED" });
    }
    return res.status(403).json({ message: "유효하지 않은 토큰입니다" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "관리자 권한이 필요합니다" });
  }
  next();
};

// =================================
// 인증 API
// =================================

// POST /auth/register
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "이름, 이메일, 비밀번호는 필수입니다" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "비밀번호는 최소 6자 이상이어야 합니다" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "USER",
    });

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const { accessToken, refreshToken } = generateTokenPair(payload);
    await saveRefreshToken(user.id, refreshToken);

    res.status(201).json({
      message: "회원가입이 완료되었습니다",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "이미 존재하는 이메일입니다" });
    }
    console.error("Register error:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다" });
  }
});

// POST /auth/login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요" });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "존재하지 않는 이메일입니다" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: "비밀번호가 틀렸습니다" });
    }

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const { accessToken, refreshToken } = generateTokenPair(payload);
    await saveRefreshToken(user.id, refreshToken);

    res.json({
      message: "로그인 성공",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
  }
});

// POST /auth/refresh
app.post("/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh Token이 필요합니다" });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    const storedToken = await RefreshToken.findOne({
      where: { token: refreshToken, userId: decoded.id, expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User, as: "user" }],
    });

    if (!storedToken) {
      return res.status(401).json({ message: "유효하지 않은 Refresh Token입니다" });
    }

    const user = storedToken.user;
    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(payload);

    await storedToken.destroy();
    await saveRefreshToken(user.id, newRefreshToken);

    res.json({ message: "토큰이 갱신되었습니다", accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Refresh Token이 만료되었습니다" });
    }
    res.status(401).json({ message: "토큰 갱신에 실패했습니다" });
  }
});

// =================================
// 사용자 API
// =================================

// GET /users/me
app.get("/users/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "role", "createdAt"],
    });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "사용자 정보 조회 실패" });
  }
});

// GET /admin/users
app.get("/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    res.json({ users, requestedBy: req.user });
  } catch (error) {
    res.status(500).json({ message: "사용자 목록 조회 실패" });
  }
});

// =================================
// Todo API
// =================================

// GET /todos
app.get("/todos", authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const whereClause = isAdmin ? {} : { userId: req.user.id };

    const todos = await Todo.findAll({
      where: whereClause,
      include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
      order: [["createdAt", "DESC"]],
    });

    res.json({ todos, isAdmin, user: req.user });
  } catch (error) {
    res.status(500).json({ message: "할 일 목록 조회 실패" });
  }
});

// POST /todos
app.post("/todos", authenticateToken, async (req, res) => {
  try {
    const { task } = req.body;

    if (!task) {
      return res.status(400).json({ message: "task는 필수입니다" });
    }

    const todo = await Todo.create({ task, userId: req.user.id });

    res.status(201).json({ message: "할 일이 추가되었습니다", todo });
  } catch (error) {
    res.status(500).json({ message: "할 일 생성 실패" });
  }
});

// PATCH /todos/:id
app.patch("/todos/:id", authenticateToken, async (req, res) => {
  try {
    const todo = await Todo.findByPk(req.params.id);

    if (!todo) {
      return res.status(404).json({ message: "할 일을 찾을 수 없습니다" });
    }

    if (req.user.role !== "ADMIN" && todo.userId !== req.user.id) {
      return res.status(403).json({ message: "본인의 할 일만 수정할 수 있습니다" });
    }

    const { task, completed } = req.body;
    await todo.update({ task: task ?? todo.task, completed: completed ?? todo.completed });

    res.json({ message: "할 일이 수정되었습니다", todo });
  } catch (error) {
    res.status(500).json({ message: "할 일 수정 실패" });
  }
});

// DELETE /todos/:id
app.delete("/todos/:id", authenticateToken, async (req, res) => {
  try {
    const todo = await Todo.findByPk(req.params.id);

    if (!todo) {
      return res.status(404).json({ message: "할 일을 찾을 수 없습니다" });
    }

    if (req.user.role !== "ADMIN" && todo.userId !== req.user.id) {
      return res.status(403).json({ message: "본인의 할 일만 삭제할 수 있습니다" });
    }

    await todo.destroy();

    res.json({ message: "할 일이 삭제되었습니다" });
  } catch (error) {
    res.status(500).json({ message: "할 일 삭제 실패" });
  }
});

// GET /api/info
app.get("/api/info", (req, res) => {
  res.json({
    name: "Week 8: Sequelize Auth System",
    version: "1.0.0",
    database: "MySQL + Sequelize",
    features: ["JWT Authentication", "Refresh Tokens", "Role-Based Access Control", "ORM (Sequelize)"],
  });
});

// =================================
// 서버 시작
// =================================

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL 데이터베이스 연결 성공!");

    await sequelize.sync({ force: false });
    console.log("✅ 테이블 동기화 완료!");

    // 기본 관리자 계정 생성
    const admin = await User.findOne({ where: { email: "admin@test.com" } });
    if (!admin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await User.create({ name: "관리자", email: "admin@test.com", password: hashedPassword, role: "ADMIN" });
      console.log("✅ 기본 관리자 계정 생성: admin@test.com / admin123");
    }

    app.listen(PORT, () => {
      console.log(`\n🚀 Week 8 Sequelize Auth 서버가 http://localhost:${PORT}에서 실행 중!`);
      console.log("📚 API 정보: GET /api/info\n");
    });
  } catch (error) {
    console.error("❌ 서버 시작 실패:", error);
    process.exit(1);
  }
}

startServer();
