import type { ReactNode } from 'react'
import logo from '../assets/logo-mark.png?inline'

// Public pages at /privacy and /terms. They work whether or not someone is signed in.

const UPDATED = 'October 15, 2026'
const CONTACT = 'support@freelancetracker.app'

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-head">
        <a className="brand" href="/">
          <img className="logo-img" src={logo} alt="" />
          <span className="wordmark">
            <span>Freelance</span>
            <span className="accent-word">Tracker</span>
          </span>
        </a>
        <a className="ghost bordered btn-link" href="/">Open the app</a>
      </header>
      <article className="legal-body">
        <h1>{title}</h1>
        <p className="muted small">Last updated: {UPDATED}</p>
        {children}
        <hr />
        <p className="muted small">
          <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a> · <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </article>
    </div>
  )
}

const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>

export function PrivacyPage() {
  return (
    <Shell title="Privacy Policy">
      <p>
        Freelance Tracker helps you keep track of your clients, orders, money and daily work. Your records belong to you, and this page explains in plain words how we look after them.
      </p>

      <h2>Who we are</h2>
      <p>
        Freelance Tracker (freelancetracker.app) is an independent app based in Nigeria. If you have any question about your data, email <Mail />.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> your name, your email address and your password. Your password is stored scrambled, so not even we can read it.</li>
        <li><strong>What you add:</strong> clients, orders, payments, expenses, check-ins, goals and any files you upload.</li>
        <li><strong>Your settings:</strong> your currency, time zone and which reminder emails you want.</li>
        <li><strong>Feedback you send us:</strong> your message and the email address we reply to.</li>
        <li><strong>Basic technical info:</strong> like any website, our hosting providers keep short-term logs such as your IP address and browser type, to keep the service secure and working.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run Freelance Tracker for you: to show your records, keep you signed in, send the emails you asked for (sign-up confirmation, password reset and the reminders you switch on), answer your feedback, and fix problems.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>We never sell your data.</li>
        <li>We never show you ads or share your data with advertisers.</li>
        <li>We never read your clients, orders, payments or files.</li>
      </ul>

      <h2>Who can see your records</h2>
      <p>
        Only you. Every account is locked so it can see only its own records. The people running the app can see a summary of accounts (name, email, sign-up date, when you were last active, and how many records you have), but not the records themselves.
      </p>

      <h2>Services we use</h2>
      <p>To run the app we use trusted providers who store or process data for us and nothing else:</p>
      <ul>
        <li><strong>Supabase</strong> stores your account and records.</li>
        <li><strong>Cloudflare</strong> hosts the website and forwards emails sent to our support address.</li>
        <li><strong>Resend</strong> sends our emails.</li>
      </ul>

      <h2>Emails</h2>
      <p>
        You can turn reminder emails off anytime in Settings, or with the unsubscribe link in any reminder. We'll still send emails you need, like password resets and replies to your feedback.
      </p>

      <h2>Keeping your data safe</h2>
      <p>
        Everything travels over a secure, encrypted connection (HTTPS), and access rules make sure no account can see another account's records. No system is perfect, but we take reasonable steps to protect your data and will tell you promptly if something goes wrong.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have an account. If you delete your account in Settings, your records and files are deleted right away, and any remaining backup copies are cleared within 30 days.
      </p>

      <h2>Your rights</h2>
      <p>
        Under Nigeria's Data Protection Act (2023) you can ask to see, correct, download or delete your data, and you can object to how we use it. You can download your records and delete your account yourself in Settings, or email <Mail /> and we'll reply within 30 days. If you're not happy with our answer, you can complain to the Nigeria Data Protection Commission.
      </p>

      <h2>Age</h2>
      <p>Freelance Tracker is meant for adults aged 18 and over.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we'll update the date above and email you before the change takes effect.</p>

      <h2>Contact</h2>
      <p><Mail /></p>
    </Shell>
  )
}

export function TermsPage() {
  return (
    <Shell title="Terms of Use">
      <p>By creating an account or using Freelance Tracker, you agree to these terms. They're short, so please read them.</p>

      <h2>Using the app</h2>
      <ul>
        <li>Freelance Tracker is free to use. If that ever changes, we'll tell you well in advance and you won't be charged without agreeing first.</li>
        <li>You're responsible for keeping your password safe and for what happens in your account.</li>
        <li>Give a real email address so we can confirm your account and reach you.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Everything you add stays yours. You give us permission only to store it and show it to you so the app works. You can download it or delete it at any time.
      </p>

      <h2>Fair use</h2>
      <p>Please don't use Freelance Tracker to:</p>
      <ul>
        <li>break the law or store anything illegal,</li>
        <li>upload viruses or harmful files,</li>
        <li>try to get into other people's accounts or disrupt the service.</li>
      </ul>
      <p>We may suspend accounts that do these things.</p>

      <h2>No guarantees</h2>
      <p>
        We work hard to keep the app running and your data safe, but it's provided "as is". Freelance Tracker is a record-keeping tool, not financial, tax or legal advice, so always double-check important numbers. We're not responsible for losses from relying on the app, as far as the law allows. Keep your own copy of anything important using the download option in Settings.
      </p>

      <h2>Ending your account</h2>
      <p>You can delete your account anytime in Settings. We may close accounts that break these terms, and we'll tell you why.</p>

      <h2>Changes</h2>
      <p>If we change these terms in a way that matters, we'll update the date above and email you first.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of Nigeria.</p>

      <h2>Contact</h2>
      <p><Mail /></p>
    </Shell>
  )
}
