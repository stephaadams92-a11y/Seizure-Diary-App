# Untold Seizure Log v0.5 Universal Beta

Vercel-ready universal/PWA build based on the CodeAssist Android v0.4 application.

## What this beta adds

- Installable PWA behaviour for Android/iPhone/iPad/desktop browsers
- Dedicated `/download` trust/install page for links shared by WhatsApp, Facebook or email
- Offline shell caching
- Online/offline status
- IndexedDB local snapshot mirror in addition to the existing localStorage state
- Opt-in automatic encrypted cloud backup
- AES-256-GCM encryption in the browser before upload
- Recovery code for restoring after browser/app/device loss
- Pause, resume and permanent cloud-backup deletion controls
- Private Vercel Blob backend endpoint
- Accessibility improvements: focus-visible treatment, reduced-motion support, higher-contrast preference support, labelled cloud controls

## Important architecture

The seizure log remains local-first. Cloud backup is optional. The browser encrypts the complete state before upload. The AES key is contained only in the user's recovery code and is not sent to `/api/backup`.

The backup API receives only:
- a random capability token used to locate the private backup object
- encrypted ciphertext
- encryption IV
- app/schema version and backup timestamp

## Before enabling cloud backup in production

Create a **Private Vercel Blob store** and connect it to this Vercel project. The Vercel Blob SDK then receives its server-side credentials/OIDC configuration automatically.

Do not use a public Blob store for these backups.

## Reminder behaviour

The original CodeAssist Android application should remain available for users who require the current native exact-alarm medication/appointment reminder implementation. The universal PWA does not pretend browser timers are equivalent to native Android exact alarms. Standards-based Web Push can be added as a separate audited feature.

## Public launch checklist

- Complete UK GDPR privacy notice for optional cloud processing of health data
- Record the chosen Article 6 lawful basis and Article 9 condition
- Document the production retention policy
- Add rate limiting/abuse protection to backup endpoint before open public distribution
- Test Safari/iOS, Chrome/Android, Samsung Internet, Firefox, Edge and tablet layouts
- Run accessibility testing with TalkBack and VoiceOver
- Add production domain and HTTPS
- Keep the Android APK/store build as a separate distribution channel