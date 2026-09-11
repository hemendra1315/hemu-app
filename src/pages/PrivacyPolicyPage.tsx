import { Link } from 'react-router-dom';

/**
 * Public privacy policy — reachable signed in or signed out (see router.tsx,
 * it sits outside every auth guard) since Play Store review and prospective
 * users both need to open it without an account.
 *
 * This is a starting draft grounded in what the app actually collects today
 * (see claude/audit-full-production-readiness.md, Critical Issue #2). It is
 * not legal advice — have it reviewed before relying on it for a real Play
 * Store submission, and update the contact email/effective date below to
 * whatever address should actually receive privacy requests.
 */
const EFFECTIVE_DATE = 'September 2026';
const CONTACT_EMAIL = 'cybermentors.india@gmail.com';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-bg min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link
          to="/"
          className="text-primary mb-6 inline-block text-sm underline-offset-4 hover:underline"
        >
          ← Back
        </Link>

        <h1 className="text-fg text-2xl font-bold">Privacy Policy</h1>
        <p className="text-fg-muted mt-1 text-sm">Effective {EFFECTIVE_DATE}</p>

        <div className="text-fg mt-8 space-y-8 text-sm leading-relaxed">
          <section>
            <p>
              This app (Cricket Academy Manager, "the app") helps cricket academies manage players,
              coaches, attendance, matches, and fees. This policy explains what information the app
              collects, why, and how it is handled, for anyone who uses it — academy owners,
              coaches, players, and parents.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Information we collect</h2>
            <p>We collect information you or your academy provide directly:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Account details:</strong> your name, email address, and phone number,
                collected when you sign in and verify your phone.
              </li>
              <li>
                <strong>Profile information:</strong> date of birth and a profile photo, if you
                choose to add one.
              </li>
              <li>
                <strong>Academy activity:</strong> attendance records, training batches, match
                scorecards, and cricket statistics that coaches or academy staff enter.
              </li>
              <li>
                <strong>Payment records:</strong> the app does not process payments itself. It
                displays a UPI QR code for fees and lets a player or parent self-report "I've paid,"
                optionally with the phone number the payment was made from. No card, bank, or UPI
                credentials ever pass through the app.
              </li>
              <li>
                <strong>Notifications:</strong> if you allow notifications, we store a device token
                so the app can send you announcements, attendance reminders, and similar updates.
              </li>
              <li>
                <strong>Basic technical data:</strong> standard information such as device type and
                app version, used only to keep the app working correctly.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">How we use this information</h2>
            <p>We use the information above only to run the app's core features:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Running the features you use — attendance, matches, stats, fees, announcements
              </li>
              <li>Letting your academy's staff manage players, batches, and sessions</li>
              <li>Sending you notifications you've opted into</li>
              <li>Keeping accounts and academies secure and separate from one another</li>
            </ul>
            <p>
              We do not sell your information, and we do not use it for advertising or share it with
              advertisers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Players under 18</h2>
            <p>
              Many players using this app are minors. Player accounts and records are created and
              managed by academy staff or a parent/guardian, not solicited directly from a child. A
              parent or guardian can link their own account to their child's player record to view
              their attendance, stats, and fee status, and can contact their academy or us (below)
              to request that a child's information be corrected or removed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Who can see your information</h2>
            <p>
              Your academy's coaches and owner can see information relevant to running the academy —
              your attendance, stats, and fee status. Other academies on the platform cannot see
              your data; each academy's data is kept separate. We use Supabase, a third-party
              database and hosting provider, to store and secure this information — they process it
              on our behalf and don't use it for their own purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">How long we keep it</h2>
            <p>
              We keep your information for as long as your academy is active on the app. If you
              leave an academy or ask us to delete your account, we'll remove your personal
              information within a reasonable time, except where academy records (like past match
              results) need to stay intact for other members' historical stats — those are kept in a
              form that no longer identifies you personally where possible.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Your choices</h2>
            <p>You can, at any time:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>View and update your profile information from the app</li>
              <li>Turn notifications off in your device settings</li>
              <li>Ask us to see a copy of, correct, or delete your information</li>
              <li>Ask your academy to remove your link to them</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Security</h2>
            <p>
              We restrict access so that only your own academy's authorized staff can see your
              information, enforced at the database level, not just in the app's screens. No method
              of storing or transmitting data online is 100% secure, but we work to protect your
              information using industry-standard practices.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Changes to this policy</h2>
            <p>
              If we make significant changes to this policy, we'll update the effective date above
              and, where appropriate, let you know in the app.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-fg text-base font-semibold">Contact us</h2>
            <p>
              Questions, or want to access, correct, or delete your information? Email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
