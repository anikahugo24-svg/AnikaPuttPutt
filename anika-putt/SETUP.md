# 🎀 Anika's 26th — Setup Guide
## From zero to live web app in ~15 minutes

---

## STEP 1 — Create a Firebase Project (free)

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"** → name it `anika-putt-putt`
3. Disable Google Analytics (not needed) → **Create project**

---

## STEP 2 — Enable Realtime Database

1. In the left sidebar click **Build → Realtime Database**
2. Click **"Create Database"**
3. Choose a region (any is fine) → **Next**
4. Select **"Start in test mode"** → **Enable**
   *(This allows everyone to read/write — perfect for a party!)*

---

## STEP 3 — Enable Storage (for photos)

1. In the left sidebar click **Build → Storage**
2. Click **"Get Started"** → **Next**
3. Select **"Start in test mode"** → **Done**

---

## STEP 4 — Get your Firebase config

1. Click the **gear icon ⚙️** next to "Project Overview" → **Project settings**
2. Scroll down to **"Your apps"**
3. Click the **</>** web icon to register a web app
4. Name it `anika-putt` → click **Register app**
5. You'll see a `firebaseConfig` object — **copy it**

---

## STEP 5 — Paste config into the app

Open the file **`src/firebase.js`** and replace the placeholder values
with your actual config. It should look like this:

```js
const firebaseConfig = {
  apiKey:            "AIzaSyAbc123...",
  authDomain:        "anika-putt-putt.firebaseapp.com",
  databaseURL:       "https://anika-putt-putt-default-rtdb.firebaseio.com",
  projectId:         "anika-putt-putt",
  storageBucket:     "anika-putt-putt.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
}
```

---

## STEP 6 — Deploy to Vercel (free, takes 2 minutes)

### Option A — Vercel via GitHub (recommended)

1. Push this folder to a **GitHub repo** (github.com → New repo → upload files)
2. Go to **https://vercel.com** → sign up free with GitHub
3. Click **"Add New Project"** → import your GitHub repo
4. Vercel auto-detects Vite → click **Deploy**
5. Done! You get a URL like `https://anika-putt.vercel.app`

### Option B — Vercel CLI (if you have Node.js installed)

```bash
npm install -g vercel
cd anika-putt
npm install
vercel --prod
```

---

## STEP 7 — Share the link!

Send the Vercel URL to everyone before the party.
**All 35 players open the same URL** and scores sync live across all phones.

---

## 🎉 That's it!

| Feature | How it works |
|---|---|
| Live scores | Firebase Realtime Database — updates in <1 second |
| Photos | Firebase Storage — any phone uploads, all phones see |
| Braai vote | Stored in Firebase — live tally |
| Bonus points | Toggle per player — syncs instantly |
| Leaderboard | Always live — no refresh needed |

---

## ⚡ Firebase Free Tier Limits (more than enough for your party)

- 100 simultaneous connections ✅ (you have 35 people)
- 1 GB database storage ✅
- 5 GB photo storage ✅
- 10 GB/month downloads ✅

---

## 🆘 Troubleshooting

**"Permission denied" error** → Go back to Firebase Console, check that
Realtime Database and Storage are both in **test mode**.

**Photos not uploading** → Make sure Storage is enabled (Step 3).

**White screen** → Check that all 8 values in `firebase.js` are filled in.
