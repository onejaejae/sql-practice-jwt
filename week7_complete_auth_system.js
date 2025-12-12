/*
Week 7: 완전한 인증/인가 시스템 (Complete Auth & AuthZ System)

특징:
- Refresh Token을 통한 토큰 재발급
- Role-Based Access Control (RBAC)
- 자원 소유권 검증
- 계정 상태 관리
- 보안 헤더 및 CORS
- Rate Limiting

테스트 방법:
1. npm install 실행
2. npm run dev:complete-auth 실행 (포트 3005)
3. API 테스트:
   - 회원가입/로그인으로 토큰 쌍 받기
   - Access Token 만료 시 Refresh Token으로 갱신
   - 관리자 권한이 필요한 API 테스트
   - 소유권 검증이 필요한 API 테스트
*/

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// 고급 인증 미들웨어 import
const {
    generateTokenPair,
    verifyAccessToken,
    verifyRefreshToken,
    authenticateToken,
    checkRole,
    requireAdmin,
    checkOwnership,
    requireSelfOrAdmin,
    checkAccountStatus,
    authErrors
} = require('./middleware/advancedAuth');

const app = express();
const PORT = 3005;

// 보안 미들웨어 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'], // 허용할 오리진
    credentials: true, // 쿠키 허용
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting - 일반 요청
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100, // 최대 100회 요청
    message: {
        message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate Limiting - 인증 요청 (더 엄격)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5, // 최대 5회 시도
    message: {
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    }
});

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));

// 데이터베이스 연결
const dbPath = path.join(__dirname, 'complete_auth.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
    } else {
        console.log('complete_auth.db 데이터베이스 연결 성공!');
    }
});

