# 🔐 Keystore 만들기 - 실행 명령어

> **바로 복사해서 실행하세요!**

---

## 🚀 1단계: Keystore 만들기

**PowerShell에서 실행:**

```powershell
cd "C:\Users\Kyung\Mud Game\mud_client\android\app"

keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias key
```

**실행하면 질문이 나와요. 하나씩 입력하세요:**

1. **Keystore 비밀번호:** 비밀번호 입력 (예: `MyPassword123!`)
   - ⚠️ **중요:** 이 비밀번호를 꼭 기억해두세요!

2. **비밀번호 확인:** 같은 비밀번호 다시 입력

3. **이름:** `Mud Game` 또는 그냥 Enter

4. **조직 단위:** `Development` 또는 그냥 Enter

5. **조직 이름:** `Mud Game Studio` 또는 그냥 Enter

6. **도시:** `Seoul` 또는 그냥 Enter

7. **주/도:** `Seoul` 또는 그냥 Enter

8. **국가 코드:** `KR` 또는 `US`

9. **정보 확인:** `yes` 입력

10. **Key 비밀번호:** 그냥 Enter (keystore 비밀번호와 같게)

---

## ✅ 2단계: 파일 확인

**생성되었는지 확인:**

```powershell
Get-ChildItem -Filter "*.jks"
```

**파일이 보이면 성공!**

---

## 🔄 3단계: Base64로 변환

**PowerShell에서 실행:**

```powershell
$keystorePath = "C:\Users\Kyung\Mud Game\mud_client\android\app\release-key.jks"
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard
Write-Host "✅ 완료! 클립보드에 복사되었습니다!"
```

---

## 🔐 4단계: GitHub Secrets에 등록

1. GitHub 레포지토리 → Settings → Secrets → Actions
2. 4개 Secrets 추가:
   - `ANDROID_KEYSTORE_BASE64`: 클립보드 내용 붙여넣기
   - `ANDROID_KEYSTORE_PASSWORD`: 위에서 입력한 비밀번호
   - `ANDROID_KEY_ALIAS`: `key`
   - `ANDROID_KEY_PASSWORD`: keystore 비밀번호와 같으면 같은 값

---

**작성일:** 2025-12-20  
**중요:** 비밀번호를 꼭 기억해두세요!


