#!/usr/bin/env node

/**
 * MediaBoard Update Script
 * 
 * This script can be used to trigger MediaBoard updates from external sources
 * such as GitHub Actions, cron jobs, or webhooks.
 * 
 * Usage:
 *   node scripts/update-mediaboard.js [options]
 * 
 * Options:
 *   --force     Force update even if recently updated
 *   --daily     Run daily update (comprehensive check)
 *   --platforms Check platform availability
 *   --webhook   Send webhook notification after update
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
    // Add your webhook URL here if you want notifications
    webhookUrl: process.env.UPDATE_WEBHOOK_URL || null,
    
    // Add your MediaBoard API endpoint if you have one
    mediaboardApiUrl: process.env.MEDIABOARD_API_URL || null,
    
    // Update intervals (in milliseconds)
    minUpdateInterval: 1000 * 60 * 60, // 1 hour
    dailyUpdateInterval: 1000 * 60 * 60 * 24, // 24 hours
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    force: args.includes('--force'),
    daily: args.includes('--daily'),
    platforms: args.includes('--platforms'),
    webhook: args.includes('--webhook')
};

// Utility function to make HTTP requests
function makeRequest(urlString, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'User-Agent': 'MediaBoard-Update-Bot/1.0',
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }
        
        const req = client.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: responseData
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (data) {
            req.write(data);
        }
        
        req.end();
    });
}

// Send webhook notification
async function sendWebhookNotification(updateData) {
    if (!CONFIG.webhookUrl) {
        console.log('No webhook URL configured, skipping notification');
        return;
    }
    
    try {
        const payload = {
            timestamp: new Date().toISOString(),
            type: 'mediaboard_update',
            data: updateData
        };
        
        const response = await makeRequest(CONFIG.webhookUrl, 'POST', JSON.stringify(payload));
        console.log('Webhook notification sent:', response.statusCode);
    } catch (error) {
        console.error('Failed to send webhook notification:', error.message);
    }
}

// Trigger update via API (if available)
async function triggerApiUpdate() {
    if (!CONFIG.mediaboardApiUrl) {
        console.log('No MediaBoard API URL configured, skipping API update');
        return null;
    }
    
    try {
        const updateData = {
            force: options.force,
            daily: options.daily,
            platforms: options.platforms,
            timestamp: new Date().toISOString()
        };
        
        const response = await makeRequest(CONFIG.mediaboardApiUrl, 'POST', JSON.stringify(updateData));
        console.log('API update triggered:', response.statusCode);
        return response;
    } catch (error) {
        console.error('Failed to trigger API update:', error.message);
        return null;
    }
}

// Main update function
async function runUpdate() {
    const startTime = new Date();
    console.log('Starting MediaBoard update...');
    console.log('Options:', options);
    console.log('Start time:', startTime.toISOString());
    
    try {
        // Trigger API update if configured
        const apiResult = await triggerApiUpdate();
        
        // Log update details
        const endTime = new Date();
        const duration = endTime - startTime;
        
        const updateData = {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: duration,
            options: options,
            apiResult: apiResult ? {
                statusCode: apiResult.statusCode,
                success: apiResult.statusCode >= 200 && apiResult.statusCode < 300
            } : null
        };
        
        console.log('Update completed successfully');
        console.log('Duration:', duration, 'ms');
        console.log('Update data:', JSON.stringify(updateData, null, 2));
        
        // Send webhook notification if requested
        if (options.webhook) {
            await sendWebhookNotification(updateData);
        }
        
        return updateData;
        
    } catch (error) {
        console.error('Update failed:', error.message);
        
        // Send error notification
        if (options.webhook) {
            await sendWebhookNotification({
                error: error.message,
                timestamp: new Date().toISOString(),
                options: options
            });
        }
        
        process.exit(1);
    }
}

// Run the update
if (require.main === module) {
    runUpdate().then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    }).catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = { runUpdate, makeRequest, sendWebhookNotification }; 