// 테이블 생성
db.serialize(() => {
    // 사용자 테이블 (역할 및 상태 포함)
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            permissions TEXT DEFAULT '[]',
            lastLogin TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('users 테이블 생성 실패:', err.message);
        } else {
            console.log('users 테이블 준비 완료!');
        }
    });

    // Refresh Token 저장 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            is_revoked INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('refresh_tokens 테이블 생성 실패:', err.message);
        } else {
            console.log('refresh_tokens 테이블 준비 완료!');
        }
    });

    // Todo 테이블 (사용자별 + 관리자 관리 가능)
    db.run(`
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            completed INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'medium',
            due_date TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('todos 테이블 생성 실패:', err.message);
        } else {
            console.log('todos 테이블 준비 완료!');
        }
    });

    // 기본 관리자 계정 생성 (없는 경우)
    db.get('SELECT * FROM users WHERE email = ?', ['admin@system.com'], async (err, admin) => {
        if (err) {
            console.error('관리자 계정 확인 실패:', err.message);
            return;
        }
        
        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123456', 10);
            db.run(
                'INSERT INTO users (name, email, password, role, permissions) VALUES (?, ?, ?, ?, ?)',
                ['System Admin', 'admin@system.com', hashedPassword, 'admin', JSON.stringify(['ALL'])],
                function(err) {
                    if (err) {
                        console.error('관리자 계정 생성 실패:', err.message);
                    } else {
                        console.log('🔑 기본 관리자 계정 생성 완료:');
                        console.log('   이메일: admin@system.com');
                        console.log('   비밀번호: admin123456');
                    }
                }
            );
        }
    });
});

// 유틸리티 함수들
function isValidEmail(email) {
    return email && email.includes('@') && email.includes('.');
}

function isValidPassword(password) {
    return password && password.length >= 6;
}

// Refresh Token 저장 함수
function saveRefreshToken(userId, refreshToken) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7일 후
    
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, refreshToken, expiresAt],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Refresh Token 검증 및 조회 함수
function validateRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT rt.*, u.id as user_id, u.name, u.email, u.role, u.status, u.permissions 
             FROM refresh_tokens rt 
             JOIN users u ON rt.user_id = u.id 
             WHERE rt.token = ? AND rt.is_revoked = 0 AND datetime(rt.expires_at) > datetime('now')`,
            [refreshToken],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Refresh Token 무효화 함수
function revokeRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?',
            [refreshToken],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

// ================================
// 인증 관련 API 엔드포인트
// ================================

// POST /auth/register - 회원가입
app.post('/auth/register', authLimiter, async (req, res) => {
    const { name, email, password, role = 'user' } = req.body;
    
    // 입력 검증
    if (!name || !email || !password) {
        return res.status(400).json({ 
            message: '이름, 이메일, 비밀번호는 필수입니다',
            code: 'MISSING_REQUIRED_FIELDS'
        });
    }
    
    if (!isValidEmail(email)) {
        return res.status(400).json({ 
            message: '올바른 이메일 형식이 아닙니다',
            code: 'INVALID_EMAIL_FORMAT'
        });
    }
    
    if (!isValidPassword(password)) {
        return res.status(400).json({ 
            message: '비밀번호는 최소 6자 이상이어야 합니다',
            code: 'INVALID_PASSWORD_LENGTH'
        });
    }

    // 역할 검증 (일반 사용자는 admin 역할로 가입 불가)
    if (role === 'admin') {
        return res.status(403).json({ 
            message: '관리자 계정은 직접 생성할 수 없습니다',
            code: 'ADMIN_REGISTRATION_FORBIDDEN'
        });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        
        db.run(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role],
            async function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ 
                            message: '이미 존재하는 이메일입니다',
                            code: 'EMAIL_ALREADY_EXISTS'
                        });
                    }
                    return res.status(500).json({ 
                        message: '회원가입 처리 중 오류가 발생했습니다',
                        code: 'REGISTRATION_ERROR'
                    });
                }
                
                // 토큰 생성
                const payload = { 
                    id: this.lastID, 
                    email, 
                    name, 
                    role,
                    status: 'active',
                    permissions: []
                };
                
                const { accessToken, refreshToken } = generateTokenPair(payload);
                
                // Refresh Token 저장
                try {
                    await saveRefreshToken(this.lastID, refreshToken);
                    
                    res.status(201).json({
                        message: '회원가입이 완료되었습니다',
                        user: {
                            id: this.lastID,
                            name,
                            email,
                            role
                        },
                        tokens: {
                            accessToken,
                            refreshToken,
                            accessTokenExpiresIn: '15m',
                            refreshTokenExpiresIn: '7d'
                        }
                    });
                } catch (tokenError) {
                    console.error('Refresh Token 저장 실패:', tokenError);
                    return res.status(500).json({ 
                        message: '토큰 생성 중 오류가 발생했습니다',
                        code: 'TOKEN_CREATION_ERROR'
                    });
                }
            }
        );
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// POST /auth/login - 로그인
app.post('/auth/login', authLimiter, (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            message: '이메일과 비밀번호를 입력해주세요',
            code: 'MISSING_CREDENTIALS'
        });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ 
                message: '로그인 처리 중 오류가 발생했습니다',
                code: 'LOGIN_ERROR'
            });
        }
        
        if (!user) {
            return res.status(401).json({ 
                message: '존재하지 않는 이메일입니다',
                code: 'EMAIL_NOT_FOUND'
            });
        }

        // 계정 상태 확인
        if (user.status !== 'active') {
            return res.status(403).json({ 
                message: user.status === 'suspended' ? '정지된 계정입니다' : '비활성화된 계정입니다',
                code: 'ACCOUNT_' + user.status.toUpperCase()
            });
        }
        
        try {
            const isValidPassword = await bcrypt.compare(password, user.password);
            
            if (!isValidPassword) {
                return res.status(401).json({ 
                    message: '비밀번호가 틀렸습니다',
                    code: 'INVALID_PASSWORD'
                });
            }
            
            // 마지막 로그인 시간 업데이트
            db.run(
                'UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );
            
            const payload = { 
                id: user.id, 
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status,
                permissions: JSON.parse(user.permissions || '[]')
            };
            
            const { accessToken, refreshToken } = generateTokenPair(payload);
            
            // Refresh Token 저장
            saveRefreshToken(user.id, refreshToken)
                .then(() => {
                    res.json({
                        message: '로그인 성공',
                        user: {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            lastLogin: user.lastLogin
                        },
                        tokens: {
                            accessToken,
                            refreshToken,
                            accessTokenExpiresIn: '15m',
                            refreshTokenExpiresIn: '7d'
                        }
                    });
                })
                .catch((tokenError) => {
                    console.error('Refresh Token 저장 실패:', tokenError);
                    return res.status(500).json({ 
                        message: '토큰 생성 중 오류가 발생했습니다',
                        code: 'TOKEN_CREATION_ERROR'
                    });
                });
        } catch (error) {
            console.error('로그인 검증 오류:', error);
            res.status(500).json({ 
                message: '로그인 처리 중 오류가 발생했습니다',
                code: 'LOGIN_VERIFICATION_ERROR'
            });
        }
    });
});

