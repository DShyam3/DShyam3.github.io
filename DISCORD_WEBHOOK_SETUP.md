# Discord Webhook Setup for MediaBoard Updates

This guide will help you set up Discord notifications for your MediaBoard daily updates using webhooks.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create a Discord Webhook

1. **Go to your Discord server**
2. **Right-click on a channel** where you want notifications
3. **Select "Edit Channel"** → **Integrations** → **Webhooks**
4. **Click "New Webhook"**
5. **Name it** "MediaBoard Updates"
6. **Copy the Webhook URL** (you'll need this for GitHub)

### Step 2: Add GitHub Secret

1. **Go to your GitHub repository**
2. **Navigate to Settings** → **Secrets and variables** → **Actions**
3. **Add a new secret**:
   - **Name**: `DISCORD_WEBHOOK_URL`
   - **Value**: Your Discord webhook URL from Step 1

### Step 3: Use Discord Workflow

1. **Rename the workflow file**:
   ```bash
   mv .github/workflows/daily-update.yml .github/workflows/daily-update-email.yml
   mv .github/workflows/daily-update-discord.yml .github/workflows/daily-update.yml
   ```

2. **Commit and push**:
   ```bash
   git add .github/workflows/
   git commit -m "Switch to Discord notifications"
   git push
   ```

### Step 4: Test

1. **Go to Actions tab** in your repository
2. **Manually trigger** the workflow
3. **Check your Discord channel** for the notification

## 📱 What You'll See

### Success Notification:
- ✅ Green embed with "MediaBoard Update Completed"
- Update start and completion times
- Whether changes were made
- Direct link to GitHub workflow

### Failure Notification:
- ❌ Red embed with "MediaBoard Update Failed"
- Failure timestamp
- Direct link to GitHub workflow logs

## 🔧 Advantages of Discord

- **Instant notifications** - No email delays
- **Rich formatting** - Embeds with colors and fields
- **Mobile friendly** - Discord app notifications
- **No spam folder** - Always delivered
- **Free** - No email setup required
- **Easy to share** - Team members can see updates too

## 🎯 Next Steps

1. **Choose your notification channel** (general, updates, or create a new one)
2. **Test the webhook** by manually triggering the workflow
3. **Customize the message** if needed (edit the workflow file)
4. **Monitor the first few automated runs**

That's it! You'll now get Discord notifications every time your MediaBoard updates run. 
