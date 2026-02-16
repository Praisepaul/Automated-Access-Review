import axios from 'axios';

/**
 * Sends a formatted summary of the access review to Slack
 * @param {Array} reportData - Array of objects containing app name and diff results
 */
export async function sendSlackSummary(reportData) {
    if (!process.env.SLACK_WEBHOOK_URL) {
        console.warn("[SLACK] Webhook URL not found in .env. Skipping notification.");
        return;
    }

    // Only notify if there are actual discrepancies to report
    const appsWithIssues = reportData.filter(item => item.unauthorizedCount > 0 || item.missingCount > 0);
    
    if (appsWithIssues.length === 0) {
        console.log("[SLACK] No discrepancies found. Skipping notification.");
        return;
    }

    let blocks = [
        {
            "type": "header",
            "text": { "type": "plain_text", "text": "🚨 Access Review Discrepancy Report", "emoji": true }
        },
        {
            "type": "section",
            "text": { "type": "mrkdwn", "text": `Review completed. Found issues in *${appsWithIssues.length}* applications.` }
        },
        { "type": "divider" }
    ];

    appsWithIssues.forEach(app => {
        const unauthorizedList = app.unauthorizedList.length > 0 
            ? app.unauthorizedList.join(', ') 
            : "_None_";

        blocks.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `*App:* ${app.name}\n` +
                        `• *Missing (In JC, not in App):* ${app.missingCount}\n` +
                        `• *Unauthorized (In App, not in JC):* ${app.unauthorizedCount}\n` +
                        `• *Unauthorized Users:* ${unauthorizedList}`
            }
        });
    });

    try {
        await axios.post(process.env.SLACK_WEBHOOK_URL, { blocks });
        console.log("[SLACK] Summary message sent successfully.");
    } catch (error) {
        console.error("[SLACK] Failed to send notification:", error.message);
    }
}