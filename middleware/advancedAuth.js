const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT 비밀키들 (실제 프로젝트에서는 환경변수 사용)
const ACCESS_TOKEN_SECRET = 'access-token-secret-key';
const REFRESH_TOKEN_SECRET = 'refresh-token-secret-key';

// Access Token 생성 (짧은 만료 시간)
const generateAccessToken = (payload) => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { 
        expiresIn: '15m' // 15분
    });
};

// Refresh Token 생성 (긴 만료 시간)
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { 
        expiresIn: '7d' // 7일
    });
};

// Access Token 검증
const verifyAccessToken = (token) => {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

// Refresh Token 검증
const verifyRefreshToken = (token) => {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
};

// 토큰 쌍 생성 (Access + Refresh)
const generateTokenPair = (payload) => {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    
    return { accessToken, refreshToken };
};

// 기본 인증 미들웨어 (Access Token 필수)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            message: '액세스 토큰이 필요합니다',
            code: 'TOKEN_REQUIRED'
        });
    }

    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: '토큰이 만료되었습니다',
                code: 'TOKEN_EXPIRED'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ 
                message: '유효하지 않은 토큰입니다',
                code: 'TOKEN_INVALID'
            });
        }
        return res.status(500).json({ 
            message: '토큰 검증 중 오류가 발생했습니다',
            code: 'TOKEN_ERROR'
        });
    }
};

// 역할 기반 권한 검증 미들웨어
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                message: '인증이 필요합니다',
                code: 'AUTH_REQUIRED'
            });
        }

        const userRole = req.user.role;
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ 
                message: '접근 권한이 없습니다',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: allowedRoles,
                current: userRole
            });
        }

        next();
    };
};

// 관리자 전용 미들웨어
const requireAdmin = checkRole('admin');

// 소유권 검증 미들웨어 생성기
const checkOwnership = (resourceIdParam = 'id', userIdField = 'user_id') => {
    return async (req, res, next) => {
        const resourceId = req.params[resourceIdParam];
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        // 관리자는 모든 리소스에 접근 가능
        if (currentUserRole === 'admin') {
            return next();
        }

        try {
            // 리소스 소유권 확인을 위한 콜백 함수
            req.checkOwnership = (resource) => {
                if (!resource) {
                    return false;
                }
                return resource[userIdField] === currentUserId;
            };

            // 소유권 검증 정보를 req에 추가
            req.ownership = {
                resourceId,
                currentUserId,
                isAdmin: currentUserRole === 'admin'
            };

            next();
        } catch (error) {
            return res.status(500).json({ 
                message: '소유권 검증 중 오류가 발생했습니다',
                code: 'OWNERSHIP_CHECK_ERROR'
            });
        }
    };
};

// 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 진행)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = verifyAccessToken(token);
            req.user = decoded;
        } catch (error) {
            // 토큰이 유효하지 않아도 계속 진행
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
};

// 자신의 리소스만 접근 가능한 미들웨어
const requireSelfOrAdmin = (userIdParam = 'id') => {
    return (req, res, next) => {
        const targetUserId = parseInt(req.params[userIdParam]);
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        // 관리자이거나 본인인 경우만 허용
        if (currentUserRole === 'admin' || currentUserId === targetUserId) {
            return next();
        }

        return res.status(403).json({ 
            message: '자신의 정보만 조회/수정할 수 있습니다',
            code: 'SELF_ACCESS_ONLY'
        });
    };
};

// 계정 상태 검증 미들웨어
const checkAccountStatus = (req, res, next) => {
    const user = req.user;
    
    if (user.status === 'inactive') {
        return res.status(403).json({ 
            message: '비활성화된 계정입니다',
            code: 'ACCOUNT_INACTIVE'
        });
    }
    
    if (user.status === 'suspended') {
        return res.status(403).json({ 
            message: '정지된 계정입니다',
            code: 'ACCOUNT_SUSPENDED'
        });
    }
    
    next();
};

// 특정 권한(permission) 검증 미들웨어
const checkPermission = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                message: '인증이 필요합니다',
                code: 'AUTH_REQUIRED'
            });
        }

        const userPermissions = req.user.permissions || [];
        const hasPermission = requiredPermissions.some(permission => 
            userPermissions.includes(permission)
        );

        if (!hasPermission) {
            return res.status(403).json({ 
                message: '필요한 권한이 없습니다',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: requiredPermissions,
                current: userPermissions
            });
        }

        next();
    };
};

// 에러 응답 헬퍼 함수들
const authErrors = {
    tokenRequired: () => ({
        status: 401,
        message: '액세스 토큰이 필요합니다',
        code: 'TOKEN_REQUIRED'
    }),
    
    tokenExpired: () => ({
        status: 401,
        message: '토큰이 만료되었습니다',
        code: 'TOKEN_EXPIRED'
    }),
    
    tokenInvalid: () => ({
        status: 403,
        message: '유효하지 않은 토큰입니다',
        code: 'TOKEN_INVALID'
    }),
    
    insufficientPermissions: (required, current) => ({
        status: 403,
        message: '접근 권한이 없습니다',
        code: 'INSUFFICIENT_PERMISSIONS',
        required,
        current
    }),
    
    accessDenied: () => ({
        status: 403,
        message: '접근이 거부되었습니다',
        code: 'ACCESS_DENIED'
    }),
    
    resourceNotFound: () => ({
        status: 404,
        message: '리소스를 찾을 수 없습니다',
        code: 'RESOURCE_NOT_FOUND'
    })
};

module.exports = {
    // 토큰 관련
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateTokenPair,
    
    // 미들웨어
    authenticateToken,
    checkRole,
    requireAdmin,
    checkOwnership,
    optionalAuth,
    requireSelfOrAdmin,
    checkAccountStatus,
    checkPermission,
    
    // 유틸리티
    authErrors,
    
    // 상수
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET
};