// POST /auth/refresh - 토큰 재발급
app.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(401).json({ 
            message: 'Refresh Token이 필요합니다',
            code: 'REFRESH_TOKEN_REQUIRED'
        });
    }
    
    try {
        // Refresh Token 검증
        const decoded = verifyRefreshToken(refreshToken);
        
        // DB에서 토큰 유효성 확인
        const tokenData = await validateRefreshToken(refreshToken);
        
        if (!tokenData) {
            return res.status(401).json({ 
                message: '유효하지 않은 Refresh Token입니다',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }

        // 계정 상태 재확인
        if (tokenData.status !== 'active') {
            return res.status(403).json({ 
                message: '계정이 비활성화되었습니다',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }
        
        // 새로운 토큰 쌍 생성
        const payload = {
            id: tokenData.user_id,
            email: tokenData.email,
            name: tokenData.name,
            role: tokenData.role,
            status: tokenData.status,
            permissions: JSON.parse(tokenData.permissions || '[]')
        };
        
        const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(payload);
        
        // 기존 Refresh Token 무효화 및 새 토큰 저장
        await revokeRefreshToken(refreshToken);
        await saveRefreshToken(tokenData.user_id, newRefreshToken);
        
        res.json({
            message: '토큰이 갱신되었습니다',
            tokens: {
                accessToken,
                refreshToken: newRefreshToken,
                accessTokenExpiresIn: '15m',
                refreshTokenExpiresIn: '7d'
            }
        });
        
    } catch (error) {
        console.error('토큰 갱신 오류:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Refresh Token이 만료되었습니다. 다시 로그인해주세요',
                code: 'REFRESH_TOKEN_EXPIRED'
            });
        }
        
        return res.status(401).json({ 
            message: '토큰 갱신에 실패했습니다',
            code: 'TOKEN_REFRESH_FAILED'
        });
    }
});

// POST /auth/logout - 로그아웃 (토큰 무효화)
app.post('/auth/logout', authenticateToken, async (req, res) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
        try {
            await revokeRefreshToken(refreshToken);
        } catch (error) {
            console.error('Refresh Token 무효화 실패:', error);
        }
    }
    
    res.json({ 
        message: '로그아웃되었습니다',
        code: 'LOGOUT_SUCCESS'
    });
});

// ================================
// 사용자 관리 API (역할 기반 접근 제어)
// ================================

// GET /users/me - 내 정보 조회
app.get('/users/me', authenticateToken, checkAccountStatus, (req, res) => {
    const userId = req.user.id;
    
    db.get(
        'SELECT id, name, email, role, status, permissions, lastLogin, createdAt FROM users WHERE id = ?',
        [userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ 
                    message: '사용자 정보 조회 중 오류가 발생했습니다',
                    code: 'USER_FETCH_ERROR'
                });
            }
            
            if (!user) {
                return res.status(404).json({ 
                    message: '사용자를 찾을 수 없습니다',
                    code: 'USER_NOT_FOUND'
                });
            }

            // 권한 정보 파싱
            user.permissions = JSON.parse(user.permissions || '[]');
            
            res.json(user);
        }
    );
});

// GET /admin/users - 모든 사용자 조회 (관리자 전용)
app.get('/admin/users', authenticateToken, checkAccountStatus, requireAdmin, (req, res) => {
    const { page = 1, limit = 10, role, status } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    
    if (role) {
        whereClause += ' WHERE role = ?';
        params.push(role);
    }
    
    if (status) {
        whereClause += (whereClause ? ' AND' : ' WHERE') + ' status = ?';
        params.push(status);
    }
    
    // 총 개수 조회
    db.get(
        `SELECT COUNT(*) as total FROM users${whereClause}`,
        params,
        (err, countResult) => {
            if (err) {
                return res.status(500).json({ 
                    message: '사용자 목록 조회 중 오류가 발생했습니다',
                    code: 'USERS_FETCH_ERROR'
                });
            }
            
            // 사용자 목록 조회
            db.all(
                `SELECT id, name, email, role, status, permissions, lastLogin, createdAt 
                 FROM users${whereClause} 
                 ORDER BY createdAt DESC 
                 LIMIT ? OFFSET ?`,
                [...params, parseInt(limit), offset],
                (err, users) => {
                    if (err) {
                        return res.status(500).json({ 
                            message: '사용자 목록 조회 중 오류가 발생했습니다',
                            code: 'USERS_FETCH_ERROR'
                        });
                    }
                    
                    // 각 사용자의 권한 정보 파싱
                    const processedUsers = users.map(user => ({
                        ...user,
                        permissions: JSON.parse(user.permissions || '[]')
                    }));
                    
                    res.json({
                        users: processedUsers,
                        pagination: {
                            current: parseInt(page),
                            total: Math.ceil(countResult.total / limit),
                            totalItems: countResult.total,
                            limit: parseInt(limit)
                        },
                        requestedBy: req.user
                    });
                }
            );
        }
    );
});

