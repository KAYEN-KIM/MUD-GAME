# 🔐 Android Secrets 등록 가이드

> **GitHub Secrets에 Android keystore 정보 등록하기**  
> 초보자도 쉽게 따라할 수 있도록 단계별로 설명합니다! 😊

---

## 📋 필요한 것들

### 1. Android Keystore 파일 (`.jks` 또는 `.keystore`)
- 파일 위치를 알고 있어야 해요
- 보통 `android/app/` 폴더나 프로젝트 루트에 있어요

### 2. Keystore 정보
- **Keystore 비밀번호** (keystore를 만들 때 설정한 비밀번호)
- **Key 별명** (alias, 보통 `key` 또는 `upload`)
- **Key 비밀번호** (key의 비밀번호, keystore 비밀번호와 같을 수도 있어요)

---

## 🔍 1단계: Keystore 파일 찾기

### 방법 1: 파일 탐색기에서 찾기

1. **파일 탐색기 열기**
2. **프로젝트 폴더 열기**: `C:\Users\Kyung\Mud Game`
3. **검색**: `*.jks` 또는 `*.keystore` 검색
4. **파일 위치 확인**

### 방법 2: PowerShell에서 찾기

```powershell
cd "C:\Users\Kyung\Mud Game"
Get-ChildItem -Recurse -Filter "*.jks"
Get-ChildItem -Recurse -Filter "*.keystore"
```

**파일을 찾으면 경로를 복사해두세요!**

---

## 📝 2단계: Keystore를 Base64로 변환하기

### 실제 파일 경로를 찾았다면:

**PowerShell에서 실행:**

```powershell
# 실제 파일 경로로 바꿔주세요!
$keystorePath = "C:\Users\Kyung\Mud Game\android\app\release-key.jks"

# Base64로 변환하고 클립보드에 복사
$bytes = [System.IO.File]::ReadAllBytes($keystorePath)
[Convert]::ToBase64String($bytes) | Set-Clipboard

# 확인 메시지
Write-Host "✅ Keystore가 Base64로 변환되어 클립보드에 복사되었습니다!"
```

**⚠️ 중요:** 
- `$keystorePath`를 실제 파일 경로로 바꿔주세요!
- 파일 경로에 공백이 있으면 따옴표로 감싸주세요!

---

## 🔑 3단계: GitHub Secrets 등록하기

### 1. GitHub 레포지토리 열기
- `https://github.com/KAYEN-KIM/mud-game` 열기

### 2. Settings로 이동
- 상단 메뉴에서 **Settings** 클릭

### 3. Secrets 메뉴 열기
- 왼쪽 사이드바에서 **Secrets and variables** → **Actions** 클릭

### 4. 4개 Secrets 추가하기

#### Secret 1: `ANDROID_KEYSTORE_BASE64`
1. **New repository secret** 클릭
2. **Name**: `ANDROID_KEYSTORE_BASE64`
3. **Secret**: 클립보드에 복사된 Base64 문자열 붙여넣기 (위에서 복사한 것)
4. **Add secret** 클릭

#### Secret 2: `ANDROID_KEYSTORE_PASSWORD`
1. **New repository secret** 클릭
2. **Name**: `ANDROID_KEYSTORE_PASSWORD`
3. **Secret**: Keystore 비밀번호 입력
4. **Add secret** 클릭

#### Secret 3: `ANDROID_KEY_ALIAS`
1. **New repository secret** 클릭
2. **Name**: `ANDROID_KEY_ALIAS`
3. **Secret**: Key 별명 입력 (보통 `key` 또는 `upload`)
4. **Add secret** 클릭

#### Secret 4: `ANDROID_KEY_PASSWORD`
1. **New repository secret** 클릭
2. **Name**: `ANDROID_KEY_PASSWORD`
3. **Secret**: Key 비밀번호 입력 (keystore 비밀번호와 같을 수도 있어요)
4. **Add secret** 클릭

---

## ✅ 완료 확인

**등록한 Secrets:**
- [ ] `ANDROID_KEYSTORE_BASE64`
- [ ] `ANDROID_KEYSTORE_PASSWORD`
- [ ] `ANDROID_KEY_ALIAS`
- [ ] `ANDROID_KEY_PASSWORD`

**모두 체크했으면 완료입니다!** 🎉

---

## 🆘 Keystore 파일이 없어요!

### Keystore 파일을 만들어야 해요

**Android Studio에서:**
1. **Build** → **Generate Signed Bundle / APK**
2. **Android App Bundle** 선택
3. **Create new...** 클릭
4. 정보 입력하고 keystore 생성

**또는 명령어로:**

```powershell
cd "C:\Users\Kyung\Mud Game\android\app"
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias key
```

**정보 입력:**
- Keystore 비밀번호: (기억해두세요!)
- Key 비밀번호: (기억해두세요!)
- 이름, 조직 등: (자유롭게 입력)

---

## 💡 팁

### Keystore 정보를 모르겠어요?

**명령어로 확인:**

```powershell
# Keystore 정보 확인 (비밀번호 필요)
keytool -list -v -keystore "C:\path\to\release-key.jks"
```

**출력에서 확인:**
- **Alias name**: Key 별명
- **Keystore 비밀번호**: 입력한 비밀번호
- **Key 비밀번호**: 보통 keystore 비밀번호와 같아요

---

## 📝 체크리스트

- [ ] Keystore 파일 위치 확인
- [ ] Keystore를 Base64로 변환
- [ ] GitHub Secrets에 4개 모두 등록
- [ ] 등록 확인

---

**작성일:** 2025-12-20  
**난이도:** ⭐⭐ (중급)  
**중요:** Keystore 파일과 비밀번호는 안전하게 보관하세요!

