import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting map (in-memory for serverless - consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Simple rate limiter
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }

  if (limit.count >= 3) {
    // Max 3 requests per minute
    return false;
  }

  limit.count++;
  return true;
}

// Sanitize input to prevent XSS
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 5000); // Max length
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { name, email, content } = await request.json();

    // Validate required fields
    if (!name || !content) {
      return NextResponse.json(
        { error: "Name and content are required fields." },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name is too long (max 100 characters)." },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "Message is too long (max 5000 characters)." },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = email ? sanitizeInput(email) : "";
    const sanitizedContent = sanitizeInput(content);

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("Email credentials not configured");
      return NextResponse.json(
        { error: "Email service is not configured. Please contact the administrator." },
        { status: 503 }
      );
    }

    // Create transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    await transporter.verify();

    // Prepare email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO || "marcus.cuong.doan@gmail.com",
      subject: `Portfolio Contact: Message from ${sanitizedName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Name:</strong> ${sanitizedName}</p>
            ${sanitizedEmail ? `<p style="margin: 10px 0;"><strong>Email:</strong> ${sanitizedEmail}</p>` : '<p style="margin: 10px 0;"><em>No email provided</em></p>'}
            <p style="margin: 10px 0;"><strong>Message:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px; white-space: pre-wrap;">
              ${sanitizedContent.replace(/\n/g, "<br>")}
            </div>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This message was sent from your portfolio contact form on ${new Date().toLocaleString()}.
          </p>
          ${sanitizedEmail ? `<p style="color: #666; font-size: 12px;">Reply to: ${sanitizedEmail}</p>` : ""}
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${sanitizedName}
${sanitizedEmail ? `Email: ${sanitizedEmail}` : "No email provided"}

Message:
${sanitizedContent}

---
This message was sent from your portfolio contact form on ${new Date().toLocaleString()}.
      `,
      ...(sanitizedEmail && { replyTo: sanitizedEmail }),
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: "Email sent successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("Invalid login")) {
        return NextResponse.json(
          { error: "Email service authentication failed. Please contact the administrator." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to send email. Please try again later." },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
