# MediaBoard Automated Update System

This document describes the automated update system for MediaBoard, which provides both scheduled daily updates and manual update capabilities.

## Features

### 1. Daily Automated Updates
- **Scheduled Updates**: Automatically runs updates at a configurable time each day (default: 6:00 AM)
- **Client-side Scheduling**: Uses browser-based scheduling that works even when the page is open
- **Update Tracking**: Tracks when updates were last run and when the next update is scheduled
- **Configurable Timing**: Users can change the daily update time through the settings panel

### 2. Manual Updates
- **Manual Trigger**: Users can manually trigger updates by clicking the update button
- **Force Updates**: Option to force updates even if recently updated
- **Progress Tracking**: Real-time progress display during updates
- **Platform Checking**: Option to check platform availability during updates

### 3. Update Status Display
- **Last Update Time**: Shows when the last update was performed
- **Next Update Time**: Shows countdown to next scheduled update
- **Daily Update Time**: Shows the configured daily update time
- **Settings Panel**: Easy access to update configuration

### 4. GitHub Actions Integration
- **Automated Workflows**: GitHub Actions can trigger updates on schedule
- **Manual Triggering**: Workflows can be triggered manually from GitHub
- **Logging**: Comprehensive logging of update activities
- **Error Handling**: Proper error handling and notifications

## How It Works

### Client-Side Scheduling
The update system uses a combination of:
- `setInterval()` for checking if updates should run
- `localStorage` for persisting update times and settings
- Custom events for notifying the UI of update completion

### Update Process
1. **Check Timing**: Verifies if enough time has passed since last update
2. **TV Show Updates**: Checks for new seasons, status changes, and missing episodes
3. **Movie Updates**: Checks for platform availability changes
4. **Coming Soon Panel**: Updates the upcoming releases section
5. **UI Refresh**: Refreshes the display with new data
6. **Status Update**: Updates the status display and notifications

### GitHub Actions
The GitHub Actions workflow:
1. Runs on a daily schedule (configurable via cron)
2. Can be triggered manually
3. Executes the update script
4. Logs results and can send notifications

## Configuration

### Daily Update Time
Users can configure the daily update time through the settings panel:
1. Click the "⚙️ Settings" button in the News section
2. Set the desired time in 24-hour format (e.g., "06:00" for 6 AM)
3. Click "Save Settings"

### GitHub Actions Configuration
To set up GitHub Actions:

1. **Create the workflow file** (already created at `.github/workflows/daily-update.yml`)
2. **Configure environment variables** (optional):
   - `UPDATE_WEBHOOK_URL`: Webhook URL for notifications
   - `MEDIABOARD_API_URL`: API endpoint for triggering updates

3. **Customize the schedule**:
   ```yaml
   schedule:
     - cron: '0 6 * * *'  # Daily at 6:00 AM UTC
   ```

### Environment Variables
The system supports these environment variables:
- `UPDATE_WEBHOOK_URL`: Webhook URL for sending update notifications
- `MEDIABOARD_API_URL`: API endpoint for triggering updates remotely

## Usage

### For Users
1. **View Update Status**: Check the status display in the News section
2. **Manual Updates**: Click the "Check for Updates" button
3. **Configure Settings**: Use the settings panel to change update time
4. **Monitor Progress**: Watch the progress bar during updates

### For Developers
1. **Run Manual Updates**: Use the update button or settings panel
2. **Test Updates**: Use the "Test Update Now" button in settings
3. **Monitor Logs**: Check browser console for update logs
4. **GitHub Actions**: Monitor workflow runs in GitHub Actions tab

### For Automation
1. **GitHub Actions**: The workflow runs automatically on schedule
2. **Manual Trigger**: Trigger workflows manually from GitHub
3. **Webhooks**: Configure webhook URLs for notifications
4. **API Integration**: Use the provided script for external triggers

## Files and Components

### Core Files
- `updateService.js`: Main update service with scheduling logic
- `app.js`: UI integration and event handling
- `styles.css`: Styling for update status and settings
- `scripts/update-mediaboard.js`: Standalone update script

### GitHub Actions
- `.github/workflows/daily-update.yml`: GitHub Actions workflow

### Configuration
- Update times stored in `localStorage`
- Settings persisted across browser sessions
- Configurable via UI or environment variables

## Troubleshooting

### Common Issues

1. **Updates not running**:
   - Check if the page is open (client-side scheduling requires page to be loaded)
   - Verify the daily update time is set correctly
   - Check browser console for errors

2. **GitHub Actions not working**:
   - Verify the workflow file is in the correct location
   - Check GitHub Actions permissions
   - Review workflow logs for errors

3. **Manual updates failing**:
   - Check network connectivity
   - Verify API keys are configured
   - Review browser console for error messages

### Debugging
- Enable browser console logging for detailed update information
- Check GitHub Actions logs for workflow issues
- Use the test update feature to verify functionality

## Future Enhancements

### Planned Features
- **Server-side scheduling**: Move scheduling to a server for reliability
- **Email notifications**: Send email notifications for update results
- **Update history**: Track and display update history
- **Multiple time zones**: Support for different time zones
- **Update analytics**: Track update performance and statistics

### API Enhancements
- **REST API**: Full REST API for external integrations
- **Webhook support**: Enhanced webhook system
- **Authentication**: Secure API access
- **Rate limiting**: Prevent abuse of update endpoints

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console logs
3. Check GitHub Actions logs
4. Create an issue in the repository

## Contributing

To contribute to the update system:
1. Follow the existing code style
2. Add appropriate error handling
3. Update documentation for new features
4. Test changes thoroughly
5. Submit pull requests with clear descriptions 
