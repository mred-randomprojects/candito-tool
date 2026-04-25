# Firebase Setup

This app uses the same Firebase pattern as `nutriapp` and `dineros`:

- Google Authentication for sign-in.
- Cloud Firestore document per user at `users/{uid}/data/appData`.
- Local-first persistence: localStorage remains the immediate local copy.
- First login merges localStorage and Firestore, then writes the merged data back to both places.

## 1. Create Or Select The Firebase Project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create a new project or open the existing project you want to use.
3. Analytics is optional for this app; it is not required for auth or Firestore sync.

## 2. Register The Web App

1. In the project overview, click the Web app icon.
2. App nickname: `candito-tool`.
3. Do not enable Firebase Hosting unless you specifically want to move away from GitHub Pages.
4. Click **Register app**.
5. Firebase shows a config object. Copy these values into `.env.local`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Use [.env.example](/Users/maximilianoredigonda/Documents/Programming/candito-tool/.env.example) as the template.

## 3. Enable Google Authentication

1. In Firebase Console, go to **Build > Authentication**.
2. Click **Get started** if Authentication is not enabled yet.
3. Open **Sign-in method**.
4. Choose **Google**.
5. Toggle **Enable**.
6. Select a project support email.
7. Click **Save**.

## 4. Add Authorized Domains

In **Authentication > Settings > Authorized domains**, make sure these are listed:

- `localhost`
- `127.0.0.1`
- `maximilianoredigonda.github.io`

If you use another production domain later, add only the hostname, not the full URL path.

For the current GitHub Pages setup, the app URL is expected to be:

```text
https://maximilianoredigonda.github.io/candito-tool/
```

## 5. Create Firestore

1. Go to **Build > Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode**.
4. Pick the closest region you want to keep long term. You usually cannot change this later.
5. Finish creation.

## 6. Publish Security Rules

1. In **Firestore Database**, open the **Rules** tab.
2. Replace the rules with the contents of [firestore.rules](/Users/maximilianoredigonda/Documents/Programming/candito-tool/firestore.rules).
3. Click **Publish**.

The important rule is:

```js
match /users/{userId}/data/appData {
  allow read, write: if request.auth != null &&
    request.auth.uid == userId &&
    request.auth.token.email == "maxiredigonda@gmail.com";
}
```

That means only your signed-in Google account can read and write its own app data.

## 7. Add GitHub Actions Secrets

Because this app deploys through GitHub Pages, the Vite Firebase environment variables must exist in GitHub Actions too.

1. Open the GitHub repository.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add these repository secrets:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Use the same values from `.env.local`.

The deploy workflow already passes these secrets into `npm run build`.

## 8. Critical Migration Sequence

Your phone currently has the complete localStorage data. Your Windows machine is empty. Do this in this order:

1. Deploy this Firebase-enabled version.
2. On the phone, open the deployed app.
3. Sign in with Google on the phone first.
4. Wait for the app to finish the “Syncing your training data” screen.
5. Tap **Sync** once from the bottom bar.
6. Open Firebase Console > Firestore Database > Data.
7. Confirm this document exists:

```text
users/{yourFirebaseUid}/data/appData
```

8. Click the document and verify it contains `currentCycle` and/or `history`.
9. Only after that, open the app on Windows.
10. Sign in with the same Google account on Windows.
11. The Windows app should merge its empty local data with the cloud document and show the phone cycles.

## 9. Do Not Do This During Migration

- Do not delete local browser data on the phone until Firestore visibly contains the cycles.
- Do not sign in first on Windows if you are unsure whether the phone has uploaded yet. It should still be safe because the merge is additive, but phone-first is the cleanest path.
- Do not publish permissive Firestore rules like `allow read, write: if true`.

## 10. Recovery Check

If the Windows app looks empty after sign-in:

1. Check the Google account is exactly the same one used on the phone.
2. Check Firebase Console > Authentication > Users and confirm the user exists.
3. Check Firestore path `users/{uid}/data/appData`.
4. If Firestore has the data, tap **Sync** on Windows and refresh.
5. If Firestore does not have the data, go back to the phone, confirm the phone still shows the cycles, and tap **Sync** there.
