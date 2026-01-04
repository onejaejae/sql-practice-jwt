const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/database");
const { User, Todo, syncDatabase } = require("./models");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

async function startServer() {
  try {
    await connectDB();
    await syncDatabase();

    app.get("/users", async (req, res) => {
      try {
        const users = await User.findAll({
          include: [
            {
              model: Todo,
              as: "todos",
            },
          ],
        });
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const { username, email, password } = req.body;
        const newUser = await User.create({
          username,
          email,
          password,
        });
        res.status(201).json(newUser);
      } catch (error) {
        console.error("Error creating user:", error);
        if (error.name === "SequelizeUniqueConstraintError") {
          res.status(400).json({ error: "Username or email already exists" });
        } else {
          res.status(500).json({ error: "Failed to create user" });
        }
      }
    });

    app.get("/users/:id", async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id, {
          include: [
            {
              model: Todo,
              as: "todos",
            },
          ],
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    });

    app.put("/users/:id", async (req, res) => {
      try {
        const { username, email } = req.body;
        const [updatedRows] = await User.update(
          { username, email },
          { where: { id: req.params.id } }
        );

        if (updatedRows === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const updatedUser = await User.findByPk(req.params.id);
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
      }
    });

    app.delete("/users/:id", async (req, res) => {
      try {
        const deletedRows = await User.destroy({
          where: { id: req.params.id },
        });

        if (deletedRows === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
      }
    });

    app.get("/todos", async (req, res) => {
      try {
        const todos = await Todo.findAll({
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "email"],
            },
          ],
        });
        res.json(todos);
      } catch (error) {
        console.error("Error fetching todos:", error);
        res.status(500).json({ error: "Failed to fetch todos" });
      }
    });

    app.post("/todos", async (req, res) => {
      try {
        const { title, description, userId } = req.body;

        const user = await User.findByPk(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const newTodo = await Todo.create({
          title,
          description,
          userId,
        });

        const todoWithUser = await Todo.findByPk(newTodo.id, {
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "email"],
            },
          ],
        });

        res.status(201).json(todoWithUser);
      } catch (error) {
        console.error("Error creating todo:", error);
        res.status(500).json({ error: "Failed to create todo" });
      }
    });

    app.get("/todos/:id", async (req, res) => {
      try {
        const todo = await Todo.findByPk(req.params.id, {
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "email"],
            },
          ],
        });

        if (!todo) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.json(todo);
      } catch (error) {
        console.error("Error fetching todo:", error);
        res.status(500).json({ error: "Failed to fetch todo" });
      }
    });

    app.put("/todos/:id", async (req, res) => {
      try {
        const { title, description, completed } = req.body;
        const [updatedRows] = await Todo.update(
          { title, description, completed },
          { where: { id: req.params.id } }
        );

        if (updatedRows === 0) {
          return res.status(404).json({ error: "Todo not found" });
        }

        const updatedTodo = await Todo.findByPk(req.params.id, {
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "email"],
            },
          ],
        });
        res.json(updatedTodo);
      } catch (error) {
        console.error("Error updating todo:", error);
        res.status(500).json({ error: "Failed to update todo" });
      }
    });

    app.delete("/todos/:id", async (req, res) => {
      try {
        const deletedRows = await Todo.destroy({
          where: { id: req.params.id },
        });

        if (deletedRows === 0) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.json({ message: "Todo deleted successfully" });
      } catch (error) {
        console.error("Error deleting todo:", error);
        res.status(500).json({ error: "Failed to delete todo" });
      }
    });

    app.get("/users/:id/todos", async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const todos = await Todo.findAll({
          where: { userId: req.params.id },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "username", "email"],
            },
          ],
        });

        res.json(todos);
      } catch (error) {
        console.error("Error fetching user todos:", error);
        res.status(500).json({ error: "Failed to fetch user todos" });
      }
    });

    app.listen(PORT, () => {
      console.log(
        `Sequelize CRUD 서버가 http://localhost:${PORT}에서 실행 중입니다.`
      );
      console.log("\n=== Sequelize ORM 기반 API 엔드포인트 ===");
      console.log("Users:");
      console.log(
        "  GET    /users         - 모든 사용자 조회 (관련 할일 포함)"
      );
      console.log("  POST   /users         - 새 사용자 생성");
      console.log(
        "  GET    /users/:id     - 특정 사용자 조회 (관련 할일 포함)"
      );
      console.log("  PUT    /users/:id     - 사용자 정보 수정");
      console.log("  DELETE /users/:id     - 사용자 삭제");
      console.log("");
      console.log("Todos:");
      console.log(
        "  GET    /todos         - 모든 할일 조회 (사용자 정보 포함)"
      );
      console.log("  POST   /todos         - 새 할일 생성 (userId 필요)");
      console.log("  GET    /todos/:id     - 특정 할일 조회");
      console.log("  PUT    /todos/:id     - 할일 수정");
      console.log("  DELETE /todos/:id     - 할일 삭제");
      console.log("");
      console.log("Relations:");
      console.log("  GET    /users/:id/todos - 특정 사용자의 할일 조회");
      console.log("\n=== Sequelize 주요 메서드 ===");
      console.log("- User.findAll() : SELECT * FROM users");
      console.log("- User.create()  : INSERT INTO users");
      console.log("- User.findByPk(): SELECT * FROM users WHERE id = ?");
      console.log("- User.update()  : UPDATE users SET ... WHERE ...");
      console.log("- User.destroy() : DELETE FROM users WHERE ...");
    });
  } catch (error) {
    console.error("서버 시작 실패:", error);
    process.exit(1);
  }
}

startServer();
