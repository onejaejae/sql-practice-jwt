# Simple Auth System 클라이언트

## 개요

`week7_simple_auth.js` API를 위한 완전한 웹 클라이언트입니다.

## 주요 기능

### 🔐 인증 시스템
- **로그인/회원가입**: JWT + Refresh Token 방식
- **자동 토큰 갱신**: Access Token 만료 시 자동 재발급
- **세션 지속성**: 브라우저 재시작 후에도 로그인 상태 유지

### 👤 사용자 관리
- **프로필 표시**: 사용자 이름, 이메일, 역할 정보
- **역할 구분**: USER vs ADMIN 배지 표시
- **관리자 전용**: 전체 사용자 목록 조회 (ADMIN 역할만)

### 📋 Todo 관리
- **CRUD 작업**: 생성, 조회, 수정, 삭제
- **소유권 기반 접근**: 본인 Todo만 수정/삭제 가능
- **관리자 권한**: ADMIN은 모든 사용자의 Todo 관리 가능
- **실시간 업데이트**: 상태 변경 시 즉시 반영

## 사용 방법

### 1. 서버 실행
```bash
# week7_simple_auth.js 서버 실행 (포트 3006)
npm run dev:simple-auth
```

### 2. 클라이언트 실행
```bash
# 브라우저에서 클라이언트 폴더의 index.html 파일 열기
open client/index.html
```

또는 간단한 HTTP 서버 사용:
```bash
cd client
python3 -m http.server 8080
# http://localhost:8080 접속
```

### 3. 테스트 계정
- **관리자**: admin@test.com / admin123
- **일반 사용자**: 회원가입으로 생성

## 구현된 API 연동

### 인증 API
- `POST /auth/login` - 로그인
- `POST /auth/register` - 회원가입  
- `POST /auth/refresh` - 토큰 재발급

### 사용자 API
- `GET /users/me` - 내 정보 조회
- `GET /admin/users` - 전체 사용자 조회 (ADMIN 전용)

### Todo API
- `GET /todos` - Todo 목록 조회
- `POST /todos` - 새 Todo 생성
- `PATCH /todos/:id` - Todo 수정 (완료 상태 토글)
- `DELETE /todos/:id` - Todo 삭제

## 클라이언트 특징

### 🎨 반응형 디자인
- 모바일/데스크톱 호환
- 모던한 그라데이션 UI
- 직관적인 탭 인터페이스

### 🔄 자동 토큰 관리
- Access Token 자동 갱신
- 만료 시 사용자에게 알림
- LocalStorage 기반 세션 관리

### ✅ 실시간 피드백
- 성공/실패 알림 시스템
- 로딩 상태 표시
- 확인 다이얼로그

### 🛡️ 보안 고려사항
- XSS 방지를 위한 안전한 DOM 조작
- 토큰 검증 및 자동 갱신
- 권한별 UI 요소 제어

## 파일 구조

```
client/
├── index.html      # 메인 HTML 페이지
├── client.js       # JavaScript 로직
└── README.md       # 사용법 안내
```

## 브라우저 호환성

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+