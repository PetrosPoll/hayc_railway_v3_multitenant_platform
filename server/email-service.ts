import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Normalize AWS region (handle human-readable names)
function normalizeAwsRegion(region: string): string {
  const regionMap: { [key: string]: string } = {
    "us-east": "us-east-1",
    "us-west": "us-west-2", 
    "eu-west": "eu-west-1",
    "eu-central": "eu-central-1",
    "asia-pacific": "ap-southeast-1",
    "ap-southeast": "ap-southeast-1",
  };

  // Return normalized region or default to original
  return regionMap[region.toLowerCase()] || region;
}

// Initialize SES client
const sesClient = new SESClient({
  region: normalizeAwsRegion(process.env.AWS_REGION || "us-east-1"),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export interface EmailData {
  to: string;
  subject: string;
  message: string;
  fromEmail: string;
  fromName?: string;
  html?: string;
  replyToAddresses?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  /**
   * Send an email using AWS SES
   */
  static async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      if (!emailData.fromEmail) {
        return {
          success: false,
          error: "From email address is required",
        };
      }
      
      // Format Source as "Name" <email> if fromName is provided
      const source = emailData.fromName 
        ? `"${emailData.fromName}" <${emailData.fromEmail}>`
        : emailData.fromEmail;

      const command = new SendEmailCommand({
        Source: source,
        ...(emailData.replyToAddresses?.length
          ? { ReplyToAddresses: emailData.replyToAddresses }
          : {}),
        Destination: {
          ToAddresses: [emailData.to],
        },
        Message: {
          Subject: {
            Data: emailData.subject,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: emailData.message,
              Charset: "UTF-8",
            },
            ...(emailData.html && {
              Html: {
                Data: emailData.html,
                Charset: "UTF-8",
              },
            }),
          },
        },
        ConfigurationSetName: "hayc-newsletters"
      });

      const result = await sesClient.send(command);
      
      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error: any) {
      console.error("AWS SES Error:", error);
      
      // Handle common SES errors with user-friendly messages
      let errorMessage = "Failed to send email. Please try again.";
      
      if (error.name === "MessageRejected") {
        errorMessage = "Email address not verified. Please verify both sender and recipient emails in AWS SES console.";
      } else if (error.name === "ConfigurationSetDoesNotExistException") {
        errorMessage = "SES configuration error. Please check your AWS setup.";
      } else if (error.name === "InvalidParameterValue") {
        errorMessage = "Invalid email address format.";
      } else if (error.message?.includes("Invalid URL")) {
        errorMessage = "Invalid AWS region configuration.";
      } else if (error.name === "UnauthorizedOperation" || error.name === "AccessDenied") {
        errorMessage = "AWS credentials error. Please check your access keys.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate email configuration
   */
  static validateConfiguration(): { isValid: boolean; error?: string } {
    const requiredEnvVars = [
      "AWS_REGION",
      "AWS_ACCESS_KEY_ID", 
      "AWS_SECRET_ACCESS_KEY"
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        return {
          isValid: false,
          error: `Missing required environment variable: ${envVar}`,
        };
      }
    }

    return { isValid: true };
  }
}