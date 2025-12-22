# 🔐 Keystore Base64 변환 - 실행 명령어

> **찾은 파일 경로를 사용해서 바로 실행하세요!**

---

## 📍 찾은 파일 위치

**경로:** `C:\Users\Kyung\Wuxia\murim_mvp\mobile`

**파일:** `.jks` 파일 (파일 이름 확인 필요)

---

## 🚀 실행 명령어

### 방법 1: 파일 이름을 알고 있다면

**PowerShell에서 실행:**

```powershell
# 파일 이름을 실제 이름으로 바꿔주세요!
# 예: release-key.jks, upload-keystore.jks, key.jks 등
$keystorePath = "C:\Users\Kyung\Wuxia\murim_mvp\mobile\release-key.jks"

# Base64로 변환하고 클립보드에 복사
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard

# 확인 메시지
Write-Host "✅ Keystore가 Base64로 변환되어 클립보드에 복사되었습니다!"
Write-Host "이제 GitHub Secrets에 붙여넣으세요!"
```

---

### 방법 2: 파일 이름을 모르겠다면

**먼저 파일 이름 확인:**

```powershell
# 폴더 안의 모든 .jks 파일 확인
Get-ChildItem -Path "C:\Users\Kyung\Wuxia\murim_mvp\mobile" -Filter "*.jks" | Select-Object Name
```

**출력된 파일 이름을 사용해서:**

```powershell
# 위에서 확인한 파일 이름으로 바꿔주세요!
$keystorePath = "C:\Users\Kyung\Wuxia\murim_mvp\mobile\[파일이름].jks"
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard
Write-Host "✅ 완료!"
```

---

### 방법 3: 자동으로 찾아서 변환

**PowerShell에서 실행:**

```powershell
# 폴더에서 첫 번째 .jks 파일 찾기
$keystoreFile = Get-ChildItem -Path "C:\Users\Kyung\Wuxia\murim_mvp\mobile" -Filter "*.jks" | Select-Object -First 1

if ($keystoreFile) {
    Write-Host "찾은 파일: $($keystoreFile.FullName)"
    $bytes = [System.IO.File]::ReadAllBytes($keystoreFile.FullName)
    [Convert]::ToBase64String($bytes) | Set-Clipboard
    Write-Host "✅ Keystore가 Base64로 변환되어 클립보드에 복사되었습니다!"
} else {
    Write-Host "❌ .jks 파일을 찾을 수 없습니다."
}
```

---

## ✅ 다음 단계

1. **위 명령어 중 하나 실행**
2. **GitHub Secrets 열기**: Settings → Secrets → Actions
3. **`ANDROID_KEYSTORE_BASE64` Secret 추가**
4. **클립보드 내용 붙여넣기** (Ctrl+V)
5. **Add secret 클릭**

---

**작성일:** 2025-12-20  
**중요:** 파일 이름을 정확히 입력해야 해요!

