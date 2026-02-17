In the logs we have for the schedule discount pricing we are trying to get the discount amount. We see many logs but I dont see any logs to display the discounted amount.
The schedule subscriptions addons that haven't started yet don't display the price with the disocunted amount be removed from the total. 

2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] ========================================

2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] Subscription ID: sub_sched_1SRfBFB3lUTVGKGUH5e6Mb2W
2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] Is scheduled subscription: true
2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] Subscription status: active
2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] Product type: addon
2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] Database price: 1000 cents
2025-11-10 19:25:16.50
5b5634d4
User
[SCHEDULED ADDON DEBUG] 🔍 Fetching scheduled subscription from Stripe...
2025-11-10 19:25:16.61
5b5634d4
User
[SCHEDULED ADDON DEBUG] ========================================
2025-11-10 19:25:16.61
5b5634d4
User
[SCHEDULED ADDON DEBUG] Subscription ID: sub_1R41fqB3lUTVGKGUu0QDcl12
2025-11-10 19:25:16.61
5b5634d4
User
[SCHEDULED ADDON DEBUG] Is scheduled subscription: false
2025-11-10 19:25:16.61
5b5634d4
User
[SCHEDULED ADDON DEBUG] Subscription status: active
2025-11-10 19:25:16.61
5b5634d4
User
[SCHEDULED ADDON DEBUG] Product type: plan
2025-11-10 19:25:16.61
5b5634d4
User
[SCHEDULED ADDON DEBUG] Database price: 3900 cents
2025-11-10 19:25:16.61
5b5634d4
User
[/api/user] Fetching Stripe subscription for: sub_1R41fqB3lUTVGKGUu0QDcl12
2025-11-10 19:25:16.61
5b5634d4
User
[/api/user] Skipping Stripe fetch - status: incomplete_expired, stripeSubscriptionId: sub_1R41csB3lUTVGKGUt9CXkggV
2025-11-10 19:25:16.61
5b5634d4
User
[SUBSCRIPTION RETURN DEBUG] Subscription ID: 969
2025-11-10 19:25:16.61
5b5634d4
User
[SUBSCRIPTION RETURN DEBUG] Product Type: plan
2025-11-10 19:25:16.61
5b5634d4
User
[SUBSCRIPTION RETURN DEBUG] Stripe ID: sub_1R41csB3lUTVGKGUt9CXkggV
