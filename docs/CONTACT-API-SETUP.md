# Contact Form Serverless API Setup

This document explains how the serverless contact form API works and how to set it up.

## Overview

The contact form uses a **Next.js API route** which is **serverless by default** when deployed to platforms like Vercel, Netlify, or AWS Lambda. The API handles form submissions and sends emails using Gmail SMTP.

## Features

✅ **Serverless Architecture** - No server management required  
✅ **Email Validation** - Validates email format and required fields  
✅ **Rate Limiting** - Prevents spam (max 3 requests per minute per IP)  
✅ **Input Sanitization** - Protects against XSS attacks  
✅ **Field Length Validation** - Ensures reasonable message sizes  
✅ **Error Handling** - Provides specific error messages  
✅ **Reply-To Support** - Automatically sets reply-to header when email is provided

## Setup Instructions

### 1. Create Environment Variables

Copy the `.env.example` file to `.env.local`:

```bash
cp .env.example .env.local
```

### 2. Configure Gmail App Password

To use Gmail SMTP, you need to create an **App Password** (not your regular Gmail password):

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Select **Mail** and **Other (Custom name)**
5. Name it "Portfolio Contact Form"
6. Copy the generated 16-character password

### 3. Update Environment Variables

Edit `.env.local` with your credentials:

```env
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # 16-character app password
EMAIL_TO=marcus.cuong.doan@gmail.com  # Optional: defaults to this
```

⚠️ **Important:** Never commit `.env.local` to version control!

### 4. Test Locally

Run the development server:

```bash
npm run dev
```

Navigate to the Contact section and submit a test message.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project on [Vercel](https://vercel.com)
3. Add environment variables in **Project Settings → Environment Variables**:
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `EMAIL_TO` (optional)
4. Deploy!

The API route will automatically become a serverless function.

### Netlify

1. Push your code to GitHub
2. Import project on [Netlify](https://netlify.com)
3. Add environment variables in **Site settings → Environment variables**
4. Deploy!

### Other Platforms

The API works on any platform that supports Next.js API routes:
- AWS Amplify
- Azure Static Web Apps
- Railway
- Render

## API Endpoint

### POST `/api/contact`

Sends a contact form submission via email.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",  // Optional
  "content": "Your message here"
}
```

**Success Response (200):**

```json
{
  "message": "Email sent successfully!"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields or invalid input
- `429 Too Many Requests` - Rate limit exceeded
- `503 Service Unavailable` - Email service not configured
- `500 Internal Server Error` - Server error

## Rate Limiting

The API implements simple in-memory rate limiting:
- **Limit:** 3 requests per minute per IP address
- **Window:** 60 seconds

For production with multiple serverless instances, consider using:
- Redis (Upstash, Redis Cloud)
- DynamoDB
- Firebase Realtime Database

## Security Features

### Input Sanitization
- Removes `<` and `>` characters to prevent XSS
- Trims whitespace
- Limits content to 5000 characters

### Field Validation
- Name: Required, max 100 characters
- Email: Optional, must be valid format
- Content: Required, max 5000 characters

### CORS Protection
Next.js API routes are protected by same-origin policy by default.

## Troubleshooting

### "Email service is not configured"
- Check that `EMAIL_USER` and `EMAIL_PASS` are set in `.env.local`
- Restart the development server after adding environment variables

### "Email service authentication failed"
- Verify you're using an **App Password**, not your regular Gmail password
- Ensure 2-Step Verification is enabled on your Google account
- Check that `EMAIL_USER` matches the account that created the App Password

### "Too many requests"
- Wait 60 seconds before trying again
- Check if you're behind a shared IP (VPN, corporate network)

### Email not received
- Check spam folder
- Verify `EMAIL_TO` is correct
- Check server logs for errors
- Test SMTP credentials with a tool like [mailtrap.io](https://mailtrap.io)

## Alternative Email Services

While the API is configured for Gmail, you can use other SMTP services:

### SendGrid

```javascript
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  auth: {
    user: "apikey",
    pass: process.env.SENDGRID_API_KEY,
  },
});
```

### AWS SES

```javascript
const transporter = nodemailer.createTransport({
  host: "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  auth: {
    user: process.env.AWS_SES_USER,
    pass: process.env.AWS_SES_PASS,
  },
});
```

### Mailgun, Postmark, etc.

Check their respective documentation for SMTP configuration.

## Performance Considerations

- **Cold starts:** First request may be slower (200-500ms)
- **Warm instances:** Subsequent requests are faster (<100ms)
- **Email sending:** Takes 1-3 seconds depending on SMTP server

## Cost

- **Vercel Free Tier:** 100GB bandwidth, 100 serverless function executions/day
- **Netlify Free Tier:** 100GB bandwidth, 125k serverless function requests/month
- **Gmail SMTP:** Free for reasonable usage

## Monitoring

Consider adding monitoring for production:
- [Sentry](https://sentry.io) - Error tracking
- [LogRocket](https://logrocket.com) - User session replay
- [Vercel Analytics](https://vercel.com/analytics) - Performance monitoring

## Future Improvements

- [ ] Replace in-memory rate limiting with Redis
- [ ] Add honeypot field for bot detection
- [ ] Implement CAPTCHA (reCAPTCHA, hCaptcha)
- [ ] Add email queue for better reliability
- [ ] Store submissions in database as backup
- [ ] Add email templates with React Email
- [ ] Implement webhook notifications (Slack, Discord)

## Related Files

- `/src/app/api/contact/route.ts` - API endpoint implementation
- `/src/components/Contact.tsx` - Contact form component
- `/.env.example` - Environment variables template
- `/.env.local` - Your local environment variables (not in git)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for errors
3. Test email credentials manually
4. Open an issue on GitHub

---

**Last Updated:** December 2025
