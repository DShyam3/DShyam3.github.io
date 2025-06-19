# Email Notification Setup for MediaBoard Updates

This guide will help you set up email notifications for your MediaBoard daily updates. You'll receive emails when updates complete successfully or fail.

## 🚀 Option 1: Gmail SMTP (Recommended - Free)

### Step 1: Enable Gmail App Passwords

1. **Go to your Google Account settings**: https://myaccount.google.com/
2. **Navigate to Security** → **2-Step Verification** (enable if not already)
3. **Go to App passwords** (under 2-Step Verification)
4. **Generate a new app password**:
   - Select "Mail" as the app
   - Select "Other" as the device
   - Name it "MediaBoard Updates"
   - Copy the generated 16-character password

### Step 2: Add GitHub Secrets

1. **Go to your GitHub repository**
2. **Navigate to Settings** → **Secrets and variables** → **Actions**
3. **Add the following secrets**:

```
SMTP_SERVER: smtp.gmail.com
SMTP_PORT: 587
SMTP_USERNAME: your-email@gmail.com
SMTP_PASSWORD: your-16-character-app-password
SMTP_FROM: your-email@gmail.com
NOTIFICATION_EMAIL: your-email@gmail.com
```

### Step 3: Test the Setup

1. **Push the workflow file** to your repository
2. **Go to Actions tab** in your repository
3. **Manually trigger the workflow** to test
4. **Check your email** for the notification

## 📧 Option 2: Outlook/Hotmail SMTP

### Step 1: Enable App Passwords

1. **Go to your Microsoft Account**: https://account.microsoft.com/
2. **Navigate to Security** → **Advanced security options**
3. **Enable 2-step verification** if not already enabled
4. **Create an app password** for "Mail"

### Step 2: Add GitHub Secrets

```
SMTP_SERVER: smtp-mail.outlook.com
SMTP_PORT: 587
SMTP_USERNAME: your-email@outlook.com
SMTP_PASSWORD: your-app-password
SMTP_FROM: your-email@outlook.com
NOTIFICATION_EMAIL: your-email@outlook.com
```

## 🔧 Option 3: Custom SMTP Server

If you have your own email server or use a different provider:

```
SMTP_SERVER: your-smtp-server.com
SMTP_PORT: 587 (or 465 for SSL)
SMTP_USERNAME: your-username
SMTP_PASSWORD: your-password
SMTP_FROM: your-email@domain.com
NOTIFICATION_EMAIL: your-email@domain.com
```

## 📱 Option 4: Alternative Notification Methods

### Discord Webhook

If you prefer Discord notifications, you can use this alternative workflow:

```yaml
- name: Send Discord notification
  if: always()
  run: |
    curl -H "Content-Type: application/json" \
         -X POST \
         -d '{
           "embeds": [{
             "title": "${{ job.status == \"success\" && \"✅ MediaBoard Update Completed\" || \"❌ MediaBoard Update Failed\" }}",
             "description": "Daily update ${{ job.status == \"success\" && \"completed successfully\" || \"failed\" }}",
             "color": ${{ job.status == \"success\" && 3066993 || 15158332 }},
             "fields": [
               {
                 "name": "Repository",
                 "value": "${{ github.repository }}",
                 "inline": true
               },
               {
                 "name": "Workflow",
                 "value": "[View Details](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})",
                 "inline": true
               }
             ],
             "timestamp": "${{ github.event.head_commit.timestamp }}"
           }]
         }' \
         ${{ secrets.DISCORD_WEBHOOK_URL }}
```

### Slack Webhook

For Slack notifications:

```yaml
- name: Send Slack notification
  if: always()
  run: |
    curl -X POST -H 'Content-type: application/json' \
         --data '{
           "text": "${{ job.status == \"success\" && \"✅ MediaBoard Update Completed\" || \"❌ MediaBoard Update Failed\" }}",
           "attachments": [{
             "fields": [
               {
                 "title": "Repository",
                 "value": "${{ github.repository }}",
                 "short": true
               },
               {
                 "title": "Workflow",
                 "value": "<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Details>",
                 "short": true
               }
             ]
           }]
         }' \
         ${{ secrets.SLACK_WEBHOOK_URL }}
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Failed**:
   - Verify your app password is correct
   - Ensure 2-step verification is enabled
   - Check that you're using the correct SMTP server

2. **Emails Not Received**:
   - Check your spam folder
   - Verify the email address in NOTIFICATION_EMAIL
   - Check GitHub Actions logs for errors

3. **Workflow Fails**:
   - Check that all secrets are properly set
   - Verify the SMTP server and port are correct
   - Check GitHub Actions logs for detailed error messages

### Testing Your Setup

1. **Manual Trigger**: Go to Actions → Daily MediaBoard Update → Run workflow
2. **Check Logs**: View the workflow run logs for any errors
3. **Verify Email**: Check your inbox (and spam folder) for the notification

## 📊 Email Content

The emails you'll receive include:

### Success Email:
- ✅ Green checkmark in subject
- Update start and completion times
- Whether changes were made to the repository
- Direct link to the workflow run
- Repository information

### Failure Email:
- ❌ Red X in subject
- Failure timestamp
- Direct link to workflow logs
- Repository information
- Instructions to check logs

## 🔒 Security Notes

- **Never commit secrets** to your repository
- **Use app passwords** instead of your main password
- **Rotate passwords** regularly
- **Limit access** to repository secrets

## 🎯 Next Steps

1. **Choose your email provider** (Gmail recommended for simplicity)
2. **Set up app passwords** following the provider's instructions
3. **Add GitHub secrets** with your SMTP configuration
4. **Test the workflow** by manually triggering it
5. **Monitor the first few automated runs** to ensure everything works

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review GitHub Actions logs for detailed error messages
3. Verify your SMTP configuration with your email provider
4. Test with a simple email client first

The email notification system will keep you informed about your MediaBoard updates automatically, so you'll always know when your content has been refreshed! 
