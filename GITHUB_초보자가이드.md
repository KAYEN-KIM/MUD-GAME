# 🎮 GitHub에 게임 올리기 - 초보자 가이드

> **이 가이드는 초등학생도 따라할 수 있도록 쉽게 만들었습니다!**  
> 하나씩 차근차근 따라하면 됩니다. 실수해도 괜찮아요! 😊

---

## 📦 준비물

1. **컴퓨터** (지금 사용 중인 것)
2. **인터넷 연결**
3. **GitHub 계정** (없으면 만들어야 해요)

---

## 🎯 목표

게임 코드를 GitHub라는 "온라인 창고"에 올려서:
- ✅ 안전하게 보관
- ✅ 다른 사람과 공유 가능
- ✅ 자동으로 빌드/테스트 가능

---

## 📝 단계별 가이드

### 1단계: GitHub 계정 만들기 (5분)

**만약 이미 GitHub 계정이 있으면 이 단계는 건너뛰세요!**

#### 1-1. GitHub 웹사이트 열기

1. 브라우저 열기 (Chrome, Edge 등)
2. 주소창에 입력: `github.com`
3. Enter 키 누르기

#### 1-2. 회원가입

1. 오른쪽 위 **"Sign up"** 버튼 클릭
2. 이메일 주소 입력
3. 비밀번호 만들기 (안전하게!)
4. 사용자 이름 만들기 (예: `kyung-dev`)
5. **"Create account"** 클릭
6. 이메일 확인 (이메일로 온 링크 클릭)

**✅ 완료 확인:** GitHub 메인 페이지에 로그인되어 있으면 성공!

---

### 2단계: 빈 창고 만들기 (3분)

> **비유:** 게임 코드를 넣을 빈 상자를 만드는 거예요!

#### 2-1. 새 창고 만들기

1. GitHub 메인 페이지에서
2. 오른쪽 위 **"+"** 버튼 클릭
3. **"New repository"** 클릭

#### 2-2. 창고 이름 정하기

**이렇게 입력하세요:**

```
Repository name: mud-game
```

**중요한 체크박스:**
- ❌ **"Add a README file"** ← 체크 해제!
- ❌ **"Add .gitignore"** ← 체크 해제!
- ❌ **"Choose a license"** ← None 선택!

**왜?** 우리가 이미 파일을 만들었으니까요!

#### 2-3. 만들기

1. 아래쪽 **"Create repository"** 버튼 클릭
2. **중요!** 나오는 페이지에서 **URL 복사하기**

**복사할 URL 예시:**
```
https://github.com/kyung-dev/mud-game.git
```

**✅ 완료 확인:** URL이 복사되었으면 성공!

---

### 3단계: 컴퓨터에서 GitHub 연결하기 (2분)

> **비유:** 컴퓨터와 GitHub 창고를 줄로 연결하는 거예요!

#### 3-1. PowerShell 열기

1. **Windows 키** 누르기
2. **"PowerShell"** 입력
3. **"Windows PowerShell"** 클릭

#### 3-2. 게임 폴더로 이동

PowerShell 창에 **이렇게 입력** (복사-붙여넣기 OK):

```powershell
cd "C:\Users\Kyung\Mud Game"
```

Enter 키 누르기

#### 3-3. GitHub 연결하기

**아래 명령어를 복사해서 붙여넣기:**

```powershell
git remote add origin https://github.com/YOUR-USERNAME/mud-game.git
```

**⚠️ 주의:** `YOUR-USERNAME`을 2단계에서 만든 사용자 이름으로 바꾸세요!

**예시:**
```powershell
git remote add origin https://github.com/kyung-dev/mud-game.git
```

Enter 키 누르기

**✅ 완료 확인:** 아무 에러가 안 나오면 성공!

---

### 4단계: 코드 올리기 (3분)

> **비유:** 게임 파일들을 상자에 넣는 거예요!

#### 4-1. Main 브랜치 올리기

**아래 명령어를 하나씩 입력하세요:**

```powershell
git checkout main
```

Enter 키 → 잠시 기다리기

```powershell
git push -u origin main
```

Enter 키 → **시간이 좀 걸릴 수 있어요!** (1-2분)

**✅ 완료 확인:** 
- "Enumerating objects..." 같은 메시지가 나오면 성공!
- 마지막에 "Branch 'main' set up..." 메시지 보이면 완료!

#### 4-2. RC 브랜치 올리기

```powershell
git checkout chore/release-candidate-v1
```

Enter 키

```powershell
git push -u origin chore/release-candidate-v1
```

Enter 키 → 잠시 기다리기

**✅ 완료 확인:** 에러 없이 끝나면 성공!

---

### 5단계: GitHub에서 확인하기 (1분)

1. 브라우저에서 GitHub 열기
2. 만든 창고 클릭 (예: `mud-game`)
3. 파일 목록이 보이면 성공! 🎉

**보이는 것:**
- `README.md`
- `package.json`
- `apps/` 폴더
- 등등...

---

## 🎉 완료!

이제 게임 코드가 GitHub에 안전하게 보관되었어요!

---

## ❓ 문제 해결

### "fatal: not a git repository" 에러

**해결:**
```powershell
cd "C:\Users\Kyung\Mud Game"
git init
```

### "remote origin already exists" 에러

**해결:** 이미 연결되어 있어요! 4단계로 넘어가세요.

### "Permission denied" 에러

**해결:** GitHub 로그인이 필요해요!
1. GitHub 웹사이트에서 로그인 확인
2. 비밀번호 다시 확인

### "could not read Username" 에러

**해결:** GitHub 인증이 필요해요!
1. GitHub 웹사이트 → Settings → Developer settings → Personal access tokens
2. "Generate new token" 클릭
3. 토큰 복사
4. PowerShell에서 비밀번호 입력할 때 토큰 붙여넣기

---

## 📚 다음 단계 (선택)

코드 올리기가 완료되면:

1. **PR 만들기** (다른 사람이 확인할 수 있게)
2. **Secrets 설정** (Android 앱 빌드용)
3. **릴리즈 태그 만들기** (버전 관리)

**하지만 지금은 여기까지 해도 충분해요!** 😊

---

## 💡 팁

- **실수해도 괜찮아요!** 다시 하면 됩니다.
- **시간이 걸려도 괜찮아요!** 파일이 많으니까요.
- **모르는 게 있으면 멈추고 질문하세요!**

---

**작성일:** 2025-12-20  
**난이도:** ⭐ (초보자용)

