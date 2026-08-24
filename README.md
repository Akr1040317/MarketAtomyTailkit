## Firebase Cloud Functions (Email Automation)

This repo includes Firebase Cloud Functions in `functions/` for:

- **Welcome email** on new user creation (`users/{uid}`)
- **Reminder emails** for incomplete assessments (scheduled daily)
- **Completion congratulations** when a user finishes all assessment sections

Emails are enqueued by writing documents to the Firestore collection configured by `MAIL_COLLECTION` (default: `mail`), intended to be sent by the **Firebase Extension: Trigger Email** (`firebase/firestore-send-email`).

### Prerequisites

- Firebase CLI installed: `npm i -g firebase-tools`
- You must be logged into Firebase: `firebase login`

### 1) Install the Trigger Email extension

Firebase does not send email “by itself” — you still need an SMTP provider. The **Trigger Email** extension handles delivery once configured.

Install via CLI (recommended):

```bash
firebase ext:install firebase/firestore-send-email --project businesshealthassessment
```

During install, set:

- **Mail collection**: `mail` (or change `MAIL_COLLECTION` param)
- **SMTP connection URI**: from your provider (SendGrid/Mailgun/Gmail SMTP, etc.)
- **From address/name**: your desired sender

### 2) Configure function params (recommended)

These Functions use params (2nd gen) with defaults:

- `APP_BASE_URL` (default: `https://businesshealthassessment.web.app`)
- `SUPPORT_EMAIL` (default: `support@marketatomy.com`)
- `MAIL_COLLECTION` (default: `mail`)
- `FIRST_REMINDER_AFTER_DAYS` (default: `2`)
- `REMINDER_INTERVAL_DAYS` (default: `3`)
- `MAX_REMINDERS` (default: `5`)

Set params in the Firebase console (Functions → Runtime params), or via CLI if desired.

### 3) Stripe checkout (no Secret Manager)

Put your Stripe keys in `functions/.env` (gitignored). Firebase loads that file on deploy:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Promo codes unlock the assessment without Stripe. Paid checkout needs `STRIPE_SECRET_KEY`. The webhook secret is optional because returning from Stripe confirms the purchase directly.

Copy `functions/.env.example` if you are starting from scratch.

### 4) Deploy

```bash
firebase deploy --only functions --project businesshealthassessment
```