// PATCH /admin/users/:id/role - 사용자 역할 변경 (관리자 전용)
app.patch('/admin/users/:id/role', authenticateToken, checkAccountStatus, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['user', 'admin', 'moderator'].includes(role)) {
        return res.status(400).json({ 
            message: '유효하지 않은 역할입니다',
            code: 'INVALID_ROLE'
        });
    }
    
    // 자신의 역할은 변경할 수 없음
    if (parseInt(id) === req.user.id) {
        return res.status(403).json({ 
            message: '자신의 역할은 변경할 수 없습니다',
            code: 'CANNOT_CHANGE_OWN_ROLE'
        });
    }
    
    db.run(
        'UPDATE users SET role = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [role, id],
        function(err) {
            if (err) {
                return res.status(500).json({ 
                    message: '역할 변경 중 오류가 발생했습니다',
                    code: 'ROLE_UPDATE_ERROR'
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    message: '사용자를 찾을 수 없습니다',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            res.json({ 
                message: '역할이 변경되었습니다',
                changedBy: req.user.name,
                newRole: role
            });
        }
    );
});

// PATCH /admin/users/:id/status - 사용자 상태 변경 (관리자 전용)
app.patch('/admin/users/:id/status', authenticateToken, checkAccountStatus, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({ 
            message: '유효하지 않은 상태입니다',
            code: 'INVALID_STATUS'
        });
    }
    
    // 자신의 상태는 변경할 수 없음
    if (parseInt(id) === req.user.id) {
        return res.status(403).json({ 
            message: '자신의 계정 상태는 변경할 수 없습니다',
            code: 'CANNOT_CHANGE_OWN_STATUS'
        });
    }
    
    db.run(
        'UPDATE users SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        function(err) {
            if (err) {
                return res.status(500).json({ 
                    message: '계정 상태 변경 중 오류가 발생했습니다',
                    code: 'STATUS_UPDATE_ERROR'
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    message: '사용자를 찾을 수 없습니다',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            // 상태 변경 시 모든 Refresh Token 무효화
            if (status !== 'active') {
                db.run('UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?', [id]);
            }
            
            res.json({ 
                message: '계정 상태가 변경되었습니다',
                changedBy: req.user.name,
                newStatus: status
            });
        }
    );
});

// ================================
// Todo 관리 API (소유권 기반 접근 제어)
// ================================

// GET /todos - 내 할 일 목록 조회
app.get('/todos', authenticateToken, checkAccountStatus, (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { completed, priority, page = 1, limit = 10 } = req.query;
    
    let whereClause = '';
    const params = [];
    
    // 관리자는 모든 할 일 조회 가능, 일반 사용자는 자신의 것만
    if (userRole !== 'admin') {
        whereClause = ' WHERE user_id = ?';
        params.push(userId);
    } else {
        whereClause = '';
    }
    
    if (completed !== undefined) {
        whereClause += (whereClause ? ' AND' : ' WHERE') + ' completed = ?';
        params.push(completed === 'true' ? 1 : 0);
    }
    
    if (priority) {
        whereClause += (whereClause ? ' AND' : ' WHERE') + ' priority = ?';
        params.push(priority);
    }
    
    const offset = (page - 1) * limit;
    
    db.all(
        `SELECT t.*, u.name as owner_name, u.email as owner_email 
         FROM todos t 
         JOIN users u ON t.user_id = u.id${whereClause} 
         ORDER BY t.createdAt DESC 
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset],
        (err, todos) => {
            if (err) {
                return res.status(500).json({ 
                    message: '할 일 목록 조회 중 오류가 발생했습니다',
                    code: 'TODOS_FETCH_ERROR'
                });
            }
            
            res.json({
                todos,
                isAdmin: userRole === 'admin',
                user: req.user
            });
        }
    );
});

// POST /todos - 새 할 일 추가
app.post('/todos', authenticateToken, checkAccountStatus, (req, res) => {
    const { title, description, priority = 'medium', due_date } = req.body;
    const userId = req.user.id;
    
    if (!title) {
        return res.status(400).json({ 
            message: '제목은 필수입니다',
            code: 'TITLE_REQUIRED'
        });
    }
    
    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({ 
            message: '유효하지 않은 우선순위입니다',
            code: 'INVALID_PRIORITY'
        });
    }
    
    db.run(
        'INSERT INTO todos (user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)',
        [userId, title, description, priority, due_date],
        function(err) {
            if (err) {
                return res.status(500).json({ 
                    message: '할 일 생성 중 오류가 발생했습니다',
                    code: 'TODO_CREATION_ERROR'
                });
            }
            
            // 생성된 할 일 조회
            db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, todo) => {
                if (err) {
                    return res.status(500).json({ 
                        message: '생성된 할 일 조회 중 오류가 발생했습니다',
                        code: 'TODO_FETCH_ERROR'
                    });
                }
                
                res.status(201).json({
                    message: '할 일이 추가되었습니다',
                    todo
                });
            });
        }
    );
});

// PATCH /todos/:id - 할 일 수정 (소유권 검증)
app.patch('/todos/:id', authenticateToken, checkAccountStatus, checkOwnership('id', 'user_id'), (req, res) => {
    const { id } = req.params;
    const { title, description, completed, priority, due_date } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // 먼저 할 일 조회 및 소유권 확인
    db.get('SELECT * FROM todos WHERE id = ?', [id], (err, todo) => {
        if (err) {
            return res.status(500).json({ 
                message: '할 일 조회 중 오류가 발생했습니다',
                code: 'TODO_FETCH_ERROR'
            });
        }
        
        if (!todo) {
            return res.status(404).json({ 
                message: '할 일을 찾을 수 없습니다',
                code: 'TODO_NOT_FOUND'
            });
        }
        
        // 소유권 검증 (관리자는 모든 할 일 수정 가능)
        if (!isAdmin && !req.checkOwnership(todo)) {
            return res.status(403).json({ 
                message: '본인의 할 일만 수정할 수 있습니다',
                code: 'ACCESS_DENIED'
            });
        }
        
        // 수정할 필드 동적 구성
        const updates = [];
        const values = [];
        
        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({ 
                    message: '제목은 빈 값일 수 없습니다',
                    code: 'EMPTY_TITLE'
                });
            }
            updates.push('title = ?');
            values.push(title);
        }
        
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        
        if (completed !== undefined) {
            updates.push('completed = ?');
            values.push(completed ? 1 : 0);
        }
        
        if (priority !== undefined) {
            if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
                return res.status(400).json({ 
                    message: '유효하지 않은 우선순위입니다',
                    code: 'INVALID_PRIORITY'
                });
            }
            updates.push('priority = ?');
            values.push(priority);
        }
        
        if (due_date !== undefined) {
            updates.push('due_date = ?');
            values.push(due_date);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ 
                message: '수정할 내용이 없습니다',
                code: 'NO_UPDATES'
            });
        }
        
        updates.push('updatedAt = CURRENT_TIMESTAMP');
        values.push(id);
        
        const sql = `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(sql, values, function(err) {
            if (err) {
                return res.status(500).json({ 
                    message: '할 일 수정 중 오류가 발생했습니다',
                    code: 'TODO_UPDATE_ERROR'
                });
            }
            
            // 수정된 할 일 조회
            db.get('SELECT * FROM todos WHERE id = ?', [id], (err, updatedTodo) => {
                if (err) {
                    return res.status(500).json({ 
                        message: '수정된 할 일 조회 중 오류가 발생했습니다',
                        code: 'TODO_FETCH_ERROR'
                    });
                }
                
                res.json({
                    message: '할 일이 수정되었습니다',
                    todo: updatedTodo,
                    modifiedBy: req.user.name
                });
            });
        });
    });
});

