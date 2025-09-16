import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
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
          <h1 className="text-4xl font-bold text-foreground mb-2">MyPhysioFlow Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last Updated: September 2025</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to MyPhysioFlow ("we", "our", "us"). By accessing or using our service, you
                ("the Clinic", "you") agree to be bound by these Terms of Service. Please read them
                carefully.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">2. Nature of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                MyPhysioFlow is an administrative tool that helps physiotherapy clinics in Australia
                track EPC, WorkCover, and related program sessions. We are{' '}
                <strong>not a medical service</strong>, and we do not provide medical or legal
                advice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">3. Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service is intended for use by physiotherapy clinics and providers in Australia.
                By using the Service, you confirm you are authorised to act on behalf of your
                clinic.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">4. User Responsibilities</h2>
              <ul className="text-muted-foreground space-y-3 pl-6">
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    You must ensure that your use of MyPhysioFlow is lawful and complies with all
                    applicable healthcare, Medicare, WorkCover, and privacy requirements.
                  </span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    You are responsible for obtaining valid patient consent before sharing patient
                    data with MyPhysioFlow via third-party practice management systems (e.g.,
                    Cliniko, Nookal).
                  </span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    You must keep your account credentials secure and ensure only authorised staff
                    access your account.
                  </span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Handling</h2>
              <ul className="text-muted-foreground space-y-3 pl-6">
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    We process personal and health information only as necessary to provide the
                    Service.
                  </span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    Data is hosted on Australian servers and handled in accordance with our{' '}
                    <Link href="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    We do not sell or disclose patient data to third parties, except as required to
                    operate the Service or by law.
                  </span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                6. Subscriptions and Payments
              </h2>
              <ul className="text-muted-foreground space-y-3 pl-6">
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>Plans and pricing are displayed on our website.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    Subscriptions are billed in advance, either monthly or annually, depending on
                    the plan chosen.
                  </span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    You may cancel at any time; cancellation stops future billing, but no refunds
                    are provided for partial periods.
                  </span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">7. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                We aim to provide continuous access but do not guarantee uninterrupted service.
                Maintenance or technical issues may cause temporary downtime.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                8. Limitation of Liability
              </h2>
              <ul className="text-muted-foreground space-y-3 pl-6">
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>MyPhysioFlow is provided "as is" without warranties of any kind.</span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    To the extent permitted by law, we are not liable for any loss, claim, or
                    damages (including loss of revenue from missed billings or renewals) arising
                    from use of the Service.
                  </span>
                </li>
                <li className="flex">
                  <span className="mr-3 text-foreground">•</span>
                  <span>
                    Clinics remain fully responsible for ensuring compliance with healthcare
                    obligations and verifying the accuracy of patient data.
                  </span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">9. Indemnity</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless MyPhysioFlow, its directors, and employees
                from any claims, damages, or losses arising from your use of the Service, including
                but not limited to improper handling of patient data or failure to meet regulatory
                obligations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">10. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may suspend or terminate access to the Service if you breach these Terms. You may
                cancel your account at any time via the dashboard or by contacting support.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">11. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms are governed by the laws of Australia. Any disputes will be resolved in
                the courts of New South Wales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">12. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about these Terms, please contact us at:
              </p>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground">
                  <strong>Email:</strong> ryan@myphysioflow.com.au
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
