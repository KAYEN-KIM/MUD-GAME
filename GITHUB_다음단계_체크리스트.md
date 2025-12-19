# 🎮 GitHub 다음 단계 - 빠른 체크리스트

> **복사-붙여넣기만 하면 됩니다!**  
> 하나씩 따라하세요. 실수해도 괜찮아요! 😊

---

## ✅ 체크리스트

### 1️⃣ PR 만들기 (5분)

- [ ] GitHub 창고 → **"Pull requests"** 탭 클릭
- [ ] **"New pull request"** 클릭
- [ ] Base: `main`, Compare: `chore/release-candidate-v1` 선택
- [ ] 제목: `Release Candidate v1 (S1 Only)` 입력
- [ ] **"Create pull request"** 클릭

**✅ 완료:** PR 페이지가 보이면 성공!

---

### 2️⃣ PR 머지하기 (2분)

- [ ] PR 페이지에서 **"Merge pull request"** 클릭
- [ ] **"Confirm merge"** 클릭

**✅ 완료:** "Merged" 표시가 보이면 성공!

---

### 3️⃣ 릴리즈 태그 만들기 (3분)

**PowerShell 열기:**
- Windows 키 → "PowerShell" 입력 → Enter

**아래 명령어를 하나씩 복사-붙여넣기:**

```powershell
cd "C:\Users\Kyung\Mud Game"
```

```powershell
git checkout main
```

```powershell
git pull origin main
```

```powershell
git tag -a v1.0.0 -m "Release v1.0.0 (S1 only)"
```

```powershell
git push origin v1.0.0
```

**✅ 완료:** "Total 1" 메시지가 보이면 성공!

---

### 4️⃣ 결과 확인하기 (5분)

- [ ] GitHub 창고 → **"Actions"** 탭 클릭
- [ ] **"Release Server Image"** 워크플로우 확인
- [ ] **"Release Android Build"** 워크플로우 확인
- [ ] ✅ 초록색 체크 = 성공!

**⏰ 시간:** 5-10분 걸릴 수 있어요!

---

## 🎉 완료!

이제 다음을 완료했어요:

✅ PR 만들기  
✅ PR 머지하기  
✅ 릴리즈 태그 만들기  
✅ 자동 빌드 확인하기  

---

## 📦 결과물 확인

### 서버 이미지

- [ ] GitHub 창고 → **"Packages"** 클릭
- [ ] `mud-game/server` 이미지 확인

### 안드로이드 앱

- [ ] Actions → "Release Android Build" 클릭
- [ ] 완료된 실행 → **"Artifacts"** 섹션
- [ ] AAB 파일 다운로드

---

## ❓ 문제 해결

**"Able to merge"가 안 보여요**
→ 그냥 머지 버튼을 눌러보세요!

**"tag already exists" 에러**
→ 다른 버전으로 바꾸세요 (예: `v1.0.1`)

**GitHub Actions가 실패해요**
→ 나중에 고치면 됩니다! (지금은 괜찮아요)

---

## 💡 팁

- ⏰ 시간이 걸려도 괜찮아요!
- ❌ 실패해도 괜찮아요!
- ❓ 모르는 게 있으면 질문하세요!

---

**작성일:** 2025-12-20  
**난이도:** ⭐ (초보자용)