// DELETE /todos/:id - 할 일 삭제 (소유권 검증)
app.delete('/todos/:id', authenticateToken, checkAccountStatus, checkOwnership('id', 'user_id'), (req, res) => {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    
    // 먼저 할 일 조회 및 소유권 확인
    db.get('SELECT * FROM todos WHERE id = ?', [id], (err, todo) => {
        if (err) {
            return res.status(500).json({ 
                message: '할 일 조회 중 오류가 발생했습니다',
                code: 'TODO_FETCH_ERROR'
            });
        }
        
        if (!todo) {
            return res.status(404).json({ 
                message: '할 일을 찾을 수 없습니다',
                code: 'TODO_NOT_FOUND'
            });
        }
        
        // 소유권 검증 (관리자는 모든 할 일 삭제 가능)
        if (!isAdmin && !req.checkOwnership(todo)) {
            return res.status(403).json({ 
                message: '본인의 할 일만 삭제할 수 있습니다',
                code: 'ACCESS_DENIED'
            });
        }
        
        db.run('DELETE FROM todos WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ 
                    message: '할 일 삭제 중 오류가 발생했습니다',
                    code: 'TODO_DELETE_ERROR'
                });
            }
            
            res.json({ 
                message: '할 일이 삭제되었습니다',
                deletedBy: req.user.name
            });
        });
    });
});

