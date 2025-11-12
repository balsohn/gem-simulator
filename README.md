# 💎 보석 가공 시뮬레이터

게임의 보석 가공 시스템을 재현한 웹 기반 시뮬레이터입니다. 전략적인 선택을 통해 최고 등급인 **슈퍼 에픽(16번 칸)**을 달성하세요!

![보석 가공 시뮬레이터](https://img.shields.io/badge/status-ready-brightgreen) ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## 🎮 게임 규칙

### 기본 시스템
- **총 8번의 시도** 기회
- **17개의 슬롯**으로 구성된 보드
- **시작 위치**: 1번 칸
- **목표**: 16번 칸(슈퍼 에픽) 달성

### 슬롯 등급
- **1~9번**: 희귀 (파란색)
- **10~13번**: 에픽 (보라색)
- **14~15번**: 희귀 (파란색)
- **16번**: 슈퍼 에픽 (빨간색) ⭐ **최고 등급!**
- **17번**: 꽝 (회색) - 랜덤 낮은 등급

### 가공 방법

#### 1️⃣ 세게 두드리기
- **이동 범위**: +3 ~ +6
- **사용 제한**: 무제한
- **특징**: 빠르게 앞으로 이동, 공격적인 전략

#### 2️⃣ 세공하기
- **이동 범위**: -3 ~ +2
- **사용 제한**: 3회
- **특징**: 뒤로도 이동 가능, 위치 조정에 유용

#### 3️⃣ 안정제 사용
- **이동 범위**: +0 ~ +4
- **사용 제한**: 3회
- **특징**: 안정적인 이동, 정밀한 착지

## ✨ 주요 기능

### 1. 실시간 게임 플레이
- 직관적인 UI로 쉬운 조작
- 실시간 위치 표시 및 등급 확인
- 가공 기록 로그

### 2. 📊 확률 통계 분석
- **10,000회 몬테카를로 시뮬레이션**
- 각 등급별 도달 확률 계산
- 무작위 전략 vs 최적 전략 비교

### 3. 🎯 최적 전략 추천
- 현재 위치 기반 실시간 전략 분석
- 4가지 전략 시나리오 제공:
  - 직진 전략
  - 안정 전략
  - 정밀 조정 전략
  - 역산 전략 (초과 시)
- 각 전략의 예상 성공률 표시

### 4. 🎨 멋진 UI/UX
- 그라데이션 배경 및 애니메이션
- 반응형 디자인 (모바일 지원)
- 등급별 색상 구분
- 가공 시 애니메이션 효과

## 🚀 GitHub Pages로 배포하기

### 방법 1: GitHub Desktop 사용 (초보자 추천)

1. **GitHub 계정 만들기**
   - https://github.com 접속
   - 무료 계정 생성

2. **GitHub Desktop 설치**
   - https://desktop.github.com 에서 다운로드
   - 설치 후 GitHub 계정으로 로그인

3. **저장소 만들기**
   - GitHub Desktop에서 `File` → `New Repository` 클릭
   - Repository name: `gem-simulator` (원하는 이름)
   - Local path: 이 프로젝트가 있는 폴더 선택
   - `Create Repository` 클릭

4. **파일 업로드**
   - GitHub Desktop이 자동으로 파일 변경 감지
   - 왼쪽 하단에 커밋 메시지 입력: "Initial commit"
   - `Commit to main` 클릭
   - 상단의 `Publish repository` 클릭

5. **GitHub Pages 활성화**
   - GitHub 웹사이트에서 저장소 페이지로 이동
   - `Settings` 탭 클릭
   - 왼쪽 메뉴에서 `Pages` 클릭
   - Source: `main` 브랜치 선택
   - `Save` 클릭
   - 몇 분 후 `https://[사용자명].github.io/gem-simulator/` 에서 접속 가능!

### 방법 2: Git 명령어 사용 (개발자)

```bash
# 1. 저장소 초기화
cd gem-simulator
git init

# 2. 파일 추가
git add .
git commit -m "Initial commit"

# 3. GitHub 저장소 연결 (미리 만들어야 함)
git remote add origin https://github.com/[사용자명]/gem-simulator.git
git branch -M main
git push -u origin main

# 4. GitHub 웹사이트에서 Settings → Pages → Source를 main으로 설정
```

### 방법 3: 직접 업로드 (가장 간단)

1. GitHub에서 새 저장소 만들기 (`gem-simulator`)
2. `Add file` → `Upload files` 클릭
3. 모든 파일 드래그 앤 드롭
4. `Commit changes` 클릭
5. `Settings` → `Pages` → Source를 `main`으로 설정

## 📁 프로젝트 구조

```
gem-simulator/
├── index.html          # 메인 HTML 파일
├── style.css           # 스타일시트
├── script.js           # 게임 로직
└── README.md          # 프로젝트 설명
```

## 🎓 전략 팁

### 초보자를 위한 팁
1. **처음에는 세게 두드리기**로 빠르게 10번대로 이동
2. **13-15번 근처**에 도착하면 안정제나 세공하기 사용
3. **16번 초과 시** 세공하기의 마이너스 값 활용
4. **남은 턴 수**를 항상 확인하며 플레이

### 고급 전략
1. **역산 계산**: 16번까지 남은 거리 계산
2. **확률 활용**: 각 방법의 평균값 고려
   - 세게 두드리기: 평균 +4.5
   - 세공하기: 평균 -0.5
   - 안정제: 평균 +2
3. **안전 마진**: 16번 도달 후 멈추는 것이 목표

## 🛠️ 기술 스택

- **HTML5**: 구조
- **CSS3**: 스타일링 및 애니메이션
- **Vanilla JavaScript**: 게임 로직 및 시뮬레이션
- **No Dependencies**: 외부 라이브러리 없음!

## 📱 브라우저 지원

- ✅ Chrome (권장)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ 모바일 브라우저

## 🤝 기여하기

이슈 제보나 개선 제안은 언제나 환영합니다!

## 📄 라이선스

MIT License - 자유롭게 사용 및 수정 가능

## 🎉 즐거운 게임 되세요!

16번 칸 달성을 응원합니다! 💎✨
