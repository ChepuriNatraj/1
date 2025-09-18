# Cross-Device Task Sync Setup Guide

## 🔄 How to Enable Task Synchronization

Your Task Optimization Canvas now supports cross-device synchronization! Here's how to set it up:

### Step 1: Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Tokens (classic)" 
3. Click "Generate new token (classic)"
4. Give your token a name like "Task Sync"
5. Select the **"repo"** permission (this allows read/write access to your repositories)
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again!)

### Step 2: Enable Sync in Your App

1. Open your Task Manager app in any browser
2. Click the "🔄 Enable Sync" button in the header
3. Paste your GitHub token when prompted
4. Your tasks will now sync automatically!

## ✨ What Happens Next

- **Automatic Sync**: Tasks sync every 30 seconds and when you switch back to the app
- **Cross-Device**: Add a task on your desktop → see it instantly on mobile
- **Conflict Resolution**: If you edit on multiple devices, the most recent change wins
- **Offline Support**: Works offline, syncs when you're back online

## 📱 Using on Mobile

1. Open the same website URL on your mobile device
2. The sync will already be enabled (uses the same GitHub token)
3. Your tasks will appear automatically!

## 🔧 Technical Details

- Tasks are stored in a `tasks.json` file in your GitHub repository
- Each change creates a commit with timestamp
- Data is encrypted in transit (HTTPS)
- Your GitHub token is stored locally in your browser

## 🚨 Security Note

- Keep your GitHub token private
- If compromised, revoke it in GitHub settings and create a new one
- The token only has access to your repositories, not your entire GitHub account

## 📞 Troubleshooting

**Sync not working?**
1. Check your internet connection
2. Verify your GitHub token has "repo" permissions
3. Make sure you're using the same GitHub account

**Tasks not appearing on mobile?**
1. Make sure sync is enabled on desktop first
2. Wait 30 seconds for initial sync
3. Refresh the mobile page

**Having issues?** Check the browser console (F12) for error messages.

---

Enjoy seamless task management across all your devices! 🚀