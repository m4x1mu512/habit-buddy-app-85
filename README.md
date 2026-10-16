# Мои привычки — Android-приложение

Приложение для привычек с ежедневными локальными напоминаниями, архивом и светлой/тёмной/системной темой.
Работает полностью на устройстве: без сервера, без регистрации, без платных сервисов и Firebase.

Стек: React + TypeScript + Vite (TanStack Start), Tailwind CSS, shadcn/ui, Lucide, date-fns, Capacitor 7
(`@capacitor/core`, `cli`, `android`, `local-notifications`, `status-bar`, `preferences`, `app`).

## Структура

| Путь | Назначение |
| --- | --- |
| `src/routes/index.tsx` | Главный экран: привычки, архив, настройки, кнопка «Назад» |
| `src/lib/habits.ts` | Модель `Habit` и правила (проверка, сортировка, автоархив) |
| `src/lib/notifications.ts` | Локальные уведомления |
| `src/lib/theme.ts` | Тема и цвет строки состояния |
| `src/lib/storage.ts` | Локальное хранение (`@capacitor/preferences`) |
| `capacitor.config.ts` | Настройки Capacitor, **ID приложения** |
| `android/` | Нативный Android-проект |
| `.github/workflows/build-android.yml` | Сборка APK/AAB в GitHub Actions |

## 1. Установка зависимостей

Нужны Node.js 20+, для локальной сборки Android — JDK 17 и Android Studio (Android SDK 35).

```bash
npm ci        # или npm install, если нет package-lock.json
npm run dev   # запуск в браузере для разработки
npm run build # сборка веб-части в dist/client
npm run preview
npm test      # проверка правил приложения
```

## 2. Capacitor

Capacitor уже подключён, папка `android/` уже создана. Веб-сборка лежит в `dist/client`
(в `capacitor.config.ts` это `webDir`). После любых изменений кода:

```bash
npm run build
npm run cap:sync      # = npx cap sync android
```

Если папку `android/` удалили — пересоздайте: `npx cap add android`, затем повторно добавьте файлы
`MainActivity.java`, `AppSettingsPlugin.java`, `res/drawable/ic_stat_habit.xml`, разрешения в манифесте и блок подписи в `app/build.gradle`.

## 3. Открыть Android-проект

```bash
npm run android:open  # откроет android/ в Android Studio
```

## 4. Запуск на устройстве

1. На телефоне включите «Для разработчиков» → «Отладка по USB».
2. Подключите телефон, в Android Studio выберите его и нажмите **Run ▶**.
3. Или соберите APK из командной строки: `npm run android:build` →
   файл `android/app/build/outputs/apk/debug/app-debug.apk`, установите: `adb install -r app-debug.apk`.

## 5. Сборка в GitHub Actions

1. Загрузите проект в репозиторий GitHub (ветка `main`).
2. Workflow запускается сам при push в `main`, при создании Release
   или вручную: вкладка **Actions → Build Android → Run workflow**.
3. Шаги: `npm ci` → `npm run build` → `npx cap sync android` → `chmod +x android/gradlew` →
   `./gradlew assembleDebug` → `./gradlew bundleRelease` (+ `assembleRelease`).

Debug APK собирается всегда. Если release-сборка не удалась, workflow не падает.

## 6. Где скачать APK

**Actions → нужный запуск → внизу раздел Artifacts**:

- `my-habits-debug-apk` — APK для установки на телефон;
- `my-habits-release-apk` — release APK;
- `my-habits-release-aab` — файл для Google Play.

Артефакты скачиваются как ZIP — распакуйте и откройте `.apk` на телефоне (разрешите установку из неизвестных источников).

## 7. Release-подпись

Ключ и пароли **никогда** не хранятся в репозитории.

1. Создайте ключ (один раз, сохраните в надёжном месте):
   ```bash
   keytool -genkeypair -v -keystore release.jks -alias myhabits -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Закодируйте в base64: `base64 -w 0 release.jks > release.b64` (macOS: `base64 -i release.jks`).
3. В GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `ANDROID_KEYSTORE_BASE64` — содержимое `release.b64`;
   - `ANDROID_KEYSTORE_PASSWORD` — пароль хранилища;
   - `ANDROID_KEY_ALIAS` — `myhabits`;
   - `ANDROID_KEY_PASSWORD` — пароль ключа.

Без секретов release-файлы собираются неподписанными (для Google Play не годятся), debug APK — как обычно.
Для локальной подписи создайте `android/keystore.properties` (он в `.gitignore`):

```
storeFile=/полный/путь/release.jks
storePassword=...
keyAlias=myhabits
keyPassword=...
```

## 8. APK и AAB — в чём разница

- **APK** — готовый установочный файл: можно сразу поставить на телефон.
- **AAB** (Android App Bundle) — формат для загрузки в Google Play; магазин сам собирает из него APK под каждое устройство. На телефон напрямую не ставится.

## Перед публикацией в Google Play

Замените `com.example.myhabits` на свой ID в двух местах:
`capacitor.config.ts` (константа `APP_ID`) и `android/app/build.gradle` (`namespace`, `applicationId`),
затем перенесите `MainActivity.java`/`AppSettingsPlugin.java` в папку с новым именем пакета и обновите строку `package`.
Увеличивайте `versionCode` в `android/app/build.gradle` при каждом обновлении.

## Как это работает

- Данные (привычки, архив, тема, ID уведомлений, статус разрешения) хранятся в `@capacitor/preferences`.
- Бессрочная привычка — одно ежедневное повторяющееся уведомление. Привычка с датой окончания — уведомления по дням на 60 дней вперёд и не позже даты окончания; окно обновляется при каждом запуске.
- При запуске привычки с истёкшим сроком переносятся в архив с причиной «Срок действия завершён».
- Светлая тема: строка состояния `#111827` со светлыми значками; тёмная: `#FFFFFF` с тёмными значками. Верхняя панель приложения повторяет эти цвета.
- Кнопка «Назад»: закрывает окно → возвращает на «Привычки» → выходит из приложения.
