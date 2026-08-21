import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Dinezy",
  description:
    "Dinezy's Privacy Policy — how we collect, use, disclose, store, and protect your information across the Dinezy restaurant discovery and social platform.",
};

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    body: (
      <>
        <p>We collect information depending on how you use Dinezy.</p>

        <h3>1.1 Information You Provide When Creating an Account</h3>
        <p>Currently, Dinezy uses mobile-number-based authentication.</p>
        <p>When you create or access a Dinezy account, we may collect:</p>
        <ul>
          <li>Mobile phone number</li>
          <li>One-time password (OTP) or authentication information required to verify your mobile number</li>
          <li>User ID generated for your Dinezy account</li>
          <li>Username, display name, profile information, or profile photo if you choose to provide them</li>
          <li>Information associated with your account and activity on Dinezy</li>
        </ul>
        <p>We do not require you to use Google Login or another social-login provider to create a Dinezy account.</p>

        <h3>1.2 User-Generated Content</h3>
        <p>If you choose to participate in Dinezy&apos;s social features, you may provide:</p>
        <ul>
          <li>Restaurant review videos</li>
          <li>Photos</li>
          <li>Comments</li>
          <li>Likes</li>
          <li>Saves</li>
          <li>Follows</li>
          <li>Other content or information you voluntarily submit</li>
        </ul>
        <p>
          Videos, comments, profile information, and other content that you choose to publish may be visible to
          other Dinezy users and, depending on the feature and your account settings, may be publicly accessible.
        </p>
        <p>
          You should avoid including sensitive personal information, financial information, passwords,
          identification documents, or information about other people in content that you upload.
        </p>

        <h3>1.3 Restaurant and Platform Activity</h3>
        <p>When you use Dinezy, we may collect information about your interactions with the Service, including:</p>
        <ul>
          <li>Restaurants you view</li>
          <li>Menus you view</li>
          <li>Offers you view</li>
          <li>Videos you watch</li>
          <li>Videos you like</li>
          <li>Videos you save</li>
          <li>Restaurants or users you follow or unfollow</li>
          <li>Comments you post</li>
          <li>Content you share through Dinezy</li>
          <li>Searches or interactions with restaurant information</li>
          <li>Account and profile activity</li>
          <li>Other interactions with features of the Service</li>
        </ul>
        <p>
          This information helps us operate the platform, improve recommendations and discovery, understand how
          users interact with restaurants and content, and maintain platform security.
        </p>

        <h3>1.4 Device and Technical Information</h3>
        <p>We may automatically collect certain technical information when you use Dinezy, such as:</p>
        <ul>
          <li>IP address</li>
          <li>Device type</li>
          <li>Operating system</li>
          <li>Browser type</li>
          <li>App version</li>
          <li>Approximate device information</li>
          <li>Language and region settings</li>
          <li>Date and time of activity</li>
          <li>Error logs and diagnostic information</li>
          <li>Information necessary to maintain security and prevent abuse</li>
        </ul>

        <h3>1.5 Cookies and Similar Technologies</h3>
        <p>Dinezy may use cookies, local storage, session storage, and similar technologies to:</p>
        <ul>
          <li>Keep you signed in</li>
          <li>Maintain sessions</li>
          <li>Remember preferences</li>
          <li>Maintain security</li>
          <li>Understand how features are used</li>
          <li>Improve the performance and functionality of Dinezy</li>
        </ul>
        <p>
          You may be able to control cookies through your browser or device settings. Disabling certain
          technologies may affect some features of Dinezy.
        </p>
      </>
    ),
  },
  {
    id: "browsing-without-account",
    title: "2. Browsing Without an Account",
    body: (
      <>
        <p>You do not need to create an account simply to browse certain parts of Dinezy.</p>
        <p>You may be able to:</p>
        <ul>
          <li>Watch restaurant videos</li>
          <li>Discover restaurants</li>
          <li>View restaurant profiles</li>
          <li>View restaurant menus</li>
          <li>View restaurant information</li>
          <li>View available offers</li>
        </ul>
        <p>However, certain interactive features require authentication.</p>
        <p>For example, you may be required to log in before you can:</p>
        <ul>
          <li>Like videos</li>
          <li>Comment on videos</li>
          <li>Save content</li>
          <li>Follow or unfollow restaurants or users</li>
          <li>Access your account section</li>
          <li>Post videos or other user-generated content</li>
          <li>Use other account-based features</li>
        </ul>
        <p>We may still collect limited technical and usage information when you browse Dinezy without logging in.</p>
      </>
    ),
  },
  {
    id: "how-we-use-information",
    title: "3. How We Use Your Information",
    body: (
      <>
        <p>We may use information we collect for the following purposes:</p>

        <h3>Providing the Service</h3>
        <p>To:</p>
        <ul>
          <li>Create and manage your account</li>
          <li>Authenticate your mobile number</li>
          <li>Provide restaurant discovery</li>
          <li>Display restaurant menus and information</li>
          <li>Display offers</li>
          <li>Provide video and social features</li>
          <li>Allow you to upload and manage content</li>
          <li>Enable likes, comments, saves, shares, follows, and other interactions</li>
          <li>Maintain your account and preferences</li>
        </ul>

        <h3>Improving Dinezy</h3>
        <p>We may use usage information to:</p>
        <ul>
          <li>Understand how users interact with restaurants and content</li>
          <li>Improve the restaurant discovery experience</li>
          <li>Improve search and recommendations</li>
          <li>Improve application performance</li>
          <li>Develop new features</li>
          <li>Understand which restaurants and content are useful to users</li>
        </ul>

        <h3>Security and Abuse Prevention</h3>
        <p>We may process information to:</p>
        <ul>
          <li>Detect fraudulent activity</li>
          <li>Prevent spam</li>
          <li>Prevent unauthorized account access</li>
          <li>Investigate misuse of the platform</li>
          <li>Protect users, restaurants, and Dinezy</li>
          <li>Enforce our Terms of Service and community rules</li>
        </ul>

        <h3>Legal and Regulatory Compliance</h3>
        <p>We may process information where necessary to:</p>
        <ul>
          <li>Comply with applicable laws</li>
          <li>Respond to lawful requests from authorities</li>
          <li>Protect our legal rights</li>
          <li>Investigate suspected violations</li>
          <li>Resolve disputes</li>
        </ul>
      </>
    ),
  },
  {
    id: "user-generated-content",
    title: "4. User-Generated Content",
    body: (
      <>
        <p>Dinezy allows users to publish restaurant-related content.</p>
        <p>
          When you upload a video, comment, photo, or other content to Dinezy, you understand that the content may
          be visible to other users.
        </p>
        <p>
          For example, if you upload a restaurant review video, that video may be displayed on Dinezy&apos;s
          restaurant discovery or video sections.
        </p>
        <p>You are responsible for the content you upload.</p>
        <p>You must not upload content that:</p>
        <ul>
          <li>Violates applicable law</li>
          <li>Infringes another person&apos;s intellectual property rights</li>
          <li>Contains another person&apos;s private or confidential information without appropriate permission</li>
          <li>Is fraudulent or deliberately misleading</li>
          <li>Contains harmful or abusive material</li>
          <li>Impersonates another person</li>
          <li>Violates Dinezy&apos;s Terms of Service or community guidelines</li>
        </ul>
        <p>
          Dinezy may remove, restrict, or disable access to content that violates applicable law, our policies, or
          the rights of others.
        </p>
      </>
    ),
  },
  {
    id: "public-information",
    title: "5. Public Information and Social Features",
    body: (
      <>
        <p>Certain information and activities may become publicly visible when you use Dinezy&apos;s social features.</p>
        <p>Depending on the feature, this may include:</p>
        <ul>
          <li>Your username or display name</li>
          <li>Profile information</li>
          <li>Profile photo</li>
          <li>Videos you publish</li>
          <li>Comments you publish</li>
          <li>Likes or other interactions</li>
          <li>Restaurants or users you follow</li>
          <li>Other information that you intentionally make public</li>
        </ul>
        <p>Please consider carefully what you choose to publish.</p>
        <p>
          Deleting an account or content may not remove copies that have already been independently downloaded,
          shared, cached, or otherwise retained by other users or third parties.
        </p>
      </>
    ),
  },
  {
    id: "restaurant-information-google-reviews",
    title: "6. Restaurant Information and Google Reviews",
    body: (
      <>
        <p>
          Dinezy may display information about restaurants, including restaurant descriptions, menus, offers,
          contact information, ratings, reviews, or other information obtained from restaurant owners, publicly
          available sources, or third-party services.
        </p>
        <p>
          Where Dinezy displays Google reviews or other third-party review information, such information may be
          provided through or derived from third-party services and remains subject to the applicable third
          party&apos;s terms and policies.
        </p>
        <p>
          Dinezy does not represent that all third-party restaurant information or reviews are independently
          verified by Dinezy.
        </p>
      </>
    ),
  },
  {
    id: "location-information",
    title: "7. Location Information",
    body: (
      <>
        <p>
          Dinezy may use location-related information where a feature requires it or where you choose to provide or
          permit access to such information.
        </p>
        <p>For example, location information may be used to:</p>
        <ul>
          <li>Help users discover restaurants in relevant areas</li>
          <li>Improve restaurant discovery</li>
          <li>Provide location-relevant features</li>
          <li>Help prevent fraudulent activity where applicable</li>
        </ul>
        <p>
          If Dinezy requests access to your device&apos;s location, you may control this permission through your
          device or browser settings.
        </p>
        <p>
          Dinezy does not require continuous background location access merely to browse restaurant videos or menus
          unless a specific feature clearly requires it and appropriate permission is obtained.
        </p>
      </>
    ),
  },
  {
    id: "how-we-share-information",
    title: "8. How We Share Information",
    body: (
      <>
        <p>We do not sell your personal information as a standalone product.</p>
        <p>We may share information with service providers and technology partners who help us operate Dinezy.</p>
        <p>These may include providers for:</p>
        <ul>
          <li>Authentication</li>
          <li>Cloud hosting</li>
          <li>Database services</li>
          <li>Video storage or delivery</li>
          <li>Analytics</li>
          <li>Infrastructure and security</li>
          <li>Notifications</li>
          <li>Customer support</li>
          <li>Other technical services required to operate Dinezy</li>
        </ul>
        <p>
          These providers may process information on our behalf and are expected to handle information in
          accordance with applicable contractual and legal requirements.
        </p>
        <p>We may also disclose information:</p>
        <ul>
          <li>When required by law</li>
          <li>In response to lawful governmental or regulatory requests</li>
          <li>To protect Dinezy, our users, restaurants, or other persons</li>
          <li>To investigate fraud, abuse, security incidents, or violations</li>
          <li>In connection with a merger, acquisition, restructuring, financing, or sale of all or part of our business</li>
        </ul>
      </>
    ),
  },
  {
    id: "supabase-service-providers",
    title: "9. Supabase and Service Providers",
    body: (
      <>
        <p>Dinezy uses third-party technology infrastructure to provide parts of the Service.</p>
        <p>
          For example, Dinezy may use Supabase and other infrastructure providers for services such as
          authentication, databases, storage, and application infrastructure.
        </p>
        <p>Information processed through these services may be stored or processed on infrastructure operated by those providers.</p>
        <p>
          We take reasonable steps to use reputable service providers and appropriate security controls, but no
          internet-based service can guarantee absolute security.
        </p>
      </>
    ),
  },
  {
    id: "payments-advertising",
    title: "10. Payments and Advertising",
    body: (
      <>
        <p>At present:</p>
        <ul>
          <li>Dinezy does not offer in-app purchases.</li>
          <li>Dinezy does not process payments from users through the application for user purchases.</li>
          <li>Dinezy does not currently display third-party advertising.</li>
        </ul>
        <p>
          If these features are introduced in the future, this Privacy Policy may be updated to explain the
          relevant data processing and third-party services.
        </p>
        <p>
          Restaurant offers displayed on Dinezy are part of the restaurant discovery experience and should not
          automatically be interpreted as paid advertising unless clearly identified as such.
        </p>
      </>
    ),
  },
  {
    id: "data-retention",
    title: "11. Data Retention",
    body: (
      <>
        <p>We retain personal information for as long as reasonably necessary to:</p>
        <ul>
          <li>Provide the Service</li>
          <li>Maintain your account</li>
          <li>Provide features you request</li>
          <li>Maintain security</li>
          <li>Prevent fraud and abuse</li>
          <li>Comply with legal obligations</li>
          <li>Resolve disputes</li>
          <li>Enforce our agreements</li>
        </ul>
        <p>
          When information is no longer required for these purposes, we may delete, anonymize, or otherwise dispose
          of it in accordance with applicable law.
        </p>
        <p>
          Some information may need to be retained for a longer period where required by law or necessary for
          legitimate legal or security purposes.
        </p>
      </>
    ),
  },
  {
    id: "account-deletion",
    title: "12. Account Deletion",
    body: (
      <>
        <p>You may request deletion of your Dinezy account and associated personal information.</p>
        <p>To request account deletion, contact us using the contact details provided below.</p>
        <p>
          When we receive a valid deletion request, we will take reasonable steps to delete information that we are
          required or permitted to delete.
        </p>
        <p>
          Certain information may be retained where necessary to comply with legal obligations, prevent fraud,
          resolve disputes, enforce agreements, or protect our legal rights.
        </p>
        <p>
          Public content may also have separate retention or deletion considerations, particularly where it has
          been shared or copied by other users.
        </p>
      </>
    ),
  },
  {
    id: "your-privacy-rights",
    title: "13. Your Privacy Rights",
    body: (
      <>
        <p>Subject to applicable law, you may have rights regarding your personal data, including rights to:</p>
        <ul>
          <li>Obtain information about personal data being processed</li>
          <li>Request correction of inaccurate personal information</li>
          <li>Request deletion of personal information where applicable</li>
          <li>Withdraw consent where processing is based on consent</li>
          <li>Request information regarding processing of your personal data</li>
          <li>Raise a complaint regarding our handling of personal data</li>
        </ul>
        <p>Requests may be submitted using the contact details provided below.</p>
        <p>We may need to verify your identity before processing certain requests in order to protect your account and personal information.</p>
      </>
    ),
  },
  {
    id: "withdrawal-of-consent",
    title: "14. Withdrawal of Consent",
    body: (
      <>
        <p>Where we process personal data based on your consent, you may withdraw your consent subject to applicable law.</p>
        <p>Withdrawal of consent may affect our ability to provide certain features or services.</p>
        <p>
          For example, if certain account functionality requires processing of your mobile number, withdrawing the
          relevant consent may prevent you from using those account-based features.
        </p>
        <p>Withdrawal of consent does not affect the lawfulness of processing carried out before the withdrawal.</p>
      </>
    ),
  },
  {
    id: "childrens-privacy",
    title: "15. Children's Privacy",
    body: (
      <>
        <p>Dinezy is not intended to knowingly collect personal information from children in violation of applicable law.</p>
        <p>
          If you are a parent or legal guardian and believe that a child has provided personal information to
          Dinezy in circumstances where such collection is not permitted, please contact us.
        </p>
        <p>Where required by applicable law, we will take appropriate steps to address such information.</p>
      </>
    ),
  },
  {
    id: "data-security",
    title: "16. Data Security",
    body: (
      <>
        <p>
          We use reasonable technical and organizational measures designed to protect information against
          unauthorized access, alteration, disclosure, loss, misuse, or destruction.
        </p>
        <p>Security measures may include:</p>
        <ul>
          <li>Authentication controls</li>
          <li>Access controls</li>
          <li>Encryption where appropriate</li>
          <li>Secure communications</li>
          <li>Infrastructure security</li>
          <li>Monitoring and logging</li>
          <li>Measures designed to prevent unauthorized access</li>
        </ul>
        <p>However, no website, application, database, or transmission over the internet can be guaranteed to be completely secure.</p>
        <p>You are responsible for maintaining the security of your account and should not share authentication codes or account credentials with others.</p>
      </>
    ),
  },
  {
    id: "third-party-links",
    title: "17. Third-Party Links and Services",
    body: (
      <>
        <p>
          Dinezy may contain links or information provided by third parties, including restaurant websites, maps,
          social platforms, review platforms, or other external services.
        </p>
        <p>When you access a third-party service, that service&apos;s own privacy policy and terms may apply.</p>
        <p>Dinezy is not responsible for the privacy practices, security, or content of third-party services that it does not control.</p>
      </>
    ),
  },
  {
    id: "changes-to-policy",
    title: "18. Changes to This Privacy Policy",
    body: (
      <>
        <p>We may update this Privacy Policy from time to time to reflect:</p>
        <ul>
          <li>Changes to Dinezy</li>
          <li>New features</li>
          <li>Changes in technology</li>
          <li>Changes in applicable law</li>
          <li>Changes in our data processing practices</li>
        </ul>
        <p>When we make material changes, we may provide an appropriate notice through Dinezy or other reasonable means.</p>
        <p>The &quot;Last Updated&quot; date at the beginning of this Privacy Policy indicates when it was most recently updated.</p>
      </>
    ),
  },
  {
    id: "contact-us",
    title: "19. Contact Us",
    body: (
      <>
        <p>
          If you have questions about this Privacy Policy, want to exercise applicable privacy rights, or want to
          raise a privacy-related complaint, please contact us:
        </p>
        <p className="pr-contact-block">
          <strong>Dinezy</strong>
          <br />
          Website:{" "}
          <a href="https://dinezy.in" target="_blank" rel="noopener noreferrer">
            https://dinezy.in
          </a>
          <br />
          <br />
          <strong>Privacy Contact:</strong> [INSERT PRIVACY EMAIL]
          <br />
          <strong>Grievance / Support Contact:</strong> [INSERT SUPPORT EMAIL]
        </p>
        <p>
          If Dinezy appoints a Data Protection Officer or other person responsible for privacy-related requests,
          the relevant contact details will be provided here.
        </p>
      </>
    ),
  },
  {
    id: "applicable-law",
    title: "20. Applicable Law",
    body: (
      <>
        <p>This Privacy Policy shall be governed by the applicable laws of India.</p>
        <p>Nothing in this Privacy Policy limits any rights that you may have under applicable data-protection or consumer-protection laws.</p>
      </>
    ),
  },
  {
    id: "your-consent",
    title: "21. Your Consent",
    body: (
      <>
        <p>
          By using Dinezy and, where applicable, creating an account or submitting personal information, you
          acknowledge that you have been provided with information regarding the processing of your personal data
          as described in this Privacy Policy.
        </p>
        <p>
          Where applicable law requires consent for a particular processing activity, Dinezy will seek the
          appropriate consent before carrying out that processing.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="pr-privacy-page">
      <div className="pr-privacy-container">
        <header className="pr-privacy-header">
          <p className="pr-eyebrow">Legal</p>
          <h1>Privacy Policy</h1>
          <p className="pr-updated">Last Updated: 21 August 2026</p>
          <p className="pr-intro">
            Dinezy (&quot;Dinezy&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the Dinezy
            website, web application, mobile application, and related services (collectively, the
            &quot;Service&quot;).
          </p>
          <p className="pr-intro">
            Dinezy is a restaurant discovery and social platform that allows users to discover restaurants, view
            restaurant information and menus, explore offers, watch restaurant-related videos, interact with
            content, and share their own restaurant experiences through videos and other content.
          </p>
          <p className="pr-intro">
            This Privacy Policy explains how we collect, use, disclose, store, and protect information when you use
            Dinezy.
          </p>
          <p className="pr-intro">
            By using Dinezy, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </header>

        <div className="pr-privacy-layout">
          <nav className="pr-toc" aria-label="Table of contents">
            <p className="pr-toc-title">On this page</p>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="pr-privacy-content">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="pr-section">
                <h2>{section.title}</h2>
                {section.body}
              </section>
            ))}

            <div className="pr-footer-nav">
              <Link href="/">Back to Dinezy</Link>
            </div>
          </article>
        </div>
      </div>

      <style>{`
        .pr-privacy-page {
          background: var(--pr-ivory, #FBF6EC);
          color: var(--pr-burgundy, #7A2333);
          min-height: 100vh;
          padding: 4rem 1.5rem 6rem;
          font-family: var(--pr-font-sans, 'Inter', sans-serif);
        }

        .pr-privacy-container {
          max-width: 960px;
          margin: 0 auto;
        }

        .pr-privacy-header {
          border-bottom: 1px solid rgba(122, 35, 51, 0.15);
          padding-bottom: 2.5rem;
          margin-bottom: 3rem;
        }

        .pr-eyebrow {
          font-size: 0.8rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(122, 35, 51, 0.65);
          margin: 0 0 0.75rem;
          font-weight: 600;
        }

        .pr-privacy-header h1 {
          font-family: var(--pr-font-serif, 'Fraunces', serif);
          font-size: clamp(2.25rem, 4vw, 3rem);
          line-height: 1.1;
          margin: 0 0 0.75rem;
          color: var(--pr-burgundy, #7A2333);
        }

        .pr-updated {
          font-size: 0.9rem;
          color: rgba(122, 35, 51, 0.6);
          margin: 0 0 1.5rem;
        }

        .pr-intro {
          font-size: 1rem;
          line-height: 1.7;
          margin: 0 0 1rem;
          color: rgba(122, 35, 51, 0.9);
          max-width: 68ch;
        }

        .pr-privacy-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 3rem;
          align-items: start;
        }

        .pr-toc {
          position: sticky;
          top: 2rem;
          border-left: 2px solid rgba(122, 35, 51, 0.15);
          padding-left: 1.25rem;
        }

        .pr-toc-title {
          font-family: var(--pr-font-serif, 'Fraunces', serif);
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0 0 0.75rem;
          color: var(--pr-burgundy, #7A2333);
        }

        .pr-toc ol {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .pr-toc a {
          font-size: 0.85rem;
          line-height: 1.4;
          color: rgba(122, 35, 51, 0.7);
          text-decoration: none;
        }

        .pr-toc a:hover {
          color: var(--pr-burgundy, #7A2333);
          text-decoration: underline;
        }

        .pr-privacy-content {
          max-width: 68ch;
        }

        .pr-section {
          padding: 2rem 0;
          border-bottom: 1px solid rgba(122, 35, 51, 0.1);
        }

        .pr-section:first-child {
          padding-top: 0;
        }

        .pr-section:last-of-type {
          border-bottom: none;
        }

        .pr-section h2 {
          font-family: var(--pr-font-serif, 'Fraunces', serif);
          font-size: 1.5rem;
          margin: 0 0 1rem;
          color: var(--pr-burgundy, #7A2333);
          scroll-margin-top: 2rem;
        }

        .pr-section h3 {
          font-family: var(--pr-font-serif, 'Fraunces', serif);
          font-size: 1.1rem;
          margin: 1.5rem 0 0.75rem;
          color: var(--pr-burgundy, #7A2333);
        }

        .pr-section p {
          font-size: 0.98rem;
          line-height: 1.75;
          margin: 0 0 1rem;
          color: rgba(122, 35, 51, 0.88);
        }

        .pr-section ul {
          margin: 0 0 1.25rem;
          padding-left: 1.25rem;
        }

        .pr-section li {
          font-size: 0.98rem;
          line-height: 1.7;
          margin-bottom: 0.4rem;
          color: rgba(122, 35, 51, 0.88);
        }

        .pr-section a {
          color: var(--pr-burgundy, #7A2333);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .pr-contact-block {
          background: rgba(122, 35, 51, 0.05);
          border: 1px solid rgba(122, 35, 51, 0.12);
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          line-height: 1.7;
        }

        .pr-footer-nav {
          padding-top: 2rem;
        }

        .pr-footer-nav a {
          font-size: 0.95rem;
          color: var(--pr-burgundy, #7A2333);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 800px) {
          .pr-privacy-layout {
            grid-template-columns: 1fr;
          }

          .pr-toc {
            position: static;
            border-left: none;
            border-bottom: 1px solid rgba(122, 35, 51, 0.15);
            padding-left: 0;
            padding-bottom: 1.5rem;
          }
        }
      `}</style>
    </main>
  );
}