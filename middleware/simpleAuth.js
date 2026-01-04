const jwt = require("jsonwebtoken");

// JWT 비밀키들 (실제 프로젝트에서는 환경변수 사용)
const ACCESS_TOKEN_SECRET = "access-token-secret-key";
const REFRESH_TOKEN_SECRET = "refresh-token-secret-key";

// Access Token 생성 (15분)
const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
};

// Refresh Token 생성 (7일)
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

// 토큰 쌍 생성
const generateTokenPair = (payload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
};

// Access Token 검증
const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

// Refresh Token 검증
const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};

// 인증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      message: "액세스 토큰이 필요합니다",
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    console.log("decoded111111", decoded);
    req.user = decoded; // 토큰에서 사용자 정보 추출
    next();
  } catch (error) {
    console.log("error----", error);
    console.log("error name----", error.name);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "토큰이 만료되었습니다. refresh token으로 갱신하세요",
      });
    }
    return res.status(403).json({
      message: "유효하지 않은 토큰입니다",
    });
  }
};

// 관리자 권한 확인 미들웨어
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "로그인이 필요합니다",
    });
  }

  console.log("req.user----------", req.user);
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "관리자 권한이 필요합니다",
    });
  }

  next();
};

// 본인 또는 관리자만 접근 가능 미들웨어
const requireSelfOrAdmin = (userIdParam = "id") => {
  return (req, res, next) => {
    const targetUserId = parseInt(req.params[userIdParam]);
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    // 관리자이거나 본인인 경우만 허용
    if (currentUserRole === "ADMIN" || currentUserId === targetUserId) {
      return next();
    }

    return res.status(403).json({
      message: "본인의 정보만 접근할 수 있습니다",
    });
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  authenticateToken,
  requireAdmin,
  requireSelfOrAdmin,
};
