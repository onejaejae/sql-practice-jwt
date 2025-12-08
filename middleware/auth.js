const jwt = require("jsonwebtoken");

// JWT 비밀키 (실제 프로젝트에서는 환경변수 사용 권장)
const JWT_SECRET = "your-secret-key-change-in-production";

// JWT 토큰 생성 함수
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h", // 24시간 후 만료
  });
};

// JWT 토큰 검증 함수
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// 인증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  console.log("req.headers----", req.headers);
  console.log("authHeader-----", authHeader);

  if (!token) {
    return res.status(401).json({
      message: "액세스 토큰이 필요합니다",
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // 토큰에서 추출한 사용자 정보를 req.user에 저장
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "토큰이 만료되었습니다",
      });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({
        message: "유효하지 않은 토큰입니다",
      });
    }
    return res.status(500).json({
      message: "토큰 검증 중 오류가 발생했습니다",
    });
  }
};

// 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 진행)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      const decoded = verifyToken(token);
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

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
  JWT_SECRET,
};
