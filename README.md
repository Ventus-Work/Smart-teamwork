# Smart Teamwork 협업 플랫폼

10명 내외의 소규모 팀을 위한 협업 할 일 관리 웹 애플리케이션입니다. 실시간 대시보드, 댓글 기능, 프로젝트 관리, 캘린더 뷰를 제공합니다.

## ✨ 주요 기능

- 📊 **실시간 대시보드** - 팀 전체 할 일 통계 및 상태별 필터링
- ✅ **할 일 관리** - 우선순위 설정, 마감일 관리, 프로젝트별 분류
- 🎯 **프로젝트 관리** - 색상별 프로젝트 구분, 진행률 표시
- 💬 **실시간 댓글** - 할 일별 댓글 시스템
- 📅 **스마트 캘린더** - 월간/주간 뷰, 마감일 시각화
- 🔐 **Google OAuth** - 간편한 소셜 로그인
- 🔍 **고급 필터링** - 상태별, 프로젝트별 필터링

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Tailwind CSS CDN
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Authentication**: Google OAuth via Supabase Auth
- **Deployment**: Vercel

## 📁 프로젝트 구조

```
smart-teamwork/
├── index.html          # 메인 HTML 파일
├── script.js           # 메인 JavaScript 로직
├── style.css           # 커스텀 CSS 스타일
├── env.example.js      # 환경변수 예시 파일
├── vercel.json         # Vercel 배포 설정
├── package.json        # NPM 패키지 설정
├── README.md           # 프로젝트 문서
├── LICENSE             # MIT 라이선스
└── .gitignore          # Git 무시 파일
```

## 🚀 시작하기

### 로컬 개발

1. **저장소 클론**
   ```bash
   git clone https://github.com/yourusername/smart-teamwork.git
   cd smart-teamwork
   ```

2. **환경변수 설정**
   ```bash
   cp env.example.js env.js
   # env.js 파일을 편집하여 실제 Supabase 설정값 입력
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

### Vercel 배포

1. GitHub 저장소 연결
2. Vercel 환경변수 설정:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 🔧 Supabase 설정

### 필요한 테이블
- `workspaces` - 팀 워크스페이스
- `workspace_members` - 멤버십 관리
- `projects` - 프로젝트 정보
- `todos` - 할 일 목록
- `comments` - 댓글 시스템
- `profiles` - 사용자 프로필

### Google OAuth 설정
1. Supabase 대시보드 → Authentication → Providers
2. Google 프로바이더 활성화
3. 승인된 리디렉션 URI 추가

## 🎮 사용법

### 데모 모드
- 로그인 없이 "데모 체험하기" 버튼 클릭
- 모든 기능을 로컬 스토리지로 시뮬레이션

### 실제 사용
1. Google 계정으로 로그인
2. 자동 워크스페이스 생성
3. 프로젝트 및 할 일 관리

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조