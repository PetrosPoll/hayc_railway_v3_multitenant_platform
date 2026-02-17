# Google Analytics 4 - IP Filtering Instructions

## Exclude Admin IP from Production Tracking

Follow these steps to exclude your admin IP address (85.73.94.118) from Google Analytics tracking on your published site.

---

## Step 1: Define Internal Traffic Rule

1. Go to **Google Analytics** at https://analytics.google.com
2. Click **Admin** (bottom-left corner)
3. Under **Data collection and modification**, click **Data Streams**
4. Click on your **Web** data stream (hayc website)
5. Scroll down and click **Configure tag settings**
6. Click **Show more** to expand additional options
7. Click **Define internal traffic**
8. Click **Create** (blue button)

---

## Step 2: Configure the Rule

Enter the following settings:

- **Rule name**: `Admin Traffic`
- **traffic_type parameter value**: `internal` (leave as default)
- **IP address**:
  - **Match type**: Select `IP address equals`
  - **Value**: `85.73.94.118`

Click **Create** to save the rule.

---

## Step 3: Activate the Filter

1. Still in **Admin**, go to **Data Settings** → **Data Filters**
2. You'll see a filter called **Internal Traffic**
3. Click on it
4. Change the **Filter State** from `Testing` to `Active`
5. Click **Save**

---

## Step 4: Verify It's Working

### Test in Realtime:
1. Go to **Reports** → **Realtime**
2. Visit your published website (not development)
3. **Expected result**: You should NOT see your visit appear in Realtime reports
4. Ask someone else to visit → Their visit SHOULD appear

### Alternative Test:
- Check your IP at https://www.whatismyip.com to confirm it's still `85.73.94.118`
- If your IP changes (ISP reassignment), you'll need to update the filter with your new IP

---

## Important Notes

- ⚠️ **Testing Mode**: If you set the filter to "Testing" instead of "Active", your traffic will still be collected but marked as internal (visible in DebugView)
- ⚠️ **Active Mode**: Once set to "Active", traffic from this IP is permanently excluded from all reports
- 💡 **Multiple IPs**: If you work from different locations, create additional rules for each IP address
- 💡 **IPv6**: If needed, you can also add your IPv6 address (`2001:4860:7:1711::fc`) as a separate rule

---

## Current Configuration

**Development Environment**: Automatically excluded (localhost, replit.dev)
**Production Environment**: IP `85.73.94.118` excluded via GA4 filter

This ensures clean analytics showing only real customer behavior!
