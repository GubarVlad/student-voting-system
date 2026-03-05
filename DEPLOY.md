# GitHub Pages Deployment Files

This folder contains all files needed to deploy the Student Council Voting System to GitHub Pages.

## 📁 What's Included

```
github-deploy/
├── index.html              # Main application page
├── src/
│   ├── js/                 # All JavaScript modules (8 files)
│   │   ├── app.js
│   │   ├── router.js
│   │   ├── firebase-config.js
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── admin.js
│   │   ├── member.js
│   │   └── results.js
│   └── css/
│       └── style.css       # All styling
├── firebase.json           # Firebase hosting config
├── firestore.rules         # Database security rules
└── firestore.indexes.json  # Firestore indexes
```

---

## 🚀 How to Deploy to GitHub Pages

### Method 1: Direct Upload (Simplest)

1. **Create a new repository** on GitHub:
   - Go to https://github.com/new
   - Name: `student-voting-system`
   - Make it public
   - Don't initialize with README

2. **Upload these files**:
   ```bash
   cd github-deploy
   git init
   git add .
   git commit -m "Initial commit - Voting System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/student-voting-system.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to repository Settings
   - Navigate to Pages (left sidebar)
   - Source: Deploy from branch
   - Branch: `main` / `(root)`
   - Click Save

4. **Your site will be live at**:
   ```
   https://YOUR_USERNAME.github.io/student-voting-system
   ```

---

### Method 2: Using GitHub Desktop

1. Open GitHub Desktop
2. File → Add Local Repository
3. Choose the `github-deploy` folder
4. Publish repository to GitHub
5. Enable GitHub Pages in repository settings (see Method 1, step 3)

---

## ⚙️ Post-Deployment Configuration

### Update Firebase Config

After deployment, update the Firebase config with your actual credentials:

1. Edit `src/js/firebase-config.js`
2. Replace with your Firebase project credentials from Firebase Console

### Update QR Code URLs

If you generated QR codes, make sure they point to your live URL:
- Update `APP_URL` in the main project's `scripts/generateQRCodes.js`
- Re-run: `npm run generate-qr`

---

## 🔐 Security Checklist

Before deploying:

- ✅ All files are present (index.html, src/js/, src/css/)
- ✅ Firebase credentials are valid in `firebase-config.js`
- ✅ No `.env` files included (credentials are hardcoded in firebase-config.js for frontend)
- ✅ Firestore rules are deployed separately via Firebase CLI
- ✅ Users have been created in Firebase Authentication

---

## 📝 Notes

- **No build step required** - These are static files ready to deploy
- **Hash routing** - Uses `/#/login`, `/#/admin`, etc. for GitHub Pages compatibility
- **Firebase backend** - Authentication and database hosted on Firebase
- **Static hosting** - GitHub Pages only serves the frontend files

---

## 🆘 Troubleshooting

### Site not loading?
- Check that GitHub Pages is enabled in repository settings
- Wait 2-3 minutes for deployment to complete
- Verify all files were uploaded correctly

### Login not working?
- Check Firebase credentials in `src/js/firebase-config.js`
- Make sure users were created with `createUsers.js` script
- Verify Firestore rules are deployed

### 404 errors on refresh?
- This is normal with hash routing on GitHub Pages
- Users should always start from the base URL
- Bookmark: `https://YOUR_USERNAME.github.io/student-voting-system/#/login`

---

## 🎯 Quick Deploy Checklist

- [ ] Create GitHub repository
- [ ] Upload all files from `github-deploy/` folder
- [ ] Enable GitHub Pages in repository settings
- [ ] Wait 2-3 minutes for deployment
- [ ] Test login at your live URL
- [ ] Share URL with council members

---

**Your deployment URL:**
```
https://YOUR_USERNAME.github.io/student-voting-system
```

Replace `YOUR_USERNAME` with your actual GitHub username.
