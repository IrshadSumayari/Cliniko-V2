import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import { EmailService } from '@/lib/email-service';

// Create server-side Supabase client with service role key
const supabaseUrl = config.supabase.url;
const supabaseServiceKey = config.supabase.serviceRoleKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please provide a valid token.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    // Get user data from database
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('auth_user_id', user.id)
      .single();

    // If user doesn't exist in users table, create them
    if (userError || !userData) {
      console.log('User not found in users table, creating user record...');

      // Create user record
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          auth_user_id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          is_onboarded: false,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        })
        .select('id, full_name, email')
        .single();

      if (createError || !newUser) {
        console.error('Error creating user:', createError);
        return NextResponse.json({ error: 'Failed to create user record.' }, { status: 500 });
      }

      userData = newUser;
    }

    // Parse request body
    const { softwareName, phoneNumber } = await request.json();

    if (!softwareName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Software name and phone number are required.' },
        { status: 400 }
      );
    }

    // Create email content
    const emailSubject = `New Custom PMS Integration Request - ${softwareName}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Custom PMS Integration Request</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin-top: 0;">New Integration Request</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #667eea; margin-top: 0;">Customer Information</h3>
        
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>User ID:</strong> ${userData.id}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #28a745; margin-top: 0;">PMS Details</h3>
            <p><strong>Software Name:</strong> ${softwareName}</p>
            <p><strong>Phone Number:</strong> <a href="tel:${phoneNumber}" style="color: #007bff; text-decoration: none;">${phoneNumber}</a></p>
          </div>
          
         
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>This email was generated automatically by MyPhysioFlow</p>
          <p>Request submitted at: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const emailText = `
New Custom PMS Integration Request

Customer Information:
- Email: ${userData.email}
- User ID: ${userData.id}

PMS Details:
- Software Name: ${softwareName}
- Phone Number: ${phoneNumber}

Action Required: Please reach out to the customer to discuss the integration process and timeline.

Next Steps:
1. Call the customer within 3 hours to discuss integration requirements
2. Review the PMS software and documentation
3. Create custom integration adapter for the same price
4. Test the integration with the software
5. Update the user's PMS connection in the system
6. Send confirmation email to customer

View User Profile: ${config.app.url}/admin/users/${userData.id}

Request submitted at: ${new Date().toLocaleString()}
    `;

    // Send email using EmailService
    const emailService = EmailService.getInstance();
    await emailService.queueEmail({
      to_email: config.sendgrid.fromEmail, // Send to the FROM_EMAIL address
      subject: emailSubject,
      html_content: emailHtml,
      text_content: emailText,
      type: 'general',
      clinic_id: userData.id, // Using user ID as clinic ID for now
      max_attempts: 5,
    });

    return NextResponse.json({
      success: true,
      message:
        'Custom PMS integration request submitted successfully. Our team will call you within 3 hours to discuss the integration process at the same price.',
    });
  } catch (error) {
    console.error('Error processing custom PMS request:', error);
    return NextResponse.json(
      { error: 'Failed to submit custom PMS integration request. Please try again.' },
      { status: 500 }
    );
  }
}
