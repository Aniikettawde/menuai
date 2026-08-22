export default function AccountDeletionPage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
        color: "#222",
        lineHeight: 1.7,
      }}
    >
      <h1>Account & Data Deletion</h1>

      <p style={{ color: "#666" }}>
        Last updated: August 22, 2026
      </p>

      <section>
        <h2>1. Account Deletion</h2>

        <p>
          Dinezy allows users to permanently delete their account directly
          from the Dinezy application.
        </p>

        <p>To delete your Dinezy account:</p>

        <ol>
          <li>Open the Dinezy app.</li>
          <li>Go to <strong>Account</strong>.</li>
          <li>Open <strong>Settings</strong>.</li>
          <li>Select <strong>Delete Account</strong>.</li>
          <li>Confirm the account deletion.</li>
        </ol>

        <p>
          Once confirmed, your account and associated personal data will be
          scheduled for deletion from Dinezy systems, subject to legal and
          security retention requirements.
        </p>
      </section>

      <section>
        <h2>2. What Data Is Deleted?</h2>

        <p>
          When you delete your Dinezy account, we delete or remove data
          associated with your account, including where applicable:
        </p>

        <ul>
          <li>Account and profile information</li>
          <li>Uploaded videos and user-generated content</li>
          <li>Account activity associated with your profile</li>
          <li>Saved account information</li>
        </ul>
      </section>

      <section>
        <h2>3. Delete Individual Videos</h2>

        <p>
          Users can also delete individual uploaded videos without deleting
          their entire Dinezy account.
        </p>

        <p>To delete an uploaded video:</p>

        <ol>
          <li>Open the Dinezy app.</li>
          <li>Go to <strong>Account</strong>.</li>
          <li>Select the video you uploaded.</li>
          <li>Select <strong>Delete</strong>.</li>
          <li>Confirm the deletion.</li>
        </ol>

        <p>
          After deletion, the selected video will be removed from Dinezy and
          will no longer be available as user-generated content, subject to
          normal technical processing and applicable legal requirements.
        </p>
      </section>

      <section>
        <h2>4. Data Retention</h2>

        <p>
          Certain information may be retained when required by law or when
          reasonably necessary for security, fraud prevention, dispute
          resolution, accounting, or regulatory purposes.
        </p>

        <p>
          Backups may also temporarily contain deleted information until they
          are securely overwritten according to our normal retention
          procedures.
        </p>
      </section>

      <section>
        <h2>5. Unable to Delete Your Account?</h2>

        <p>
          If you cannot access your account or cannot complete the deletion
          process through the Dinezy application, please contact Dinezy for
          assistance.
        </p>

        <p>
          Website:{" "}
          <a
            href="https://dinezy.in"
            target="_blank"
            rel="noopener noreferrer"
          >
            dinezy.in
          </a>
        </p>
      </section>

      <section>
        <h2>6. User Control</h2>

        <p>
          Dinezy provides users with control over their account and
          user-generated content. Users can either delete individual uploaded
          videos or permanently delete their complete Dinezy account.
        </p>

        <p>
          Account deletion is available from:
        </p>

        <p>
          <strong>Account → Settings → Delete Account</strong>
        </p>
      </section>
    </main>
  );
}