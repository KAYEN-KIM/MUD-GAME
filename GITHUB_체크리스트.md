# 🎮 GitHub 업로드 - 초간단 체크리스트

> **복사-붙여넣기만 하면 됩니다!**  
> 하나씩 따라하세요. 실수해도 괜찮아요! 😊

---

## ✅ 체크리스트

### 1️⃣ GitHub 계정 만들기 (5분)

- [ ] `github.com` 접속
- [ ] "Sign up" 클릭
- [ ] 이메일, 비밀번호, 사용자 이름 입력
- [ ] 이메일 확인 완료

**✅ 완료:** GitHub에 로그인되어 있으면 성공!

---

### 2️⃣ 빈 창고 만들기 (3분)

- [ ] GitHub에서 **"+"** → **"New repository"** 클릭
- [ ] 이름: `mud-game` 입력
- [ ] **중요:** README, .gitignore, License 모두 체크 해제!
- [ ] **"Create repository"** 클릭
- [ ] 나오는 URL 복사 (예: `https://github.com/사용자이름/mud-game.git`)

**✅ 완료:** URL이 복사되었으면 성공!

---

### 3️⃣ PowerShell에서 연결하기 (2분)

**PowerShell 열기:**
- Windows 키 → "PowerShell" 입력 → Enter

**아래 명령어를 복사해서 붙여넣기:**

```powershell
cd "C:\Users\Kyung\Mud Game"
```

Enter 키

```powershell
git remote add origin https://github.com/사용자이름/mud-game.git
```

**⚠️ 주의:** `사용자이름`을 1단계에서 만든 이름으로 바꾸세요!

Enter 키

**✅ 완료:** 에러 없이 끝나면 성공!

---

### 4️⃣ 코드 올리기 (5분)

**아래 명령어를 하나씩 복사-붙여넣기:**

```powershell
git checkout main
```

Enter 키 → 잠시 기다리기

```powershell
git push -u origin main
```

Enter 키 → **1-2분 걸릴 수 있어요!** (파일이 많아서)

**✅ 완료:** "Branch 'main' set up..." 메시지 보이면 성공!

---

### 5️⃣ RC 브랜치 올리기 (2분)

```powershell
git checkout chore/release-candidate-v1
```

Enter 키

```powershell
git push -u origin chore/release-candidate-v1
```

Enter 키 → 잠시 기다리기

**✅ 완료:** 에러 없이 끝나면 성공!

---

### 6️⃣ GitHub에서 확인하기 (1분)

- [ ] 브라우저에서 GitHub 열기
- [ ] 만든 창고 클릭 (`mud-game`)
- [ ] 파일 목록이 보이는지 확인

**✅ 완료:** 파일이 보이면 성공! 🎉

---

## 🎉 완료!

이제 게임 코드가 GitHub에 안전하게 보관되었어요!

---

## ❓ 문제가 생겼어요?

### 에러 메시지가 나와요

**"fatal: not a git repository"**
→ 해결: `git init` 입력 후 Enter

**"remote origin already exists"**
→ 해결: 이미 연결되어 있어요! 4단계로 넘어가세요.

**"Permission denied"**
→ 해결: GitHub 로그인 확인하세요!

---

## 📞 더 도움이 필요해요?

**상세 가이드 보기:**
- `GITHUB_초보자가이드.md` 파일 열기

**또는:**
- 각 단계마다 천천히
- 에러 메시지 복사해서 검색
- 실수해도 다시 하면 됩니다! 😊

---

**작성일:** 2025-12-20  
**난이도:** ⭐ (초보자용)

