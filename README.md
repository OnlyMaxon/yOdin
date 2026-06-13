# yOdin

Social mobile app where people discuss topics across nationalities and locations.
Built with **Expo SDK 54** · **Firebase** · **React Native** · **TypeScript**

---

## Prerequisites

Before you start, make sure you have:

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** (comes with Node.js)
- **Expo Go** on your phone — [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) · [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- A **Firebase** project (free Spark plan is enough)

---

## Step 1 — Clone and install

```bash
git clone <repo-url>
cd yodin
npm install
```

---

## Step 2 — Firebase setup

### 2.1 Create a project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Enter a project name → Continue → **Create project**

### 2.2 Enable Authentication

**Build → Authentication → Get started → Sign-in method**
Enable **Email/Password** → Save

### 2.3 Enable Firestore

**Build → Firestore Database → Create database**
Choose **Start in production mode** → pick any region → **Done**

### 2.4 Enable Storage

**Build → Storage → Get started** → Next → **Done**

### 2.5 Get your app config

**Project Settings (gear icon) → General → Your apps → Add app → Web (`</>`)**

Register the app, then copy the config object that appears:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 2.6 Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and paste in the values from the config above:

```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 2.7 Deploy Firestore rules and indexes

Install the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
```

Connect the CLI to your project:

```bash
firebase use --add
```

Select your project from the list, give it an alias (e.g. `default`), then deploy:

```bash
firebase deploy --only firestore,storage
```

This deploys:
- `firestore.rules` — security rules for the database
- `firestore.indexes.json` — composite indexes required for queries
- `storage.rules` — rules for avatar photo uploads

> **Note:** Firestore index building takes **2–5 minutes**. The feed will appear empty until they are ready.

---

## Step 3 — Run the app

```bash
npx expo start
```

A QR code will appear in the terminal.

- **Android** — open the **Expo Go** app → tap **Scan QR Code**
- **iPhone** — scan the QR code with the default **Camera** app (it opens Expo Go automatically)

Your phone and computer must be on the **same Wi-Fi network**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Black screen on launch | Check that all `.env` values are correct, then press `r` in the Metro terminal to reload |
| Empty feed after login | Firestore indexes are still building — wait a few minutes and pull to refresh |
| `Network request failed` | Phone and computer must be on the same Wi-Fi network |
| Auth errors on register / login | Confirm **Email/Password** is enabled in Firebase Authentication |
| Photo upload fails | Check that Storage is enabled and `storage.rules` was deployed |

expo go 
algolia
trello 
domains
i18n


