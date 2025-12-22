# 🔐 Android Keystore 새로 만들기 - 초보자 가이드

> **keystore 파일이 없을 때 새로 만드는 방법**  
> 초등학생도 차근차근 따라할 수 있도록 쉽게 설명합니다! 😊

---

## 📋 준비물

### 필요한 것
- ✅ Java JDK (이미 설치되어 있어야 해요)
- ✅ PowerShell 또는 명령 프롬프트
- ✅ 기억할 비밀번호 (중요!)

### 알아둘 정보
- **Keystore 비밀번호**: keystore 파일을 보호하는 비밀번호
- **Key 별명 (Alias)**: 보통 `key` 또는 `upload` 사용
- **Key 비밀번호**: key를 보호하는 비밀번호 (keystore 비밀번호와 같게 해도 돼요)

---

## 🎯 1단계: Keystore 만들기

### PowerShell에서 실행

**아래 명령어를 복사해서 PowerShell에 붙여넣으세요:**

```powershell
cd "C:\Users\Kyung\Mud Game\mud_client\android\app"

# Keystore 만들기

- `validity 10000`은 10000일(약 27년) 동안 유효하다는 뜻이에요

---

## 📝 2단계: 정보 입력하기

**명령어를 실행하면 질문이 나와요. 하나씩 입력하세요:**

### 질문 1: Keystore 비밀번호
```
Enter keystore password:
```
**답변:** 비밀번호 입력 (예: `myPassword123!`)
- ⚠️ **중요:** 이 비밀번호를 꼭 기억해두세요! GitHub Secrets에 등록해야 해요!

### 질문 2: 비밀번호 확인
```
Re-enter new password:
```
**답변:** 같은 비밀번호 다시 입력

### 질문 3: 이름
```
What is your first and last name?
  [Unknown]:
```
**답변:** 이름 입력 (예: `Mud Game` 또는 그냥 Enter)

### 질문 4: 조직 단위
```
What is the name of your organizational unit?
  [Unknown]:
```
**답변:** 조직 단위 (예: `Development` 또는 그냥 Enter)

### 질문 5: 조직 이름
```
What is the name of your organization?
  [Unknown]:
```
**답변:** 조직 이름 (예: `Mud Game Studio` 또는 그냥 Enter)

### 질문 6: 도시
```
What is the name of your City or Locality?
  [Unknown]:
```
**답변:** 도시 이름 (예: `Seoul` 또는 그냥 Enter)

### 질문 7: 주/도
```
What is the name of your State or Province?
  [Unknown]:
```
**답변:** 주/도 이름 (예: `Seoul` 또는 그냥 Enter)

### 질문 8: 국가 코드
```
What is the two-letter country code for this unit?
  [Unknown]:
```
**답변:** 국가 코드 (예: `KR` 또는 `US`)

### 질문 9: 정보 확인
```
Is CN=Mud Game, OU=Development, O=Mud Game Studio, L=Seoul, ST=Seoul, C=KR correct?
  [no]:
```
**답변:** `yes` 입력

### 질문 10: Key 비밀번호
```
Enter key password for <key>
        (RETURN if same as keystore password):
```
**답변:** 
- **같은 비밀번호 사용:** 그냥 Enter
- **다른 비밀번호 사용:** 새로운 비밀번호 입력

---

## ✅ 3단계: 완료 확인

**파일이 생성되었는지 확인:**

```powershell
# 현재 폴더에서 확인
Get-ChildItem -Filter "*.jks"
```

**출력 예시:**
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a----      2025-12-20   오후 2:00           2189 release-key.jks
```

**✅ 파일이 보이면 성공!**

---

## 🔄 4단계: Base64로 변환하기

**PowerShell에서 실행:**

```powershell
# 파일 경로 (위치에 맞게 수정)
$keystorePath = "C:\Users\Kyung\Mud Game\mud_client\android\app\release-key.jks"

# Base64로 변환하고 클립보드에 복사
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard

# 확인 메시지
Write-Host "✅ Keystore가 Base64로 변환되어 클립보드에 복사되었습니다!"
Write-Host "이제 GitHub Secrets에 붙여넣으세요!"
```

---

## 🔐 5단계: GitHub Secrets에 등록하기

### 1. GitHub 레포지토리 열기
- `https://github.com/KAYEN-KIM/mud-game` 열기

### 2. Settings → Secrets → Actions
- 상단 메뉴에서 **Settings** 클릭
- 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭

### 3. 4개 Secrets 추가

#### Secret 1: `ANDROID_KEYSTORE_BASE64`
- **Name:** `ANDROID_KEYSTORE_BASE64`
- **Secret:** 클립보드 내용 붙여넣기 (Ctrl+V)
- **Add secret** 클릭

#### Secret 2: `ANDROID_KEYSTORE_PASSWORD`
- **Name:** `ANDROID_KEYSTORE_PASSWORD`
- **Secret:** 위에서 입력한 keystore 비밀번호
- **Add secret** 클릭

#### Secret 3: `ANDROID_KEY_ALIAS`
- **Name:** `ANDROID_KEY_ALIAS`
- **Secret:** `key` (위에서 입력한 별명)
- **Add secret** 클릭

#### Secret 4: `ANDROID_KEY_PASSWORD`
- **Name:** `ANDROID_KEY_PASSWORD`
- **Secret:** 위에서 입력한 key 비밀번호 (keystore 비밀번호와 같으면 같은 값)
- **Add secret** 클릭

---

## ✅ 완료 체크리스트

- [ ] Keystore 파일 생성 (`release-key.jks`)
- [ ] Base64로 변환하고 클립보드에 복사
- [ ] GitHub Secrets에 4개 모두 등록
  - [ ] `ANDROID_KEYSTORE_BASE64`
  - [ ] `ANDROID_KEYSTORE_PASSWORD`
  - [ ] `ANDROID_KEY_ALIAS`
  - [ ] `ANDROID_KEY_PASSWORD`

**모두 체크했으면 완료입니다!** 🎉

---

## 🆘 문제 해결

### 문제 1: "keytool을 찾을 수 없습니다"

**해결 방법:**
- Java JDK가 설치되어 있는지 확인
- JDK의 `bin` 폴더를 PATH에 추가

**확인 방법:**
```powershell
# Java 설치 확인
java -version
keytool -help
```

### 문제 2: 비밀번호를 잊어버렸어요

**해결 방법:**
- keystore 파일 삭제하고 다시 만들기
- ⚠️ **주의:** 이미 사용 중인 keystore는 삭제하면 안 돼요!

### 문제 3: 파일이 생성되지 않았어요

**확인 사항:**
- 현재 폴더가 맞는지 확인: `pwd`
- 권한이 있는지 확인
- 디스크 공간이 충분한지 확인

---

## 💡 팁

### 비밀번호 관리
- **안전한 곳에 기록해두세요!** (비밀번호 관리자 추천)
- GitHub Secrets에 등록하면 안전하게 보관돼요
- keystore 파일도 안전한 곳에 백업하세요!

### 파일 위치
- keystore 파일은 `mud_client/android/app/` 폴더에 있어요
- 이 파일은 **절대 GitHub에 올리면 안 돼요!** (`.gitignore`에 추가되어 있어요)

---

**작성일:** 2025-12-20  
**난이도:** ⭐⭐ (중급)  
**중요:** 비밀번호를 꼭 기억해두세요! 잊어버리면 다시 만들어야 해요!


