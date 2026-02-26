#!/bin/bash
set -e
set -x

echo "=== 1. Baixando e Extraindo Java JDK 17 (Amazon Corretto) ==="
mkdir -p ~/.jdk
cd ~/.jdk
if [ ! -f "corretto.tar.gz" ]; then
  wget -q https://corretto.aws/downloads/latest/amazon-corretto-17-x64-linux-jdk.tar.gz -O corretto.tar.gz
fi
tar -xzf corretto.tar.gz
JDK_DIR=$(ls -d */ | grep -i corretto | head -n 1)
export JAVA_HOME="$HOME/.jdk/${JDK_DIR%%/}"
export PATH="$JAVA_HOME/bin:$PATH"
java -version || echo "Java falhou!"

echo "=== 2. Configurando Local Android SDK ==="
export ANDROID_HOME="$HOME/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd "$ANDROID_HOME/cmdline-tools"
if [ ! -d "latest" ]; then
  if [ ! -f "cmdline-tools.zip" ]; then
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
  fi
  unzip -q cmdline-tools.zip
  mv cmdline-tools latest
  rm cmdline-tools.zip || true
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "=== 3. Aceitando Licenças e Baixando SDKs ==="
yes | sdkmanager --licenses || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "=== 4. Registrando no Flutter ==="
flutter config --android-sdk "$ANDROID_HOME"
flutter config --jdk-dir "$JAVA_HOME"
flutter doctor -v

echo "=== 5. Inovando bashrc com os Paths ==="
if ! grep -q "JAVA_HOME" ~/.bashrc; then
  echo "export JAVA_HOME=$JAVA_HOME" >> ~/.bashrc
  echo "export ANDROID_HOME=$ANDROID_HOME" >> ~/.bashrc
  echo "export PATH=\$JAVA_HOME/bin:\$ANDROID_HOME/cmdline-tools/latest/bin:\$PATH" >> ~/.bashrc
fi
