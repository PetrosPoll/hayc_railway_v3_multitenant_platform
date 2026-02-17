# AWS SES Email Sender App - Complete Setup Guide

This guide will walk you through creating a simple email sender application using Node.js backend with AWS SES integration and a clean frontend interface.

## 🎯 What You'll Build

A simple email testing app with:
- Clean form interface (To, Subject, Message fields)
- Node.js Express backend with AWS SES integration
- Proper error handling and validation
- Real email sending through AWS SES

## 📋 Prerequisites

- Replit account (or Node.js development environment)
- AWS account with SES access
- AWS SES sender email verified in your AWS console


### Environment Variables Setup

We have already set environment variables (in Replit: use Secrets tab):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=this is something that we configure later
```

## 🔍 Troubleshooting

### Common Issues

**1. "Email address not verified" error**
- Solution: Verify both sender and recipient emails in AWS SES console
- Note: In sandbox mode, you can only send TO verified emails

**2. "Invalid URL" region error**
- Solution: The code includes region normalization
- Use proper region codes (e.g., "us-east-1", "eu-west-1")

**3. "Access Denied" errors**
- Solution: Check IAM permissions for your AWS user
- Ensure the user has SES send permissions

**4. "Sender not verified" error**
- Solution: Verify your sender email in AWS SES console

### Moving Out of SES Sandbox

To send emails to any address (not just verified ones):
1. Go to AWS SES console
2. Click "Account dashboard"
3. Find "Sending quota" section
4. Click "Request production access"
5. Fill out the form explaining your use case

## 📝 Key Features Implemented

✅ **Clean email form** with validation  
✅ **AWS SES integration** with proper error handling  
✅ **Region normalization** (handles human-readable region names)  
✅ **Environment variable configuration**  
✅ **Success/error feedback** with message IDs  
✅ **Form validation** using Zod schemas  
✅ **Loading states** and user feedback  
✅ **Responsive design** with dark mode support  