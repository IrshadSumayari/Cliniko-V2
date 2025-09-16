import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent">
      {/* Back to Home Button */}
      <div className="absolute top-4 left-4">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-2xl shadow-lg p-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy – MyPhysioFlow</h1>
          <p className="text-muted-foreground mb-8">Last Updated: September 2025</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                MyPhysioFlow (<em>"we"</em>, <em>"us"</em> or <strong><em>"the Service"</em></strong>) is committed to protecting your privacy and complying with the <strong>Australian Privacy Act 1988</strong> and all other applicable privacy laws. This Privacy Policy explains how we collect, use, store, and disclose personal information when you use our service or website. It also outlines your rights and how you can contact us about your data.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By using MyPhysioFlow, you agree to the collection and use of information in accordance with this Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">2. What Information We Collect</h2>
              
              <ul className="space-y-4">
                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Clinic Account Information:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    When a physiotherapy clinic or provider signs up, we collect information such as the clinic name, contact person's name, email address, and billing details (if subscribing to a paid plan).
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Patient Information from Integrated Systems:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    MyPhysioFlow connects to third-party practice management systems (e.g., <em>Cliniko, Nookal, Halaxy, etc.</em>) via API, under your direction. We collect <strong>only the necessary patient data</strong> to track EPC and WorkCover sessions. This typically includes: patient name, unique patient ID, the type of program (EPC or WorkCover), number of sessions authorized and used, dates of patient appointments, and referral or approval expiry dates.
                  </p>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We do not collect or store detailed clinical notes or sensitive medical history from those systems, as our service focuses only on administrative tracking.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Usage Data:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We collect analytics about how the MyPhysioFlow dashboard is used (e.g., when you last logged in, features clicked) to improve the Service. This data is generally aggregated and not linked to individual identities, except for basic logging (such as user ID for security/audit logs).
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Support Communications:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    If you contact us for support or feedback, we will collect the information you choose to give us (such as your email, and the content of your communications).
                  </p>
                </li>
              </ul>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Important:</strong> We do not collect any patient information directly from patients. All patient data we handle is obtained via our client clinics and their systems, as needed to provide our service. In terms of Australian Privacy Principles, some of the patient information we handle is health information (sensitive information). We rely on the clinic (as the health service provider) having obtained the patient's consent to share that information with MyPhysioFlow for care management purposes.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">3. How We Use Personal Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">We use the collected information for the following purposes:</p>
              
              <ul className="space-y-4">
                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Providing and Improving the Service:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We process patient session data to display it on your dashboard, determine which patients are "Action Needed", "Pending", "Overdue", etc., and to generate email alerts before deadlines. We use clinic account information to maintain your account, authenticate your login, and provide customer support.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Alerts and Communications:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We use your (the clinic user's) email to send you important alerts about patient session quotas or upcoming referral expiries (as part of the service's core functionality). We may also send administrative emails, such as security notices or updates about new features.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Compliance and Auditing:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We may use and retain certain data as required by law or to ensure we are complying with our legal obligations. For example, we keep logs of data sync operations and access logs to monitor for any unauthorized access and to audit the system's proper functioning.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Service Improvement and Research:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Aggregated, de-identified data (e.g. average number of expiring EPCs per clinic) may be used internally to analyze usage trends or performance issues. This helps us optimize MyPhysioFlow. These analytics will not identify any individual patient or clinic.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Billing and Account Management:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    If you are on a paid plan, we use your account and payment information to process subscription payments and manage billing (through our secure payment provider). We do not store full credit card numbers on our servers; any payment details are handled by our payment processor.
                  </p>
                </li>
              </ul>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Our Commitment:</strong> We will not use personal information for any purpose other than providing our service to you, unless we obtain your consent or are required by law. In particular, we do not sell personal data or use patient information for marketing.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">4. Disclosure of Information to Third Parties</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                MyPhysioFlow understands the sensitive nature of the data we handle and generally will not disclose personal information to third parties except in the limited circumstances described here:
              </p>

              <ul className="space-y-4">
                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Service Providers (Sub-processors):</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We use trusted third-party providers to host and run MyPhysioFlow: for example, our database and backend are hosted on Supabase (cloud infrastructure) on Australian servers. We may also use an email service (for sending alert emails) and a payment processing service (for handling subscription payments). These providers may process certain personal information only on our behalf and under strict data protection agreements.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Integrated Clinic Systems:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    As part of providing the service, MyPhysioFlow connects to your chosen practice management system via API. In doing so, we obviously transmit requests that include identifiers (like patient IDs) and receive data from that system. This data interchange is encrypted. We do not send any data to those systems except maybe minimal info needed for the request.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Legal Requirements:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We may disclose information if required by law, court order, or government regulation – for instance, in response to a subpoena or to comply with a notifiable data breach reporting obligation. If an Australian authority lawfully requests access to information, we will comply after verifying the request, and we will inform the affected clients unless legally prohibited from doing so.
                  </p>
                </li>
              </ul>

              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Important:</strong> We do not disclose patient information to any third party for marketing or non-authorized purposes. Data is shared only as needed to run MyPhysioFlow and as directed by our clinic users.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Storage and Security</h2>
              
              <ul className="space-y-4">
                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Australian Data Hosting:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    All personal data is stored on secure servers located in Australia. We do not store your data in other countries. This ensures compliance with Australian data sovereignty preferences and means the data is protected under Australian law.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Encryption:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    All data transmission between your browser and our servers is encrypted using SSL/TLS (HTTPS). Our databases encrypt data at rest. In non-technical terms, this means your data is "locked" both when it's sent to us and when it's stored, so that if it were intercepted it would be unreadable.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Access Control:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Each clinic's data in MyPhysioFlow is logically segregated. Users from one clinic cannot access another clinic's information. Within your clinic, you may have multiple physiotherapists or staff using MyPhysioFlow – you can control access by sharing or not sharing the login. We recommend keeping your login credentials secure and using a strong password.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Administrative Security:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Our team access to personal data is very limited. We do not routinely look at individual patient records unless necessary to resolve a support issue for you. Access to the database and server requires authentication and is restricted to authorized personnel. We also use audit logs to track any access to sensitive data.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Data Retention:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Personal information is kept only for as long as necessary to fulfill the purposes of the service or as required by law. If your clinic stops using MyPhysioFlow and cancels the account, we will delete or de-identify your patients' personal information after a defined retention period (generally, we purge data within 30 days of account closure, unless you request immediate deletion).
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Notifiable Data Breaches:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    In the unlikely event of a data breach (such as unauthorized access to our systems) that impacts personal information, we will promptly notify your clinic and any affected individuals, as required by the Notifiable Data Breaches scheme. We will also notify regulators (OAIC) where required.
                  </p>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">6. Access and Correction</h2>
              
              <ul className="space-y-4">
                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Access:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    As a clinic user, you can access and view the patient information in your MyPhysioFlow dashboard at any time. This reflects the data we have about your patients' sessions. If you need a full export of your data, you can contact us at the email below – we can provide your clinic's data in a readable format (e.g., CSV export) on request.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Correction:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    If you notice any information in MyPhysioFlow that is incorrect (for example, a patient's name is misspelled or session count is wrong), the correction should generally be made in the source system (e.g., Cliniko or Nookal) since MyPhysioFlow syncs from there. Once corrected in your practice management system, our next sync will update the dashboard.
                  </p>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">7. Complaints and Contact Details</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We take privacy seriously. If you have a question or concern about how we handle personal information, or if you believe we have breached this Privacy Policy or the Australian Privacy Principles, please contact us and we will do our best to resolve the issue.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 mt-4">
                <p className="text-muted-foreground">
                  <strong>Email:</strong> ryan@myphysioflow.com.au
                </p>
              </div>

              <p className="text-muted-foreground leading-relaxed mt-4">
                <strong>Complaints Process:</strong> Upon receiving a complaint, our privacy officer will review it and respond within a reasonable timeframe (typically within 5 business days to acknowledge, and aim to resolve within 30 days). If you are not satisfied with our response, you have the right to escalate the matter to the Office of the Australian Information Commissioner (OAIC).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">8. Updates to this Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or new features. If we make significant changes, we will notify our users (for example, via email or a notice on the dashboard). The "Last Updated" date at the top will always indicate the latest revision.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">9. Additional Notes</h2>
              
              <ul className="space-y-4">
                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Use by Children:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    MyPhysioFlow is a tool used by physiotherapy clinics and is not directed to minors or individual consumers. Patient information in the system may include details of children (if they are patients of a physio clinic under an EPC or WorkCover plan), but those are entered by the clinic. Any parental consents for treating minors should be handled by the clinic.
                  </p>
                </li>

                <li>
                  <h3 className="text-xl font-bold text-foreground mb-3">Cookies and Tracking:</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    For users visiting our marketing site, we use minimal cookies – primarily for authentication (when you log in) and for basic analytics to understand site traffic. We do not use invasive tracking or advertising cookies.
                  </p>
                </li>
              </ul>
            </section>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mt-8">
              <p className="text-center text-primary font-semibold">
                MyPhysioFlow is proudly built for Australian physios, with privacy and compliance in mind. We regularly review our practices to ensure we meet our legal obligations and safeguard the trust you place in us.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