// ================================
// 통계 및 공개 API
// ================================

// GET /admin/stats - 관리자 통계 (관리자 전용)
app.get('/admin/stats', authenticateToken, checkAccountStatus, requireAdmin, (req, res) => {
    const queries = [
        'SELECT COUNT(*) as totalUsers FROM users',
        'SELECT COUNT(*) as activeUsers FROM users WHERE status = "active"',
        'SELECT COUNT(*) as totalTodos FROM todos',
        'SELECT COUNT(*) as completedTodos FROM todos WHERE completed = 1',
        'SELECT role, COUNT(*) as count FROM users GROUP BY role'
    ];
    
    Promise.all(queries.map(query => 
        new Promise((resolve, reject) => {
            db.all(query, [], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        })
    )).then(results => {
        const [totalUsers, activeUsers, totalTodos, completedTodos, roleStats] = results;
        
        res.json({
            summary: {
                totalUsers: totalUsers[0].totalUsers,
                activeUsers: activeUsers[0].activeUsers,
                totalTodos: totalTodos[0].totalTodos,
                completedTodos: completedTodos[0].completedTodos,
                completionRate: totalTodos[0].totalTodos > 0 ? 
                    ((completedTodos[0].completedTodos / totalTodos[0].totalTodos) * 100).toFixed(2) + '%' : '0%'
            },
            roleDistribution: roleStats,
            generatedAt: new Date().toISOString(),
            generatedBy: req.user.name
        });
    }).catch(error => {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ 
            message: '통계 조회 중 오류가 발생했습니다',
            code: 'STATS_ERROR'
        });
    });
});

// GET /public/system-info - 시스템 정보 (인증 불필요)
app.get('/public/system-info', (req, res) => {
    res.json({
        name: 'Complete Auth & Authorization System',
        version: '1.0.0',
        features: [
            'JWT Authentication with Refresh Tokens',
            'Role-Based Access Control (RBAC)',
            'Resource Ownership Validation',
            'Account Status Management',
            'Rate Limiting',
            'Security Headers'
        ],
        endpoints: {
            auth: ['POST /auth/register', 'POST /auth/login', 'POST /auth/refresh', 'POST /auth/logout'],
            users: ['GET /users/me', 'GET /admin/users', 'PATCH /admin/users/:id/role'],
            todos: ['GET /todos', 'POST /todos', 'PATCH /todos/:id', 'DELETE /todos/:id'],
            admin: ['GET /admin/stats']
        },
        roles: ['user', 'admin', 'moderator'],
        permissions: ['READ', 'WRITE', 'DELETE', 'ADMIN'],
        serverTime: new Date().toISOString()
    });
});

// 404 에러 핸들러
app.use('*', (req, res) => {
    res.status(404).json({
        message: '요청하신 엔드포인트를 찾을 수 없습니다',
        code: 'ENDPOINT_NOT_FOUND',
        availableEndpoints: '/public/system-info'
    });
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
    console.error('전역 에러:', error);
    res.status(500).json({
        message: '서버 내부 오류가 발생했습니다',
        code: 'INTERNAL_SERVER_ERROR'
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log('🚀 완전한 인증/인가 시스템 서버가 시작되었습니다!');
    console.log(`📡 서버 주소: http://localhost:${PORT}`);
    console.log('🔐 보안 기능:');
    console.log('   ✅ Refresh Token 재발급');
    console.log('   ✅ Role-Based Access Control (RBAC)');
    console.log('   ✅ 자원 소유권 검증');
    console.log('   ✅ 계정 상태 관리');
    console.log('   ✅ Rate Limiting');
    console.log('   ✅ Security Headers (Helmet)');
    console.log('   ✅ CORS 설정');
    console.log('📚 API 문서: GET /public/system-info');
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
    console.log('\n서버를 안전하게 종료합니다...');
    
    db.close((err) => {
        if (err) {
            console.error('데이터베이스 연결 종료 실패:', err.message);
        } else {
            console.log('데이터베이스 연결이 정상적으로 종료되었습니다.');
        }
        process.exit(0);
    });
});