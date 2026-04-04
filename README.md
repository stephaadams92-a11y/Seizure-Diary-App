# Seizure-Diary-App
Seizurre – How to Use Your App
What is Seizurre?
Seizurre is a private seizure diary that lives entirely on your device. No accounts, no internet, no cloud — your medical data never leaves your phone or browser. This makes it very private, but it also means you are responsible for keeping backups safe.
The Tabs
⚡ Log — Your main tab. Hit the big Log Seizure button the moment a seizure happens. It saves instantly with the current time. A popup then lets you add details (duration, type, triggers, notes) while it's fresh — or skip and come back later.
💊 Meds — Add your medications with dose times. Tap each time slot to mark a dose as taken. The new Dose History section shows the last 30 days so you and your doctor can see exactly which days a dose was missed.
🎯 Triggers — Tag what was happening before a seizure (stress, missed sleep, flashing lights, etc). Over time the app shows you patterns — which triggers appear most often.
📊 Charts — Visual breakdown of your seizures by month, time of day, and trigger correlation. Useful to print or show a neurologist.
⋯ More — Appointments, freeform notes, export options, and settings.
Backing Up — This Is Important
Seizurre stores data in your browser's IndexedDB by default. This is reliable day-to-day, but it has one big weakness:
⚠️ Clearing your browser history, cache, or site data will permanently delete everything in the app — with no warning and no recovery.
This can happen if you:
Tap "Clear browsing data" in Chrome/Edge/Firefox settings
Do a factory reset or phone reset
Uninstall and reinstall your browser
Run a phone cleaner app that wipes browser storage
Switch to a different browser
The safest option — Permanent File Storage
On Chrome or Edge (Android or desktop), you can link the app to an actual file on your device:
Go to the ⚡ Log tab and scroll down to the Permanent Storage card
Tap ✨ Create new file to start fresh, or 📂 Open data file if you have one already
Give the file a name like SeizurreDiaryData.json and save it somewhere you'll remember (e.g. your Documents folder or Google Drive)
From then on, every time you log something the app saves directly to that file — completely immune to browser clears
The status bar at the top of the Log tab shows whether file saving is active.
Regular JSON Backup (works on all browsers)
Even if you use file storage, it's worth keeping a separate backup copy:
Go to ⋯ More → Full App Backup (JSON)
Tap 💾 Save Backup
A .json file downloads to your device
Move it somewhere safe — your Google Drive, email it to yourself, or save it to a USB stick
Do this at least once a month, or after any heavy logging period. The app will remind you after 7 days if you haven't backed up.
Restoring a Backup
Go to ⋯ More → Full App Backup (JSON)
Tap 📂 Restore
Pick your .json backup file
Confirm — it replaces everything with the backup data
Exporting for Your Doctor
Under ⋯ More → Export, you have three options:
📊 CSV — Opens in Excel or Google Sheets. Great for sharing with a neurologist or epilepsy nurse
📄 Text — Plain readable summary, easy to paste into an email
📑 PDF — Opens a print-ready page you can save as PDF or print directly
Quick Tips
Log first, add details after — the timestamp is what matters most. Tap the button immediately, fill in the rest when you're ready
Dose history — on the Meds tab, the 30-day history shows missed doses clearly. Screenshot this before appointments
Emergency guide — tap the 🆘 button in the top right at any time for the seizure first aid steps and a one-tap 999 button
Dark mode — tap the 🌙/☀️ button in the header to switch
Weekly backup reminder — turn this on in Settings (⋯ More → Settings) to get a notification nudge
