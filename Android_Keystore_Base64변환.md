# 🔐 Android Keystore Base64 변환 명령어

> **실제 keystore 파일 경로를 입력해서 사용하세요!**

---

## 📝 사용 방법

### 1단계: 실제 파일 경로 확인

**keystore 파일이 어디에 있는지 확인하세요:**
- 예: `C:\Users\Kyung\release-key.jks`
- 예: `C:\Users\Kyung\Mud Game\android\app\release-key.jks`
- 예: `D:\Projects\mud-game\release-key.jks`

---

### 2단계: PowerShell에서 실행

**아래 명령어를 복사해서 PowerShell에 붙여넣으세요:**

```powershell
# ⚠️ 여기를 실제 파일 경로로 바꿔주세요!
$keystorePath = "C:\path\to\release-key.jks"

# Base64로 변환하고 클립보드에 복사
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard

# 확인 메시지
Write-Host "✅ Keystore가 Base64로 변환되어 클립보드에 복사되었습니다!"
Write-Host "이제 GitHub Secrets에 붙여넣으세요!"
```

**중요:**
- `$keystorePath = "C:\path\to\release-key.jks"` 부분을 실제 파일 경로로 바꿔주세요!
- 파일 경로에 공백이 있으면 따옴표로 감싸주세요!

---

## 🎯 예시

### 예시 1: 파일이 `C:\Users\Kyung\release-key.jks`에 있는 경우

```powershell
$keystorePath = "C:\Users\Kyung\release-key.jks"
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard
Write-Host "✅ 완료! 클립보드에 복사되었습니다!"
```

### 예시 2: 파일이 프로젝트 폴더에 있는 경우

```powershell
$keystorePath = "C:\Users\Kyung\Mud Game\release-key.jks"
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard
Write-Host "✅ 완료! 클립보드에 복사되었습니다!"
```

---

## ✅ 다음 단계

1. **위 명령어 실행** → Base64 문자열이 클립보드에 복사됨
2. **GitHub Secrets 열기**: Settings → Secrets → Actions
3. **`ANDROID_KEYSTORE_BASE64` Secret 추가**
4. **클립보드 내용 붙여넣기** (Ctrl+V)
5. **Add secret 클릭**

---

## 🆘 파일을 찾을 수 없어요!

**파일 탐색기에서 검색:**
1. 파일 탐색기 열기
2. `*.jks` 또는 `*.keystore` 검색
3. 파일 위치 확인

**또는 PowerShell에서 검색:**

```powershell
# 전체 드라이브에서 검색 (시간이 걸릴 수 있어요)
Get-ChildItem -Path C:\ -Recurse -Filter "*.jks" -ErrorAction SilentlyContinue | Select-Object FullName

# 특정 폴더에서 검색
Get-ChildItem -Path "C:\Users\Kyung" -Recurse -Filter "*.jks" -ErrorAction SilentlyContinue | Select-Object FullName
```

---

**작성일:** 2025-12-20  
**중요:** 실제 파일 경로를 정확히 입력해야 해요!

